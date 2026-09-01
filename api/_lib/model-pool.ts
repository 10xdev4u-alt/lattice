/**
 * Server model pool — free-tier models rotate out without
 * notice. Probed 2026-09-01: liquid 925ms TOOL fastest,
 * inclusionai 1422ms, dots-studio 1630ms. tencent/hy3 dead,
 * minimax 429, nvidia 18s — removed. kilo-auto router removed.
 *
 * completePrompt tries the pool in order; the first model that
 * answers wins. LATTICE_LLM_MODEL still wins over everything.
 */

const POOL: readonly string[] = [
  "liquid/lfm-2.5-2.6b:free",
  "inclusionai/ling-3.0-flash-fin:free",
  "dots-studio/dots-3-note-preview:free",
  "stepfun/step-3.7-flash:free",
  "meituan/longcat-2.0-free",
  "openrouter/free",
  "cohere/north-mini-code:free",
];

/** The pool order, env override first when set. */
export function modelOrder(): string[] {
  const o = process.env.LATTICE_LLM_MODEL;
  return o ? [o, ...POOL.filter((m) => m !== o)] : [...POOL];
}
