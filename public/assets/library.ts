/**
 * Library — the user's collection of papers.
 *
 * Persists to localStorage in the browser (no auth needed for the demo).
 * When we ship the magic-link auth, this will move to Netlify Blobs keyed
 * by the session.
 */

export interface Author {
  family: string;
  given?: string;
}

export interface Paper {
  id: string;
  title: string;
  authors: Author[];
  year?: number;
  doi?: string;
  arxivId?: string;
  url?: string;
  abstract?: string;
  addedAt: string;
  source: 'arxiv' | 'pdf-upload' | 'doi-resolve' | 'sample';
}

const STORAGE_KEY = 'lattice.library.v1';

function read(): Paper[] {
  if (typeof localStorage === 'undefined') return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Paper[];
  } catch {
    return [];
  }
}

function write(library: Paper[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
}

export function getLibrary(): Paper[] {
  return read();
}

export function addPaper(paper: Paper): void {
  const lib = read();
  // Dedupe across the two id schemes: an entry may exist as
  // "arxiv:1706.03762" (sample load) and arrive again as
  // "arxiv-170603762v7" (server hydration). Same digit core =
  // same paper.
  const core = idCore(paper.id);
  if (lib.some((p) => p.id === paper.id || (paper.arxivId && idCore(p.id) === core))) return;
  lib.push(paper);
  write(lib);
}

export function removePaper(id: string): void {
  write(read().filter((p) => p.id !== id));
}

/**
 * Resolve a paper by any id form. Two schemes coexist after
 * server hydration: the sample style (arxiv:1706.03762) and the
 * ingest style (arxiv-170603762v7). Both reduce to the same
 * digit core, so tools and UI can pass either — open_paper,
 * summarize_paper, cite_paper all resolve through here.
 */
export function getPaper(id: string): Paper | undefined {
  const lib = read();
  const exact = lib.find((p) => p.id === id);
  if (exact) return exact;
  const core = idCore(id);
  if (!core) return undefined;
  return lib.find((p) => idCore(p.id) === core || idCore(p.arxivId ?? '') === core);
}

/** The arXiv digit core: strip version, then all non-digits. */
function idCore(id: string): string {
  // v7-style suffixes must go first or their digit joins the
  // core: 170603762v7 → 170603762, not 1706037627.
  const withoutVersion = id.replace(/v\d+$/i, '');
  const digits = withoutVersion.replace(/[^0-9]/g, '');
  return digits.length >= 4 ? digits : '';
}

export function setLibrary(papers: Paper[]): void {
  write(papers);
}
