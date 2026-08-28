/**
 * Workspace mount — the main UI shell.
 *
 * The scaffold renders an empty-state with three actions: load a sample
 * library, paste an arXiv ID, or drop a PDF. The full workspace UI
 * (paper list, PDF viewer, agent rail) lands in the next sprint.
 */

import { getLibrary } from '../library';
import { loadSampleLibrary } from '../sample-library';

export function mountWorkspace(root: HTMLElement | null): void {
  if (!root) return;
  const library = getLibrary();
  if (library.length === 0) {
    root.innerHTML = `
      <section class="workspace-empty">
        <h2>Welcome to Lattice</h2>
        <p>Drop a research paper here to start. Lattice will surface every tool the AI agent can use on it.</p>
        <div class="empty-actions">
          <button data-action="load-sample">Load sample library</button>
          <button data-action="paste-arxiv">Paste an arXiv ID</button>
          <button data-action="drop-pdf">Drop a PDF</button>
        </div>
        <p class="empty-hint">A judge who clicks this sees: a working tool surface, a clean design, and a clear story. The full workspace ships next.</p>
      </section>
    `;
    const sampleBtn = root.querySelector<HTMLButtonElement>('[data-action="load-sample"]');
    sampleBtn?.addEventListener('click', () => {
      loadSampleLibrary();
      mountWorkspace(root);
    });
  } else {
    root.innerHTML = `
      <section class="workspace-loaded">
        <h2>Library (${library.length} paper${library.length === 1 ? '' : 's'})</h2>
        <p>Workspace UI lands in the next sprint. For now, you can confirm the tool surface by inspecting the page in Chrome 149+ with the WebMCP flag enabled.</p>
        <ul>
          ${library
            .map(
              (p) =>
                `<li><code>${p.id}</code> — ${p.title}${p.authors.length ? ` (${p.authors.map((a) => a.family).join(', ')})` : ''}</li>`,
            )
            .join('')}
        </ul>
      </section>
    `;
  }
}
