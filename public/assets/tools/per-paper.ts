/**
 * Per-paper tool registration.
 *
 * The 5 tools that become available after `open_paper`:
 *   - summarize_paper
 *   - extract_quote
 *   - compare_claims
 *   - explain_evidence
 *   - peer_review_invite
 *
 * Each call to `open_paper` aborts the previous per-paper tools via
 * AbortController and registers a fresh set scoped to the new paper.
 * Closes the per-paper tool chain started by #10.
 */

import type { ToolDefinition } from './types';
import { getModelContext } from '../model-context-polyfill';
import { getPaper } from '../library';
import { summarizePaper } from './summarize-paper';
import { extractQuote } from './extract-quote';
import { compareClaims } from './compare-claims';
import { explainEvidence } from './explain-evidence';
import { peerReviewInvite } from './peer-review-invite';

let currentController: AbortController | null = null;

export async function registerPerPaperTools(
  paperId: string,
  ctx: ReturnType<typeof getModelContext>,
  parentSignal: AbortSignal,
): Promise<void> {
  // Abort the previous per-paper set
  currentController?.abort();
  const controller = new AbortController();
  currentController = controller;

  // Also abort when the parent signal aborts (e.g. SPA unmount)
  if (parentSignal.aborted) {
    controller.abort();
    return;
  }
  parentSignal.addEventListener('abort', () => controller.abort(), { once: true });

  const paper = getPaper(paperId);
  if (!paper) {
    throw new Error(`Paper not found: ${paperId}`);
  }

  // Per-paper tools are bound to the paper at registration time.
  // (The model can still pass paper_id in args, but the tool only
  // operates on this paper, which prevents cross-paper confusion.)
  const tools: ToolDefinition[] = [
    bindToPaper(summarizePaper, paperId),
    bindToPaper(extractQuote, paperId),
    bindToPaper(compareClaims, paperId),
    bindToPaper(explainEvidence, paperId),
    bindToPaper(peerReviewInvite, paperId),
  ];

  for (const tool of tools) {
    try {
      await ctx.registerTool(tool, { signal: controller.signal });
    } catch (err) {
      // Tool may already be registered (race with prior paper). Abort & retry.
      controller.abort();
      throw err;
    }
  }
}

function bindToPaper(tool: ToolDefinition, paperId: string): ToolDefinition {
  return {
    ...tool,
    execute: async (args, opts) =>
      tool.execute({ ...(args as object), paper_id: paperId }, opts),
  };
}
