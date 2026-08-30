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
import { getStore } from './_lib/store';
import { completePrompt } from './_lib/llm';

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
  const store = getStore('lattice');
  const textMeta = await store.getWithMetadata(`papers/${body.paper_id}/text.json`, { type: 'json' });
  if (!textMeta) {
    return json({ error: { code: 'NOT_FOUND', message: 'No text.json for that paper.' } }, 404);
  }
  const parsed = textMeta.data as { pages: PageText[] };
  const excerpt = parsed.pages
    .slice(0, 3)
    .map((p) => `--- page ${p.page_number} ---\n${p.text.slice(0, 1500)}`)
    .join('\n\n');

  const prompt = `Summarize the following paper for ${AUDIENCE_PROMPTS[body.audience]}. Stay under ${maxWords} words. Cite the page number for any specific claim. End with a one-sentence 'confidence' note: 'well-sourced' (most claims backed by the excerpt), 'mixed' (some claims inferred), or 'speculative' (most claims inferred).

Paper text:
${excerpt}

Return JSON only. Schema:
{
  "summary": "<prose>",
  "page_citations": [<int>],
  "confidence": "well-sourced" | "mixed" | "speculative"
}`;

  try {
    const reply = await completePrompt(prompt, {
      signal: req.signal,
      maxTokens: Math.min(maxWords * 2, 1500),
      temperature: 0.2,
    });
    const start = reply.indexOf('{');
    const end = reply.lastIndexOf('}');
    if (start !== -1 && end > start) {
      const parsed = JSON.parse(reply.slice(start, end + 1)) as {
        summary: string;
        page_citations: number[];
        confidence: 'well-sourced' | 'mixed' | 'speculative';
      };
      return json({ paper_id: body.paper_id, audience: body.audience, ...parsed });
    }
    return json({ paper_id: body.paper_id, audience: body.audience, summary: reply, page_citations: [], confidence: 'mixed' });
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
  path: '/api/papers/summarize',
  method: 'POST',
};
