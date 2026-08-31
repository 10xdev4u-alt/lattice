/**
 * Protocol trace — the seismograph of the session.
 *
 * A horizontal strip in the header where every WebMCP call draws
 * one mark: width proportional to duration, machine-violet while
 * in flight, verdigris on success, red on failure. The strip
 * scrolls left as the session fills, so the whole conversation
 * with the agent is visible as a shape — dense bursts of tool
 * use, the long single call, the failure that stands out.
 *
 * This is the real-time WebMCP visualization: every call through
 * the instrumented polyfill lands here the instant it starts,
 * before any result exists. No decoration — the trace is the
 * data.
 */

import { onCallEnd, onCallStart, type CallEndDetail, type CallStartDetail } from '../webmcp-live';

export function mountProtocolTrace(host: HTMLElement): void {
  host.innerHTML = `
    <div class="ptrace" data-ptrace role="status" aria-label="WebMCP call trace">
      <div class="ptrace-empty" data-ptrace-empty>WebMCP trace — every call lands here live</div>
      <div class="ptrace-strip" data-ptrace-strip></div>
    </div>
  `;
  const strip = host.querySelector<HTMLElement>('[data-ptrace-strip]');
  const empty = host.querySelector<HTMLElement>('[data-ptrace-empty]');
  if (!strip || !empty) return;

  // Width scale: 30ms → 8px floor, 5000ms → full width cap. A
  // log-ish ramp keeps fast calls visible and slow calls from
  // swallowing the strip.
  const widthFor = (ms: number): number => Math.min(96, 8 + Math.sqrt(Math.max(ms - 25, 0)) * 1.6);

  let active: HTMLElement | null = null;

  onCallStart(({ toolName }: CallStartDetail) => {
    empty.setAttribute('hidden', '');
    const mark = document.createElement('span');
    mark.className = 'ptrace-mark ptrace-running';
    mark.dataset.tool = toolName;
    mark.title = `${toolName} — running`;
    mark.style.width = '10px';
    strip.appendChild(mark);
    active = mark;
    // Slide older marks left if the strip overflows; the newest
    // mark is always fully visible.
    const over = strip.scrollWidth - strip.clientWidth;
    if (over > 0) strip.scrollLeft = over;
  });

  onCallEnd(({ toolName, durationMs, ok, error }: CallEndDetail) => {
    const mark = active ?? strip.lastElementChild as HTMLElement | null;
    active = null;
    if (!mark) return;
    mark.classList.remove('ptrace-running');
    mark.classList.add(ok ? 'ptrace-ok' : 'ptrace-err');
    mark.style.width = `${widthFor(durationMs)}px`;
    mark.title = ok
      ? `${toolName} — ${durationMs}ms`
      : `${toolName} — failed after ${durationMs}ms: ${error?.slice(0, 80) ?? ''}`;
  });
}
