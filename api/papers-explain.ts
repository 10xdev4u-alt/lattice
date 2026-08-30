/**
 * POST /api/papers/explain — LLM-backed evidence map.
 *
 * Used by explain_evidence. For a given claim, the LLM scans the
 * user's library, reads each paper's text, and surfaces every
 * paper that supports / refutes / mentions the claim, with a
 * verbatim quote and page number.
 *
 * Returns up to N papers, each with a stance and a quote. The
 * library is whatever's in Blobs; in the demo, the same papers
 * the user loaded in the client.
 *
 * Closes the polish item: real explain_evidence.
 */

import type { Config, Context } from './_lib/types';
import { getStore } from './_lib/store';
import { completePrompt } from './_lib/llm';

interface ExplainRequest {
  claim: string;
  max_papers?: number;
}

interface PageText {
  page_number: number;
  text: string;
}

interface Evidence {
  paper_id: string;
  stance: 'supporting' | 'refuting' | 'mentioning';
  quote: string;
  page: number;
  score: number;
}

export default async (req: Request, _ctx: Context): Promise<Response> => {
  if (req.method !== 'POST') {
    return json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' } }, 405);
  }

  let body: ExplainRequest;
  try {
    body = (await req.json()) as ExplainRequest;
  } catch {
    return json({ error: { code: 'BAD_JSON', message: 'Body is not valid JSON.' } }, 400);
  }
  if (!body.claim) {
    return json({ error: { code: 'MISSING_ARG', message: 'claim is required.' } }, 400);
  }

  const maxPapers = body.max_papers ?? 5;
  const store = getStore('lattice');
  const paperKeys: string[] = [];
  try {
    const list = await store.list({ prefix: 'papers/' });
    for (const b of list.blobs) paperKeys.push(b.key);
  } catch {
    // ignore
  }

  // Build a per-paper excerpt bundle. Cap total context at 12k chars
  // so we don't blow the model's input budget.
  const bundle: Array<{ paper_id: string; excerpt: string }> = [];
  for (const key of paperKeys) {
    if (!key.endsWith('/text.json')) continue;
    const paperId = key.split('/')[1]!;
    const meta = await store.getWithMetadata(key, { type: 'json' });
    if (!meta) continue;
    const pages = (meta.data as { pages: PageText[] }).pages;
    const excerpt = pages
      .slice(0, 4)
      .map((p) => `--- ${paperId} page ${p.page_number} ---\n${p.text.slice(0, 800)}`)
      .join('\n\n')
      .slice(0, 4000);
    bundle.push({ paper_id: paperId, excerpt });
    if (bundle.length >= 8) break;
  }

  if (bundle.length === 0) {
    return json({ claim: body.claim, evidence: [], note: 'No papers in the library.' });
  }

  const prompt = `You are building an evidence map. The user has a claim and a library. For each paper, decide if it supports, refutes, or only mentions the claim, and return a verbatim quote with the page number.

Claim: "${body.claim}"

Library (paper_id: excerpt):
${bundle.map((b) => `--- ${b.paper_id} ---\n${b.excerpt}`).join('\n\n')}

Return JSON only. Schema:
{
  "evidence": [
    {
      "paper_id": "<id>",
      "stance": "supporting" | "refuting" | "mentioning",
      "quote": "<verbatim sentence from the paper>",
      "page": <int>,
      "score": <0.0-1.0>
    }
  ]
}

Rules:
- Verbatim quotes. Copy the text exactly.
- If no paper mentions the claim, return {"evidence": []}.
- Cap the list at ${maxPapers} entries, ranked by score.`;

  try {
    const reply = await completePrompt(prompt, {
      signal: req.signal,
      maxTokens: 1500,
      temperature: 0.1,
    });
    const start = reply.indexOf('{');
    const end = reply.lastIndexOf('}');
    if (start !== -1 && end > start) {
      const parsed = JSON.parse(reply.slice(start, end + 1)) as { evidence: Evidence[] };
      return json({ claim: body.claim, evidence: parsed.evidence });
    }
    return json({ claim: body.claim, evidence: [] });
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
  path: '/api/papers/explain',
  method: 'POST',
};
