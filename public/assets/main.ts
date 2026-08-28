/**
 * Lattice — main entry point.
 *
 * Boots the workspace. The order matters:
 *   1. Install the modelContext polyfill if needed (no-op when WebMCP is native).
 *   2. Read the live WebMCP state and update the status pill.
 *   3. Register the tool surface (8 always-on tools; per-paper tools are added by `open_paper`).
 *   4. Wire the UI.
 */
import { installModelContextPolyfill } from './model-context-polyfill';
import { registerAllTools } from './tools/register';
import { mountWorkspace } from './ui/workspace';

async function main(): Promise<void> {
  installModelContextPolyfill();

  const statusEl = document.getElementById('webmcp-status');
  if (statusEl) {
    const hasWebMCP = 'modelContext' in document && 'registerTool' in document.modelContext;
    statusEl.textContent = hasWebMCP ? 'WebMCP ready' : 'WebMCP not detected';
    statusEl.dataset.state = hasWebMCP ? 'ok' : 'warn';
  }

  try {
    await registerAllTools();
  } catch (err) {
    console.error('Tool registration failed', err);
  }

  mountWorkspace(document.getElementById('app-main'));

  // Trail watcher: badges the Log tab with the count of new steps.
  void import('./trail-watcher').then(({ initTrailWatcher }) => initTrailWatcher());

  // What-just-changed toast: surfaces the last 2 steps on each new tool call.
  void import('./what-just-changed').then(({ mountWhatJustChanged }) => mountWhatJustChanged());

  // Session timer pill: shows how long the user has been on the page.
  void import('./session-timer').then(({ mountSessionTimer }) => {
    const host = document.getElementById('session-timer-host');
    if (host) mountSessionTimer(host);
  });

  // Peer-reviewer preview: hover a citation chip, see the challenge.
  void import('./peer-preview').then(({ mountPeerPreview }) => mountPeerPreview());

  // Smart session hint: appears after 90 seconds with a suggestion.
  void import('./session-hint').then(({ mountSessionHint }) => mountSessionHint(document.body));

  // Context budget bar: estimated tokens used vs window.
  void import('./context-budget').then(({ mountContextBudgetBar }) => {
    const rail = document.querySelector('.agent-rail-tab[data-tab-content="chat"]');
    if (rail) mountContextBudgetBar(rail);
  });

  // "What's in the prompt" debug view (g d).
  document.addEventListener('keydown', async (e) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'P') {
      e.preventDefault();
      const { mountPromptDebugOverlay } = await import('./prompt-debug');
      mountPromptDebugOverlay();
    }
  });

  // Report-a-problem button: copy a diagnostic bundle to the clipboard.
  document.querySelector<HTMLButtonElement>('[data-action="report-problem"]')?.addEventListener('click', async () => {
    const { copyDiagnosticBundleToClipboard } = await import('./diagnostics');
    const ok = await copyDiagnosticBundleToClipboard();
    if (ok) {
      window.alert('Diagnostic bundle copied to clipboard. Paste it into the GitHub issue.');
    } else {
      window.alert('Could not copy. Press F12, run: await import("/assets/diagnostics.ts").then(m => m.buildDiagnosticBundle())');
    }
  });

  document.getElementById('app')?.setAttribute('data-state', 'ready');
}

main().catch((err) => {
  console.error('Lattice failed to start', err);
  const main = document.getElementById('app-main');
  if (main) {
    main.innerHTML = '<p class="empty-state">Lattice failed to start. Check the console for details.</p>';
  }
});
