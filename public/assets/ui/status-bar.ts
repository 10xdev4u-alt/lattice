/**
 * status-bar — the tmux strip at the bottom of the terminal.
 *
 * Left: session name + store mode. Center: the live tool in
 * flight + audit counts. Right: papers, steps, clock. Every
 * segment is real state, no decoration — this is the summary
 * line of the whole instrument.
 */

import { getSession } from '../workflow-trail';
import { getLibrary } from '../library';
import { webllmStatus, webllmSupported } from '../webllm/engine';
import { webmcpRuntime } from '../model-context-polyfill';

export function mountStatusBar(root: HTMLElement): void {
  render(root);

  document.addEventListener('webmcp:toolcall', () => render(root));
  document.addEventListener('lattice:library-changed', () => render(root));
  document.addEventListener('lattice:trail-changed', () => render(root));

  // The clock ticks once a minute — a terminal without a clock
  // is a lie.
  window.setInterval(() => render(root), 30_000);
}

function render(root: HTMLElement): void {
  const session = getSession();
  const papers = getLibrary().length;
  const runtime = webmcpRuntime();
  const offline =
    webllmSupported() && webllmStatus() === 'ready'
      ? '<span class="sb-ok">PHI3-READY</span>'
      : webllmSupported()
        ? '<span class="sb-dim">PHI3-IDLE</span>'
        : '<span class="sb-dim">NO-WGPU</span>';

  const now = new Date();
  const clock = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  root.innerHTML = `
    <footer class="statusbar" role="status" aria-label="Session status">
      <span class="sb-seg sb-left">
        <span class="sb-strong">LATTICE</span>
        <span class="sb-dim">[${escapeHtml(session.session_id.slice(0, 18))}]</span>
      </span>
      <span class="sb-seg sb-center">
        <span class="sb-dim">SESSIONS:</span><span class="sb-strong">1</span>
        <span class="sb-dim">PAPERS:</span><span class="sb-strong">${papers}</span>
        <span class="sb-dim">STEPS:</span><span class="sb-strong">${session.steps.length}</span>
      </span>
      <span class="sb-seg sb-right">
        ${offline}
        <span class="sb-dim">WEBMCP:</span><span class="${runtime === 'native' ? 'sb-ok' : 'sb-dim'}">${runtime === 'native' ? 'NATIVE' : runtime === 'polyfill' ? 'POLYFILL' : 'ABSENT'}</span>
        <span class="sb-strong">${clock}</span>
        <button class="report-problem" data-action="report-problem" type="button">[REPORT]</button>
      </span>
    </footer>
  `;

  root.querySelector<HTMLButtonElement>('[data-action="report-problem"]')?.addEventListener('click', async () => {
    const { copyDiagnosticBundleToClipboard } = await import('../diagnostics');
    const { notice } = await import('./overlays');
    const ok = await copyDiagnosticBundleToClipboard();
    if (ok) {
      await notice('Diagnostic bundle copied', 'Paste it into the GitHub issue.');
    } else {
      await notice('Could not copy', 'Use Export instead: the diagnostics module builds the same bundle.');
    }
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
