/**
 * Compare two ingests of the same paper. The library can hold
 * multiple entries with the same arxiv id but different addedAt
 * timestamps (the user re-ingested the PDF, or we pulled a
 * different version). This overlay shows the LCS-based diff
 * between the two latest text.json files in Blobs.
 *
 * Closes the polish item: a "compare two library versions" diff.
 */

import { getLibrary } from '../library';
import { diffPages, diffStats, mountPaperDiff, type DiffOp } from './paper-diff';
import { getStore } from '../netlify/functions/_lib/arxiv-shim';

async function loadText(paperId: string): Promise<Array<{ page_number: number; text: string }> | null> {
  try {
    const store = getStore('lattice');
    const blob = await store.get(`papers/${paperId}/text.json`);
    if (!blob) return null;
    return (await blob.json()) as Array<{ page_number: number; text: string }>;
  } catch {
    return null;
  }
}

export async function mountCompareIngestsOverlay(root: HTMLElement): Promise<void> {
  const library = getLibrary();
  const duplicates = findDuplicates(library);
  if (duplicates.length === 0) {
    root.innerHTML = `<p class="canvas-empty">No duplicate papers in the library. Ingest the same paper twice (or two versions) to compare.</p>`;
    return;
  }
  const paperId = duplicates[0]!;
  const latest = library.filter((p) => p.id === paperId).sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  const a = latest[0]!;
  const b = latest[1] ?? latest[0]!;

  const [textA, textB] = await Promise.all([loadText(a.id), loadText(b.id)]);
  if (!textA || !textB) {
    root.innerHTML = `<p class="canvas-empty">No extracted text for one of the versions.</p>`;
    return;
  }

  const ops = diffPages(textA, textB);
  const stats = diffStats(ops);
  mountPaperDiff(root, ops, stats);
  // Add a header explaining what we're comparing
  const header = document.createElement('p');
  header.className = 'canvas-empty';
  header.textContent = `Comparing ${a.id} (added ${new Date(a.addedAt).toLocaleDateString()}) vs same paper (added ${new Date(b.addedAt).toLocaleDateString()})`;
  root.prepend(header);
}

function findDuplicates(library: { id: string; arxivId?: string }[]): string[] {
  const seen = new Set<string>();
  const dups = new Set<string>();
  for (const p of library) {
    const key = p.arxivId ?? p.id;
    if (seen.has(key)) dups.add(key);
    seen.add(key);
  }
  return Array.from(dups);
}
