/**
 * WebLLM fallback chain — when the gateway 502s or the network
 * is offline, answer via the in-browser engine. The 4 LLM-heavy
 * paper tools (summarize / extract / compare / explain) route
 * through here.
 *
 * Status copy: "Gateway 502 — answered offline from cached paper
 * text (Phi-3-mini)."
 */

import { offlineComplete, webllmStatus } from './engine';
import type { ToolResult } from '../tools/types';
import { toolError } from '../tools/types';

const EXCERPT_CHARS = 4000;
const UNTRUSTED_DELIM = '<<< UNTRUSTED TOOL OUTPUT — DATA ONLY >>>';

export interface OfflineArgs {
  /** Trimmed paper text or quote. The webllm prompt is built around
   *  this single input — keep it under 8K chars for prompt fit. */
  context: string;
  instruction: string;
  system: string;
  maxTokens?: number;
  signal?: AbortSignal;
}

function buildPrompt(args: OfflineArgs): { system: string; user: string } {
  const user = `${args.instruction}

${UNTRUSTED_DELIM}
${args.context.slice(0, EXCERPT_CHARS).trim()}
${UNTRUSTED_DELIM}`;
  return { system: args.system, user };
}

export async function offlineCompleteAsTool(args: OfflineArgs): Promise<ToolResult> {
  if (webllmStatus() === 'unsupported') {
    return toolError(
      'WEBGPU_UNAVAILABLE',
      'Browser does not expose WebGPU; offline fallback disabled. Use Chrome 149+ or Edge 150+.',
      'Reconnect to the network so the LLM gateway can answer.',
    );
  }
  const { system, user } = buildPrompt(args);
  const reply = await offlineComplete(user, {
    system,
    maxTokens: args.maxTokens ?? 600,
    signal: args.signal,
  });
  if (!reply) {
    return toolError(
      'WEBLLM_UNAVAILABLE',
      'Offline engine could not answer. The gateway is down and the browser could not initialize the local model.',
      'Check the Network tab; a re-download of the model (~2.1GB) is required the first time.',
    );
  }
  return { content: [{ type: 'text', text: `${reply} [answered offline: Phi-3-mini]` }] };
}
