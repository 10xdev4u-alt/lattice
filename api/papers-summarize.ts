/**
 * POST /api/papers/summarize — LLM-backed paper summary.
 *
 * Used by summarize_paper. Reads the paper's text.json, takes the
 * first ~3000 chars of the body (or the abstract if present), and
 * sends them to the LLM with the audience prompt. Returns prose
 * the model can relay to the user, with a citation of which page(s)
 * the summary drew on.
 *
 * Closes the polish item: real summary endpoint.
 */

import type { Config, Context } from './_lib/types';
import { resolvePaperId } from './_lib/store';
import { storeFor } from './_lib/session';
import { completePrompt } from './_lib/llm';
import { extractJson } from './_lib/extract-json';
import { excerptWindows } from './_lib/excerpt';

interface SummarizeRequest {
  paper_id: string;
  audience: 'undergrad' | 'grad' | 'phd' | 'lay';
  max_words?: number;
}

interface PageText {
  page_number: number;
  text: string;
}

const AUDIENCE_PROMPTS: Record<string, string> = {
  undergrad: 'a first-year undergraduate student with no prior exposure to the field',
  grad: 'a graduate student in the field',
  phd: 'a domain expert',
  lay: 'a curious general reader with no technical background',
};

export default async (req: Request, _ctx: Context): Promise<Response> => {
  if (req.method !== 'POST') {
    return json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' } }, 405);
  }

  let body: SummarizeRequest;
  try {
    body = (await req.json()) as SummarizeRequest;
  } catch {
    return json({ error: { code: 'BAD_JSON', message: 'Body is not valid JSON.' } }, 400);
  }
  if (!body.paper_id || !body.audience) {
    return json({ error: { code: 'MISSING_ARG', message: 'paper_id and audience are required.' } }, 400);
  }

  const maxWords = body.max_words ?? 200;
  const { store } = storeFor(req);
  // Library ids and ingest ids differ in version suffixes; match
  // on the digit core either way.
  const paperId = await resolvePaperId(store, body.paper_id);
  if (!paperId) {
    return json({ error: { code: 'NOT_FOUND', message: 'No text.json for that paper.' } }, 404);
  }
  const textMeta = await store.getWithMetadata(`papers/${paperId}/text.json`, { type: 'json' });
  if (!textMeta) {
    return json({ error: { code: 'NOT_FOUND', message: 'No text.json for that paper.' } }, 404);
  }
  const parsed = textMeta.data as { pages: PageText[] };
  const excerpt = excerptWindows(parsed.pages, paperId);

  const prompt = `Summarize the following paper for ${AUDIENCE_PROMPTS[body.audience]}. Stay under ${maxWords} words. Cite the page number for any specific claim.

Paper text:
${excerpt}

Output format: a single JSON object with three keys: "summary" (your ${maxWords}-word summary of the actual paper above), "page_citations" (array of page numbers you cited), "confidence" (one of "well-sourced", "mixed", or "speculative").

Rules:
- Write the summary yourself from the paper text. Never output placeholder text.
- "page_citations" values must be integers, e.g. [1, 3].
- Output the JSON object only — no markdown fences, no explanations.`;

  try {
    const reply = await completePrompt(prompt, {
      signal: req.signal,
      maxTokens: Math.min(maxWords * 3, 2000),
      temperature: 0.2,
    });
    const parsed = extractJson(reply);
    if (parsed) {
      const summary = typeof parsed.summary === 'string' ? parsed.summary : '';
      const pageCitations = Array.isArray(parsed.page_citations)
        ? parsed.page_citations.filter((n: unknown) => typeof n === 'number')
        : [];
      const confidence =
        parsed.confidence === 'well-sourced' || parsed.confidence === 'speculative'
          ? parsed.confidence
          : 'mixed';
      return json({
        paper_id: body.paper_id,
        audience: body.audience,
        summary,
        page_citations: pageCitations,
        confidence,
      });
    }
    // No JSON at all — treat the whole reply as the summary so
    // the user still gets the model's work.
    return json({
      paper_id: body.paper_id,
      audience: body.audience,
      summary: reply,
      page_citations: [],
      confidence: 'mixed',
    });
  } catch (err) {
    return json({ error: { code: 'LLM_FAILED', message: (err as Error).message } }, 502);
  }
};

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  const headers = new Headers({ 'Content-Type': 'application/json', ...extraHeaders });
  return new Response(JSON.stringify(body), { status, headers });
}

export const config: Config = {
  path: '/api/papers/summarize',
  method: 'POST',
};
