import { useEffect, useState } from 'react';
import { useSpotAuth } from './SpotAuthContext.jsx';
import { exchangeCode, normalizeTokenData } from '../core/oauth.js';

/**
 * Base callback handler. Reads ?code= from the URL, exchanges it for tokens
 * via PKCE, saves to localStorage, then redirects to the original URL.
 *
 * @param {(url: string) => void} [onRedirect] - Override navigation (e.g. React Router's navigate()).
 *   Defaults to window.location.replace().
 */
export function SpotAuthCallbackBase({ onRedirect }) {
  const { clientId, redirectUri } = useSpotAuth();
  const [error, setError] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const errorParam = params.get('error');

    const storedState = sessionStorage.getItem('spot_auth_state');
    const codeVerifier = sessionStorage.getItem('spot_auth_verifier');
    const returnUrl = localStorage.getItem('spot_auth_return_url') || '/';

    if (errorParam) {
      setError(`Spotify authorization error: ${errorParam}`);
      return;
    }

    if (!code) {
      setError('No authorization code received.');
      return;
    }

    if (state !== storedState) {
      setError('State mismatch — possible CSRF attack. Please try again.');
      return;
    }

    // Clean up PKCE session state
    sessionStorage.removeItem('spot_auth_state');
    sessionStorage.removeItem('spot_auth_verifier');
    localStorage.removeItem('spot_auth_return_url');

    exchangeCode({ clientId, code, redirectUri, codeVerifier })
      .then(res => {
        const tokenData = normalizeTokenData(res);
        localStorage.setItem('spot_auth_tokens', JSON.stringify(tokenData));
        if (onRedirect) {
          onRedirect(returnUrl);
        } else {
          window.location.replace(returnUrl);
        }
      })
      .catch(err => setError(err.message));
  }, []);

  if (error) return <div>Authentication error: {error}</div>;
  return <div>Authenticating...</div>;
}

/**
 * Router-agnostic callback component. Mount this on your /auth/callback route.
 * Uses window.location.replace() to navigate back after auth.
 *
 * For React Router apps, import from 'spot-auth/react-router' instead.
 */
export function SpotAuthCallback() {
  return <SpotAuthCallbackBase />;
}
