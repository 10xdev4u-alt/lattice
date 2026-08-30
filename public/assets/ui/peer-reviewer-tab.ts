/**
 * Peer-reviewer tab — a per-claim review panel in the stats
 * overlay. For each paper in the library, show the skeptic
 * persona's challenge on the paper's central claim, cached so we
 * don't re-fetch on every open.
 *
 * Closes the polish item: a peer-reviewer tab in the stats panel.
 */

import { getLibrary } from '../library';
import { challengeClaim, type Persona } from './peer-reviewer';

const CACHE_KEY = 'lattice.peer-reviewer-cache.v1';

interface CachedReview {
  paperId: string;
  persona: Persona;
  claim: string;
  challenge: string;
  at: string;
}

function readCache(): CachedReview[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '[]') as CachedReview[];
  } catch {
    return [];
  }
}

function writeCache(list: CachedReview[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(CACHE_KEY, JSON.stringify(list));
}

export function mountPeerReviewerTab(host: HTMLElement, persona: Persona = 'skeptic'): void {
  const library = getLibrary();
  if (library.length === 0) {
    host.innerHTML = '<p class="canvas-empty">No papers in the library yet.</p>';
    return;
  }
  const cached = readCache();
  host.innerHTML = `
    <h3>Peer review (${persona})</h3>
    <p class="canvas-empty">The ${persona} persona's challenge for each paper's central claim. Cached locally so we don't re-fetch on every open.</p>
    <ul class="peer-reviewer-list">
      ${library
        .map((p) => {
          const hit = cached.find((c) => c.paperId === p.id && c.persona === persona);
          return `
            <li class="peer-reviewer-row" data-paper-id="${escapeHtml(p.id)}">
              <div class="peer-reviewer-title">${escapeHtml(p.title.slice(0, 70))}${p.title.length > 70 ? '…' : ''}</div>
              <div class="peer-reviewer-challenge" data-challenge-for="${escapeHtml(p.id)}">${hit ? escapeHtml(hit.challenge) : '<em>Not reviewed yet. Click "Review all".</em>'}</div>
            </li>
          `;
        })
        .join('')}
    </ul>
    <button data-action="review-all" class="peer-reviewer-run">Review all (${library.length})</button>
  `;
  host.querySelector<HTMLButtonElement>('[data-action="review-all"]')?.addEventListener('click', async () => {
    const btn = host.querySelector<HTMLButtonElement>('[data-action="review-all"]');
    if (!btn) return;
    btn.disabled = true;
    btn.textContent = 'Reviewing…';
    const next: CachedReview[] = [...cached];
    for (const p of library) {
      const claim = `The paper "${p.title}" is a key contribution.`;
      try {
        const challenge = await challengeClaim(claim);
        const el = host.querySelector<HTMLElement>(`[data-challenge-for="${CSS.escape(p.id)}"]`);
        if (el) el.textContent = challenge;
        next.push({ paperId: p.id, persona, claim, challenge, at: new Date().toISOString() });
      } catch {
        // skip on failure
      }
    }
    writeCache(next);
    btn.disabled = false;
    btn.textContent = 'Review all again';
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
