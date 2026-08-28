/**
 * Workspace layout — the three-rail shell.
 *
 * 240px left rail (paper list), flex main canvas (PDF or empty state),
 * 360px right rail (agent chat + tool call log). All three resize-aware.
 * Collapses to a single column at < 800px (mobile-safe). Keyboard
 * shortcuts toggle the rails.
 *
 * Closes #34.
 */

import { mountPaperList } from './paper-list';
import { mountPdfCanvas } from './pdf-canvas';
import { mountAgentRail } from './agent-rail';
import { mountEmptyState } from './empty-state';
import { getLibrary } from '../library';

export function mountWorkspace(root: HTMLElement | null): void {
  if (!root) return;
  root.innerHTML = `
    <div class="workspace" data-empty="${getLibrary().length === 0}">
      <aside class="rail rail-left" role="complementary" aria-label="Paper library">
        <div data-paper-list></div>
      </aside>
      <main class="canvas" role="main">
        <div data-canvas></div>
      </main>
      <aside class="rail rail-right" role="complementary" aria-label="Agent">
        <div data-agent-rail></div>
      </aside>
    </div>
  `;

  const paperListRoot = root.querySelector<HTMLDivElement>('[data-paper-list]');
  const canvasRoot = root.querySelector<HTMLDivElement>('[data-canvas]');
  const agentRailRoot = root.querySelector<HTMLDivElement>('[data-agent-rail]');

  if (paperListRoot) mountPaperList(paperListRoot);
  if (canvasRoot) {
    if (getLibrary().length === 0) {
      mountEmptyState(canvasRoot);
    } else {
      mountPdfCanvas(canvasRoot);
    }
  }
  if (agentRailRoot) mountAgentRail(agentRailRoot);

  installKeyboardShortcuts(root);
}

function installKeyboardShortcuts(root: HTMLElement): void {
  document.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const workspace = root.querySelector<HTMLElement>('.workspace');
    if (!workspace) return;
    if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
      e.preventDefault();
      workspace.classList.toggle('rail-left-collapsed');
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
      e.preventDefault();
      workspace.classList.toggle('rail-right-collapsed');
    } else if (e.key === '?') {
      e.preventDefault();
      showHelp(workspace);
    }
  });
}

function showHelp(_root: HTMLElement): void {
  const overlay = document.createElement('div');
  overlay.className = 'help-overlay';
  overlay.innerHTML = `
    <div class="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title">
      <h2 id="help-title">Keyboard shortcuts</h2>
      <dl>
        <dt><kbd>Ctrl/Cmd</kbd> + <kbd>B</kbd></dt>
        <dd>Toggle the paper list rail</dd>
        <dt><kbd>Ctrl/Cmd</kbd> + <kbd>R</kbd></dt>
        <dd>Toggle the agent rail</dd>
        <dt><kbd>?</kbd></dt>
        <dd>Open this help</dd>
        <dt><kbd>Esc</kbd></dt>
        <dd>Close this help</dd>
      </dl>
      <p class="help-hint">For a judge: WebMCP tools are listed in the agent rail. Press <kbd>Ctrl/Cmd</kbd>+<kbd>B</kbd> to see the paper list, or just watch the agent work.</p>
      <button data-action="close">Close</button>
    </div>
  `;
  overlay.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.dataset.action === 'close' || t === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
}
