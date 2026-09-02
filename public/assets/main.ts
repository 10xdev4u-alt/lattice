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
    const ctx = document.modelContext;
    const hasWebMCP = !!ctx && 'registerTool' in ctx;
    const dot = statusEl.querySelector<HTMLElement>('.status-dot');
    const text = statusEl.querySelector<HTMLElement>('[data-status-text]');
    if (dot) dot.dataset.state = hasWebMCP ? 'ok' : 'warn';
    if (text) text.textContent = hasWebMCP ? 'WebMCP ready' : 'WebMCP not detected';
    statusEl.dataset.state = hasWebMCP ? 'ok' : 'warn';
  }

  try {
    await registerAllTools();
  } catch (err) {
    console.error('Tool registration failed', err);
  }

  // Protocol trace + live call indicator: the real-time WebMCP
  // surface. Every call through the polyfill lands here as it
  // happens — the trace strip shows the session's shape, the
  // indicator names the call in flight.
  void import('./ui/protocol-trace').then(({ mountProtocolTrace }) => {
    const host = document.getElementById('protocol-trace-host');
    if (host) mountProtocolTrace(host);
  });
  void import('./live-indicator').then(({ mountLiveIndicator }) => {
    mountLiveIndicator();
  });

  mountWorkspace(document.getElementById('app-main') as HTMLElement | null);

  // The tmux strip: session, counts, runtime, clock.
  void import('./ui/status-bar').then(({ mountStatusBar }) => {
    const host = document.getElementById('status-bar-host');
    if (host) mountStatusBar(host);
  });

  // Hydrate the client library from the server store — the server
  // is the source of truth. Papers ingested server-side (a past
  // session, another tab) appear in the rail on boot; the
  // workspace re-renders when the count changes.
  void import('./library-hydration').then(({ hydrateLibrary }) => {
    void hydrateLibrary();
  });

  // Report-a-problem button: copy a diagnostic bundle to the clipboard.

  // Trail watcher: badges the Log tab with the count of new steps.
  void import('./trail-watcher').then(({ initTrailWatcher }) => initTrailWatcher());

  // What-just-changed toast: surfaces the last 2 steps on each new tool call.
  void import('./what-just-changed').then(({ mountWhatJustChanged }) => mountWhatJustChanged());

  // Session timestamp footer: bottom-right of the app.
  void import('./session-timestamp').then(({ mountSessionTimestamp, refreshSessionTimestamp }) => {
    mountSessionTimestamp();
    setInterval(refreshSessionTimestamp, 60_000);
  });

  // "What would you do?" AI-generated placeholder for the chat input.
  void import('./ui/what-would-you-do').then(({ mountWhatWouldYouDo }) => {
    // small delay so the empty-state mounts first
    setTimeout(mountWhatWouldYouDo, 1500);
  });

  // Session timer pill: shows how long the user has been on the page.
  void import('./session-timer').then(({ mountSessionTimer }) => {
    const host = document.getElementById('session-timer-host');
    if (host) mountSessionTimer(host);
  });

  // Next-action carousel on the empty state. Rotates every 5s.
  void import('./ui/next-action-carousel').then(({ mountNextActionCarousel }) => {
    const host = document.querySelector<HTMLElement>('[data-carousel-host]');
    if (host) mountNextActionCarousel(host);
  });

  // Peer-reviewer preview: hover a citation chip, see the challenge.
  void import('./peer-preview').then(({ mountPeerPreview }) => mountPeerPreview());

  // Session hint removed: it mounted at 90s over the agent input
  // (bottom-right, z-50) and computed its suggestion from a stale
  // empty-library snapshot, telling users with 5 loaded papers to
  // "Load sample library" while blocking the chat. A hint that
  // lies and obstructs is worse than none.

  // Context budget bar: estimated tokens used vs window.
  void import('./context-budget').then(({ mountContextBudgetBar }) => {
    const rail = document.querySelector('.agent-rail-tab[data-tab-content="chat"]') as HTMLElement | null;
    if (rail) mountContextBudgetBar(rail);
  });

  // WebLLM badge: private/offline indicator in the header
  void import('./ui/webllm-badge').then(({ mountWebLLMBadge }) => {
    const header = document.querySelector<HTMLElement>('.app-header');
    if (header) {
      const badgeHost = document.createElement('div');
      badgeHost.id = 'webllm-badge-host';
      badgeHost.style.marginLeft = '12px';
      header.appendChild(badgeHost);
      mountWebLLMBadge(badgeHost);
    }
  });

  // WebLLM prewarm: the airplane-mode demo only works if the
  // 2.1GB Phi-3 weights are cached BEFORE the network drops. The
  // engine initializes on first idle — after first paint, off the
  // critical path — so the offline fallback is ready when a
  // gateway failure (or DevTools offline) hits.
  void import('./webllm/engine').then(({ prewarmIfIdle }) => prewarmIfIdle());

  // "What's in the prompt" debug view (g d).
  document.addEventListener('keydown', async (e) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'P') {
      e.preventDefault();
      const { mountPromptDebugOverlay } = await import('./prompt-debug');
      mountPromptDebugOverlay();
    }
  });

  // Command palette (Cmd/Ctrl+K).
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      void import('./ui/command-palette').then(({ mountCommandPalette }) => mountCommandPalette());
    }
  });

  // Report-a-problem lives in the status bar now (status-bar.ts).

  document.getElementById('app')?.setAttribute('data-state', 'ready');
}

main().catch((err) => {
  console.error('Lattice failed to start', err);
  const main = document.getElementById('app-main');
  if (main) {
    main.innerHTML = '<p class="empty-state">Lattice failed to start. Check the console for details.</p>';
  }
});
