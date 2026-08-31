/**
 * Routine runner — replay a saved routine against a new paper.
 *
 * The user picks a routine (e.g. "Screen a paper for claims about
 * transformers") and a paper (e.g. "Attention Is All You Need"). The
 * runner iterates through the routine's steps, substituting the
 * chosen paper_id for any step that had a paper_id input, and
 * invokes each tool via modelContext. The audit log records every
 * step under a "routine:<id>" tool name prefix so the trace is
 * still readable.
 *
 * For a step that uses a free-text input (e.g. search_library's
 * query), the user is prompted on the first call; subsequent runs
 * use the same value unless the user changes it.
 *
 * Closes the polish item: the playbook runs on a new paper.
 */

import { getModelContext } from './model-context-polyfill';
import { recordStep } from './workflow-trail';
import { listRoutines, type Routine, type RoutineStep } from './routines';

export interface RunOptions {
  routineId: string;
  paperId: string;
  signal: AbortSignal;
}

export interface RunResult {
  steps: Array<{ tool: string; status: 'ok' | 'err' | 'denied' | 'pending'; durationMs: number }>;
}

export async function runRoutine(opts: RunOptions): Promise<RunResult> {
  const routine: Routine | undefined = listRoutines().find((r) => r.id === opts.routineId);
  if (!routine) {
    return { steps: [] };
  }
  const ctx = getModelContext();
  const results: RunResult['steps'] = [];
  const argsOverrides = await promptForInputs(routine, opts.paperId);
  for (const step of routine.steps) {
    if (opts.signal.aborted) break;
    const args = substituteInputs(step, argsOverrides);
    const start = performance.now();
    try {
      const result = await ctx.executeTool(
        { name: step.tool } as any,
        JSON.stringify(args ?? {}),
        { signal: opts.signal },
      );
      const durationMs = Math.round(performance.now() - start);
      recordStep({
        tool_name: `routine:${routine.id}:${step.tool}`,
        args,
        result_summary: JSON.stringify(result).slice(0, 500),
        result_full: result,
        duration_ms: durationMs,
        status: 'ok',
      });
      results.push({ tool: step.tool, status: 'ok', durationMs });
    } catch (err) {
      const durationMs = Math.round(performance.now() - start);
      recordStep({
        tool_name: `routine:${routine.id}:${step.tool}`,
        args,
        result_summary: `error: ${(err as Error).message}`,
        result_full: { error: (err as Error).message },
        duration_ms: durationMs,
        status: 'err',
      });
      results.push({ tool: step.tool, status: 'err', durationMs });
    }
  }
  return { steps: results };
}

async function promptForInputs(routine: Routine, paperId: string): Promise<Record<string, unknown>> {
  const overrides: Record<string, unknown> = { paper_id: paperId };
  for (const step of routine.steps) {
    const args = (step.args ?? {}) as Record<string, unknown>;
    if (step.tool === 'search_library' && typeof args.query === 'string') {
      const { askText } = await import('./ui/overlays');
      const choice = await askText(`Routine "${routine.name}"`, 'Which query should this run search for?', {
        initial: args.query,
      });
      if (choice.ok && choice.value) overrides['query'] = choice.value;
    } else if (step.tool === 'compare_claims' && typeof args.topic === 'string') {
      const { askText } = await import('./ui/overlays');
      const choice = await askText(`Routine "${routine.name}"`, 'Which topic should this run compare on?', {
        initial: args.topic,
      });
      if (choice.ok && choice.value) overrides['topic'] = choice.value;
    }
  }
  return overrides;
}

function substituteInputs(step: RoutineStep, overrides: Record<string, unknown>): unknown {
  if (!step.args || typeof step.args !== 'object') return step.args;
  const merged: Record<string, unknown> = { ...(step.args as Record<string, unknown>) };
  for (const [k, v] of Object.entries(overrides)) {
    merged[k] = v;
  }
  return merged;
}
