/**
 * "Explain in 3 sentences" — a tool the user invokes from the paper
 * viewer to get a one-paragraph TL;DR. The constraint (exactly 3
 * sentences) is enforced by the prompt; the model has to be
 * ruthless about what makes the cut.
 *
 * The result lands in the chat and in the audit log. The user can
 * keep clicking the button to get a fresh take, or save the
 * current one as a highlight note.
 */

import { getPaper } from './library';
import { completePrompt } from './llm';
import { recordStep } from './workflow-trail';

export interface Explain3Options {
  paperId: string;
  signal: AbortSignal;
}

export async function explainIn3Sentences(opts: Explain3Options): Promise<string> {
  const paper = getPaper(opts.paperId);
  if (!paper) {
    throw new Error(`Paper ${opts.paperId} not in library.`);
  }
  const prompt = `Explain "${paper.title}" in exactly 3 sentences for a researcher who has 30 seconds. Be specific: what did they do, what did they find, why does it matter. Use the abstract for grounding.\n\nAbstract: ${(paper.abstract ?? 'No abstract available.').slice(0, 1500)}\n\nReturn JSON only:\n{"sentences": ["...", "...", "..."]}`;

  const start = performance.now();
  try {
    const reply = await completePrompt(prompt, {
      signal: opts.signal,
      maxTokens: 250,
      temperature: 0.3,
    });
    const startIdx = reply.indexOf('{');
    const endIdx = reply.lastIndexOf('}');
    let summary: string;
    if (startIdx !== -1 && endIdx > startIdx) {
      const parsed = JSON.parse(reply.slice(startIdx, endIdx + 1)) as { sentences: string[] };
      summary = parsed.sentences.filter((s) => s.trim().length > 0).join(' ');
    } else {
      summary = reply.trim();
    }
    recordStep({
      tool_name: 'explain_3_sentences',
      args: { paper_id: opts.paperId },
      result_summary: summary.slice(0, 500),
      result_full: { sentences: summary.split('. ') },
      duration_ms: Math.round(performance.now() - start),
      status: 'ok',
    });
    return summary;
  } catch (err) {
    recordStep({
      tool_name: 'explain_3_sentences',
      args: { paper_id: opts.paperId },
      result_summary: `error: ${(err as Error).message}`,
      result_full: { error: (err as Error).message },
      duration_ms: Math.round(performance.now() - start),
      status: 'err',
    });
    throw err;
  }
}
