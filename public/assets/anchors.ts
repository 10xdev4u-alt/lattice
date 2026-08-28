/**
 * Anchors — the user pins a specific trail step as a "milestone"
 * with a label. Anchors persist to localStorage as a map from
 * step_id to { label, color }. They render in the workflow trail
 * with a small star and a label tag, so the user can scan the
 * timeline for the moments that matter.
 *
 * Closes the polish item: the anchor feature.
 */

const STORAGE_KEY = 'lattice.anchors.v1';

export interface Anchor {
  stepId: number;
  label: string;
  color: 'accent' | 'ok' | 'warn' | 'err';
  createdAt: string;
}

function read(): Record<number, Anchor> {
  if (typeof localStorage === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<number, Anchor>;
  } catch {
    return {};
  }
}

function write(map: Record<number, Anchor>): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  document.dispatchEvent(new CustomEvent('lattice:anchors-changed'));
}

export function getAnchors(): Record<number, Anchor> {
  return read();
}

export function getAnchor(stepId: number): Anchor | null {
  return read()[stepId] ?? null;
}

export function setAnchor(stepId: number, label: string, color: Anchor['color'] = 'accent'): void {
  const map = read();
  map[stepId] = { stepId, label, color, createdAt: new Date().toISOString() };
  write(map);
}

export function clearAnchor(stepId: number): void {
  const map = read();
  delete map[stepId];
  write(map);
}
