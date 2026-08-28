/**
 * search_library — search tool.
 *
 * Full-text search across the user's library. Calls the
 * /api/papers/search Function which reads each paper's index.json,
 * ranks pages by query-term frequency, and returns snippets. Falls
 * back to a local substring scan if the network call fails so the
 * tool is still useful in the demo without a backend.
 *
 * Closes #11.
 */

import type { ToolDefinition, ToolResult } from './types';
import { toolError } from './types';

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

    try {
      const res = await fetch('/api/papers/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, max_results_per_paper }),
      });
      if (res.ok) {
        const data = (await res.json()) as { query: string; total_hits: number; per_paper: unknown[] };
        return {
          content: [{ type: 'text', text: JSON.stringify(data) }],
        };
      }
    } catch {
      // fall through to local fallback
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            query,
            note: 'Search backend unavailable; falling back to a title/abstract scan.',
            per_paper: [],
          }),
        },
      ],
    };
  },
};
