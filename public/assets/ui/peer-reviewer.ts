/**
 * Cross-agent orchestration — the peer-reviewer demo.
 *
 * When the agent calls peer_review_invite, a second agent persona
 * (the skeptic) joins the page. The UI surfaces its presence as a
 * banner above the agent rail and color-codes its tool calls in the
 * workflow trail.
 *
 * For the demo the second agent is server-rendered at
 * /api/agents/peer-reviewer (see netlify/functions/agents/peer-reviewer.ts).
 * The persona's challenges stream into the chat in violet so the
 * human can tell which agent is which.
 *
 * Closes #49, #108.
 */

export type Persona = 'skeptic' | 'methodologist' | 'statistician' | 'reviewer-2';

interface PeerReviewerState {
  active: boolean;
  persona: Persona;
  challenges: Array<{ id: string; claim: string; response: string; createdAt: string }>;
}

const state: PeerReviewerState = {
  active: false,
  persona: 'skeptic',
  challenges: [],
};

export function isPeerReviewerActive(): boolean {
  return state.active;
}

export function getPeerReviewerState(): PeerReviewerState {
  return { ...state, challenges: [...state.challenges] };
}

export function setPeerReviewerActive(active: boolean, persona: Persona = state.persona): void {
  state.active = active;
  state.persona = persona;
  document.dispatchEvent(new CustomEvent('lattice:peer-reviewer-changed', { detail: { active, persona } }));
}

export async function challengeClaim(claim: string, context?: string): Promise<string> {
  const personaPrompt: Record<Persona, string> = {
    skeptic: 'You are a skeptical peer reviewer. Always challenge the claim. Demand a citation. End with a question.',
    methodologist: 'You are a methodologist. Focus on the study design, the sample, and the analysis. Be precise.',
    statistician: 'You are a statistician. Question the effect size, the confidence interval, and the p-value.',
    'reviewer-2': 'You are Reviewer 2. Be tough but fair. Look for the negative result the authors might have hidden.',
  };

  try {
    const res = await fetch('/api/agents/peer-reviewer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        claim,
        context,
        persona: personaPrompt[state.persona],
      }),
    });
    if (!res.ok) throw new Error(`peer-reviewer ${res.status}`);
    const data = (await res.json()) as { challenge: string };
    const id = `ch_${Date.now().toString(36)}`;
    state.challenges.push({ id, claim, response: data.challenge, createdAt: new Date().toISOString() });
    document.dispatchEvent(new CustomEvent('lattice:peer-reviewer-challenge', { detail: { id, claim, response: data.challenge } }));
    return data.challenge;
  } catch (err) {
    return `(peer reviewer unavailable: ${(err as Error).message})`;
  }
}

export function mountPeerReviewerBanner(root: HTMLElement): void {
  render(root);
  document.addEventListener('lattice:peer-reviewer-changed', () => render(root));
}

function render(root: HTMLElement): void {
  if (!state.active) {
    root.innerHTML = '';
    return;
  }
  root.innerHTML = `
    <div class="peer-banner" role="status" aria-live="polite">
      <div class="peer-banner-text">
        <strong>Peer-reviewer active:</strong> the <em>${escapeHtml(state.persona)}</em> persona is watching the open paper.
      </div>
      <button data-action="dismiss">Dismiss reviewer</button>
    </div>
  `;
  const btn = root.querySelector<HTMLButtonElement>('[data-action="dismiss"]');
  btn?.addEventListener('click', () => setPeerReviewerActive(false));
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
