/**
 * arXiv feed — render the saved-searches panel as a live feed.
 * The feed surfaces the latest arXiv papers for each saved search.
 * For the demo we reuse the saved-searches panel so the user can
 * both save new searches and see the latest results in one place.
 */

import { mountSavedSearchesPanel } from './arxiv-saved-searches';

export function mountArxivFeed(root: HTMLElement): Promise<void> {
  root.innerHTML = '<div data-feed></div>';
  const inner = root.querySelector<HTMLElement>('[data-feed]');
  if (inner) mountSavedSearchesPanel(inner);
  return Promise.resolve();
}
