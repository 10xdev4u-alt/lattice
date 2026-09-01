/**
 * The model pool — free-tier models rotate in and out without
 * notice. Probed 2026-09-01 via tool_choice tool-call (real
 * search_library schema): liquid 925ms TOOL fastest, inclusionai
 * 1422ms, dots-studio 1630ms, stepfun 1924ms. tencent/hy3 dead,
 * minimax 429 rate-limited, nvidia lightning 18s — all removed.
 * kilo-auto is a redundant router (2412ms) — removed.
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
