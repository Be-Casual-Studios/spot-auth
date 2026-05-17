// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageTokenStore } from '../../src/browser/LocalStorageTokenStore.js';

const store = new LocalStorageTokenStore();

const SAMPLE_TOKEN = {
  access_token: 'access_abc',
  refresh_token: 'refresh_xyz',
  expires_at: Date.now() + 3600 * 1000,
  created_at: Date.now(),
};

beforeEach(() => {
  localStorage.clear();
});

describe('LocalStorageTokenStore', () => {
  it('returns null when no token is stored', () => {
    expect(store.get()).toBeNull();
  });

  it('stores and retrieves a token', () => {
    store.set(SAMPLE_TOKEN);
    const result = store.get();
    expect(result.access_token).toBe('access_abc');
    expect(result.refresh_token).toBe('refresh_xyz');
  });

  it('returns null after clear()', () => {
    store.set(SAMPLE_TOKEN);
    store.clear();
    expect(store.get()).toBeNull();
  });

  it('overwrites an existing token on set()', () => {
    store.set(SAMPLE_TOKEN);
    store.set({ ...SAMPLE_TOKEN, access_token: 'new_access' });
    expect(store.get().access_token).toBe('new_access');
  });

  it('returns null gracefully when stored value is corrupt JSON', () => {
    localStorage.setItem('spot_auth_tokens', 'not-valid-json{{{');
    expect(store.get()).toBeNull();
  });
});
