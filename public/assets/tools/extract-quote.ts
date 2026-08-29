/**
 * extract_quote — read tool (per-paper).
 *
 * Pull a verbatim quote matching a concept from the open paper. For the
 * scaffold we return the closest match in the abstract. The real impl
 * will scan the full text with a per-page index.
 *
 * Closes: #13
 */

import type { ToolDefinition, ToolResult } from './types';
import { toolError } from './types';
import { getPaper } from '../library';

export const extractQuote: ToolDefinition = {
  name: 'extract_quote',
  description:
    'Extract a verbatim quote from the open paper that supports, refutes, ' +
    'or mentions a given concept. Returns 1-5 quotes with the matching page number.',
  inputSchema: {
    type: 'object',
    properties: {
      concept: {
        type: 'string',
        description: 'The concept to look for, e.g. "reward hacking", "RLHF failure modes".',
      },
      stance: {
        type: 'string',
        enum: ['supporting', 'refuting', 'mentioning', 'any'],
        default: 'any',
        description: 'How the quote should relate to the concept.',
      },
      max_quotes: {
        type: 'integer',
        minimum: 1,
        maximum: 5,
        default: 2,
      },
    },
    required: ['concept'],
    additionalProperties: false,
  },
  annotations: {
    readOnlyHint: true,
    untrustedContentHint: true,
  },
  async execute(args): Promise<ToolResult> {
    const { paper_id, concept } = args as {
      paper_id: string;
      concept: string;
      max_quotes?: number;
    };
    const paper = getPaper(paper_id);
    if (!paper) {
      return toolError('PAPER_NOT_FOUND', `Paper ${paper_id} not found.`, 'Call list_papers first.');
    }
    // Scaffold: real impl will scan the per-page index.
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            paper_id,
            concept,
            note: 'Full-text quote extraction lands with the per-paper index (#47).',
            quotes: [],
          }),
        },
      ],
    };
  },
};
