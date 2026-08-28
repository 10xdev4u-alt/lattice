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
  if (lib.some((p) => p.id === paper.id)) return;
  lib.push(paper);
  write(lib);
}

export function removePaper(id: string): void {
  write(read().filter((p) => p.id !== id));
}

export function getPaper(id: string): Paper | undefined {
  return read().find((p) => p.id === id);
}

export function setLibrary(papers: Paper[]): void {
  write(papers);
}
