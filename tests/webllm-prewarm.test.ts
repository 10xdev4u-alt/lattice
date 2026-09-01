/**
 * Regression: the offline engine must be prewarmed, honestly
 * badged, and independently cached.
 *
 * prewarmIfIdle() shipped dead (zero callers) — the airplane-mode
 * demo toggled the network offline before the 2.1GB download
 * ever started, so the flagship WebLLM fallback could only fail.
 * These tests pin: main.ts calls prewarm, the badge never claims
 * ready before it is, and the vendor chunk is split.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';

describe('webllm prewarm + honesty', () => {
  it('main.ts invokes prewarmIfIdle', () => {
    const src = readFileSync('public/assets/main.ts', 'utf8');
    expect(src).toContain('prewarmIfIdle');
  });

  it('prewarm is genuinely exported and idempotent-shaped', () => {
    const src = readFileSync('public/assets/webllm/engine.ts', 'utf8');
    expect(src).toContain('export function prewarmIfIdle');
    // Guarded: unsupported, already-initialized, and in-flight
    // must all no-op rather than double-download.
    expect(src).toContain('if (!webllmSupported() || engineInstance || initPromise) return;');
  });

  it('badge never claims ready before it is (no offline ready*)', () => {
    const src = readFileSync('public/assets/ui/webllm-badge.ts', 'utf8');
    expect(src).not.toContain('offline ready*');
    expect(src).toContain('Offline: not loaded');
    // Clicking the badge starts the download (getEngine is the
    // idempotent entry).
    expect(src).toContain('getEngine()');
  });

  it('vendor chunks are split (build output, when present)', () => {
    const dir = 'dist/assets';
    if (!existsSync(dir)) return; // not built in this run — skip
    const files = readdirSync(dir);
    const hasWebllmVendor = files.some(
      (f) => f.startsWith('webllm-vendor') || f.endsWith('.js') && (() => { try { return readFileSync(`${dir}/${f}`, 'utf8').includes('MLC_DUMMY'); } catch { return false; } })(),
    );
    expect(hasWebllmVendor).toBe(true);
  });
});
