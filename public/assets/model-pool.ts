/**
 * The model pool — free-tier models rotate in and out without
 * notice. Re-probed 2026-09-02: ALL live models answer natively
 * WITH reasoning enabled — liquid 400s on reasoning:{enabled:false}
 * ("Reasoning is mandatory for this endpoint"), and inclusionai
 * puts the whole answer in message.reasoning with content:null.
 * The agent loop therefore sends no reasoning override and reads
 * content ?? reasoning (see messageText in agent-loop.ts).
 * tencent/hy3 dead, minimax 429, nvidia 18s — removed.
 *
 * Order = live latency rank. Consumers try in order; first
 * model that answers wins. LATTICE_LLM_MODEL override still
 * wins over everything.
 */

export const MODEL_POOL: readonly string[] = [
  "liquid/lfm-2.5-2.6b:free",
  "inclusionai/ling-3.0-flash-fin:free",
  "dots-studio/dots-3-note-preview:free",
  "stepfun/step-3.7-flash:free",
  "meituan/longcat-2.0-free",
  "openrouter/free",
  "cohere/north-mini-code:free",
];

export function modelOverride(): string | null {
  const v = (globalThis as { LATTICE_LLM_MODEL?: string }).LATTICE_LLM_MODEL;
  return typeof v === "string" && v.length > 0 ? v : null;
}

/** The pool order, override first when set. */
export function modelOrder(): string[] {
  const o = modelOverride();
  return o ? [o, ...MODEL_POOL.filter((m) => m !== o)] : [...MODEL_POOL];
}
