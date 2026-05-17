import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileTokenStore } from '../../src/node/FileTokenStore.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

let tmpPath;
let store;

beforeEach(() => {
  tmpPath = path.join(os.tmpdir(), `spot-auth-test-${Date.now()}.json`);
  store = new FileTokenStore(tmpPath);
});

afterEach(() => {
  if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
});

const SAMPLE_TOKEN = {
  access_token: 'access_abc',
  refresh_token: 'refresh_xyz',
  expires_at: Date.now() + 3600 * 1000,
  created_at: Date.now(),
};

describe('FileTokenStore', () => {
  it('returns null when no file exists', () => {
    expect(store.get()).toBeNull();
  });

  it('writes and reads back a token', () => {
    store.set(SAMPLE_TOKEN);
    const result = store.get();
    expect(result.access_token).toBe('access_abc');
    expect(result.refresh_token).toBe('refresh_xyz');
  });

  it('returns null after clear()', () => {
    store.set(SAMPLE_TOKEN);
    store.clear();
    expect(store.get()).toBeNull();
    expect(fs.existsSync(tmpPath)).toBe(false);
  });

  it('overwrites an existing token on set()', () => {
    store.set(SAMPLE_TOKEN);
    store.set({ ...SAMPLE_TOKEN, access_token: 'updated_token' });
    expect(store.get().access_token).toBe('updated_token');
  });

  it('returns null gracefully when file contains corrupt JSON', () => {
    fs.writeFileSync(tmpPath, 'this is not json{{{');
    expect(store.get()).toBeNull();
  });

  it('writes valid JSON to disk', () => {
    store.set(SAMPLE_TOKEN);
    const raw = fs.readFileSync(tmpPath, 'utf8');
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it('clear() is non-fatal when file does not exist', () => {
    expect(() => store.clear()).not.toThrow();
  });
});
