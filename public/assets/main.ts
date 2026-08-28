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

  document.getElementById('app')?.setAttribute('data-state', 'ready');
}

main().catch((err) => {
  console.error('Lattice failed to start', err);
  const main = document.getElementById('app-main');
  if (main) {
    main.innerHTML = '<p class="empty-state">Lattice failed to start. Check the console for details.</p>';
  }
});
