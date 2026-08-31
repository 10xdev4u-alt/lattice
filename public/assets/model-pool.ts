/**
 * The model pool — free-tier models rotate in and out without
 * notice. On 2026-08-30 tencent/hy3:free began returning
 * "currently unavailable" and every chat died with a 502 until
 * the pin was changed by hand; a day later kilo-auto/free — the
 * replacement — did the same. Pinning does not survive the
 * free tier.
 *
 * Order below = a fresh liveness probe (2026-08-31, each
 * verified emitting a real tool call): every entry was alive
 * AND tool-calling at probe time. Consumers try the pool in
 * order; the first model that answers wins. An explicit
 * override (settings, env) still wins over everything.
 */

export const MODEL_POOL: readonly string[] = [
  'dots-studio/dots-3-note-preview:free',
  'openrouter/free',
  'inclusionai/ling-3.0-flash-fin:free',
  'meituan/longcat-2.0-free',
  'kilo-auto/free',
  'tencent/hy3:free',
  'stepfun/step-3.7-flash:free',
];

/** The configured override, if any. */
export function modelOverride(): string | null {
  const v = (globalThis as { LATTICE_LLM_MODEL?: string }).LATTICE_LLM_MODEL;
  return typeof v === 'string' && v.length > 0 ? v : null;
}

/** The pool order, override first when set. */
export function modelOrder(): string[] {
  const o = modelOverride();
  return o ? [o, ...MODEL_POOL.filter((m) => m !== o)] : [...MODEL_POOL];
}
