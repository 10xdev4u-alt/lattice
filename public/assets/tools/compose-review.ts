/**
 * compose_review — write tool.
 *
 * Drafts a structured peer review (summary, strengths, weaknesses, score)
 * of the open paper, grounded in the user's library. The draft lands in
 * a "Drafts" pane in the UI.
 *
 * Closes: #22
 */

import type { ToolDefinition, ToolResult } from './types';
import { getPaper } from '../library';
import { completePrompt } from '../llm';

export const composeReview: ToolDefinition = {
  name: 'compose_review',
  description:
    'Draft a structured peer review (summary, strengths, weaknesses, score) ' +
    "of the open paper, grounded in the user's library. " +
    'The draft is returned in the response and added to a Drafts pane in the UI.',
  inputSchema: {
    type: 'object',
    properties: {
      paper_id: {
        type: 'string',
        description: 'The paper to review.',
      },
      tone: {
        type: 'string',
        enum: ['constructive', 'critical', 'neutral'],
        default: 'constructive',
      },
      audience: {
        type: 'string',
        enum: ['author', 'editor', 'lab-meeting'],
        default: 'editor',
      },
    },
    required: ['paper_id'],
    additionalProperties: false,
  },
  annotations: {
    destructiveHint: false,
    openWorldHint: false,
  },
  async execute(args, opts): Promise<ToolResult> {
    const { paper_id, tone = 'constructive', audience = 'editor' } = args as {
      paper_id: string;
      tone?: string;
      audience?: string;
    };
    const paper = getPaper(paper_id);
    if (!paper) {
      return {
        content: [{ type: 'text', text: `Paper ${paper_id} not found.` }],
        isError: true,
      };
    }
    const prompt = `Draft a ${tone} peer review of "${paper.title}" for a ${audience} audience. Four sections: Summary, Strengths, Weaknesses, Score (1-10). Abstract for context: ${paper.abstract?.slice(0, 2000) ?? '(none)'.slice(0, 2000)}`;
    const draft = await completePrompt(prompt, { signal: opts.signal, maxTokens: 1500 });
    return {
      content: [{ type: 'text', text: draft }],
    };
  },
};
