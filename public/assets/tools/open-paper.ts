/**
 * open_paper — action tool.
 *
 * Opens a paper by library ID. Re-registers a set of per-paper tools
 * (compare_claims, extract_quote, summarize_paper, explain_evidence,
 * peer_review_invite) scoped to the now-open paper. Aborts the
 * previously-open paper's tools via AbortController.
 *
 * Closes: #10
 */

import type { ToolDefinition, ToolResult } from './types';
import { toolError } from './types';
import { getModelContext } from '../model-context-polyfill';
import { getPaper } from '../library';
import { registerPerPaperTools } from './per-paper';

export const openPaper: ToolDefinition = {
  name: 'open_paper',
  description:
    "Open a paper by its library ID. After calling, per-paper tools become available " +
    '(summarize_paper, extract_quote, compare_claims, explain_evidence, peer_review_invite). ' +
    'Use list_papers first to see valid IDs. Returns the paper metadata.',
  inputSchema: {
    type: 'object',
    properties: {
      paper_id: {
        type: 'string',
        description: 'The library ID of the paper to open, from list_papers.',
      },
    },
    required: ['paper_id'],
    additionalProperties: false,
  },
  annotations: {
    // Opening a paper only registers its per-paper tools —
    // nothing is written or deleted — so it runs without the
    // write-tool confirmation modal.
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
  },
  async execute(args, opts): Promise<ToolResult> {
    const { paper_id } = (args ?? {}) as { paper_id?: string };
    if (!paper_id) {
      return toolError(
        'MISSING_ARG',
        'open_paper requires a paper_id argument.',
        'Call list_papers first to see valid IDs.',
      );
    }
    const paper = getPaper(paper_id);
    if (!paper) {
      return toolError(
        'PAPER_NOT_FOUND',
        `No paper in the library with id "${paper_id}".`,
        'Call list_papers to see available papers.',
      );
    }

    const ctx = getModelContext();
    try {
      await registerPerPaperTools(paper.id, ctx, opts.signal);
    } catch (err) {
      return toolError(
        'REGISTRATION_FAILED',
        `Failed to register per-paper tools: ${(err as Error).message}`,
        'Try again or check the browser console.',
      );
    }

    // The canvas follows the agent: when open_paper runs (from
    // the chat, a judge's agent, or the UI), the reading surface
    // swaps to this paper so human and machine stay in sync.
    document.dispatchEvent(
      new CustomEvent('lattice:paper-opened', { detail: { paper_id: paper.id } }),
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            opened: paper.id,
            title: paper.title,
            authors: paper.authors,
            year: paper.year,
            doi: paper.doi,
            arxiv: paper.arxivId,
            tools_now_available: [
              'summarize_paper',
              'extract_quote',
              'compare_claims',
              'explain_evidence',
              'peer_review_invite',
            ],
          }),
        },
      ],
    };
  }
}
