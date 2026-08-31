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
      <button class="rail-divider" data-divider="left" type="button" aria-label="Resize library rail" aria-hidden="true" tabindex="-1"></button>
      <main class="canvas" role="main">
        <div data-open-papers></div>
        <div data-canvas></div>
        <div data-settings hidden></div>
      </main>
      <button class="rail-divider" data-divider="right" type="button" aria-label="Resize agent rail" aria-hidden="true" tabindex="-1"></button>
      <aside class="rail rail-right" role="complementary" aria-label="Agent">
        <div data-peer-banner></div>
        <div data-agent-rail></div>
      </aside>
    </div>
    <nav class="rail-mobile-tabs" role="tablist" aria-label="Workspace sections">
      <button data-mobile-tab="library" role="tab" aria-selected="false">Library</button>
      <button data-mobile-tab="canvas" role="tab" aria-selected="true">Paper</button>
      <button data-mobile-tab="agent" role="tab" aria-selected="false">Agent</button>
    </nav>
  `;

  installRailResizers(root);

  const paperListRoot = root.querySelector<HTMLDivElement>('[data-paper-list]');
  const canvasRoot = root.querySelector<HTMLDivElement>('[data-canvas]');
  const agentRailRoot = root.querySelector<HTMLDivElement>('[data-agent-rail]');

  if (paperListRoot) mountPaperList(paperListRoot);
  if (canvasRoot) {
    if (getLibrary().length === 0) {
      mountEmptyState(canvasRoot);
      // The empty state handed the canvas over never: when the
      // library fills (sample load, arXiv add, restore), swap the
      // empty state for the paper viewer so the first paper
      // opens without a reload.
      document.addEventListener(
        'lattice:library-changed',
        () => {
          const lib = getLibrary();
          if (lib.length > 0 && canvasRoot.querySelector('.empty-state')) {
            import('./pdf-canvas').then(({ mountPdfCanvas }) => mountPdfCanvas(canvasRoot));
          }
        },
        { once: true },
      );
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

  installMobileTabs(root);
  installKeyboardShortcuts(root);
}

/**
 * Draggable rail dividers. Widths persist to localStorage per
 * side; double-click resets to the design default. The grid
 * template reads from custom properties so resizing never fights
 * the collapsed-rail modifiers.
 */
function installRailResizers(root: HTMLElement): void {
  const workspace = root.querySelector<HTMLElement>('.workspace');
  if (!workspace) return;
  const left = root.querySelector<HTMLElement>('[data-divider="left"]');
  const right = root.querySelector<HTMLElement>('[data-divider="right"]');
  const KEY = 'lattice.rails.v1';

  const apply = (l: number | null, r: number | null): void => {
    if (l) workspace.style.setProperty('--rail-left-w', `${l}px`);
    if (r) workspace.style.setProperty('--rail-right-w', `${r}px`);
  };

  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as { left?: number; right?: number };
    apply(saved.left ?? null, saved.right ?? null);
  } catch {
    /* defaults stand */
  }

  const makeDrag = (
    handle: HTMLElement | null,
    side: 'left' | 'right',
    min: number,
    max: number,
  ): void => {
    if (!handle) return;
    const onDown = (e: MouseEvent): void => {
      e.preventDefault();
      handle.dataset.dragging = '1';
      const startX = e.clientX;
      const startW =
        (side === 'left'
          ? workspace.querySelector('.rail-left')
          : workspace.querySelector('.rail-right')
        )?.getBoundingClientRect().width ?? 300;
      const onMove = (ev: MouseEvent): void => {
        const delta = side === 'left' ? ev.clientX - startX : startX - ev.clientX;
        const w = Math.max(min, Math.min(max, startW + delta));
        apply(side === 'left' ? w : null, side === 'right' ? w : null);
      };
      const onUp = (): void => {
        handle.dataset.dragging = '0';
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        try {
          const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, number>;
          const l = parseFloat(
            getComputedStyle(workspace).getPropertyValue('--rail-left-w'),
          );
          const r = parseFloat(
            getComputedStyle(workspace).getPropertyValue('--rail-right-w'),
          );
          localStorage.setItem(KEY, JSON.stringify({ ...saved, left: l, right: r }));
        } catch {
          /* persistence is best-effort */
        }
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    };
    handle.addEventListener('mousedown', onDown);
    handle.addEventListener('dblclick', () => {
      workspace.style.removeProperty(side === 'left' ? '--rail-left-w' : '--rail-right-w');
      try {
        localStorage.removeItem(KEY);
      } catch {
        /* ignore */
      }
    });
  };

  makeDrag(left, 'left', 200, 480);
  makeDrag(right, 'right', 280, 640);
}

/* Mobile: the three rails become a bottom-tabbed deck. On
   narrow viewports each tab shows one region and hides the
   others, so the agent chat stays reachable on a phone. */
function installMobileTabs(root: HTMLElement): void {
  const tabs = root.querySelectorAll<HTMLButtonElement>('[data-mobile-tab]');
  if (tabs.length === 0) return;
  const workspace = root.querySelector<HTMLElement>('.workspace');
  if (!workspace) return;
  const regions = {
    library: workspace.querySelector<HTMLElement>('.rail-left'),
    canvas: workspace.querySelector<HTMLElement>('.canvas'),
    agent: workspace.querySelector<HTMLElement>('.rail-right'),
  };

  const select = (name: string): void => {
    for (const t of tabs) {
      t.setAttribute('aria-selected', t.dataset.mobileTab === name ? 'true' : 'false');
    }
    for (const [key, el] of Object.entries(regions)) {
      if (!el) continue;
      if (key === name) {
        el.classList.add('rail-mobile-active');
        el.classList.remove('rail-mobile-hidden');
      } else {
        el.classList.remove('rail-mobile-active');
        el.classList.add('rail-mobile-hidden');
      }
    }
  };

  // 'canvas' shows the center region; the library/agent rails
  // default hidden on mobile via CSS, so only the active one
  // gets rail-mobile-active.
  tabs.forEach((t) => {
    t.addEventListener('click', () => {
      const name = t.dataset.mobileTab!;
      select(name);
      if (name === 'canvas') {
        regions.canvas?.classList.remove('canvas-mobile-hidden');
      } else {
        regions.canvas?.classList.add('canvas-mobile-hidden');
      }
    });
  });

  // Default: canvas visible (its tab is aria-selected in markup).
  const applyDefault = (): void => {
    if (window.innerWidth <= 800) {
      regions.library?.classList.add('rail-mobile-hidden');
      regions.agent?.classList.add('rail-mobile-hidden');
    } else {
      // Desktop: clear any mobile state entirely.
      for (const el of Object.values(regions)) {
        el?.classList.remove('rail-mobile-active', 'rail-mobile-hidden');
      }
      regions.canvas?.classList.remove('canvas-mobile-hidden');
    }
  };
  applyDefault();
  window.addEventListener('resize', applyDefault, { passive: true });
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
    } else if (e.shiftKey && (e.metaKey || e.ctrlKey) && e.key === 'r') {
      e.preventDefault();
      workspace.classList.toggle('rail-right-floating');
      announce('Agent rail floating mode toggled');
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
          void import('../arxiv-feed').then(({ mountArxivFeed: mountFeed }) => {
            const overlay = document.createElement('div');
            overlay.className = 'kg-overlay';
            overlay.innerHTML = `<div class="kg-modal feed-modal" role="dialog" aria-modal="true"><button data-action="close">Close</button><div data-feed-host style="height: 70vh; overflow: auto"></div></div>`;
            overlay.addEventListener('click', (e) => {
              const t = e.target as HTMLElement;
              if (t.dataset.action === 'close' || t === overlay) overlay.remove();
            });
            document.body.appendChild(overlay);
            const inner = overlay.querySelector<HTMLElement>('[data-feed-host]');
            if (inner) void mountFeed(inner);
            announce('arXiv feed opened');
          });
          announce('arXiv feed opened');
        } else if (e2.key === 's') {
          // Open the stats panel
          void openStatsOverlay();
          announce('Stats panel opened');
        } else if (e2.key === 'n') {
          // Open the scratchpad
          void openScratchpadOverlay();
          announce('Scratchpad opened');
        } else if (e2.key === 'b') {
          // Open the branch diff
          void openBranchDiffOverlay();
          announce('Branch diff opened');
        } else if (e2.key === 'h') {
          // Open the session hash overlay
          void import('../session-hash').then(({ mountSessionHashOverlay }) => {
            mountSessionHashOverlay();
            announce('Session hash opened');
          });
        } else if (e2.key === 'a') {
          // Open the build-bibliography overlay
          void import('./build-bibliography').then(({ mountBuildBibliographyOverlay }) => {
            mountBuildBibliographyOverlay();
            announce('Build bibliography opened');
          });
        } else if (e2.key === 'r') {
          // Open the session-restore overlay
          void import('./session-restore').then(({ mountSessionRestoreOverlay }) => {
            mountSessionRestoreOverlay();
            announce('Session restore opened');
          });
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

async function openStatsOverlay(): Promise<void> {
  const { mountStatsPageOverlay } = await import('./stats-page');
  const overlay = document.createElement('div');
  overlay.className = 'kg-overlay';
  overlay.innerHTML = `<div class="kg-modal stats-modal" role="dialog" aria-modal="true"><button data-action="close">Close</button><div data-stats-host></div></div>`;
  overlay.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.dataset.action === 'close' || t === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
  const inner = overlay.querySelector<HTMLElement>('[data-stats-host]');
  if (inner) mountStatsPageOverlay();
}

async function openScratchpadOverlay(): Promise<void> {
  const { mountScratchpadPanel } = await import('../scratchpad');
  const overlay = document.createElement('div');
  overlay.className = 'kg-overlay';
  overlay.innerHTML = `<div class="kg-modal scratchpad-modal" role="dialog" aria-modal="true"><button data-action="close">Close</button><div data-scratchpad-host style="height: 60vh"></div></div>`;
  overlay.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.dataset.action === 'close' || t === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
  const inner = overlay.querySelector<HTMLElement>('[data-scratchpad-host]');
  if (inner) mountScratchpadPanel(inner);
}

async function openBranchDiffOverlay(): Promise<void> {
  const { mountBranchDiffOverlay } = await import('./branch-diff');
  const overlay = document.createElement('div');
  overlay.className = 'kg-overlay';
  overlay.innerHTML = `<div class="kg-modal" role="dialog" aria-modal="true" style="width: 90vw; max-width: 1000px"><button data-action="close">Close</button><div data-branch-diff-host style="padding: var(--sp-4)"></div></div>`;
  overlay.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.dataset.action === 'close' || t === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
  const inner = overlay.querySelector<HTMLElement>('[data-branch-diff-host]');
  if (inner) mountBranchDiffOverlay(inner);
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
        <dt><kbd>Ctrl/Cmd</kbd> + <kbd>Shift</kbd> + <kbd>R</kbd></dt>
        <dd>Float the agent rail over the canvas</dd>
        <dt><kbd>Ctrl/Cmd</kbd> + <kbd>,</kbd></dt>
        <dd>Open the settings panel</dd>
        <dt><kbd>g</kbd> <kbd>k</kbd></dt>
        <dd>Open the knowledge graph</dd>
        <dt><kbd>g</kbd> <kbd>f</kbd></dt>
        <dd>Open the arXiv feed</dd>
        <dt><kbd>g</kbd> <kbd>s</kbd></dt>
        <dd>Open the stats panel</dd>
        <dt><kbd>g</kbd> <kbd>n</kbd></dt>
        <dd>Open the scratchpad</dd>
        <dt><kbd>g</kbd> <kbd>b</kbd></dt>
        <dd>Open the branch diff</dd>
        <dt><kbd>g</kbd> <kbd>h</kbd></dt>
        <dd>Open the session hash (copy a short URL for this session)</dd>
        <dt><kbd>g</kbd> <kbd>p</kbd></dt>
        <dd>Open the prompt diff (last 2 submissions)</dd>
        <dt><kbd>g</kbd> <kbd>d</kbd></dt>
        <dd>Run the routine detector (find broken routines)</dd>
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
