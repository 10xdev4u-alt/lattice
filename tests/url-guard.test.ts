/**
 * SSRF url-guard tests.
 *
 * The guard backs every outbound server fetch: http/https only,
 * and the destination host must not resolve to localhost,
 * loopback, link-local, private, or reserved ranges.
 */

import { describe, expect, it } from 'vitest';
import { assertUrlAllowed, safeFetch, UrlNotAllowedError } from '../api/_lib/url-guard';

describe('assertUrlAllowed', () => {
  it('allows a public https URL', async () => {
    await expect(assertUrlAllowed('https://arxiv.org/e-print/1706.03762')).resolves.toBeInstanceOf(URL);
  });

  it('allows a public http URL', async () => {
    await expect(assertUrlAllowed('http://export.arxiv.org/api/query')).resolves.toBeInstanceOf(URL);
  });

  it('rejects non-http protocols', async () => {
    await expect(assertUrlAllowed('file:///etc/passwd')).rejects.toBeInstanceOf(UrlNotAllowedError);
    await expect(assertUrlAllowed('ftp://example.com/x')).rejects.toBeInstanceOf(UrlNotAllowedError);
  });

  it('rejects localhost hostnames', async () => {
    await expect(assertUrlAllowed('http://localhost:3000/api')).rejects.toBeInstanceOf(UrlNotAllowedError);
    await expect(assertUrlAllowed('http://api.localhost/v1')).rejects.toBeInstanceOf(UrlNotAllowedError);
    await expect(assertUrlAllowed('http://db.internal/v1')).rejects.toBeInstanceOf(UrlNotAllowedError);
  });

  it('rejects literal loopback IPs', async () => {
    await expect(assertUrlAllowed('http://127.0.0.1:8888/api/llm')).rejects.toBeInstanceOf(UrlNotAllowedError);
    await expect(assertUrlAllowed('http://0.0.0.0/')).rejects.toBeInstanceOf(UrlNotAllowedError);
  });

  it('rejects private ranges', async () => {
    for (const ip of ['10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1']) {
      await expect(assertUrlAllowed(`http://${ip}/metadata`)).rejects.toBeInstanceOf(UrlNotAllowedError);
    }
  });

  it('rejects multicast and reserved ranges', async () => {
    await expect(assertUrlAllowed('http://224.0.0.1/stream')).rejects.toBeInstanceOf(UrlNotAllowedError);
    await expect(assertUrlAllowed('http://0.0.0.1/x')).rejects.toBeInstanceOf(UrlNotAllowedError);
  });

  it('rejects IPv6 loopback and link-local', async () => {
    await expect(assertUrlAllowed('http://[::1]/x')).rejects.toBeInstanceOf(UrlNotAllowedError);
    await expect(assertUrlAllowed('http://[fe80::1]/x')).rejects.toBeInstanceOf(UrlNotAllowedError);
    await expect(assertUrlAllowed('http://[::ffff:127.0.0.1]/x')).rejects.toBeInstanceOf(
      UrlNotAllowedError,
    );
  });

  it('rejects garbage', async () => {
    await expect(assertUrlAllowed('not a url')).rejects.toBeInstanceOf(UrlNotAllowedError);
  });
});

describe('safeFetch', () => {
  it('throws UrlNotAllowedError for a blocked destination', async () => {
    await expect(safeFetch('http://localhost:9999/api/gateway/v1/chat/completions')).rejects.toBeInstanceOf(
      UrlNotAllowedError,
    );
  });

  it('does not send the request when blocked', async () => {
    let sent = false;
    const origFetch = globalThis.fetch;
    globalThis.fetch = (() => {
      sent = true;
      return Promise.resolve(new Response(''));
    }) as typeof fetch;
    try {
      await safeFetch('http://169.254.169.254/latest/meta-data');
      expect.unreachable();
    } catch {
      // expected
    } finally {
      globalThis.fetch = origFetch;
    }
    expect(sent).toBe(false);
  });
});
