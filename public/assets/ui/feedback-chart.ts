/**
 * Feedback chart — a small bar chart of 👍/👎 over time, grouped
 * by hour. Rendered as a pure-CSS bar chart (no chart lib, no
 * bundle cost). Opens inside the stats overlay.
 *
 * Closes the polish item: a feedback summary chart.
 */

import { getAllFeedback } from '../feedback';

export function mountFeedbackChart(host: HTMLElement): void {
  const feedback = getAllFeedback();
  if (feedback.length === 0) {
    host.innerHTML = '<p class="canvas-empty">No feedback yet.</p>';
    return;
  }
  // Group by hour
  const buckets = new Map<string, { up: number; down: number }>();
  for (const f of feedback) {
    const d = new Date(f.timestamp);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:00`;
    const b = buckets.get(key) ?? { up: 0, down: 0 };
    if (f.feedback === 'up') b.up++;
    else b.down++;
    buckets.set(key, b);
  }
  const keys = Array.from(buckets.keys()).sort();
  const max = Math.max(...Array.from(buckets.values()).map((b) => b.up + b.down), 1);
  host.innerHTML = `
    <h3>Feedback over time</h3>
    <div class="feedback-chart">
      ${keys
        .map((k) => {
          const b = buckets.get(k)!;
          const total = b.up + b.down;
          const h = Math.round((total / max) * 100);
          const upPct = total > 0 ? Math.round((b.up / total) * 100) : 0;
          return `
            <div class="feedback-chart-col" title="${k}: ${b.up} up, ${b.down} down">
              <div class="feedback-chart-bar" style="height: ${h}%;">
                <div class="feedback-chart-up" style="height: ${upPct}%;" title="${b.up} up"></div>
                <div class="feedback-chart-down" style="height: ${100 - upPct}%;" title="${b.down} down"></div>
              </div>
              <div class="feedback-chart-label">${k.slice(-5)}</div>
            </div>
          `;
        })
        .join('')}
    </div>
    <p class="feedback-chart-legend">
      <span><i class="dot dot-up"></i> 👍</span>
      <span><i class="dot dot-down"></i> 👎</span>
    </p>
  `;
}
