/**
 * Share-by-URL — round-trip encryption tests.
 *
 * Covers the bug class: encrypt() returning a Promise cast to a
 * string so the URL was "[object Promise]". After the fix:
 *   - encryptAsync returns a versioned base64url envelope
 *   - decryptAsync recovers the plaintext with the right passphrase
 *   - a wrong passphrase fails closed
 *   - non-encrypted fragments still round-trip
 */
import { describe, expect, it } from 'vitest';
import { encryptAsync, decryptAsync } from '../public/assets/share';

describe('share — encryption round-trip', () => {
  it('encrypts and decrypts with the right passphrase', async () => {
    const plaintext = JSON.stringify({ steps: [{ tool_name: 'list_papers', args: {} }] });
    const enc = await encryptAsync(plaintext, 'correct horse battery staple');
    expect(enc).toMatch(/^v1\.[A-Za-z0-9_-]+$/);
    const dec = await decryptAsync(enc, 'correct horse battery staple');
    expect(dec).toBe(plaintext);
  });

  it('fails closed with a wrong passphrase', async () => {
    const enc = await encryptAsync('secret payload', 'right');
    const dec = await decryptAsync(enc, 'wrong');
    expect(dec).toBeNull();
  });

  it('rejects a non-versioned fragment', async () => {
    const dec = await decryptAsync('plain-base64-no-version', 'whatever');
    expect(dec).toBeNull();
  });

  it('produces a different ciphertext on each call (random salt+iv)', async () => {
    const a = await encryptAsync('same', 'pass');
    const b = await encryptAsync('same', 'pass');
    expect(a).not.toBe(b);
    expect(await decryptAsync(a, 'pass')).toBe('same');
    expect(await decryptAsync(b, 'pass')).toBe('same');
  });

  it('handles large payloads without truncation', async () => {
    const big = 'x'.repeat(100_000);
    const enc = await encryptAsync(big, 'p');
    const dec = await decryptAsync(enc, 'p');
    expect(dec).toBe(big);
  });
});
