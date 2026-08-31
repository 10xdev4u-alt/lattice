/**
 * Command palette — Cmd/Ctrl+K opens a searchable list of every
 * Lattice action. Type to filter, arrow keys to navigate, Enter
 * to run. This is the single biggest UX win for a keyboard-first
 * research tool: every feature is 2 keystrokes away.
 *
 * Closes the polish item: a command palette.
 */

interface Command {
  id: string;
  label: string;
  hint: string;
  keywords: string;
  run: () => void;
}

export function mountCommandPalette(): void {
  const overlay = document.createElement('div');
  overlay.className = 'kg-overlay command-palette-overlay';
  overlay.innerHTML = `
    <div class="command-palette" role="dialog" aria-modal="true" aria-label="Command palette">
      <input type="text" data-palette-input placeholder="Type a command…" aria-label="Search commands" autofocus />
      <ul data-palette-list role="listbox"></ul>
      <p class="palette-hint">↑↓ navigate · Enter run · Esc close</p>
    </div>
  `;
  document.body.appendChild(overlay);

  const input = overlay.querySelector<HTMLInputElement>('[data-palette-input]')!;
  const list = overlay.querySelector<HTMLUListElement>('[data-palette-list]')!;

  const commands: Command[] = [
    { id: 'load-sample', label: 'Load sample library', hint: '5 well-known arXiv papers', keywords: 'sample library load papers demo', run: () => document.querySelector<HTMLButtonElement>('[data-action="load-sample"]')?.click() },
    { id: 'tour', label: 'Start 30-second tour', hint: 'auto-runs the demo', keywords: 'tour demo walkthrough', run: () => document.querySelector<HTMLButtonElement>('[data-action="start-tour"]')?.click() },
    { id: 'ingest', label: 'Ingest one paper', hint: 'arXiv ID or DOI', keywords: 'ingest add paper arxiv doi', run: () => void import('./ingest-overlay').then((m) => m.mountIngestOverlay()) },
    { id: 'stats', label: 'Open stats', hint: 'library, agent, feedback', keywords: 'stats summary analytics', run: () => void import('./stats-page').then((m) => m.mountStatsPageOverlay()) },
    { id: 'peer', label: 'Peer review all papers', hint: 'skeptic persona per paper', keywords: 'peer review skeptic challenge', run: () => void import('./peer-reviewer-tab').then((m) => m.mountPeerReviewerTab(document.body)) },
    { id: 'bib', label: 'Build bibliography', hint: 'all 6 formats', keywords: 'bibliography cite export bibtex', run: () => void import('./build-bibliography').then((m) => m.mountBuildBibliographyOverlay()) },
    { id: 'batch-extract', label: 'Batch extract quotes', hint: 'one concept, all papers', keywords: 'batch extract quotes concept', run: () => void import('./batch-extract').then((m) => void m.mountBatchExtractOverlay()) },
    { id: 'graph', label: 'Knowledge graph', hint: 'papers + claims', keywords: 'graph knowledge network', run: () => void import('../knowledge-graph').then((m) => void m.mountKnowledgeGraph(document.body)) },
    { id: 'feed', label: 'arXiv feed', hint: 'recent papers by category', keywords: 'arxiv feed recent papers', run: () => void import('../arxiv-feed').then((m) => void m.mountArxivFeed(document.body)) },
    { id: 'saved', label: 'Saved searches', hint: 'check for new papers', keywords: 'saved searches subscribe arxiv', run: () => void import('../arxiv-saved-searches').then((m) => m.mountSavedSearchesPanel(document.body)) },
    { id: 'share', label: 'Share session URL', hint: 'copy to clipboard', keywords: 'share url copy session', run: () => void import('../share').then((m) => { const u = m.buildShareUrl(); void navigator.clipboard?.writeText(u); window.prompt('Share URL (copied):', u); }) },
    { id: 'restore', label: 'Restore a session', hint: 'paste a session id', keywords: 'restore session load past', run: () => void import('./session-restore').then((m) => m.mountSessionRestoreOverlay()) },
    { id: 'prompt-diff', label: 'Prompt diff', hint: 'last 2 submissions', keywords: 'prompt diff compare submissions', run: () => void import('../prompt-diff').then((m) => m.mountPromptDiffOverlay()) },
    { id: 'whats-wrong', label: "What's wrong?", hint: 'recent errors + re-run', keywords: 'errors wrong debug retry', run: () => void import('./whats-wrong').then((m) => m.mountWhatsWrongOverlay()) },
    { id: 'latency', label: 'Latency chart', hint: 'every tool call, by duration', keywords: 'latency chart duration performance', run: () => {
        void import('./stats-page').then((m) => m.mountStatsPageOverlay());
        // The chart appends inside the stats overlay once it mounts.
        setTimeout(() => {
          const btn = document.querySelector<HTMLButtonElement>('[data-action="latency"]');
          btn?.click();
        }, 300);
      } },
    { id: 'scratchpad', label: 'Scratchpad', hint: 'free-form notes', keywords: 'scratchpad notes write', run: () => void import('../scratchpad').then((m) => m.mountScratchpadPanel(document.body)) },
    { id: 'webmcp-audit', label: 'WebMCP self-audit', hint: 'verify spec compliance, live', keywords: 'webmcp audit spec compliance verify check', run: () => void import('./webmcp-audit-panel').then((m) => m.mountWebmcpAuditOverlay()) },
    { id: 'settings', label: 'Settings', hint: 'theme, model, confirmations', keywords: 'settings preferences theme model', run: () => document.dispatchEvent(new KeyboardEvent('keydown', { key: ',', metaKey: true, bubbles: true })) },
    { id: 'help', label: 'Keyboard shortcuts', hint: 'the full list', keywords: 'help shortcuts keyboard', run: () => document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true })) },
  ];

  let filtered = commands;
  let selected = 0;

  const render = (): void => {
    list.innerHTML = filtered
      .map(
        (c, i) => `
          <li class="palette-item ${i === selected ? 'selected' : ''}" data-id="${c.id}" role="option" aria-selected="${i === selected}">
            <span class="palette-label">${c.label}</span>
            <span class="palette-hint-text">${c.hint}</span>
          </li>
        `,
      )
      .join('');
    list.querySelectorAll<HTMLLIElement>('.palette-item').forEach((li) => {
      li.addEventListener('click', () => {
        const c = filtered.find((x) => x.id === li.dataset.id);
        c?.run();
        overlay.remove();
      });
    });
  };

  const filter = (): void => {
    const q = input.value.trim().toLowerCase();
    filtered = q
      ? commands.filter((c) => (c.label + ' ' + c.keywords).toLowerCase().includes(q))
      : commands;
    selected = 0;
    render();
  };

  input.addEventListener('input', filter);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selected = Math.min(selected + 1, filtered.length - 1);
      render();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selected = Math.max(selected - 1, 0);
      render();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      filtered[selected]?.run();
      overlay.remove();
    } else if (e.key === 'Escape') {
      overlay.remove();
    }
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  filter();
  input.focus();
}
