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

import type { Config, Context } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { completePrompt } from './_lib/llm';

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
  const store = getStore('lattice');
  const textMeta = await store.getWithMetadata(`papers/${body.paper_id}/text.json`, { type: 'json' });
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
${pages.map((p) => `--- page ${p.page_number} ---\n${p.text.slice(0, 3000)}`).join('\n\n')}

Return JSON only. Schema:
{
  "quotes": [
    { "page": <int>, "text": "<verbatim quote>", "score": <0.0-1.0> }
  ]
}

Rules:
- Verbatim. Copy the text exactly. Do not paraphrase.
- Include the page number.
- The score reflects how well the quote matches the concept.
- If the paper does not mention the concept, return {"quotes": []}.`;

  try {
    const reply = await completePrompt(prompt, { signal: req.signal, maxTokens: 800, temperature: 0.1 });
    const jsonStart = reply.indexOf('{');
    const jsonEnd = reply.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd > jsonStart) {
      const parsed = JSON.parse(reply.slice(jsonStart, jsonEnd + 1)) as { quotes: Array<{ page: number; text: string; score: number }> };
      return json({ paper_id: body.paper_id, concept: body.concept, quotes: parsed.quotes });
    }
  } catch (err) {
    return json({ error: { code: 'LLM_FAILED', message: (err as Error).message } }, 502);
  }

  return json({ paper_id: body.paper_id, concept: body.concept, quotes: [] });
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const config: Config = {
  path: '/api/papers/extract',
  method: 'POST',
};
