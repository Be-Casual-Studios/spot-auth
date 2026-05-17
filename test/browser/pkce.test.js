import { describe, it, expect } from 'vitest';
import { generatePKCE } from '../../src/browser/pkce.js';

describe('generatePKCE', () => {
  it('returns a codeVerifier and codeChallenge', async () => {
    const { codeVerifier, codeChallenge } = await generatePKCE();
    expect(typeof codeVerifier).toBe('string');
    expect(typeof codeChallenge).toBe('string');
  });

  it('codeVerifier is URL-safe base64 (no +, /, or = characters)', async () => {
    const { codeVerifier } = await generatePKCE();
    expect(codeVerifier).not.toMatch(/[+/=]/);
  });

  it('codeChallenge is URL-safe base64 (no +, /, or = characters)', async () => {
    const { codeChallenge } = await generatePKCE();
    expect(codeChallenge).not.toMatch(/[+/=]/);
  });

  it('codeVerifier is at least 43 characters (RFC 7636 minimum)', async () => {
    const { codeVerifier } = await generatePKCE();
    expect(codeVerifier.length).toBeGreaterThanOrEqual(43);
  });

  it('codeVerifier and codeChallenge are different values', async () => {
    const { codeVerifier, codeChallenge } = await generatePKCE();
    expect(codeVerifier).not.toBe(codeChallenge);
  });

  it('generates a different pair each call', async () => {
    const first = await generatePKCE();
    const second = await generatePKCE();
    expect(first.codeVerifier).not.toBe(second.codeVerifier);
    expect(first.codeChallenge).not.toBe(second.codeChallenge);
  });
});
