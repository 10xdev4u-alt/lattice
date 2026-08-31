/**
 * Live call indicator — the header status line for WebMCP.
 *
 * Names the call in flight (machine-violet, dot breathing) and
 * the last completed call with its duration (verdigris). Driven
 * by the same events as the protocol trace, so the two stay in
 * lockstep: the strip shows the shape, this names the moment.
 */

import { onCallEnd, onCallStart } from './webmcp-live';

export function mountLiveIndicator(): void {
  const root = document.getElementById('live-indicator');
  const text = root?.querySelector<HTMLElement>('[data-live-text]');
  if (!root || !text) return;

  onCallStart(({ toolName }) => {
    root.dataset.live = '1';
    text.classList.remove('live-tool-done');
    text.textContent = `${toolName} — running`;
  });

  onCallEnd(({ toolName, durationMs, ok }) => {
    root.dataset.live = '0';
    text.classList.add('live-tool-done');
    text.textContent = ok ? `${toolName} — ${durationMs}ms` : `${toolName} — failed`;
  });
}
