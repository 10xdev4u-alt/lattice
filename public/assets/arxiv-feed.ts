/**
 * arXiv feed — render the saved-searches panel as a live feed.
 * The feed surfaces the latest arXiv papers for each saved search.
 * For the demo we reuse the saved-searches panel so the user can
 * both save new searches and see the latest results in one place.
 *
 * The panel mounts into its own overlay — never directly into a
 * host that already holds app content (calling this with
 * document.body used to wipe the whole workspace).
 */

import { mountSavedSearchesPanel } from './arxiv-saved-searches';

export function mountArxivFeed(_host: HTMLElement): Promise<void> {
  const overlay = document.createElement('div');
  overlay.className = 'kg-overlay';
  overlay.innerHTML = `
    <div class="kg-modal feed-modal" role="dialog" aria-modal="true">
      <button data-action="close" type="button">Close</button>
      <div data-feed-host style="min-height: 60vh; max-height: 75vh; overflow: auto"></div>
    </div>
  `;
  overlay.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.dataset.action === 'close' || t === overlay) overlay.remove();
  });
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') overlay.remove();
  });
  document.body.appendChild(overlay);
  const inner = overlay.querySelector<HTMLElement>('[data-feed-host]');
  if (inner) void mountSavedSearchesPanel(inner);
  return Promise.resolve();
}
