import { generatePKCE } from '../browser/pkce.js';
import { buildAuthUrl, exchangeCode, refreshAccessToken, normalizeTokenData } from '../core/oauth.js';
import { LocalStorageTokenStore } from '../browser/LocalStorageTokenStore.js';

const BUFFER_MS = 5 * 60 * 1000;
const store = new LocalStorageTokenStore();

// Holds a reference to the active <spot-auth-barrier> instance so getSpotToken()
// can refresh or trigger auth without the caller needing to pass config.
let _activeInstance = null;

/**
 * Returns a valid Spotify access token.
 * - If the cached token is still valid, returns it immediately.
 * - If expired but a refresh token exists, silently refreshes and returns the new token.
 * - If no token exists at all, triggers the full PKCE auth redirect (page navigates away).
 *
 * Requires a <spot-auth-barrier> element to be present in the DOM.
 *
 * @returns {Promise<string>}
 *
 * @example
 * const token = await getSpotToken();
 * const res = await fetch('https://api.spotify.com/v1/me', {
 *   headers: { Authorization: `Bearer ${token}` }
 * });
 */
export async function getSpotToken() {
  const tokenData = store.get();

  if (tokenData && Date.now() < tokenData.expires_at - BUFFER_MS) {
    return tokenData.access_token;
  }

  if (!_activeInstance) {
    throw new Error('spot-auth: getSpotToken() requires a <spot-auth-barrier> element in the DOM.');
  }

  if (tokenData?.refresh_token) {
    return _activeInstance._refreshAndReturn(tokenData);
  }

  // No token at all — trigger full auth (page redirects away, promise never resolves)
  await _activeInstance._triggerAuth();
}

/**
 * <spot-auth-barrier> web component.
 *
 * Hides its children until a valid Spotify token exists.
 * Handles the full PKCE auth flow, including detecting the callback URL.
 *
 * Dispatches a 'spot-auth-ready' CustomEvent on the element when auth is
 * confirmed, with `event.detail.accessToken` available.
 *
 * Attributes:
 *   client-id     (required) Spotify app client ID
 *   scope         (required) Space-separated Spotify scopes
 *   redirect-uri  (required) Must match a URI registered in your Spotify app
 *
 * Usage:
 *   <spot-auth-barrier
 *     client-id="..."
 *     scope="playlist-read-private user-library-read"
 *     redirect-uri="https://yourapp.com/auth/callback"
 *   >
 *     <div>Protected content</div>
 *   </spot-auth-barrier>
 */
class SpotAuthBarrier extends HTMLElement {
  connectedCallback() {
    _activeInstance = this;
    this.style.display = 'none';
    this._pendingRefresh = null;
    this._init();
  }

  disconnectedCallback() {
    if (_activeInstance === this) _activeInstance = null;
  }

  get _config() {
    return {
      clientId: this.getAttribute('client-id'),
      scope: this.getAttribute('scope'),
      redirectUri: this.getAttribute('redirect-uri'),
    };
  }

  _ready(accessToken) {
    this.style.display = '';
    this.dispatchEvent(new CustomEvent('spot-auth-ready', {
      bubbles: true,
      detail: { accessToken },
    }));
  }

  async _refreshAndReturn(cachedTokenData) {
    if (this._pendingRefresh) return this._pendingRefresh;

    this._pendingRefresh = refreshAccessToken({
      clientId: this._config.clientId,
      refreshToken: cachedTokenData.refresh_token,
    })
      .then(res => {
        const tokenData = normalizeTokenData(res, cachedTokenData.refresh_token);
        store.set(tokenData);
        return tokenData.access_token;
      })
      .catch(err => {
        store.clear();
        throw err;
      })
      .finally(() => { this._pendingRefresh = null; });

    return this._pendingRefresh;
  }

  async _init() {
    const params = new URLSearchParams(window.location.search);
    if (params.has('code') || params.has('error')) {
      await this._handleCallback(params);
      return;
    }

    const cached = store.get();

    if (cached && Date.now() < cached.expires_at - BUFFER_MS) {
      this._ready(cached.access_token);
      return;
    }

    if (cached?.refresh_token) {
      try {
        const accessToken = await this._refreshAndReturn(cached);
        this._ready(accessToken);
        return;
      } catch {
        // Fall through to full auth
      }
    }

    await this._triggerAuth();
  }

  async _triggerAuth() {
    const { codeVerifier, codeChallenge } = await generatePKCE();
    const state = Math.random().toString(36).substring(7);

    sessionStorage.setItem('spot_auth_verifier', codeVerifier);
    sessionStorage.setItem('spot_auth_state', state);
    localStorage.setItem('spot_auth_return_url', window.location.href);

    window.location.href = buildAuthUrl({ ...this._config, state, codeChallenge });
  }

  async _handleCallback(params) {
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');

    if (error) {
      console.error(`spot-auth: Spotify authorization error: ${error}`);
      return;
    }

    const storedState = sessionStorage.getItem('spot_auth_state');
    const codeVerifier = sessionStorage.getItem('spot_auth_verifier');
    const returnUrl = localStorage.getItem('spot_auth_return_url') || '/';

    if (state !== storedState) {
      console.error('spot-auth: state mismatch — possible CSRF. Aborting.');
      return;
    }

    sessionStorage.removeItem('spot_auth_state');
    sessionStorage.removeItem('spot_auth_verifier');
    localStorage.removeItem('spot_auth_return_url');

    try {
      const res = await exchangeCode({ ...this._config, code, codeVerifier });
      store.set(normalizeTokenData(res));
      window.location.replace(returnUrl);
    } catch (err) {
      console.error(`spot-auth: token exchange failed: ${err.message}`);
    }
  }
}

customElements.define('spot-auth-barrier', SpotAuthBarrier);
