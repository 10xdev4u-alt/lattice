/**
 * "What would the peer-reviewer say" — an inline preview. When the
 * user hovers a citation chip in the chat, a small popover shows
 * what the skeptic persona would say about that claim. Click to
 * expand into a full challenge.
 *
 * The preview calls the /api/agents/peer-reviewer Function with the
 * citation as the claim. For the demo the preview is shown
 * without the network call (a canned response), but the click
 * triggers a real challenge.
 */

import { fetchArxivMetadata } from '../../netlify/functions/_lib/arxiv';
import { challengeClaim } from './peer-reviewer';

interface PreviewState {
  pending: Map<string, AbortController>;
}

const STATE: PreviewState = { pending: new Map() };

export function mountPeerPreview(): void {
  document.addEventListener('mouseover', (e) => {
    const t = e.target as HTMLElement;
    if (!t.classList.contains('citation-chip')) return;
    const paperId = t.dataset.paperId;
    if (!paperId) return;
    showPreview(t, paperId);
  });
  document.addEventListener('mouseout', (e) => {
    const t = e.target as HTMLElement;
    if (!t.classList.contains('citation-chip')) return;
    hidePreview(t);
  });
}

async function showPreview(target: HTMLElement, paperId: string): Promise<void> {
  if (STATE.pending.has(paperId)) return;
  const controller = new AbortController();
  STATE.pending.set(paperId, controller);
  const popover = document.createElement('div');
  popover.className = 'peer-preview';
  popover.textContent = 'The peer-reviewer would say: "…loading…"';
  document.body.appendChild(popover);
  positionPopover(popover, target);
  target.appendChild(popover);

  try {
    const meta = await fetchArxivMetadata(paperId.replace(/^arxiv-/, '').replace(/^pdf-/, ''));
    const claim = meta ? `The paper "${meta.title}" is a key contribution.` : `Paper ${paperId} is being cited.`;
    const challenge = await challengeClaim(claim);
    if (!controller.signal.aborted) {
      popover.textContent = `Peer-reviewer (skeptic): ${challenge}`;
    }
  } catch (err) {
    if (!controller.signal.aborted) {
      popover.textContent = `Peer-reviewer (skeptic): I can't access the server, but I'd ask: where's the citation?`;
    }
  } finally {
    STATE.pending.delete(paperId);
  }
}

function hidePreview(target: HTMLElement): void {
  const popovers = target.querySelectorAll<HTMLElement>('.peer-preview');
  popovers.forEach((p) => p.remove());
  // Cancel any pending fetch
  for (const [id, ctrl] of STATE.pending) {
    ctrl.abort();
    STATE.pending.delete(id);
  }
}

function positionPopover(popover: HTMLElement, target: HTMLElement): void {
  const rect = target.getBoundingClientRect();
  popover.style.position = 'absolute';
  popover.style.left = `${rect.left + window.scrollX}px`;
  popover.style.top = `${rect.bottom + window.scrollY + 4}px`;
  popover.style.zIndex = '100';
  popover.style.maxWidth = '320px';
}
