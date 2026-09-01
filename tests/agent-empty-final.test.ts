/**
 * Regression: the agent loop must recover an empty final answer.
 *
 * Free-tier models sometimes return content: null with no
 * tool_calls on the turn after tool results. The loop used to
 * accept '' and the user saw "(the agent produced no text)"
 * after 3 perfect tool calls (observed live). Now: empty content
 * triggers one recovery completion with tool_choice:'none' and a
 * final-answer instruction.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const fetchMock = vi.fn();

/** A minimal document.modelContext stub: one registered tool. */
function stubDocumentModelContext(): void {
  const listeners = new Set<() => void>();
  const doc = {
    modelContext: {
      registerTool: async () => undefined,
      getTools: async () => [
        {
          name: 'list_papers',
          description: 'List the library',
          inputSchema: { type: 'object', properties: {} },
        },
      ],
      executeTool: async () => ({ content: [{ type: 'text', text: '[]' }] }),
      addEventListener: (_t: string, l: () => void) => listeners.add(l),
      removeEventListener: (_t: string, l: () => void) => listeners.delete(l),
    },
  };
  vi.stubGlobal('document', doc);
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  stubDocumentModelContext();
  (globalThis as Record<string, unknown>).LATTICE_LLM_BASE = undefined;
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

function toolCallMessage(): Record<string, unknown> {
  return {
    role: 'assistant',
    content: '(calling list_papers)',
    tool_calls: [{ id: 'c1', type: 'function', function: { name: 'list_papers', arguments: '{}' } }],
  };
}

describe('agent loop empty-final recovery', () => {
  it('recovers when the post-tool turn has empty content', async () => {
    const { runAgentLoop } = await import('../public/assets/agent-loop');

    fetchMock
      // Turn 1: model calls the tool.
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ choices: [{ message: toolCallMessage() }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      // Turn 2: the flake — empty content, no tool calls.
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: null } }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      // Recovery call: final answer arrives (in the reasoning
      // channel — inclusionai-style) and must still be read.
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: null, reasoning: 'Recovered answer.' } }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      // Any further calls in the same loop (extra turns) also
      // answer plainly so the loop terminates deterministically.
      .mockImplementation(async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: 'Recovered answer.' } }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    const result = await runAgentLoop('test prompt', [], { signal: new AbortController().signal });
    expect(result.finalMessage).toBe('Recovered answer.');
    expect(result.toolCalls.length).toBe(1);
    // Call sequence: tool turn, flake turn, recovery — any extra
    // turns also return the recovered answer, so assert >= 3 and
    // that the THIRD call carried tool_choice:'none' (recovery).
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(3);
    const third = JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body));
    expect(third.tool_choice).toBe('none');
  });

  it('keeps a real final answer without any recovery call', async () => {
    const { runAgentLoop } = await import('../public/assets/agent-loop');
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: 'Direct answer.' } }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    const result = await runAgentLoop('test prompt', [], { signal: new AbortController().signal });
    expect(result.finalMessage).toBe('Direct answer.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reads reasoning-channel answers when content is null', async () => {
    const { runAgentLoop } = await import('../public/assets/agent-loop');
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ choices: [{ message: { content: null, reasoning: 'Via reasoning channel.' } }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const result = await runAgentLoop('test prompt', [], { signal: new AbortController().signal });
    expect(result.finalMessage).toBe('Via reasoning channel.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not send a reasoning override (liquid rejects it)', async () => {
    const { runAgentLoop } = await import('../public/assets/agent-loop');
    fetchMock.mockImplementationOnce(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.reasoning).toBeUndefined();
      return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    const result = await runAgentLoop('p', [], { signal: new AbortController().signal });
    expect(result.finalMessage).toBe('ok');
  });

  it('llm-proxy default model is not the dead tencent/hy3', async () => {
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync('api/llm-proxy.ts', 'utf8'),
    );
    expect(src).not.toContain("?? 'tencent/hy3:free'");
    expect(src).toContain("?? 'liquid/lfm-2.5-2.6b:free'");
  });
});
