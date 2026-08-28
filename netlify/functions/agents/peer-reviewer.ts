/**
 * /api/agents/peer-reviewer — the cross-agent persona endpoint.
 *
 * Issues: #56, #21. For the cross-agent demo, this endpoint serves as the
 * "second agent" that the primary Lattice page invites via peer_review_invite.
 * In production the persona runs in the user's chat agent (not on a server),
 * but a server-rendered persona makes the demo self-contained.
 *
 * Persona: skeptic. Always challenges, demands citations, never writes to
 * the document. Returns short, pointed rebuttals.
 */

import type { Config, Context } from '@netlify/functions';

interface Req {
  claim: string;
  context?: string;
}

const PERSONA_PROMPT = `You are a skeptical peer reviewer. You always challenge claims. You demand citations. You never write to the document. Keep responses to 2-3 sentences, pointed, and end with a question.`;

export default async (req: Request, _ctx: Context): Promise<Response> => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }
  const body = (await req.json()) as Req;
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
        { role: 'system', content: PERSONA_PROMPT },
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
    JSON.stringify({ challenge: data.choices?.[0]?.message?.content ?? '' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
};

export const config: Config = {
  path: '/api/agents/peer-reviewer',
  method: 'POST',
};
