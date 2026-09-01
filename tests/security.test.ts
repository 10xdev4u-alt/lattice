import { describe, it, expect } from 'vitest';
import { normalizeIPv6, isBlockedIp } from '../api/_lib/url-guard';

describe('security: IPv6 normalization + blocked IP', () => {
  it('expands ::1 to 0000:0000:0000:0000:0000:0000:0000:0001', () => {
    expect(normalizeIPv6('::1')).toBe('0000:0000:0000:0000:0000:0000:0000:0001');
  });
  it('expands 0:0:0:0:0:ffff:127.0.0.1 (H2 bypass) to mapped loopback', () => {
    const n = normalizeIPv6('0:0:0:0:0:ffff:127.0.0.1');
    expect(n).toBe('0000:0000:0000:0000:0000:ffff:7f00:0001');
  });
  it('blocks expanded form via isBlockedIp', () => {
    expect(isBlockedIp('0000:0000:0000:0000:0000:ffff:7f00:0001')).toBe(true);
  });
  it('blocks ::ffff:127.0.0.1 (audit H2 short form)', () => {
    expect(isBlockedIp('::ffff:127.0.0.1')).toBe(true);
  });
  it('blocks 169.254.169.254 (link-local cloud metadata)', () => {
    expect(isBlockedIp('169.254.169.254')).toBe(true);
  });
  it('allows public IPs', () => {
    expect(isBlockedIp('8.8.8.8')).toBe(false);
    expect(isBlockedIp('2606:4700:4700::1111')).toBe(false);
  });
});
