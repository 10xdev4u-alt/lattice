/**
 * search_library — search tool.
 *
 * Full-text search across the user's library. Returns snippets with
 * paper_id, page, span. The result echoes the query so the model
 * knows what it asked for (per the secure-tools best-practices).
 *
 * For the demo, we use a simple per-paper substring scan. The real
 * implementation will use a per-paper inverted index (issue #47).
 *
 * Closes: #11
 */

import type { ToolDefinition, ToolResult } from './types';
import { toolError } from './types';
import { getLibrary } from '../library';

export const searchLibrary: ToolDefinition = {
  name: 'search_library',
  description:
    'Search the user\'s library of papers by free-text query. ' +
    'Returns up to N matches per paper with the matching snippet, paper ID, and page number. ' +
    'Useful when the user asks "find papers that mention X" or "where did the agent say Y?".',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description:
          'The search query. Free text or keywords. Examples: "self-consistency", ' +
          '"RLHF reward hacking", "RAG hallucination".',
      },
      max_results_per_paper: {
        type: 'integer',
        minimum: 1,
        maximum: 10,
        default: 3,
        description: 'Cap on matches per paper. Default 3.',
      },
    },
    required: ['query'],
    additionalProperties: false,
  },
  annotations: {
    readOnlyHint: true,
  },
  async execute(args): Promise<ToolResult> {
    const { query, max_results_per_paper = 3 } = (args ?? {}) as {
      query?: string;
      max_results_per_paper?: number;
    };
    if (!query || query.trim() === '') {
      return toolError('MISSING_ARG', 'search_library requires a non-empty query.', 'Ask the user what to search for.');
    }

    const library = getLibrary();
    const q = query.toLowerCase();
    const perPaper: Array<{ paper_id: string; hits: Array<{ page: number; snippet: string }> }> = [];
    let totalHits = 0;

    for (const paper of library) {
      // For the scaffold: scan the title and abstract. Real impl will hit the page index.
      const haystack = `${paper.title} ${paper.abstract ?? ''}`.toLowerCase();
      const hits: Array<{ page: number; snippet: string }> = [];
      let pos = 0;
      while (hits.length < max_results_per_paper) {
        const idx = haystack.indexOf(q, pos);
        if (idx === -1) break;
        const start = Math.max(0, idx - 60);
        const end = Math.min(haystack.length, idx + q.length + 60);
        hits.push({
          page: 1,
          snippet: haystack.slice(start, end).replace(/\s+/g, ' ').trim(),
        });
        pos = idx + q.length;
      }
      if (hits.length > 0) {
        perPaper.push({ paper_id: paper.id, hits });
        totalHits += hits.length;
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ query, total_hits: totalHits, per_paper: perPaper }),
        },
      ],
    };
  },
};
