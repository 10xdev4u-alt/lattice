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

describe('CSP + COOP headers (server.mjs)', () => {
  it('webmcpHeaders sets CSP, COOP, and all WebMCP headers', async () => {
    const src = await import('node:fs').then((fs) => fs.readFileSync('server.mjs', 'utf8'));
    for (const header of [
      'Content-Security-Policy',
      'Cross-Origin-Opener-Policy',
      'Origin-Agent-Cluster',
      'Permissions-Policy',
      'X-Content-Type-Options',
      'X-Frame-Options',
      'Referrer-Policy',
      'Strict-Transport-Security',
    ]) {
      expect(src).toContain(`'${header}'`);
    }
    // The CSP must not allow remote scripts or object embedding.
    expect(src).toContain("script-src 'self'");
    expect(src).toContain("object-src 'none'");
    // connect-src keeps https: so WebLLM model downloads work.
    expect(src).toContain("connect-src 'self' https: wss:");
  });

  it('no inline <script> blocks remain in the HTML shells (CSP-safe)', async () => {
    const fs = await import('node:fs');
    for (const page of ['public/index.html', 'public/share.html']) {
      const html = fs.readFileSync(page, 'utf8');
      // Inline scripts (non-module, no src) are CSP violations.
      const inline = html.match(/<script>([\s\S]*?)<\/script>/g) ?? [];
      expect(inline, `${page} has ${inline.length} inline <script> blocks`).toEqual([]);
      expect(html).toContain('theme-guard.js');
    }
  });
});
