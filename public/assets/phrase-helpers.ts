// Phrase helpers for the ask bar: pure text parsing, no DOM.
// Substring matching (indexOf) — no regex needed for words.

function hasWord(lower: string, words: string[]): boolean {
  for (const w of words) {
    if (lower.indexOf(w) !== -1) return true;
  }
  return false;
}

/** The audience level named in a phrase (for summarize_paper). */
export function audienceOf(phrase: string): string {
  const lower = phrase.toLowerCase();
  if (hasWord(lower, ['lay', 'simple', 'non-expert', 'beginner'])) return 'lay';
  if (hasWord(lower, ['phd', 'expert'])) return 'phd';
  if (lower.indexOf('undergrad') !== -1) return 'undergrad';
  return 'grad';
}

/** The text after the word "about"; null when absent. */
export function tailOf(phrase: string): string | null {
  const at = phrase.toLowerCase().indexOf('about');
  if (at === -1) return null;
  const rest = phrase.slice(at + 5).trim();
  return rest.length > 0 ? rest : null;
}
