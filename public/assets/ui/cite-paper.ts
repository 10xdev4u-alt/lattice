/**
 * Cite a paper — exports a single paper in 6 citation formats
 * (BibTeX, CSL-JSON, APA, MLA, Chicago, RIS). Lets the user pick
 * the format and copy to the clipboard or download.
 *
 * Closes the polish item: a "cite this paper" feature.
 */

import { getPaper, type Paper } from '../library';

type Style = 'bibtex' | 'csl-json' | 'apa' | 'mla' | 'chicago' | 'ris';

const STYLE_LABELS: Record<Style, string> = {
  'bibtex': 'BibTeX',
  'csl-json': 'CSL-JSON',
  'apa': 'APA',
  'mla': 'MLA',
  'chicago': 'Chicago',
  'ris': 'RIS',
};

function buildCitations(paper: Paper): Record<Style, string> {
  const authorList = paper.authors.map((a) => a.family + (a.given ? `, ${a.given}` : '')).join(' and ');
  const year = paper.year?.toString() ?? 'n.d.';
  const title = paper.title;
  const journal = (paper as { containerTitle?: string }).containerTitle ?? 'arXiv preprint';
  const doi = paper.doi ?? '';
  const arxiv = paper.arxivId ?? '';
  const url = doi ? `https://doi.org/${doi}` : (arxiv ? `https://arxiv.org/abs/${arxiv}` : '');
  return {
    'bibtex': `@article{${paper.id.replace(/[^\w]/g, '_')},
  title   = {${title}},
  author  = {${authorList}},
  year    = {${year}},
  journal = {${journal}},
  ${doi ? `doi    = {${doi}},\n  ` : ''}${arxiv ? `note   = {arXiv:${arxiv}},\n  ` : ''}
}`,
    'csl-json': JSON.stringify(
      [
        {
          id: paper.id,
          type: 'article-journal',
          title,
          author: paper.authors.map((a) => ({ family: a.family, given: a.given })),
          issued: paper.year ? { 'date-parts': [[paper.year]] } : undefined,
          DOI: doi || undefined,
          URL: url || undefined,
        },
      ],
      null,
      2,
    ),
    'apa': `${authorList} (${year}). ${title}. ${journal}.${doi ? ' https://doi.org/' + doi : url ? ' ' + url : ''}`,
    'mla': `${authorList}. "${title}." ${journal}, ${year}.${url ? ' ' + url : ''}`,
    'chicago': `${authorList}. "${title}." ${journal} (${year}).${doi ? ' https://doi.org/' + doi : url ? ' ' + url : ''}`,
    'ris': [
      'TY  - JOUR',
      `TI  - ${title}`,
      ...paper.authors.map((a) => `AU  - ${a.family}${a.given ? ', ' + a.given : ''}`),
      `PY  - ${year}`,
      `JO  - ${journal}`,
      doi ? `DO  - ${doi}` : '',
      url ? `UR  - ${url}` : '',
      'ER  - ',
    ].filter(Boolean).join('\n'),
  };
}

export function mountCitePaperOverlay(paperId: string): void {
  const paper = getPaper(paperId);
  if (!paper) {
    window.alert('Paper not found.');
    return;
  }
  const citations = buildCitations(paper);
  const overlay = document.createElement('div');
  overlay.className = 'kg-overlay';
  overlay.innerHTML = `
    <div class="kg-modal" role="dialog" aria-modal="true" style="width: 720px; max-width: 92vw; padding: var(--sp-4); max-height: 80vh; overflow: auto">
      <button data-action="close">Close</button>
      <h2>Cite: ${escapeHtml(paper.title.slice(0, 80))}${paper.title.length > 80 ? '…' : ''}</h2>
      <p class="canvas-empty">Pick a style. Click a card to copy; click the download button to save as a file.</p>
      <div class="cite-grid">
        ${(Object.keys(citations) as Style[]).map((s) => `
          <div class="cite-card" data-style="${s}">
            <div class="cite-card-header">
              <strong>${STYLE_LABELS[s]}</strong>
              <button data-action="copy-style" data-style="${s}">Copy</button>
            </div>
            <pre>${escapeHtml(citations[s])}</pre>
          </div>
        `).join('')}
      </div>
      <p class="cite-export-actions">
        <button data-action="download">Download all as text</button>
      </p>
    </div>
  `;
  overlay.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.dataset.action === 'close' || t === overlay) overlay.remove();
    if (t.dataset.action === 'copy-style' && t instanceof HTMLButtonElement) {
      const style = t.dataset.style as Style;
      void navigator.clipboard?.writeText(citations[style]);
      t.textContent = 'Copied';
    }
  });
  overlay.querySelector<HTMLButtonElement>('[data-action="download"]')?.addEventListener('click', () => {
    const text = (Object.keys(citations) as Style[])
      .map((s) => `## ${STYLE_LABELS[s]}\n\n${citations[s]}\n`)
      .join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lattice-cite-${paper.id}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  document.body.appendChild(overlay);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
