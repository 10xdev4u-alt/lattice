/**
 * Library hydration — the server store is the source of truth.
 *
 * The client library used to live only in localStorage, so a
 * paper ingested server-side never appeared in the rail until
 * the user hand-added it, and two ID schemes drifted apart
 * (arxiv:1706.03762 vs arxiv-170603762v7). This module pulls the
 * server's index and merges every paper it holds into the client
 * library, keeping any local-only papers (tags, pins) intact.
 *
 * Call hydrateLibrary() on boot and after any ingest.
 */

import { addPaper, getLibrary } from './library';

interface ServerPaper {
  id: string;
  title?: string;
  year?: number;
  doi?: string;
  arxiv_id?: string;
  abstract?: string;
  authors?: Array<{ family: string; given?: string }>;
}

export async function hydrateLibrary(): Promise<number> {
  try {
    const res = await fetch('/api/papers');
    if (!res.ok) return 0;
    const data = (await res.json()) as { papers: ServerPaper[] };
    const local = getLibrary();
    const known = new Set(local.map((p) => p.arxivId ?? p.id));
    let added = 0;
    for (const sp of data.papers ?? []) {
      if (!sp.id || !sp.title) continue;
      // Match by arXiv id first (the two ID schemes), else by id.
      const existingByArxiv = sp.arxiv_id && known.has(sp.arxiv_id);
      const existingById = local.some((p) => p.id === sp.id);
      if (existingByArxiv || existingById) continue;
      addPaper({
        id: sp.id,
        title: sp.title,
        authors: sp.authors ?? [],
        year: sp.year,
        doi: sp.doi,
        arxivId: sp.arxiv_id,
        abstract: sp.abstract,
        source: 'arxiv',
        addedAt: new Date().toISOString(),
      });
      known.add(sp.arxiv_id ?? sp.id);
      added++;
    }
    if (added > 0) {
      document.dispatchEvent(new CustomEvent('lattice:library-changed'));
    }
    return added;
  } catch {
    // The server being unreachable must never block the app.
    return 0;
  }
}
