/**
 * Focus management — the small utilities that make keyboard nav
 * actually work. Every modal/overlay in Lattice uses these to
 * trap focus, restore it on close, and announce the open state
 * to assistive tech.
 *
 * Closes the a11y polish item.
 */

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

interface FocusTrap {
  root: HTMLElement;
  previousFocus: HTMLElement | null;
  onKey: (e: KeyboardEvent) => void;
}

const ACTIVE_TRAPS = new Set<FocusTrap>();

export function trapFocus(root: HTMLElement): () => void {
  const previousFocus = document.activeElement as HTMLElement | null;

  function focusables(): HTMLElement[] {
    return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => !el.hasAttribute('hidden') && el.offsetParent !== null,
    );
  }

  function onKey(e: KeyboardEvent): void {
    if (e.key !== 'Tab') return;
    const list = focusables();
    if (list.length === 0) return;
    const first = list[0]!;
    const last = list[list.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  root.addEventListener('keydown', onKey);
  const trap: FocusTrap = { root, previousFocus, onKey };
  ACTIVE_TRAPS.add(trap);

  // Focus the first focusable element on next tick so screen readers
  // pick up the modal context.
  queueMicrotask(() => {
    const list = focusables();
    if (list.length > 0) list[0]!.focus();
  });

  return function release(): void {
    root.removeEventListener('keydown', onKey);
    ACTIVE_TRAPS.delete(trap);
    if (previousFocus && document.contains(previousFocus)) {
      previousFocus.focus();
    }
  };
}

export function announce(text: string, priority: 'polite' | 'assertive' = 'polite'): void {
  let region = document.getElementById('lattice-aria-live');
  if (!region) {
    region = document.createElement('div');
    region.id = 'lattice-aria-live';
    region.setAttribute('aria-live', priority);
    region.setAttribute('aria-atomic', 'true');
    region.style.position = 'absolute';
    region.style.width = '1px';
    region.style.height = '1px';
    region.style.padding = '0';
    region.style.margin = '-1px';
    region.style.overflow = 'hidden';
    region.style.clip = 'rect(0, 0, 0, 0)';
    region.style.whiteSpace = 'nowrap';
    region.style.border = '0';
    document.body.appendChild(region);
  }
  region.setAttribute('aria-live', priority);
  // Clear and set to ensure the live region announces
  region.textContent = '';
  queueMicrotask(() => {
    region!.textContent = text;
  });
}
