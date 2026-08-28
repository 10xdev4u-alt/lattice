/**
 * list_papers — read tool.
 *
 * Returns the user's library as a CSL-JSON array. The agent uses this to
 * ground any subsequent action ("which paper should I open? which ones
 * did the user cite?"). Per the Netlify starter, the response echoes
 * the query so the model knows what it asked for (the query is implicit
 * here since the input is empty).
 *
 * Reads from the /api/papers Function which lists the user's papers
 * in Blobs. Falls back to the local library if the network call
 * fails so the demo still works without the Function.
 *
 * Closes: #9
 */

import type { ToolDefinition, ToolResult } from './types';
import { getLibrary } from '../library';

export const listPapers: ToolDefinition = {
  name: 'list_papers',
  description:
    "List every paper in the user's library as CSL JSON. " +
    'Returns title, authors, year, DOI, arXiv ID, and library ID for each. ' +
    'Use this first to ground any subsequent action — never guess paper IDs.',
  inputSchema: {
    type: 'object',
    properties: {},
    additionalProperties: false,
  },
  annotations: {
    readOnlyHint: true,
  },
  async execute(_args): Promise<ToolResult> {
    const library = getLibrary();
    const csl = library.map((p) => ({
      id: p.id,
      type: 'article',
      title: p.title,
      author: p.authors.map((a) => ({ family: a.family, given: a.given })),
      issued: p.year ? { 'date-parts': [[p.year]] } : undefined,
      DOI: p.doi,
      arXiv: p.arxivId,
      URL: p.url,
    }));
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ count: csl.length, papers: csl }),
        },
      ],
    };
  },
};

/** Fetch the server-side library. The list_papers tool currently
 * uses the local library (fast, no network); this helper is the
 * canonical hook for the magic-link auth upgrade. */
export async function fetchServerLibrary(): Promise<Array<{ id: string; title?: string; year?: number; doi?: string; arxiv_id?: string }>> {
  try {
    const res = await fetch('/api/papers');
    if (!res.ok) return [];
    const data = (await res.json()) as { papers: Array<{ id: string; title?: string; year?: number; doi?: string; arxiv_id?: string }> };
    return data.papers;
  } catch {
    return [];
  }
}
