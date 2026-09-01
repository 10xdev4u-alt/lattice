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

    // Prefer the server endpoint: it summarizes the full extracted
    // text (not just the abstract) and returns the model's answer
    // with page citations and a confidence rating. Fall back to
    // offline WebLLM when the gateway 502s, then to abstract.
    try {
      const res = await fetch('/api/papers/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paper_id: serverPaperId(paper.id), audience, max_words: max_words }),
        signal: opts.signal,
      });
      if (res.ok) {
        const data = (await res.json()) as {
          summary?: string;
          page_citations?: number[];
          confidence?: string;
        };
        if (data.summary && data.summary.trim() !== '') {
          const citations =
            data.page_citations && data.page_citations.length > 0
              ? ` (pages cited: ${data.page_citations.join(', ')})`
              : '';
          return {
            content: [
              {
                type: 'text',
                text: `${data.summary}${citations} [confidence: ${data.confidence ?? 'mixed'}]`,
              },
            ],
          };
        }
      }
    } catch {
      // fall through to offline fallback
    }

    // Offline fallback (WebLLM Phi-3-mini) — answers using the
    // abstract when the network is gone. The user can re-load the
    // paper text from a server endpoint when online.
    try {
      const { offlineCompleteAsTool } = await import('../webllm/fallback');
      const result = await offlineCompleteAsTool({
        context: paper.abstract ?? '(no abstract available)',
        instruction: `Summarize this paper for a ${audience} audience in at most ${max_words} words.`,
        system: 'You are a research assistant. Use plain prose; cite concepts not sources.',
        maxTokens: Math.min(800, Math.ceil(max_words * 2)),
        signal: opts.signal,
      });
      if (!result.isError) return result;
    } catch {
      // webllm unsupported — fall through to abstract
    }

    const abstract = paper.abstract ?? '(no abstract available)';
    return {
      content: [
        {
          type: 'text',
          text: `${paper.title} (${paper.year ?? 'n.d.'}) by ${paper.authors
            .map((a) => `${a.given ?? ''} ${a.family}`.trim())
            .join(', ')}. Abstract: ${abstract.slice(0, 2000)}`,
        },
      ],
    };
  },
};

// Library-id → server-store-id. The sample papers use
// "arxiv:1706.03762"; ingested records use "arxiv-170603762v7"
// (dots stripped, version suffix — the store lookup tolerates
// both because arXiv ids are digit-unique either way).
function serverPaperId(id: string): string {
  if (id.startsWith('arxiv:')) {
    const digits = id.slice(6).replace(/[^0-9]/g, '');
    return `arxiv-${digits}`;
  }
  return id;
}
