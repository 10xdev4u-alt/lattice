/**
 * Trail instrumentation — the spec's 1.5K output budget.
 *
 * The clamp is the contract: what the agent RECEIVES from any
 * tool never exceeds TOOL_CHAR_LIMITS.outputSize; the audit trail
 * keeps the full record. Over-budget results carry a pointer to
 * the full record via show_workflow_trail.
 *
 * The wrapper touches three browser globals (performance,
 * document, and the trail's localStorage). Node has none of
 * them, so each is stubbed minimally here — the test targets the
 * clamp logic, not the storage.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { TOOL_CHAR_LIMITS } from '../public/assets/tools/types';

// A localStorage-shaped scratch store.
class ScratchStore {
  private data = new Map<string, string>();
  getItem(k: string): string | null {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.data.set(k, v);
  }
  removeItem(k: string): void {
    this.data.delete(k);
  }
}

const store = new ScratchStore();
const recorded: Array<Record<string, unknown>> = [];

const g = globalThis as unknown as Record<string, unknown>;
g.localStorage = store;
g.performance = { now: () => 0 };
g.document = {
  dispatchEvent: (): void => undefined,
};
g.CustomEvent = class {
  constructor(
    public type: string,
    public detail?: unknown,
  ) {}
};

// The trail module reads localStorage at import time; import after stubs.
const { instrument } = await import('../public/assets/tools/trail-instrumentation');
const { getSession } = await import('../public/assets/workflow-trail');

describe('instrument output clamp', () => {
  beforeEach(() => {
    store.removeItem('lattice.workflow-trail.v1');
    recorded.length = 0;
  });

  it('passes a within-budget result through untouched', async () => {
    const short = { content: [{ type: 'text', text: 'a small answer' }] };
    const wrapped = instrument('t_pass', async () => short);
    const out = (await wrapped({}, { signal: new AbortController().signal })) as typeof short;
    expect(out).toEqual(short);
  });

  it('clamps a text result to the budget and notes the truncation', async () => {
    const longText = 'x'.repeat(TOOL_CHAR_LIMITS.outputSize * 3);
    const wrapped = instrument('t_long', async () => ({ content: [{ type: 'text', text: longText }] }));
    const out = (await wrapped({}, { signal: new AbortController().signal })) as {
      content: Array<{ type: string; text: string }>;
    };
    const text = out.content[0]!.text;
    expect(text.length).toBeLessThanOrEqual(TOOL_CHAR_LIMITS.outputSize);
    expect(text).toContain('truncated');
    expect(text).toContain('show_workflow_trail');
  });

  it('keeps the full record in the trail while clamping what the agent sees', async () => {
    const longText = 'y'.repeat(TOOL_CHAR_LIMITS.outputSize * 2);
    const wrapped = instrument('t_full', async () => ({ content: [{ type: 'text', text: longText }] }));
    const agentSaw = (await wrapped({}, { signal: new AbortController().signal })) as {
      content: Array<{ text: string }>;
    };
    expect(agentSaw.content[0]!.text.length).toBeLessThanOrEqual(TOOL_CHAR_LIMITS.outputSize);
    const steps = getSession().steps;
    expect(steps.length).toBeGreaterThan(0);
    const last = steps[steps.length - 1] as unknown as {
      result_summary: string;
      result_full: { content: Array<{ text: string }> };
    };
    expect(last.result_summary.length).toBeLessThanOrEqual(TOOL_CHAR_LIMITS.outputSize);
    expect(last.result_full.content[0]!.text).toBe(longText);
  });

  it('clamps plain string results too', async () => {
    const long = 'z'.repeat(TOOL_CHAR_LIMITS.outputSize + 500);
    const wrapped = instrument('t_str', async () => long);
    const out = await wrapped({}, { signal: new AbortController().signal });
    expect(String(out).length).toBeLessThanOrEqual(TOOL_CHAR_LIMITS.outputSize);
    expect(String(out)).toContain('truncated');
  });
});
