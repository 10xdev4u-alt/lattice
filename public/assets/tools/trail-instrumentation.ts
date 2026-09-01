/**
 * Trail instrumentation — every tool call goes to the audit log.
 *
 * Wraps a tool's `execute` in a recorder so the workflow trail captures
 * (a) the call, (b) the result, (c) the duration, (d) the status. Also
 * dispatches a `webmcp:toolcall` event so the Live Tool Array and the
 * Tool Call Log UI can re-render in real time.
 *
 * The harness (register.ts) is the only caller. Per-tool execute()
 * functions are unchanged; the wrapper is transparent.
 *
 * Closes a polish issue raised during the build review: the audit
 * trail was supposed to be the killer feature, but the wiring was
 * missing. This is that wiring.
 */

import { recordStep, type WorkflowStep } from '../workflow-trail';
import { TOOL_CHAR_LIMITS } from './types';

type ToolExecute = (args: unknown, opts: { signal: AbortSignal }) => Promise<unknown>;

export function instrument(toolName: string, execute: ToolExecute): ToolExecute {
  return async (args, opts) => {
    const startedAt = performance.now();
    try {
      const result = await execute(args, opts);
      const durationMs = Math.round(performance.now() - startedAt);
      const summary = stringifyResult(result).slice(0, TOOL_CHAR_LIMITS.outputSize);
      recordStep({
        tool_name: toolName,
        args,
        result_summary: summary,
        result_full: result,
        duration_ms: durationMs,
        status: 'ok',
      });
      dispatchToolcall();
      // Spec §1.7: above 1.5K characters the agent may not see the
      // tail. What the agent RECEIVES is the budgeted payload, with
      // a pointer to the full result when it was cut. The audit
      // trail keeps result_full untruncated.
      return clampResult(result, summary);
    } catch (err) {
      const durationMs = Math.round(performance.now() - startedAt);
      recordStep({
        tool_name: toolName,
        args,
        result_summary: `error: ${(err as Error).message}`,
        result_full: { error: (err as Error).message },
        duration_ms: durationMs,
        status: 'err',
      });
      dispatchToolcall();
      throw err;
    }
  };
}

/**
 * Clamp a tool result to the spec's per-output character budget.
 * Within budget: pass through untouched. Over budget: emit the
 * first 1.5K of the rendered text plus a truncation note telling
 * the agent how to get the rest (show_workflow_trail holds the
 * full record). Text-bearing shapes keep their structure with
 * the note appended; anything else falls back to the summary.
 */
function clampResult(result: unknown, summary: string): unknown {
  const full = stringifyResult(result);
  if (full.length <= TOOL_CHAR_LIMITS.outputSize) return result;
  const note = `\n…[truncated: ${full.length} chars total; call show_workflow_trail for the full record]`;
  const budget = TOOL_CHAR_LIMITS.outputSize - note.length;
  if (result && typeof result === 'object' && Array.isArray((result as { content?: unknown[] }).content)) {
    const shaped = result as {
      content: Array<{ type: string; text?: string }>;
    };
    const first = shaped.content[0];
    if (first && first.type === 'text' && typeof first.text === 'string') {
      return {
        ...shaped,
        content: [{ type: 'text', text: first.text.slice(0, budget) + note }],
      };
    }
  }
  return summary.slice(0, budget) + note;
}

export function denyStep(toolName: string, args: unknown): void {
  recordStep({
    tool_name: toolName,
    args,
    result_summary: 'user denied',
    result_full: { denied: true },
    duration_ms: 0,
    status: 'denied',
  });
  dispatchToolcall();
}

function stringifyResult(result: unknown): string {
  if (result == null) return '';
  if (typeof result === 'string') return result;
  try {
    return JSON.stringify(result);
  } catch {
    return String(result);
  }
}

function dispatchToolcall(): void {
  document.dispatchEvent(new CustomEvent('webmcp:toolcall'));
}

// Re-export the type so other modules can keep their imports stable.
export type { WorkflowStep };
