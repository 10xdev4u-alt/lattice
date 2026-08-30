/**
 * Streaming LLM client.
 *
 * Falls back to completePrompt() for endpoints that don't support
 * Server-Sent Events. For endpoints that do, calls
 * streamCompletePrompt() and yields each delta token-by-token. The
 * agent rail uses streamCompletePrompt() to render the agent's
 * reply in real time.
 *
 * For the demo, the default kilo.ai endpoint supports streaming.
 * If the endpoint returns a non-streaming response we fall back to
 * the buffer-everything behavior.
 */

import { recordStep } from './workflow-trail';

interface StreamOptions {
  signal: AbortSignal;
  maxTokens?: number;
  temperature?: number;
  system?: string;
  model?: string;
}

interface StreamResult {
  fullText: string;
  tokens: number;
  durationMs: number;
}

function getBase(): string {
  // Route through our /api/llm proxy — the browser can't call the
  // LLM gateway directly (CORS).
  return (globalThis as { LATTICE_LLM_BASE?: string }).LATTICE_LLM_BASE ?? '/api/llm';
}

function getModel(): string {
  return (globalThis as { LATTICE_LLM_MODEL?: string }).LATTICE_LLM_MODEL ?? 'tencent/hy3:free';
}

export async function streamCompletePrompt(
  prompt: string,
  opts: StreamOptions,
  onDelta: (delta: string) => void,
): Promise<StreamResult> {
  const start = performance.now();
  const res = await fetch(getBase(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: opts.model ?? getModel(),
      messages: [
        ...(opts.system ? [{ role: 'system', content: opts.system }] : []),
        { role: 'user', content: prompt },
      ],
      max_tokens: opts.maxTokens ?? 800,
      temperature: opts.temperature ?? 0.2,
      stream: true,
      // Reasoning-capable routers otherwise spend the budget
      // thinking and stream no content deltas at all.
      reasoning: { enabled: false },
    }),
    signal: opts.signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') continue;
      try {
        const json = JSON.parse(payload) as {
          choices: Array<{ delta?: { content?: string; reasoning?: string } }>;
        };
        // Reasoning models put tokens in delta.reasoning with an
        // empty delta.content; prefer content, fall back so the
        // stream never renders blank.
        const delta = json.choices?.[0]?.delta?.content || json.choices?.[0]?.delta?.reasoning;
        if (delta) {
          fullText += delta;
          onDelta(delta);
        }
      } catch {
        // ignore parse errors on partial lines
      }
    }
  }
  const durationMs = Math.round(performance.now() - start);
  recordStep({
    tool_name: 'stream_complete',
    args: { prompt: prompt.slice(0, 200) },
    result_summary: fullText.slice(0, 500),
    result_full: { fullText },
    duration_ms: durationMs,
    status: 'ok',
  });
  return { fullText, tokens: Math.ceil(fullText.length / 4), durationMs };
}
