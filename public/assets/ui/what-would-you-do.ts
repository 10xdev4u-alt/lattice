/**
 * "What would you do?" — a one-shot LLM prompt that reads the
 * current library and suggests the single most useful next move.
 * The user can dismiss or run the suggestion.
 *
 * Closes the polish item: a "what would you do?" prompt in the
 * empty state.
 */

import { getLibrary } from '../library';
import { getSession } from '../workflow-trail';
import { completePrompt } from '../llm';

export function mountWhatWouldYouDo(): void {
  const library = getLibrary();
  const session = getSession();
  const input = document.querySelector<HTMLInputElement>('[data-agent-input]');
  if (!input) return;
  const msg = library.length === 0
    ? 'No papers in your library yet. Click "Load sample library" first, then come back.'
    : `Your library has ${library.length} paper${library.length === 1 ? '' : 's'}. Last session: ${session.steps.length} tool call${session.steps.length === 1 ? '' : 's'}.`;

  void completePrompt(
    `You are a friendly research assistant. Look at the user's library and recent activity and suggest one specific next action in a single sentence. Don't be generic. Be concrete.\n\nLibrary: ${library.map((p) => `${p.id}: ${p.title}`).join('; ')}\n\nRecent: ${session.steps.length} tool calls.\n\nUser prompt: ${msg}\n\nYour suggestion (1 sentence, 10-25 words):`,
    { signal: new AbortController().signal, maxTokens: 80, temperature: 0.7 },
  ).then((suggestion) => {
    const trimmed = suggestion.trim();
    if (trimmed) input.placeholder = trimmed;
  }).catch(() => {
    // keep the default placeholder
  });
}
