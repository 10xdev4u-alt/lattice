/**
 * Paper tags — free-form labels the user attaches to papers.
 *
 * Tags persist to localStorage as a map from paperId to a string
 * array. The user can add or remove tags from a small input on
 * each paper row, or in bulk from the paper list toolbar.
 *
 * Closes the polish item: paper-tagging.
 */

const STORAGE_KEY = 'lattice.tags.v1';

function read(): Record<string, string[]> {
  if (typeof localStorage === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, string[]>;
  } catch {
    return {};
  }
}

function write(map: Record<string, string[]>): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  document.dispatchEvent(new CustomEvent('lattice:tags-changed'));
}

export function getTagsFor(paperId: string): string[] {
  return read()[paperId] ?? [];
}

export function getAllTags(): string[] {
  const map = read();
  const set = new Set<string>();
  for (const tags of Object.values(map)) {
    for (const t of tags) set.add(t);
  }
  return Array.from(set).sort();
}

export function addTag(paperId: string, tag: string): void {
  const map = read();
  const list = map[paperId] ?? [];
  const normalized = tag.trim().toLowerCase().replace(/\s+/g, '-');
  if (!normalized || list.includes(normalized)) return;
  list.push(normalized);
  map[paperId] = list;
  write(map);
}

export function removeTag(paperId: string, tag: string): void {
  const map = read();
  const list = map[paperId] ?? [];
  const next = list.filter((t) => t !== tag);
  if (next.length === 0) delete map[paperId];
  else map[paperId] = next;
  write(map);
}

export function filterByTags(paperIds: string[], include: string[], exclude: string[]): string[] {
  const map = read();
  return paperIds.filter((id) => {
    const tags = map[id] ?? [];
    if (include.length > 0 && !include.every((t) => tags.includes(t))) return false;
    if (exclude.some((t) => tags.includes(t))) return false;
    return true;
  });
}
