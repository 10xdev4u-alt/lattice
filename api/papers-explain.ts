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
import { storeFor } from './_lib/session';
import { tenantSetCookieHeader } from './_lib/session';
import { completePrompt } from './_lib/llm';
import { extractJson } from './_lib/extract-json';
import { excerptWindows } from './_lib/excerpt';

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
  const { tenantId, store } = storeFor(req);
  const needsCookie = !req.headers.get('x-session-id') && !(req.headers.get('cookie') ?? '').includes('lattice_sid=');
  const paperKeys: string[] = [];
  try {
    const list = await store.list({ prefix: 'papers/' });
    for (const b of list.blobs) paperKeys.push(b.key);
  } catch {
    // ignore
  }

  // Build a per-paper excerpt bundle. Each paper contributes
  // head+middle windows (~7k chars); with up to 8 papers the
  // prompt stays within the model's input budget.
  const bundle: Array<{ paper_id: string; excerpt: string }> = [];
  for (const key of paperKeys) {
    if (!key.endsWith('/text.json')) continue;
    const paperId = key.split('/')[1]!;
    const meta = await store.getWithMetadata(key, { type: 'json' });
    if (!meta) continue;
    const pages = (meta.data as { pages: PageText[] }).pages;
    bundle.push({ paper_id: paperId, excerpt: excerptWindows(pages, paperId) });
    if (bundle.length >= 8) break;
  }

  if (bundle.length === 0) {
    return json({ claim: body.claim, evidence: [], note: 'No papers in the library.' });
  }

  const prompt = `You are building an evidence map. The user has a claim and a library. For each paper, decide if it supports, refutes, or only mentions the claim, and return a verbatim quote with the page number.

Claim: "${body.claim}"

Library (paper_id: excerpt):
${bundle.map((b) => `--- ${b.paper_id} ---\n${b.excerpt}`).join('\n\n')}

Output format: a single JSON object with one key "evidence" — an array of objects, each with keys "paper_id", "stance" ("supporting", "refuting", or "mentioning"), "quote" (a verbatim sentence you copied from that paper), "page" (integer), "score" (0.0-1.0).

Rules:
- Verbatim quotes. Copy the text exactly. Write them yourself — never placeholder text.
- If no paper mentions the claim, output {"evidence": []}.
- Cap the list at ${maxPapers} entries, ranked by score.
- Output the JSON object only — no markdown fences, no explanations.`;

  try {
    const reply = await completePrompt(prompt, {
      signal: req.signal,
      maxTokens: 1500,
      temperature: 0.1,
    });
    const parsed = extractJson(reply);
    const evidence = Array.isArray(parsed?.evidence) ? (parsed!.evidence as Evidence[]) : [];
    return json({ claim: body.claim, evidence });
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
