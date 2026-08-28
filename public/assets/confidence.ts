/**
 * Claim confidence — the LLM rates its own confidence in a claim
 * it just made. The user sees a small color dot beside every
 * agent message: green (high), yellow (mixed), red (speculative).
 *
 * The confidence is computed at message-append time by asking the
 * model to rate its own response on a 0.0–1.0 scale with a one-
 * word label. The result is stored in a session-scoped map so
 * the UI can render the dot.
 *
 * For the demo we don't re-call the LLM for every message (that
 * would double the cost). Instead we infer confidence from the
 * presence of citation chips, the use of "may" / "might" / "could",
 * and the length of the message. The LLM-rated version is the
 * next iteration.
 */

const STORAGE_KEY = 'lattice.confidence.v1';

export type Confidence = 'high' | 'mixed' | 'speculative';

export function getConfidence(messageId: string): Confidence | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const map = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, Confidence>;
    return map[messageId] ?? null;
  } catch {
    return null;
  }
}

export function setConfidence(messageId: string, confidence: Confidence): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const map = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, Confidence>;
    map[messageId] = confidence;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function inferConfidence(text: string): Confidence {
  const lower = text.toLowerCase();
  const hasCitation = /arxiv:[\w.-]+|pdf-[\w]+/.test(lower);
  const hasHedge = /\b(may|might|could|perhaps|possibly|likely|unlikely|seems|appears)\b/.test(lower);
  const hasNumbers = /\b\d+(\.\d+)?%?\b/.test(lower);
  if (hasCitation && hasNumbers && !hasHedge) return 'high';
  if (hasCitation || hasNumbers) return 'mixed';
  return 'speculative';
}

export function renderConfidenceDot(confidence: Confidence): string {
  const labels: Record<Confidence, string> = {
    high: 'High confidence (citations and numbers)',
    mixed: 'Mixed confidence (some citations, some hedging)',
    speculative: 'Speculative (no citations)',
  };
  return `<span class="confidence-dot confidence-${confidence}" title="${labels[confidence]}" aria-label="${labels[confidence]}"></span>`;
}
