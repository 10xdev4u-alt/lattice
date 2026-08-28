/**
 * explain_evidence — read tool (global).
 *
 * For a given claim, list every paper in the library that supports or
 * refutes it, with verbatim quotes. The headline "show your work" tool
 * that turns the library into an evidence map.
 *
 * Calls the /api/papers/explain Function which reads each paper's
 * text.json, ranks the most relevant, and returns the evidence map.
 * Falls back to a local stub if the network call fails.
 *
 * Closes #15.
 */

import type { ToolDefinition, ToolResult } from './types';
import { toolError } from './types';

export const explainEvidence: ToolDefinition = {
  name: 'explain_evidence',
  description:
    "For a given claim, list every paper in the user's library that supports, " +
    'refutes, or mentions it, with verbatim quotes. ' +
    'Use when the user asks "what is the evidence for X?" or "does any paper I have support this?".',
  inputSchema: {
    type: 'object',
    properties: {
      claim: {
        type: 'string',
        description: 'The claim to investigate, as a full sentence.',
      },
      max_papers: {
        type: 'integer',
        minimum: 1,
        maximum: 10,
        default: 5,
      },
    },
    required: ['claim'],
    additionalProperties: false,
  },
  annotations: {
    readOnlyHint: true,
    untrustedContentHint: true,
  },
  async execute(args): Promise<ToolResult> {
    const { claim, max_papers = 5 } = args as { claim: string; max_papers?: number };
    if (!claim) {
      return toolError('MISSING_ARG', 'explain_evidence requires a claim.', 'Ask the user what claim to investigate.');
    }

    try {
      const res = await fetch('/api/papers/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claim, max_papers }),
      });
      if (res.ok) {
        const data = (await res.json()) as { claim: string; evidence: Array<{ paper_id: string; stance: string; quote: string; page: number; score: number }> };
        return { content: [{ type: 'text', text: JSON.stringify(data) }] };
      }
    } catch {
      // fall through to local note
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            claim,
            evidence: [],
            note: 'Search backend unavailable; no evidence returned.',
          }),
        },
      ],
    };
  },
};

