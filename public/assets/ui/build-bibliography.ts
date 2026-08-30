/**
 * Build a bibliography — take the entire current library and
 * export it as a single combined file in 6 formats. Lets the user
 * grab everything in one shot.
 *
 * Closes the polish item: a "build a bibliography" overlay.
 */

import { getLibrary } from '../library';
import { formatBibliography } from '../format-bibliography';

export function mountBuildBibliographyOverlay(): void {
  const library = getLibrary();
  if (library.length === 0) {
    window.alert('No papers in the library. Add some first.');
    return;
  }
  const overlay = document.createElement('div');
  overlay.className = 'kg-overlay';
  overlay.innerHTML = `
    <div class="kg-modal" role="dialog" aria-modal="true" style="width: 720px; max-width: 92vw; padding: var(--sp-4); max-height: 80vh; overflow: auto">
      <button data-action="close">Close</button>
      <h2>Build bibliography</h2>
      <p class="canvas-empty">${library.length} paper${library.length === 1 ? '' : 's'} in the library. Choose a format and download or copy.</p>
      <div class="cite-grid">
        ${(Object.keys(formatters) as Format[]).map((f) => {
          const r = formatBibliography(library, f);
          const preview = (r.content ?? '').slice(0, 400);
          return `
          <div class="cite-card" data-format="${f}">
            <div class="cite-card-header">
              <strong>${formatLabels[f]}</strong>
              <button data-action="copy-fmt" data-format="${f}">Copy</button>
            </div>
            <pre>${escapeHtml(preview)}${preview.length >= 400 ? '…' : ''}</pre>
          </div>`;
        }).join('')}
      </div>
      <p class="cite-export-actions">
        <button data-action="download">Download all formats as text</button>
      </p>
    </div>
  `;
  overlay.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.dataset.action === 'close' || t === overlay) overlay.remove();
    if (t.dataset.action === 'copy-fmt' && t instanceof HTMLButtonElement) {
      const f = t.dataset.format as Format;
      void navigator.clipboard?.writeText(formatBibliography(library, f).content ?? '');
      t.textContent = 'Copied ✓';
    }
  });
  overlay.querySelector<HTMLButtonElement>('[data-action="download"]')?.addEventListener('click', () => {
    const text = (Object.keys(formatters) as Format[])
      .map((f) => `## ${formatLabels[f]}\n\n${formatBibliography(library, f).content ?? ''}\n`)
      .join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lattice-bibliography-${library.length}-papers.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  document.body.appendChild(overlay);
}

type Format = 'bibtex' | 'csl-json' | 'apa' | 'mla' | 'chicago' | 'ris';
const formatLabels: Record<Format, string> = {
  'bibtex': 'BibTeX',
  'csl-json': 'CSL-JSON',
  'apa': 'APA',
  'mla': 'MLA',
  'chicago': 'Chicago',
  'ris': 'RIS',
};
const formatters = Object.keys(formatLabels) as Format[];

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
