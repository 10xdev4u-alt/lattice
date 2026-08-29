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

import type { Config, Context } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { completePrompt } from './_lib/llm';

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
  const store = getStore('lattice');
  const [aMeta, bMeta] = await Promise.all([
    store.getWithMetadata(`papers/${body.paper_id_a}/text.json`, { type: 'json' }),
    store.getWithMetadata(`papers/${body.paper_id_b}/text.json`, { type: 'json' }),
  ]);
  if (!aMeta || !bMeta) {
    return json({ error: { code: 'NOT_FOUND', message: 'One of the papers has no extracted text.' } }, 404);
  }
  const aPages = (aMeta.data as { pages: PageText[] }).pages;
  const bPages = (bMeta.data as { pages: PageText[] }).pages;
  const aExcerpt = aPages.slice(0, 3).map((p) => `--- ${body.paper_id_a} page ${p.page_number} ---\n${p.text.slice(0, 1500)}`).join('\n\n');
  const bExcerpt = bPages.slice(0, 3).map((p) => `--- ${body.paper_id_b} page ${p.page_number} ---\n${p.text.slice(0, 1500)}`).join('\n\n');

  const prompt = `You are comparing two research papers on the topic "${body.topic}". Surface up to ${maxClaims} claims where the papers agree or conflict. For each claim, quote a verbatim sentence from each paper and note the page number.

Paper A:
${aExcerpt}

Paper B:
${bExcerpt}

Return JSON only. Schema:
{
  "topic": "${body.topic}",
  "claims": [
    {
      "type": "agreement" | "conflict" | "mention",
      "topic": "<short label>",
      "text_a": "<verbatim quote from A>",
      "page_a": <int>,
      "text_b": "<verbatim quote from B>",
      "page_b": <int>,
      "score": <0.0-1.0>
    }
  ]
}

Rules:
- Verbatim quotes. Copy the text exactly.
- Prefer claims that are concrete (a number, a result, a method).
- If the papers do not address the topic, return {"claims": []}.`;

  try {
    const reply = await completePrompt(prompt, {
      signal: req.signal,
      maxTokens: 1500,
      temperature: 0.2,
    });
    const start = reply.indexOf('{');
    const end = reply.lastIndexOf('}');
    if (start !== -1 && end > start) {
      const parsed = JSON.parse(reply.slice(start, end + 1)) as { claims: Claim[] };
      return json({
        paper_a: body.paper_id_a,
        paper_b: body.paper_id_b,
        topic: body.topic,
        claims: parsed.claims,
      });
    }
    return json({ paper_a: body.paper_id_a, paper_b: body.paper_id_b, topic: body.topic, claims: [] });
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
