/**
 * Tool-call latency chart — a pure-CSS scatter/bar view of every
 * tool call's duration_ms in the current session. Each column is
 * one step in the audit log; the height is the duration; the
 * color is the status (ok = green, err = red, denied = amber).
 * Hover a bar for the exact tool + ms.
 *
 * Closes the polish item: a tool-call latency chart.
 */

import { getSession, type WorkflowStep } from '../workflow-trail';

export function mountLatencyChart(host: HTMLElement): void {
  const session = getSession();
  if (session.steps.length === 0) {
    host.innerHTML = '<p class="canvas-empty">No tool calls yet. The chart fills in as the agent acts.</p>';
    return;
  }
  const max = Math.max(...session.steps.map((s) => s.duration_ms), 1);
  const colorFor = (s: WorkflowStep): string =>
    s.status === 'ok' ? 'var(--ok)' : s.status === 'err' ? 'var(--err)' : 'var(--warn)';
  host.innerHTML = `
    <h3>Tool-call latency (${session.steps.length} calls)</h3>
    <div class="latency-chart">
      ${session.steps
        .map(
          (s) => `
          <div
            class="latency-col"
            title="#${s.step_id} ${s.tool_name}: ${s.duration_ms}ms (${s.status})"
            style="height: ${Math.max(2, Math.round((s.duration_ms / max) * 100))}%; background: ${colorFor(s)};"
          ></div>
        `,
        )
        .join('')}
    </div>
    <p class="latency-legend">
      <span><i class="dot dot-ok"></i> ok</span>
      <span><i class="dot dot-err"></i> error</span>
      <span><i class="dot dot-warn"></i> denied</span>
      <span class="latency-meta">max ${max}ms · avg ${Math.round(
        session.steps.reduce((a, s) => a + s.duration_ms, 0) / session.steps.length,
      )}ms</span>
    </p>
  `;
}
