/**
 * Per-paper highlights and annotations.
 *
 * The user can highlight text in the PDF and add a margin note.
 * Highlights are stored as W3C Web Annotation objects and addressable
 * as MCP resources. For the demo, they live in localStorage keyed by
 * paper id; the magic-link auth upgrade will move them to Blobs.
 *
 * Closes the polish item: per-paper annotation UI.
 */

export interface Highlight {
  id: string;
  paperId: string;
  page: number;
  text: string;
  note: string;
  color: 'yellow' | 'blue' | 'red' | 'green';
  createdAt: string;
}

const STORAGE_KEY = 'lattice.highlights.v1';

function read(): Highlight[] {
  if (typeof localStorage === 'undefined') return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Highlight[];
  } catch {
    return [];
  }
}

function write(highlights: Highlight[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(highlights));
}

export function listHighlights(paperId: string): Highlight[] {
  return read().filter((h) => h.paperId === paperId);
}

export function addHighlight(h: Omit<Highlight, 'id' | 'createdAt'>): Highlight {
  const all = read();
  const created: Highlight = {
    ...h,
    id: `hl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  };
  all.push(created);
  write(all);
  document.dispatchEvent(new CustomEvent('lattice:highlights-changed', { detail: { paperId: h.paperId } }));
  return created;
}

export function removeHighlight(id: string): void {
  const all = read().filter((h) => h.id !== id);
  write(all);
  document.dispatchEvent(new CustomEvent('lattice:highlights-changed', { detail: { id } }));
}
