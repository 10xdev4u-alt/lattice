/**
 * SSRF guard for every outbound server-side request.
 *
 * Only http/https. The host is resolved and checked against
 * localhost, loopback, link-local, private, and reserved
 * ranges before the request goes out, so a poisoned
 * LATTICE_LLM_BASE (or any user-influenced URL) can't turn the
 * server into a probe of internal services.
 */

import { lookup } from 'node:dns/promises';

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

export class UrlNotAllowedError extends Error {
  constructor(url: string) {
    super(`URL not allowed: ${url}`);
    this.name = 'UrlNotAllowedError';
  }
}

function isBlockedIp(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length === 4 && parts.every((p) => Number.isInteger(p) && p >= 0 && p <= 255)) {
    const a = parts[0]!;
    const b = parts[1]!;
    if (a === 0 || a === 10 || a === 127) return true; // this-network, private, loopback
    if (a === 169 && b === 254) return true; // link-local (cloud metadata)
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT (Docker networks)
    if (a >= 224) return true; // multicast + reserved
    return false;
  }
  // IPv6
  const v6 = ip.toLowerCase();
  if (v6 === '::' || v6 === '::1') return true;
  if (v6.startsWith('fe80:') || v6.startsWith('fc') || v6.startsWith('fd')) return true;
  // IPv4-mapped, in either textual form: ::ffff:127.0.0.1 or the
  // hex-halves form Node canonicalizes to (::ffff:7f00:1).
  const mapped = v6.match(/^::ffff:(.+)$/);
  if (mapped) {
    const tail = mapped[1]!;
    if (tail.includes('.')) return isBlockedIp(tail);
    const words = tail.split(':').map((w) => parseInt(w || '0', 16));
    if (words.length === 2 && words.every((w) => Number.isInteger(w) && w >= 0 && w <= 0xffff)) {
      const ipv4 = [words[0]! >> 8, words[0]! & 0xff, words[1]! >> 8, words[1]! & 0xff].join('.');
      return isBlockedIp(ipv4);
    }
  }
  return false;
}

/**
 * Validate a URL for an outbound request. Throws
 * UrlNotAllowedError when the protocol isn't http/https or the
 * host resolves to a blocked address.
 */
export async function assertUrlAllowed(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UrlNotAllowedError(raw);
  }
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new UrlNotAllowedError(raw);
  }
  const { hostname } = url;
  if (
    hostname === 'localhost' ||
    hostname === '0.0.0.0' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.internal')
  ) {
    throw new UrlNotAllowedError(raw);
  }
  // Literal IP in the host? (IPv4 bare, IPv6 bracketed.)
  const bareHost = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(bareHost) || bareHost.includes(':')) {
    if (isBlockedIp(bareHost)) throw new UrlNotAllowedError(raw);
    return url;
  }
  // Hostname — resolve and check every address it maps to.
  try {
    const records = await lookup(hostname, { all: true });
    for (const { address } of records) {
      if (isBlockedIp(address)) throw new UrlNotAllowedError(raw);
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOTFOUND') throw err;
    throw err;
  }
  return url;
}

/** fetch that refuses blocked destinations. */
export async function safeFetch(raw: string, init?: RequestInit): Promise<Response> {
  const url = await assertUrlAllowed(raw);
  return fetch(url, init);
}
