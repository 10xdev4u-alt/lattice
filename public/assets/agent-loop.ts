/**
 * Agent tool-use loop.
 *
 * The chat input currently calls the LLM with a system prompt and
 * shows the reply. The LLM never gets to call tools because we're
 * using a generic /v1/chat/completions endpoint that doesn't know
 * about WebMCP. This module is the bridge: it gives the LLM the
 * list of registered tools and the conversation history, then
 * executes the LLM's tool calls in a loop until the LLM produces
 * a final message.
 *
 * The flow:
 *   1. user submits a prompt
 *   2. build messages: [system, ...history, user]
 *   3. send to LLM with `tools` parameter (OpenAI tool calling format)
 *   4. if LLM returns tool_calls, execute them via modelContext
 *   5. append tool results to messages, loop back to step 3
 *   6. when LLM returns a plain message, surface it to the user
 *
 * The LLM client (llm.ts) currently sends `tools` undefined. We
 * add a sibling that sends the tool list.
 */

import { getModelContext } from './model-context-polyfill';
import { recordStep } from './workflow-trail';
import { getSettings } from './settings';

interface ToolDescriptor {
  name: string;
  description: string;
  inputSchema: { type: 'object'; properties?: Record<string, unknown>; required?: string[] };
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean };
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string;
  tool_call_id?: string;
  name?: string;
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
}

export interface AgentLoopOptions {
  signal: AbortSignal;
  system?: string;
  model?: string;
  maxTurns?: number;
}

export interface AgentLoopResult {
  finalMessage: string;
  turns: number;
  toolCalls: Array<{ tool: string; args: unknown; result: unknown }>;
}

const SYSTEM_PROMPT = `You are Lattice, a research-paper assistant. The user is working in a 3-rail workspace. You have WebMCP tools available. When the user asks you to do something, first call list_papers to ground your work, then chain the per-paper tools (search_library, open_paper, summarize_paper, compare_claims, extract_quote, cite_paper, add_to_bibliography, export_bibliography, explain_evidence, show_workflow_trail, compose_review, peer_review_invite). When you have produced a final answer for the user, write it in plain text without any tool calls.`;

export async function runAgentLoop(
  userPrompt: string,
  history: ChatMessage[],
  opts: AgentLoopOptions,
): Promise<AgentLoopResult> {
  // Route through our /api/llm proxy — the browser can't call the
  // LLM gateway directly (CORS).
  const base = (globalThis as { LATTICE_LLM_BASE?: string }).LATTICE_LLM_BASE ?? '/api/llm';
  const model = opts.model ?? (globalThis as { LATTICE_LLM_MODEL?: string }).LATTICE_LLM_MODEL ?? 'tencent/hy3:free';

  const tools = await listTools();
  const messages: ChatMessage[] = [
    { role: 'system', content: opts.system ?? SYSTEM_PROMPT },
    ...history,
    { role: 'user', content: userPrompt },
  ];

  const toolCalls: AgentLoopResult['toolCalls'] = [];
  let turns = 0;
  const maxTurns = opts.maxTurns ?? 5;
  let finalMessage = '';

  while (turns++ < maxTurns) {
    const res = await fetch(base, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        tools: tools.length > 0 ? tools.map(toOpenAITool) : undefined,
        tool_choice: tools.length > 0 ? 'auto' : undefined,
        max_tokens: 800,
        temperature: 0.2,
        // Keep the agent loop direct: reasoning models would
        // spend the budget thinking before calling tools.
        reasoning: { enabled: false },
      }),
      signal: opts.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`LLM ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      choices: Array<{ message: ChatMessage & { content?: string } }>;
    };
    const msg = data.choices[0]?.message;
    if (!msg) {
      finalMessage = '(no response from LLM)';
      break;
    }
    if (msg.tool_calls && msg.tool_calls.length > 0) {
      messages.push({ role: 'assistant', tool_calls: msg.tool_calls, content: msg.content ?? '' });
      for (const call of msg.tool_calls) {
        let parsedArgs: unknown = {};
        try {
          parsedArgs = JSON.parse(call.function.arguments);
        } catch {
          // ignore parse errors
        }
        const result = await executeToolCall(call.function.name, parsedArgs, opts.signal);
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          name: call.function.name,
          content: typeof result === 'string' ? result : JSON.stringify(result),
        });
        toolCalls.push({ tool: call.function.name, args: parsedArgs, result });
      }
      continue;
    }
    finalMessage = msg.content ?? '';
    break;
  }

  return { finalMessage, turns, toolCalls };
}

async function listTools(): Promise<ToolDescriptor[]> {
  const ctx = getModelContext();
  try {
    const tools = (await ctx.getTools()) as unknown as ToolDescriptor[];
    return tools;
  } catch {
    return [];
  }
}

function toOpenAITool(t: ToolDescriptor): {
  type: 'function';
  function: { name: string; description: string; parameters: object };
} {
  return {
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema ?? { type: 'object', properties: {} },
    },
  };
}

async function executeToolCall(name: string, args: unknown, signal: AbortSignal): Promise<unknown> {
  const ctx = getModelContext();
  const start = performance.now();
  try {
    const result = await ctx.executeTool(
      { name } as any,
      JSON.stringify(args ?? {}),
      { signal },
    );
    recordStep({
      tool_name: name,
      args,
      result_summary: JSON.stringify(result).slice(0, 500),
      result_full: result,
      duration_ms: Math.round(performance.now() - start),
      status: 'ok',
    });
    return result;
  } catch (err) {
    recordStep({
      tool_name: name,
      args,
      result_summary: `error: ${(err as Error).message}`,
      result_full: { error: (err as Error).message },
      duration_ms: Math.round(performance.now() - start),
      status: 'err',
    });
    throw err;
  }
}

export function buildHistoryFromChat(chat: HTMLElement): ChatMessage[] {
  return Array.from(chat.querySelectorAll<HTMLDivElement>('.agent-message'))
    .map((el) => {
      const role = el.classList.contains('agent-message-user') ? 'user' : 'assistant';
      const text = el.querySelector('p')?.textContent ?? '';
      return { role, content: text } as ChatMessage;
    });
}

export function settingsAllowAgent(): boolean {
  return getSettings().confirm_writes;
}
