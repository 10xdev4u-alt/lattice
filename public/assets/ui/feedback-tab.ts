/**
 * Feedback tab in the stats panel — per-message drill-down of
 * thumbs-up / thumbs-down feedback, with the message text + the
 * feedback and a timestamp. The team can use this to spot which
 * answers are landing and which need work.
 */

import { getAllFeedback } from '../feedback';
import { getSession } from '../workflow-trail';

export function mountFeedbackTab(host: HTMLElement): void {
  const feedback = getAllFeedback();
  const session = getSession();
  // Map message hash to the message text from the current session
  const messageMap = new Map<string, string>();
  for (let i = 0; i < session.steps.length; i++) {
    const s = session.steps[i]!;
    if (s.tool_name === 'chat') {
      const key = String(i);
      const args = (s.args ?? {}) as { text?: string };
      messageMap.set(key, String(args.text ?? ''));
    }
  }
  if (feedback.length === 0) {
    host.innerHTML = '<p class="canvas-empty">No feedback yet. Click 👍 or 👎 on any agent message to start.</p>';
    return;
  }
  host.innerHTML = `
    <h2>Feedback log</h2>
    <p class="feedback-tab-summary">${feedback.length} response${feedback.length === 1 ? '' : 's'} rated · ${feedback.filter((f) => f.feedback === 'up').length} 👍 · ${feedback.filter((f) => f.feedback === 'down').length} 👎</p>
    <table class="feedback-tab-table">
      <thead>
        <tr><th>Rating</th><th>Message</th><th>When</th></tr>
      </thead>
      <tbody>
        ${feedback
          .map(
            (f) => `<tr>
            <td>${f.feedback === 'up' ? '👍' : '👎'}</td>
            <td>${escapeHtml(f.text.slice(0, 200))}${f.text.length > 200 ? '…' : ''}</td>
            <td>${escapeHtml(new Date(f.timestamp).toLocaleString())}</td>
          </tr>`,
          )
          .join('')}
      </tbody>
    </table>
  `;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
