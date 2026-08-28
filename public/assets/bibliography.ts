/**
 * Bibliography export list — papers the user has marked for export.
 * Persists to localStorage. The magic-link auth upgrade will move this
 * to Netlify Blobs.
 */

import type { Paper } from './library';

interface BibliographyEntry extends Paper {
  note?: string;
}

const STORAGE_KEY = 'lattice.bibliography.v1';

function read(): BibliographyEntry[] {
  if (typeof localStorage === 'undefined') return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as BibliographyEntry[];
  } catch {
    return [];
  }
}

function write(bib: BibliographyEntry[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bib));
}

export function getBibliography(): BibliographyEntry[] {
  return read();
}

export function setBibliography(bib: BibliographyEntry[]): void {
  write(bib);
}

export function clearBibliography(): void {
  write([]);
}
