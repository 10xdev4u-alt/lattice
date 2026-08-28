/**
 * peer_review_invite — write tool (per-paper).
 *
 * Invites a second agent (a peer-reviewer persona) into the page.
 * The cross-agent demo. For the scaffold we set a flag; the real
 * orchestration lives in `cross-agent.ts` and the persona prompt
 * lives in `netlify/functions/agents/peer-reviewer.ts`.
 *
 * Closes: #21
 */

import type { ToolDefinition, ToolResult } from './types';

export const peerReviewInvite: ToolDefinition = {
  name: 'peer_review_invite',
  description:
    "Invite the peer-reviewer agent into the current page. " +
    'After this call, a second agent has read access to the open paper and can ' +
    'challenge the primary agent\'s claims. Use for the cross-agent demo.',
  inputSchema: {
    type: 'object',
    properties: {
      persona: {
        type: 'string',
        enum: ['skeptic', 'methodologist', 'statistician', 'reviewer-2'],
        default: 'skeptic',
        description: 'The persona of the invited reviewer.',
      },
      scope: {
        type: 'string',
        enum: ['current_session', 'current_paper_only'],
        default: 'current_paper_only',
        description: 'How much of the page the reviewer can see.',
      },
    },
    additionalProperties: false,
  },
  annotations: {
    destructiveHint: false,
  },
  async execute(args): Promise<ToolResult> {
    const { persona = 'skeptic', scope = 'current_paper_only' } = args as {
      persona?: string;
      scope?: string;
    };
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            invited: true,
            persona,
            scope,
            note: 'Cross-agent orchestration lands with the cross-agent layer (#55) and the persona prompt (#56).',
          }),
        },
      ],
    };
  },
};
