/**
 * Excerpt windows over extracted paper text.
 *
 * arXiv LaTeX dumps are stored as one long text. Feeding the
 * model only the first ~1.5k chars samples the tar header
 * neighborhood — the intro — and misses the substance, so
 * compare/summarize/extract come back empty. Take a head window
 * plus a middle window to cover methods/results sections.
 */

import type { PageText } from './search-index';

const HEAD_CHARS = 4000;
const MID_CHARS = 3000;

/** Total chars the excerpt will span (upper bound). */
export const EXCERPT_BUDGET = HEAD_CHARS + MID_CHARS + 200;

export function excerptWindows(pages: PageText[], label: string): string {
  const text = pages.map((p) => p.text).join('\n');
  const firstPage = pages[0]?.page_number ?? 1;
  const head = text.slice(0, HEAD_CHARS);
  let out = `--- ${label} page ${firstPage} ---\n${head}`;
  if (text.length > HEAD_CHARS + MID_CHARS * 2) {
    const midStart = Math.floor((text.length - MID_CHARS) / 2);
    out += `\n--- ${label} page ${firstPage} (middle) ---\n${text.slice(midStart, midStart + MID_CHARS)}`;
  }
  return out;
}
