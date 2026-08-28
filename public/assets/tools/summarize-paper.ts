/**
 * summarize_paper — read tool (per-paper).
 *
 * LLM-summarize the open paper at a given audience level. Returns prose
 * the model can relay to the user, not JSON. `untrustedContentHint` is
 * true because the summary may include phrases from the paper, which is
 * untrusted input by definition.
 *
 * Closes: #12
 */

import type { ToolDefinition, ToolResult } from './types';
import { getPaper } from '../library';
import { completePrompt } from '../llm';

export const summarizePaper: ToolDefinition = {
  name: 'summarize_paper',
  description:
    'Summarize the currently open paper at a chosen audience level. ' +
    'Returns 50-800 words of prose. Use when the user asks ' +
    "'what does this paper say?' or 'give me the TLDR for a non-expert'.",
  inputSchema: {
    type: 'object',
    properties: {
      audience: {
        type: 'string',
        enum: ['undergrad', 'grad', 'phd', 'lay'],
        description:
          'Audience level. Affects vocabulary and assumed background. ' +
          'undergrad: first-year student. grad: MS/PhD. phd: domain expert. lay: general public.',
      },
      max_words: {
        type: 'integer',
        minimum: 50,
        maximum: 800,
        default: 200,
        description: 'Approximate upper bound on summary length in words.',
      },
    },
    required: ['audience'],
    additionalProperties: false,
  },
  annotations: {
    readOnlyHint: true,
    untrustedContentHint: true,
  },
  async execute(args, opts): Promise<ToolResult> {
    const { paper_id, audience, max_words = 200 } = args as {
      paper_id: string;
      audience: 'undergrad' | 'grad' | 'phd' | 'lay';
      max_words?: number;
    };
    const paper = getPaper(paper_id);
    if (!paper) {
      return {
        content: [{ type: 'text', text: `Paper ${paper_id} not found.` }],
        isError: true,
      };
    }
    const prompt = `Summarize the paper "${paper.title}" by ${paper.authors
      .map((a) => `${a.given ?? ''} ${a.family}`.trim())
      .join(', ')} (${paper.year ?? 'n.d.'}) for a ${audience} audience in at most ${max_words} words. Abstract: ${paper.abstract ?? '(no abstract available)'.slice(0, 2000)}`;

    const summary = await completePrompt(prompt, { signal: opts.signal, maxTokens: Math.min(max_words * 2, 1500) });
    return {
      content: [{ type: 'text', text: summary }],
    };
  },
};
