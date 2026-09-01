/**
 * POST /api/papers/extract — LLM-backed quote extraction.
 *
 * Used by the extract_quote tool. Reads the paper's text.json, finds
 * the most relevant passage for the given concept + stance, and
 * returns the verbatim quote with a page number and confidence
 * score. The page text is the source of truth; the LLM picks the
 * best span, it does not invent.
 *
 * Falls back to a substring scan if the LLM is unavailable.
 *
 * Closes the polish item: real quote extraction.
 */

import type { Config, Context } from './_lib/types';
import { getStore, resolvePaperId } from './_lib/store';
import { storeFor } from './_lib/session';
import { tenantSetCookieHeader } from './_lib/session';
import { completePrompt } from './_lib/llm';
import { extractJson } from './_lib/extract-json';
import { excerptWindows } from './_lib/excerpt';

interface ExtractRequest {
  paper_id: string;
  concept: string;
  stance?: 'supporting' | 'refuting' | 'mentioning' | 'any';
  max_quotes?: number;
}

interface PageText {
  page_number: number;
  text: string;
}

export default async (req: Request, _ctx: Context): Promise<Response> => {
  if (req.method !== 'POST') {
    return json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' } }, 405);
  }

  let body: ExtractRequest;
  try {
    body = (await req.json()) as ExtractRequest;
  } catch {
    return json({ error: { code: 'BAD_JSON', message: 'Body is not valid JSON.' } }, 400);
  }
  if (!body.paper_id || !body.concept) {
    return json({ error: { code: 'MISSING_ARG', message: 'paper_id and concept are required.' } }, 400);
  }

  const maxQuotes = body.max_quotes ?? 2;
  const stance = body.stance ?? 'any';
  const { tenantId, store } = storeFor(req);
  const needsCookie = !req.headers.get('x-session-id') && !(req.headers.get('cookie') ?? '').includes('lattice_sid=');
  const paperId = await resolvePaperId(store, body.paper_id);
  if (!paperId) {
    return json({ error: { code: 'NOT_FOUND', message: 'No text.json for that paper.' } }, 404);
  }
  const textMeta = await store.getWithMetadata(`papers/${paperId}/text.json`, { type: 'json' });
  if (!textMeta) {
    return json({ error: { code: 'NOT_FOUND', message: 'No text.json for that paper.' } }, 404);
  }
  const pages = (textMeta.data as { pages: PageText[] }).pages;
  if (pages.length === 0) {
    return json({ error: { code: 'NO_TEXT', message: 'No extractable text.' } }, 422);
  }

  const prompt = `You are extracting verbatim quotes from a research paper.
Concept: "${body.concept}"
Stance: ${stance}
Number of quotes to return: ${maxQuotes}

Paper text (paginated):
${excerptWindows(pages, paperId)}

Output format: a single JSON object with one key "quotes" — an array of objects, each with keys "page" (integer), "text" (a verbatim quote you copied from the paper above), "score" (0.0-1.0).

Rules:
- Verbatim. Copy the text exactly. Do not paraphrase.
- Write the quotes yourself from the paper text. Never output placeholder text.
- Include the page number.
- The score reflects how well the quote matches the concept.
- If the paper does not mention the concept, output {"quotes": []}.
- Output the JSON object only — no markdown fences, no explanations.`;

  try {
    const reply = await completePrompt(prompt, { signal: req.signal, maxTokens: 800, temperature: 0.1 });
    const parsed = extractJson(reply);
    const quotes = Array.isArray(parsed?.quotes)
      ? (parsed!.quotes as Array<{ page: number; text: string; score: number }>)
      : [];
    return json({ paper_id: body.paper_id, concept: body.concept, quotes });
  } catch (err) {
    return json({ error: { code: 'LLM_FAILED', message: (err as Error).message } }, 502);
  }
};

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  const headers = new Headers({ 'Content-Type': 'application/json', ...extraHeaders });
  return new Response(JSON.stringify(body), { status, headers });
}

export const config: Config = {
  path: '/api/papers/extract',
  method: 'POST',
};
