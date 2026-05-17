import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpotAuth } from '../../src/core/SpotAuth.js';

function makeStore(tokenData = null) {
  return {
    get: vi.fn().mockResolvedValue(tokenData),
    set: vi.fn(),
    clear: vi.fn(),
  };
}

function makeToken(overrides = {}) {
  return {
    access_token: 'valid_token',
    refresh_token: 'refresh_token',
    expires_at: Date.now() + 30 * 60 * 1000, // 30 min from now
    created_at: Date.now(),
    ...overrides,
  };
}

class TestSpotAuth extends SpotAuth {
  constructor(config, store) {
    super(config, store);
    this._doRefresh = vi.fn().mockResolvedValue('refreshed_token');
    this._authenticate = vi.fn().mockResolvedValue('new_token');
  }
}

describe('SpotAuth.getAccessToken', () => {
  it('returns cached token when valid', async () => {
    const token = makeToken();
    const auth = new TestSpotAuth({}, makeStore(token));
    const result = await auth.getAccessToken();
    expect(result).toBe('valid_token');
    expect(auth._authenticate).not.toHaveBeenCalled();
    expect(auth._doRefresh).not.toHaveBeenCalled();
  });

  it('calls _doRefresh when token is expired but refresh_token exists', async () => {
    const expired = makeToken({ expires_at: Date.now() - 1000 });
    const auth = new TestSpotAuth({}, makeStore(expired));
    await auth.getAccessToken();
    expect(auth._doRefresh).toHaveBeenCalledWith('refresh_token', expired);
    expect(auth._authenticate).not.toHaveBeenCalled();
  });

  it('calls _authenticate when no token exists', async () => {
    const auth = new TestSpotAuth({}, makeStore(null));
    await auth.getAccessToken();
    expect(auth._authenticate).toHaveBeenCalled();
    expect(auth._doRefresh).not.toHaveBeenCalled();
  });

  it('calls _authenticate when token is expired and has no refresh_token', async () => {
    const expired = makeToken({ expires_at: Date.now() - 1000, refresh_token: null });
    const auth = new TestSpotAuth({}, makeStore(expired));
    await auth.getAccessToken();
    expect(auth._authenticate).toHaveBeenCalled();
  });

  it('deduplicates concurrent refresh calls — only one _doRefresh in-flight', async () => {
    const expired = makeToken({ expires_at: Date.now() - 1000 });
    const auth = new TestSpotAuth({}, makeStore(expired));

    // Simulate concurrent calls
    const [r1, r2, r3] = await Promise.all([
      auth.getAccessToken(),
      auth.getAccessToken(),
      auth.getAccessToken(),
    ]);

    expect(auth._doRefresh).toHaveBeenCalledTimes(1);
    expect(r1).toBe(r2);
    expect(r2).toBe(r3);
  });

  it('treats token as expired within the 5-minute buffer', async () => {
    // expires 4 minutes from now — within the 5-min buffer, so should refresh
    const almostExpired = makeToken({ expires_at: Date.now() + 4 * 60 * 1000 });
    const auth = new TestSpotAuth({}, makeStore(almostExpired));
    await auth.getAccessToken();
    expect(auth._doRefresh).toHaveBeenCalled();
  });
});
