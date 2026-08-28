/**
 * Pinned papers — the user's starred set.
 *
 * Pinned papers stay at the top of the list regardless of sort
 * order. The user pins/unpins via a small star button on each
 * row. Pinned ids persist to localStorage.
 *
 * Closes the polish item: pin paper affordance.
 */

const STORAGE_KEY = 'lattice.pins.v1';

function read(): string[] {
  if (typeof localStorage === 'undefined') return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

function write(ids: string[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  document.dispatchEvent(new CustomEvent('lattice:pins-changed'));
}

export function getPinnedIds(): string[] {
  return read();
}

export function isPinned(paperId: string): boolean {
  return read().includes(paperId);
}

export function togglePin(paperId: string): boolean {
  const ids = read();
  const idx = ids.indexOf(paperId);
  if (idx === -1) {
    ids.push(paperId);
    write(ids);
    return true;
  }
  ids.splice(idx, 1);
  write(ids);
  return false;
}
