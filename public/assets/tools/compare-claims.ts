/**
 * compare_claims — read tool (per-paper).
 *
 * Compare two open papers on a topic, returning agreements and conflicts
 * with sources. Requires two papers to be open; will be registered with
 * a per-paper tool variant when the second paper opens.
 *
 * For the scaffold we return a structured placeholder. The real impl
 * will pull page-level claims via extract_quote and use the LLM to
 * classify agree / conflict / mention.
 *
 * Closes: #14
 */

import type { ToolDefinition, ToolResult } from './types';
import { toolError } from './types';
import { getPaper } from '../library';

export const compareClaims: ToolDefinition = {
  name: 'compare_claims',
  description:
    'Compare the claims made by two open papers on a given topic. ' +
    'Returns 1-10 (claim, supporting quote, page, paper) tuples for agreements and conflicts.',
  inputSchema: {
    type: 'object',
    properties: {
      other_paper_id: {
        type: 'string',
        description: 'The ID of the second paper. The first is the one currently open.',
      },
      topic: {
        type: 'string',
        description: 'The topic to compare on, e.g. "RLHF safety", "scaling laws".',
      },
      max_claims: {
        type: 'integer',
        minimum: 1,
        maximum: 10,
        default: 5,
      },
    },
    required: ['other_paper_id', 'topic'],
    additionalProperties: false,
  },
  annotations: {
    readOnlyHint: true,
    untrustedContentHint: true,
  },
  async execute(args): Promise<ToolResult> {
    const { paper_id, other_paper_id, topic } = args as {
      paper_id: string;
      other_paper_id: string;
      topic: string;
    };
    const a = getPaper(paper_id);
    const b = getPaper(other_paper_id);
    if (!a || !b) {
      return toolError('PAPER_NOT_FOUND', 'One of the two papers is not in the library.', 'Call list_papers first.');
    }
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            paper_a: a.id,
            paper_b: b.id,
            topic,
            note: 'Claim extraction lands with the per-paper index (#47) and the LLM compare layer (#50).',
            agreements: [],
            conflicts: [],
          }),
        },
      ],
    };
  },
};
