/**
 * Scratchpad — the user's free-form notes that show up in the
 * audit log. A simple textarea persisted to localStorage. Every
 * save records a 'scratchpad_save' step in the trail with the
 * current text.
 *
 * Closes the polish item: a scratchpad panel.
 */

import { recordStep } from './workflow-trail';

const STORAGE_KEY = 'lattice.scratchpad.v1';

function read(): string {
  if (typeof localStorage === 'undefined') return '';
  return localStorage.getItem(STORAGE_KEY) ?? '';
}

function write(text: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, text);
}

export function getScratchpad(): string {
  return read();
}

export function setScratchpad(text: string): void {
  write(text);
  recordStep({
    tool_name: 'scratchpad_save',
    args: { length: text.length },
    result_summary: `scratchpad: ${text.length} chars`,
    result_full: { text },
    duration_ms: 0,
    status: 'ok',
  });
}

export function mountScratchpadPanel(root: HTMLElement): void {
  root.innerHTML = `
    <section class="scratchpad">
      <h2>Scratchpad</h2>
      <p class="scratchpad-sub">Free-form notes. Saves are recorded in the audit log.</p>
      <textarea data-scratchpad-text rows="10">${escapeHtml(read())}</textarea>
      <div class="scratchpad-actions">
        <button data-action="save">Save</button>
        <span data-scratchpad-status></span>
      </div>
    </section>
  `;
  const textarea = root.querySelector<HTMLTextAreaElement>('[data-scratchpad-text]');
  const status = root.querySelector<HTMLElement>('[data-scratchpad-status]');
  if (!textarea || !status) return;
  // Auto-save on blur or every 5s if dirty
  let dirty = false;
  textarea.addEventListener('input', () => {
    dirty = true;
  });
  const save = (): void => {
    if (!dirty) return;
    setScratchpad(textarea.value);
    dirty = false;
    status.textContent = `Saved ${new Date().toLocaleTimeString()}`;
  };
  textarea.addEventListener('blur', save);
  setInterval(save, 5000);
  root.querySelector('[data-action="save"]')?.addEventListener('click', save);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
