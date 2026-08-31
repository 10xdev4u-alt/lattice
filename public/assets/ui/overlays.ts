/**
 * Overlays — the app's modal, confirm, prompt, and toast kit.
 *
 * Replaces every window.prompt / window.alert / window.confirm:
 * native dialogs block the main thread, carry browser chrome that
 * breaks the design, cannot be styled, and are invisible to
 * headless verification. These use the design system's
 * vocabulary instead: Fraunces titles, the data voice for
 * detail, proofreader's red for destructive actions.
 *
 * Every function returns a Promise — await ask() in any handler
 * exactly where window.prompt used to sit.
 */

export interface ConfirmChoice {
  ok: boolean;
  value?: string;
}

function shell(title: string, body: string, extra = ''): HTMLDivElement {
  const overlay = document.createElement('div');
  overlay.className = 'kg-overlay';
  overlay.innerHTML = `
    <div class="ovl" role="dialog" aria-modal="true">
      <header class="ovl-head">
        <h3 class="ovl-title">${escapeHtml(title)}</h3>
        <button class="ovl-x" data-action="close" type="button" aria-label="Close">Close</button>
      </header>
      <p class="ovl-body">${escapeHtml(body)}</p>
      ${extra}
      <footer class="ovl-actions"></footer>
    </div>
  `;
  return overlay;
}

function wire(overlay: HTMLDivElement, onResult: (choice: ConfirmChoice) => void, resolve: (c: ConfirmChoice) => void): void {
  const close = (c: ConfirmChoice): void => {
    overlay.remove();
    document.removeEventListener('keydown', onKey, true);
    onResult(c);
    resolve(c);
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') close({ ok: false });
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
      const input = overlay.querySelector<HTMLInputElement>('[data-ovl-input]');
      close({ ok: true, value: input?.value.trim() });
    }
  };
  overlay.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t === overlay) close({ ok: false });
    if (t.dataset.action === 'close') close({ ok: false });
    if (t.dataset.action === 'ok') {
      const input = overlay.querySelector<HTMLInputElement>('[data-ovl-input]');
      close({ ok: true, value: input?.value?.trim() });
    }
    if (t.dataset.action === 'cancel') close({ ok: false });
  });
  document.addEventListener('keydown', onKey, true);
  void onResult;
}

/** A notice with one OK — the alert() replacement. */
export function notice(title: string, body: string): Promise<void> {
  return new Promise((resolve) => {
    const overlay = shell(title, body);
    const footer = overlay.querySelector<HTMLElement>('.ovl-actions');
    if (footer) footer.innerHTML = `<button class="cmdbar-go" data-action="ok" type="button">OK</button>`;
    document.body.appendChild(overlay);
    wire(overlay, () => undefined, () => resolve());
    overlay.querySelector<HTMLButtonElement>('[data-action="ok"]')?.focus();
  });
}

/** A yes/no question — the confirm() replacement. */
export function askConfirm(title: string, body: string, okLabel = 'Confirm'): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = shell(title, body);
    const footer = overlay.querySelector<HTMLElement>('.ovl-actions');
    if (footer) {
      footer.innerHTML = `
        <button class="ovl-btn-quiet" data-action="cancel" type="button">Cancel</button>
        <button class="cmdbar-go" data-action="ok" type="button">${escapeHtml(okLabel)}</button>
      `;
    }
    document.body.appendChild(overlay);
    wire(overlay, () => undefined, (c) => resolve(c.ok));
    overlay.querySelector<HTMLButtonElement>('[data-action="ok"]')?.focus();
  });
}

/** A one-field question — the prompt() replacement. */
export function askText(
  title: string,
  body: string,
  opts: { placeholder?: string; initial?: string } = {},
): Promise<ConfirmChoice> {
  return new Promise((resolve) => {
    const extra = `
      <input
        class="ovl-input"
        data-ovl-input
        type="text"
        placeholder="${escapeHtml(opts.placeholder ?? '')}"
        value="${escapeHtml(opts.initial ?? '')}"
        autocomplete="off"
      />
    `;
    const overlay = shell(title, body, extra);
    const footer = overlay.querySelector<HTMLElement>('.ovl-actions');
    if (footer) {
      footer.innerHTML = `
        <button class="ovl-btn-quiet" data-action="cancel" type="button">Cancel</button>
        <button class="cmdbar-go" data-action="ok" type="button">Save</button>
      `;
    }
    document.body.appendChild(overlay);
    wire(overlay, () => undefined, resolve);
    const input = overlay.querySelector<HTMLInputElement>('[data-ovl-input]');
    input?.focus();
    input?.select();
  });
}

/** A brief toast for successes that need no decision. */
export function toast(message: string): void {
  const host = document.querySelector<HTMLElement>('[data-toast-host]');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  (host ?? document.body).appendChild(el);
  setTimeout(() => el.classList.add('toast-out'), 2400);
  setTimeout(() => el.remove(), 3000);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
