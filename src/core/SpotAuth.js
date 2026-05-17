import { refreshAccessToken } from './oauth.js';

const BUFFER_MS = 5 * 60 * 1000; // refresh 5 min before expiry

export class SpotAuth {
  constructor(config, tokenStore) {
    this.config = {
      redirectUri: 'http://127.0.0.1:3000/callback',
      ...config,
    };
    this.store = tokenStore;
    this._pendingTokenRequest = null;
  }

  /**
   * Returns a valid access token. Handles caching, refresh, and full auth flow.
   * Safe to call concurrently — duplicate in-flight requests are deduplicated.
   */
  async getAccessToken() {
    const cached = await this.store.get();

    if (cached && !this._isExpired(cached)) {
      return cached.access_token;
    }

    if (cached?.refresh_token) {
      return this._refresh(cached.refresh_token, cached);
    }

    return this._authenticate();
  }

  /**
   * Refreshes the token, deduplicating concurrent calls so only one
   * request is made even if getAccessToken() is called multiple times simultaneously.
   */
  async _refresh(refreshToken, cachedTokenData) {
    if (this._pendingTokenRequest) return this._pendingTokenRequest;

    this._pendingTokenRequest = this._doRefresh(refreshToken, cachedTokenData)
      .finally(() => { this._pendingTokenRequest = null; });

    return this._pendingTokenRequest;
  }

  /**
   * Override in subclasses to implement environment-specific refresh logic.
   */
  async _doRefresh(_refreshToken, _cachedTokenData) {
    throw new Error('_doRefresh must be implemented by subclass');
  }

  /**
   * Override in subclasses to implement environment-specific full auth flow.
   */
  async _authenticate() {
    throw new Error('_authenticate must be implemented by subclass');
  }

  _isExpired(tokenData) {
    return Date.now() > (tokenData.expires_at - BUFFER_MS);
  }
}
