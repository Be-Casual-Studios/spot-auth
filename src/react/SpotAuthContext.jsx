import { createContext, useContext, useState, useRef } from 'react';
import { LocalStorageTokenStore } from '../browser/LocalStorageTokenStore.js';
import { generatePKCE } from '../browser/pkce.js';
import { buildAuthUrl, refreshAccessToken, normalizeTokenData } from '../core/oauth.js';

const SpotAuthContext = createContext(null);
const BUFFER_MS = 5 * 60 * 1000;

function isExpired(tokenData) {
  return !tokenData || Date.now() > (tokenData.expires_at - BUFFER_MS);
}

export function SpotAuthProvider({ clientId, scope, redirectUri, children }) {
  const store = useRef(new LocalStorageTokenStore()).current;
  const [tokenData, setTokenData] = useState(() => store.get());
  const pendingRefresh = useRef(null);

  const doRefresh = async (refreshToken, existingTokenData) => {
    if (pendingRefresh.current) return pendingRefresh.current;

    pendingRefresh.current = refreshAccessToken({ clientId, refreshToken })
      .then(res => {
        const td = normalizeTokenData(res, existingTokenData?.refresh_token);
        store.set(td);
        setTokenData(td);
        return td;
      })
      .finally(() => { pendingRefresh.current = null; });

    return pendingRefresh.current;
  };

  /**
   * Returns a valid access token. Refreshes silently if expired.
   * Returns null if no token exists (SpotAuthBarrier handles triggering full auth).
   */
  const getAccessToken = async () => {
    const cached = store.get();
    if (cached && !isExpired(cached)) return cached.access_token;
    if (cached?.refresh_token) {
      const td = await doRefresh(cached.refresh_token, cached);
      return td.access_token;
    }
    return null;
  };

  /**
   * Saves current URL, generates PKCE params, redirects to Spotify auth.
   */
  const triggerAuth = async () => {
    const { codeVerifier, codeChallenge } = await generatePKCE();
    const state = Math.random().toString(36).substring(7);

    sessionStorage.setItem('spot_auth_verifier', codeVerifier);
    sessionStorage.setItem('spot_auth_state', state);
    localStorage.setItem('spot_auth_return_url', window.location.href);

    window.location.href = buildAuthUrl({ clientId, scope, redirectUri, state, codeChallenge });
  };

  const logout = () => {
    store.clear();
    setTokenData(null);
  };

  const isAuthenticated = !!tokenData && !isExpired(tokenData);

  return (
    <SpotAuthContext.Provider value={{
      tokenData,
      isAuthenticated,
      getAccessToken,
      triggerAuth,
      logout,
      clientId,
      redirectUri,
    }}>
      {children}
    </SpotAuthContext.Provider>
  );
}

export function useSpotAuth() {
  const ctx = useContext(SpotAuthContext);
  if (!ctx) throw new Error('useSpotAuth must be used within a SpotAuthProvider');
  return ctx;
}
