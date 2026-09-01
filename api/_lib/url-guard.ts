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

export function isBlockedIp(ip: string): boolean {
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
  const v6 = normalizeIPv6(ip.toLowerCase());
  // After normalize, ::1 expands to '0000:0000:0000:0000:0000:0000:0000:0001'.
  if (v6 === '0000:0000:0000:0000:0000:0000:0000:0001') return true;
  if (v6 === '0000:0000:0000:0000:0000:0000:0000:0000') return true; // ::
  if (v6.startsWith('fe80:') || v6.startsWith('fc') || v6.startsWith('fd')) return true;
  // IPv4-mapped: any of the canonical short (::ffff:127.0.0.1),
  // the hex-halves form Node uses (::ffff:7f00:1), or the fully
  // expanded 0:0:0:0:0:ffff:7f00:0001 form (audit H2).
  // After normalizeIPv6, the last 4 groups are hi, lo, hi, lo when
  // it's the hex form, or 0:0:0:0:0:ffff:<hi>:<lo> for the dotted form.
  // Simplest robust check: if the address contains "ffff:" in the
  // last 4 groups, extract the two words and treat as IPv4.
  if (v6.includes('ffff:')) {
    const groups = v6.split(':');
    // Find the 'ffff' marker, then take the two words after it.
    const idx = groups.indexOf('ffff');
    if (idx !== -1 && groups.length >= idx + 3) {
      const hi = parseInt(groups[idx + 1] ?? '0', 16);
      const lo = parseInt(groups[idx + 2] ?? '0', 16);
      if (Number.isFinite(hi) && Number.isFinite(lo)) {
        const ipv4 = [(hi >> 8) & 0xff, hi & 0xff, (lo >> 8) & 0xff, lo & 0xff].join('.');
        return isBlockedIp(ipv4);
      }
    }
  }
  return false;
}

/** Expand shortened IPv6 to 8 colon-separated 16-bit words. Catches
 *  bypasses like 0:0:0:0:0:ffff:127.0.0.1 (audit H2). */
export function normalizeIPv6(ip: string): string {
  // Strip zone id (e.g., fe80::1%eth0)
  const zone = ip.indexOf('%');
  if (zone !== -1) ip = ip.slice(0, zone);
  // IPv4 in any form? Expand last two words to hex halves.
  const v4 = ip.match(/(.*:)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (v4) {
    const head = v4[1]!;
    const dotted = v4[2]!;
    const oct = dotted.split('.').map(Number);
    if (oct.length === 4 && oct.every((n) => n >= 0 && n <= 255)) {
      const hi = ((oct[0]! << 8) | oct[1]!).toString(16);
      const lo = ((oct[2]! << 8) | oct[3]!).toString(16);
      ip = `${head}${hi}:${lo}`;
    }
  }
  // Find :: and expand to required zeros
  const dbl = ip.indexOf('::');
  if (dbl === -1) {
    // Already full form — pad each segment to 4 hex chars.
    return ip.split(':').map((s) => s.padStart(4, '0')).join(':');
  }
  const [head, tail] = ip.split('::');
  const headParts = head ? head.split(':') : [];
  const tailParts = tail ? tail.split(':') : [];
  const missing = 8 - (headParts.length + tailParts.length);
  if (missing < 1) return ip; // malformed, leave as-is
  const zeros = Array(missing).fill('0000').join(':');
  const full = [headParts, zeros.split(':'), tailParts].flat();
  return full.map((s) => s.padStart(4, '0')).join(':');
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

/** fetch that refuses blocked destinations + blocks redirects
 *  (audit C3) so a 302 cannot pivot to 169.254.169.254. */
export async function safeFetch(raw: string, init?: RequestInit): Promise<Response> {
  const url = await assertUrlAllowed(raw);
  const res = await fetch(url, { ...init, redirect: 'manual' });
  if (res.status >= 300 && res.status < 400) {
    throw new UrlNotAllowedError(`redirect blocked: ${res.headers.get('location')}`);
  }
  return res;
}
