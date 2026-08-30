/**
 * LLM gateway base-URL resolution.
 *
 * The upstream destination must be one of a fixed set of
 * compile-time base URLs. LATTICE_LLM_BASE may select among
 * them — by exact string match only — but can never introduce a
 * URL the build didn't ship with. Anything unrecognized fails
 * closed, so the fetch target is a constant regardless of
 * environment or request input.
 */

export const ALLOWED_GATEWAY_BASES = [
  'https://api.kilo.ai/api/gateway/v1',
  'https://api.openai.com/v1',
  'https://api.anthropic.com/v1',
] as const;

export type GatewayBase = (typeof ALLOWED_GATEWAY_BASES)[number];

export const DEFAULT_GATEWAY_BASE: GatewayBase = ALLOWED_GATEWAY_BASES[0];

/**
 * Resolve the configured gateway base.
 *
 * - LATTICE_LLM_BASE unset → the default (kilo.ai).
 * - LATTICE_LLM_BASE exactly matches an allowed base → that base.
 * - Anything else → null. Callers must refuse the request.
 */
export function resolveGatewayBase(): GatewayBase | null {
  const configured = process.env.LATTICE_LLM_BASE;
  if (!configured) return DEFAULT_GATEWAY_BASE;
  const match = ALLOWED_GATEWAY_BASES.find((b) => b === configured);
  return (match as GatewayBase | undefined) ?? null;
}
