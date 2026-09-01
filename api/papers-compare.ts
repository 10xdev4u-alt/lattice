/**
 * POST /api/papers/compare — LLM-backed claim comparison.
 *
 * Used by compare_claims. Reads both papers' text.json, slices the
 * first ~2000 chars from each, and asks the LLM to surface agreements
 * and conflicts on a given topic. Returns up to N claims with
 * verbatim quotes and page numbers on both sides.
 *
 * Closes the polish item: real comparison endpoint.
 */

import type { Config, Context } from './_lib/types';
import { getStore } from './_lib/store';
import { storeFor } from './_lib/session';
import { tenantSetCookieHeader } from './_lib/session';
import { completePrompt } from './_lib/llm';
import { extractJson } from './_lib/extract-json';
import { excerptWindows } from './_lib/excerpt';

interface CompareRequest {
  paper_id_a: string;
  paper_id_b: string;
  topic: string;
  max_claims?: number;
}

interface PageText {
  page_number: number;
  text: string;
}

interface Claim {
  type: 'agreement' | 'conflict' | 'mention';
  topic: string;
  text_a: string;
  page_a: number;
  text_b: string;
  page_b: number;
  score: number;
}

export default async (req: Request, _ctx: Context): Promise<Response> => {
  if (req.method !== 'POST') {
    return json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' } }, 405);
  }

  let body: CompareRequest;
  try {
    body = (await req.json()) as CompareRequest;
  } catch {
    return json({ error: { code: 'BAD_JSON', message: 'Body is not valid JSON.' } }, 400);
  }
  if (!body.paper_id_a || !body.paper_id_b || !body.topic) {
    return json({ error: { code: 'MISSING_ARG', message: 'paper_id_a, paper_id_b, and topic are required.' } }, 400);
  }
  if (body.paper_id_a === body.paper_id_b) {
    return json({ error: { code: 'NOTHING_TO_COMPARE', message: 'Open two different papers to compare.' } }, 400);
  }

  const maxClaims = body.max_claims ?? 5;
  const { tenantId, store } = storeFor(req);
  const needsCookie = !req.headers.get('x-session-id') && !(req.headers.get('cookie') ?? '').includes('lattice_sid=');
  const [aMeta, bMeta] = await Promise.all([
    store.getWithMetadata(`papers/${body.paper_id_a}/text.json`, { type: 'json' }),
    store.getWithMetadata(`papers/${body.paper_id_b}/text.json`, { type: 'json' }),
  ]);
  if (!aMeta || !bMeta) {
    return json({ error: { code: 'NOT_FOUND', message: 'One of the papers has no extracted text.' } }, 404);
  }
  const aPages = (aMeta.data as { pages: PageText[] }).pages;
  const bPages = (bMeta.data as { pages: PageText[] }).pages;
  const aExcerpt = excerptWindows(aPages, body.paper_id_a);
  const bExcerpt = excerptWindows(bPages, body.paper_id_b);

  const prompt = `You are comparing two research papers on the topic "${body.topic}". Surface up to ${maxClaims} claims where the papers agree or conflict. For each claim, quote a verbatim sentence from each paper and note the page number.

Paper A:
${aExcerpt}

Paper B:
${bExcerpt}

Output format: a single JSON object with one key "claims" — an array of objects, each with keys "type" ("agreement", "conflict", or "mention"), "topic" (a short label), "text_a" (a verbatim quote from paper A), "page_a" (integer), "text_b" (a verbatim quote from paper B), "page_b" (integer), "score" (0.0-1.0).

Rules:
- The papers almost certainly both discuss the topic — find their positions on it before deciding they don't address it. Only output {"claims": []} if neither excerpt truly mentions the topic.
- Write the quotes yourself by copying text from the papers above. Never output placeholder text.
- Prefer claims that are concrete (a number, a result, a method).
- "mention" is a valid type for positions that are related but neither agree nor conflict.
- Output the JSON object only — no markdown fences, no explanations.`;

  try {
    const reply = await completePrompt(prompt, {
      signal: req.signal,
      maxTokens: 1800,
      temperature: 0.2,
    });
    const parsed = extractJson(reply);
    const claims = Array.isArray(parsed?.claims) ? (parsed!.claims as Claim[]) : [];
    return json({
      paper_a: body.paper_id_a,
      paper_b: body.paper_id_b,
      topic: body.topic,
      claims,
    });
  } catch (err) {
    return json({ error: { code: 'LLM_FAILED', message: (err as Error).message } }, 502);
  }
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const config: Config = {
  path: '/api/papers/compare',
  method: 'POST',
};
