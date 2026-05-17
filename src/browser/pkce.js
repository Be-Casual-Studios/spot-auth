/**
 * Generates a PKCE code_verifier and code_challenge pair.
 * Uses the Web Crypto API (available in all modern browsers and Node 19+).
 *
 * code_verifier: random 128-char URL-safe base64 string
 * code_challenge: base64url(SHA-256(code_verifier))
 */
export async function generatePKCE() {
  const array = new Uint8Array(96);
  crypto.getRandomValues(array);

  const codeVerifier = btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);

  const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return { codeVerifier, codeChallenge };
}
