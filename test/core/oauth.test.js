import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildAuthUrl, exchangeCode, refreshAccessToken, normalizeTokenData } from '../../src/core/oauth.js';

describe('buildAuthUrl', () => {
  it('returns a valid Spotify authorize URL', () => {
    const url = buildAuthUrl({
      clientId: 'abc123',
      scope: 'playlist-read-private',
      redirectUri: 'http://localhost:3000/callback',
      state: 'xyz',
    });
    expect(url).toMatch(/^https:\/\/accounts\.spotify\.com\/authorize\?/);
    expect(url).toContain('client_id=abc123');
    expect(url).toContain('response_type=code');
    expect(url).toContain('redirect_uri=');
    expect(url).toContain('state=xyz');
  });

  it('includes PKCE params when codeChallenge is provided', () => {
    const url = buildAuthUrl({
      clientId: 'abc123',
      scope: 'user-read-email',
      redirectUri: 'http://localhost:3000/callback',
      state: 'xyz',
      codeChallenge: 'challenge_value',
    });
    expect(url).toContain('code_challenge=challenge_value');
    expect(url).toContain('code_challenge_method=S256');
  });

  it('omits PKCE params when codeChallenge is not provided', () => {
    const url = buildAuthUrl({
      clientId: 'abc123',
      scope: 'user-read-email',
      redirectUri: 'http://localhost:3000/callback',
      state: 'xyz',
    });
    expect(url).not.toContain('code_challenge');
    expect(url).not.toContain('code_challenge_method');
  });
});

describe('normalizeTokenData', () => {
  it('returns the correct token shape', () => {
    const before = Date.now();
    const result = normalizeTokenData({
      access_token: 'access_abc',
      refresh_token: 'refresh_xyz',
      expires_in: 3600,
    });
    const after = Date.now();

    expect(result.access_token).toBe('access_abc');
    expect(result.refresh_token).toBe('refresh_xyz');
    expect(result.expires_at).toBeGreaterThanOrEqual(before + 3600 * 1000);
    expect(result.expires_at).toBeLessThanOrEqual(after + 3600 * 1000);
    expect(result.created_at).toBeGreaterThanOrEqual(before);
  });

  it('falls back to existingRefreshToken when response omits refresh_token', () => {
    const result = normalizeTokenData(
      { access_token: 'access_abc', expires_in: 3600 },
      'existing_refresh'
    );
    expect(result.refresh_token).toBe('existing_refresh');
  });

  it('prefers the response refresh_token over the existing one', () => {
    const result = normalizeTokenData(
      { access_token: 'access_abc', refresh_token: 'new_refresh', expires_in: 3600 },
      'old_refresh'
    );
    expect(result.refresh_token).toBe('new_refresh');
  });
});

describe('exchangeCode', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('uses Basic auth header for Authorization Code flow (with clientSecret)', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'tok', refresh_token: 'ref', expires_in: 3600 }),
    });

    await exchangeCode({
      clientId: 'id',
      clientSecret: 'secret',
      code: 'code123',
      redirectUri: 'http://localhost:3000/callback',
    });

    const [, options] = fetch.mock.calls[0];
    expect(options.headers['Authorization']).toMatch(/^Basic /);
    const decoded = atob(options.headers['Authorization'].replace('Basic ', ''));
    expect(decoded).toBe('id:secret');
    expect(options.body.toString()).not.toContain('code_verifier');
  });

  it('uses code_verifier for PKCE flow (no clientSecret)', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'tok', refresh_token: 'ref', expires_in: 3600 }),
    });

    await exchangeCode({
      clientId: 'id',
      code: 'code123',
      redirectUri: 'http://localhost:3000/callback',
      codeVerifier: 'verifier_abc',
    });

    const [, options] = fetch.mock.calls[0];
    expect(options.headers['Authorization']).toBeUndefined();
    expect(options.body.toString()).toContain('code_verifier=verifier_abc');
    expect(options.body.toString()).toContain('client_id=id');
  });

  it('throws on non-ok response', async () => {
    fetch.mockResolvedValue({ ok: false, status: 400, text: async () => 'bad_request' });
    await expect(exchangeCode({ clientId: 'id', code: 'x', redirectUri: 'y' }))
      .rejects.toThrow('Token exchange failed (400)');
  });
});

describe('refreshAccessToken', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('sends Basic auth when clientSecret is provided (Node flow)', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'new_tok', expires_in: 3600 }),
    });

    await refreshAccessToken({ clientId: 'id', clientSecret: 'secret', refreshToken: 'ref' });

    const [, options] = fetch.mock.calls[0];
    expect(options.headers['Authorization']).toMatch(/^Basic /);
  });

  it('omits Authorization header for PKCE flow (no clientSecret)', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'new_tok', expires_in: 3600 }),
    });

    await refreshAccessToken({ clientId: 'id', refreshToken: 'ref' });

    const [, options] = fetch.mock.calls[0];
    expect(options.headers['Authorization']).toBeUndefined();
  });

  it('throws on non-ok response', async () => {
    fetch.mockResolvedValue({ ok: false, status: 401, text: async () => 'invalid_token' });
    await expect(refreshAccessToken({ clientId: 'id', refreshToken: 'ref' }))
      .rejects.toThrow('Token refresh failed (401)');
  });
});
