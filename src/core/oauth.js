/**
 * Builds the Spotify authorization URL.
 * Used by both node (Authorization Code) and browser (PKCE) flows.
 */
export function buildAuthUrl({ clientId, scope, redirectUri, state, codeChallenge }) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope,
    redirect_uri: redirectUri,
    state,
    ...(codeChallenge && {
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
    }),
  });
  return `https://accounts.spotify.com/authorize?${params}`;
}

/**
 * Exchanges an authorization code for tokens.
 * - Node flow: pass clientSecret → uses Basic auth header
 * - PKCE flow: pass codeVerifier → uses client_id + verifier, no secret
 */
export async function exchangeCode({ clientId, clientSecret, code, redirectUri, codeVerifier }) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });

  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };

  if (codeVerifier) {
    // PKCE — no secret, verifier proves identity
    body.set('code_verifier', codeVerifier);
    body.set('client_id', clientId);
  } else {
    // Authorization Code — use Basic auth with client_secret
    headers['Authorization'] = `Basic ${btoa(`${clientId}:${clientSecret}`)}`;
  }

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    body,
    headers,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${err}`);
  }

  return res.json();
}

/**
 * Refreshes an access token.
 * - Node flow: pass clientSecret → uses Basic auth
 * - PKCE flow: pass only clientId → Spotify accepts without secret for PKCE tokens
 */
export async function refreshAccessToken({ clientId, clientSecret, refreshToken }) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
  });

  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };

  if (clientSecret) {
    headers['Authorization'] = `Basic ${btoa(`${clientId}:${clientSecret}`)}`;
  }

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    body,
    headers,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${err}`);
  }

  return res.json();
}

/**
 * Normalizes a Spotify token response into the shape used by token stores.
 * Accepts an optional existing refresh_token as fallback for PKCE rotating tokens
 * in case the response omits it (defensive).
 */
export function normalizeTokenData(response, existingRefreshToken = null) {
  return {
    access_token: response.access_token,
    refresh_token: response.refresh_token || existingRefreshToken,
    expires_at: Date.now() + (response.expires_in * 1000),
    created_at: Date.now(),
  };
}
