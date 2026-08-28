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
      return result;
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
