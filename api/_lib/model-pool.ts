/**
 * Server model pool — free-tier models rotate out without
 * notice. On 2026-09-01 the pinned tencent/hy3:free began 404ing
 * upstream ("unavailable_model") and every server-side paper
 * tool (summarize, extract, compare, explain, both bibliography
 * tools) failed with 502 until the pin was changed by hand.
 *
 * completePrompt tries the pool in order; the first model that
 * answers wins. LATTICE_LLM_MODEL still wins over everything.
 */

const POOL: readonly string[] = [
  'kilo-auto/free',
  'tencent/hy3:free',
  'stepfun/step-3.7-flash:free',
  'inclusionai/ling-3.0-flash-fin:free',
];

/** The pool order, env override first when set. */
export function modelOrder(): string[] {
  const o = process.env.LATTICE_LLM_MODEL;
  return o ? [o, ...POOL.filter((m) => m !== o)] : [...POOL];
}
