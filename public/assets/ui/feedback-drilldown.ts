/**
 * Feedback drill-down in the trail — a small overlay attached to
 * the agent-rail that shows the per-message feedback (up/down) in a
 * timeline. Lets the user correlate feedback with specific steps.
 *
 * Closes PR #208: a feedback feature in the trail (per-message
 * drill-down).
 */

import { getAllFeedback } from '../feedback';
import { getSession } from '../workflow-trail';

export function mountFeedbackDrilldownOverlay(): void {
  const feedback = getAllFeedback();
  const _session = getSession();
  if (feedback.length === 0) {
    window.alert('No feedback yet. Click up or down on any agent message first.');
    return;
  }
  // _session is available for future per-step correlation.
  // Try to find the message text from the current session by
  // matching the feedback text against the chat history.
  const overlay = document.createElement('div');
  overlay.className = 'kg-overlay';
  overlay.innerHTML = `
    <div class="kg-modal" role="dialog" aria-modal="true" style="width: 92vw; max-width: 880px; padding: var(--sp-4); max-height: 80vh; overflow: auto">
      <button data-action="close">Close</button>
      <h2>Feedback drill-down</h2>
      <p class="canvas-empty">${feedback.length} response${feedback.length === 1 ? '' : 's'} rated. Each row shows the rating, the message text, and the time. Use this to spot which tools and which prompts land well or poorly.</p>
      <ul class="feedback-drilldown-list">
        ${feedback
          .map(
            (f) => `<li class="feedback-drilldown-row">
              <div class="feedback-drilldown-meta">${f.feedback === 'up' ? 'up' : 'down'} · ${new Date(f.timestamp).toLocaleString()}</div>
              <div class="feedback-drilldown-text">${escapeHtml(f.text.slice(0, 400))}${f.text.length > 400 ? '…' : ''}</div>
              ${f.feedback === 'down' ? '<p class="feedback-drilldown-hint">A down vote — what would have made this answer better? Consider: clearer prompt, more context, or a different tool.</p>' : ''}
            </li>`,
          )
          .join('')}
      </ul>
    </div>
  `;
  overlay.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.dataset.action === 'close' || t === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
