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
import { mountPeerReviewerBanner } from './peer-reviewer';
import { mountOpenPapersToolbar } from './open-papers';
import { getLibrary } from '../library';
import { announce } from '../focus';

export function mountWorkspace(root: HTMLElement | null): void {
  if (!root) return;
  root.innerHTML = `
    <div class="workspace" data-empty="${getLibrary().length === 0}">
      <aside class="rail rail-left" role="complementary" aria-label="Paper library">
        <div data-paper-list></div>
      </aside>
      <main class="canvas" role="main">
        <div data-open-papers></div>
        <div data-canvas></div>
        <div data-settings hidden></div>
      </main>
      <aside class="rail rail-right" role="complementary" aria-label="Agent">
        <div data-peer-banner></div>
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
  const openPapersRoot = root.querySelector<HTMLDivElement>('[data-open-papers]');
  if (openPapersRoot) mountOpenPapersToolbar(openPapersRoot);
  if (agentRailRoot) {
    const peerBannerRoot = root.querySelector<HTMLDivElement>('[data-peer-banner]');
    if (peerBannerRoot) mountPeerReviewerBanner(peerBannerRoot);
    mountAgentRail(agentRailRoot);
  }

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
      announce('Paper list rail toggled');
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
      e.preventDefault();
      workspace.classList.toggle('rail-right-collapsed');
      announce('Agent rail toggled');
    } else if ((e.metaKey || e.ctrlKey) && e.key === ',') {
      e.preventDefault();
      toggleSettings(root);
      announce('Settings panel opened');
    } else if (e.key === '?') {
      e.preventDefault();
      showHelp(workspace);
    } else if (e.key === 'g' && !e.metaKey && !e.ctrlKey) {
      // 'g' starts a 2-key sequence (g then w/l/t/k). Wait for the second key.
      const onNext = (e2: KeyboardEvent): void => {
        document.removeEventListener('keydown', onNext);
        if (e2.key === 'w') {
          // Jump to the workflow trail tab
          document.querySelector<HTMLElement>('[data-tab="log"]')?.click();
          announce('Workflow trail tab opened');
        } else if (e2.key === 'l') {
          // Jump to the chat tab
          document.querySelector<HTMLElement>('[data-tab="chat"]')?.click();
          announce('Chat tab opened');
        } else if (e2.key === 't') {
          // Jump to the tools tab
          document.querySelector<HTMLElement>('[data-tab="tools"]')?.click();
          announce('Live Tool Array opened');
        } else if (e2.key === 'k') {
          // Open the knowledge graph overlay
          void openKnowledgeGraphOverlay();
          announce('Knowledge graph opened');
        } else if (e2.key === 'f') {
          // Open the arXiv feed overlay
          void openArxivFeedOverlay();
          announce('arXiv feed opened');
        }
      };
      document.addEventListener('keydown', onNext, { once: true });
    }
  });
}

function toggleSettings(root: HTMLElement): void {
  const settings = root.querySelector<HTMLElement>('[data-settings]');
  if (!settings) return;
  const isOpen = !settings.hasAttribute('hidden');
  if (isOpen) {
    settings.setAttribute('hidden', '');
  } else {
    settings.removeAttribute('hidden');
    void import('../settings').then(({ mountSettingsPanel }) => mountSettingsPanel(settings));
  }
}

async function openKnowledgeGraphOverlay(): Promise<void> {
  const { mountKnowledgeGraph } = await import('../knowledge-graph');
  const overlay = document.createElement('div');
  overlay.className = 'kg-overlay';
  overlay.innerHTML = `<div class="kg-modal" role="dialog" aria-modal="true"><button data-action="close">Close</button><div data-kg-host style="height: 60vh"></div></div>`;
  overlay.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.dataset.action === 'close' || t === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
  const inner = overlay.querySelector<HTMLElement>('[data-kg-host]');
  if (inner) await mountKnowledgeGraph(inner);
}

async function openArxivFeedOverlay(): Promise<void> {
  const { mountArxivFeed } = await import('../arxiv-feed');
  const overlay = document.createElement('div');
  overlay.className = 'kg-overlay';
  overlay.innerHTML = `<div class="kg-modal feed-modal" role="dialog" aria-modal="true"><button data-action="close">Close</button><div data-feed-host style="height: 70vh; overflow: auto"></div></div>`;
  overlay.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.dataset.action === 'close' || t === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
  const inner = overlay.querySelector<HTMLElement>('[data-feed-host]');
  if (inner) await mountArxivFeed(inner);
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
        <dt><kbd>Ctrl/Cmd</kbd> + <kbd>,</kbd></dt>
        <dd>Open the settings panel</dd>
        <dt><kbd>g</kbd> <kbd>k</kbd></dt>
        <dd>Open the knowledge graph</dd>
        <dt><kbd>g</kbd> <kbd>f</kbd></dt>
        <dd>Open the arXiv feed</dd>
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
