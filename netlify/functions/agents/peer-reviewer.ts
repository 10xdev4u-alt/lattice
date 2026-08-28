/**
 * /api/agents/peer-reviewer — the cross-agent persona endpoint.
 *
 * Issues: #56, #21, #153. For the cross-agent demo, this endpoint serves
 * as the "second agent" that the primary Lattice page invites via
 * peer_review_invite. The persona is selected per request: skeptic
 * (default), methodologist, statistician, or reviewer-2.
 *
 * Each persona has a distinct voice. The user can switch personas
 * to get a second opinion from a different reviewer archetype.
 */

import type { Config, Context } from '@netlify/functions';

interface Req {
  claim: string;
  context?: string;
  persona?: 'skeptic' | 'methodologist' | 'statistician' | 'reviewer-2';
}

const PERSONAS: Record<NonNullable<Req['persona']>, string> = {
  skeptic:
    'You are a skeptical peer reviewer. Always challenge the claim. Demand a citation. End with a question. Keep it to 2-3 sentences.',
  methodologist:
    'You are a methodologist. Focus on the study design, the sample, and the analysis. Be precise. Point out any missing controls or confounders. End with a question about the method.',
  statistician:
    'You are a statistician. Question the effect size, the confidence interval, and the p-value. Ask about the sample size and the power. End with a question about the numbers.',
  'reviewer-2':
    'You are Reviewer 2. Be tough but fair. Look for the negative result the authors might have hidden. Question the framing of the contribution. End with a question about the implications.',
};

export default async (req: Request, _ctx: Context): Promise<Response> => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }
  const body = (await req.json()) as Req;
  const persona = body.persona ?? 'skeptic';
  const system = PERSONAS[persona];

  const base = (globalThis as any).LATTICE_LLM_BASE ?? 'https://api.kilo.ai/api/gateway/v1';
  const model = (globalThis as any).LATTICE_LLM_MODEL ?? 'poolside-laguna-free';
  const key = (globalThis as any).LATTICE_LLM_KEY ?? 'latticex';

  const res = await fetch(`${base.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content: `Challenge this claim: "${body.claim}". Context: ${body.context ?? '(none)'}`,
        },
      ],
      max_tokens: 300,
      temperature: 0.4,
    }),
  });
  if (!res.ok) {
    return new Response(JSON.stringify({ error: 'peer reviewer unavailable' }), { status: 502 });
  }
  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  return new Response(
    JSON.stringify({ challenge: data.choices?.[0]?.message?.content ?? '', persona }),
    { headers: { 'Content-Type': 'application/json' } },
  );
};

export const config: Config = {
  path: '/api/agents/peer-reviewer',
  method: 'POST',
};

