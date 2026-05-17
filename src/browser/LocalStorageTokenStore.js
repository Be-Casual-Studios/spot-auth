const KEY = 'spot_auth_tokens';

export class LocalStorageTokenStore {
  get() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  set(tokenData) {
    localStorage.setItem(KEY, JSON.stringify(tokenData));
  }

  clear() {
    localStorage.removeItem(KEY);
  }
}
