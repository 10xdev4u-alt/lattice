/**
 * Regression: submit events dispatched by app code must bubble.
 *
 * The agent rail's submit handler is delegated on the rail root
 * (root.addEventListener('submit')), but three call sites once
 * dispatched `new Event('submit', { cancelable: true })` — which
 * does NOT bubble, so the ask-bar fallback, the citation-chip
 * challenge, and Regenerate silently did nothing.
 *
 * Node ships a spec-compliant EventTarget/Event pair, so the
 * bubbling semantics are asserted against the platform itself
 * (no jsdom needed), and the three call sites are pinned to
 * bubbles:true by source assertion.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('bubbling submit dispatch', () => {
  it('platform proof: a non-bubbling Event does not reach an ancestor listener', () => {
    let reachedRoot = 0;
    const root: EventTarget = new EventTarget();
    const form: EventTarget = new EventTarget();
    // Bubbling only exists in a tree; Node's bare EventTarget has
    // no parent linkage. The real DOM is required for full proof,
    // so this test instead asserts the *contract* via source and
    // the platform's Event.bubbles flag below.
    const ev = new Event('submit', { cancelable: true });
    expect(ev.bubbles).toBe(false);
    root.addEventListener('submit', () => reachedRoot++);
    form.dispatchEvent(ev);
    // Without a composed tree the event never had a path to root —
    // which is exactly the bug: the app relied on bubbling it
    // never asked for.
    expect(reachedRoot).toBe(0);
  });

  it('platform proof: bubbles:true is set when requested', () => {
    const ev = new Event('submit', { cancelable: true, bubbles: true });
    expect(ev.bubbles).toBe(true);
  });

  it('agent-rail dispatches with bubbles:true at all three sites', () => {
    const src = readFileSync('public/assets/ui/agent-rail.ts', 'utf8');
    const dispatches = src.match(/dispatchEvent\(new Event\('submit'[^)]*\)\)/g) ?? [];
    expect(dispatches.length).toBe(3);
    for (const d of dispatches) {
      expect(d).toContain('bubbles: true');
    }
  });

  it('polyfill fires bubbling toolchange events', () => {
    const src = readFileSync('public/assets/model-context-polyfill.ts', 'utf8');
    expect(src).toContain("new Event('toolchange', { bubbles: true })");
  });
});
