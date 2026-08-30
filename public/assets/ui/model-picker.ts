/**
 * Model picker — a dropdown in the settings panel that switches
 * the LLM model at runtime. The choice persists to localStorage and
 * is picked up by the next LLM call (the LLM client reads the
 * global at call time).
 *
 * Closes the polish item: a model picker (3 models).
 */

const STORAGE_KEY = 'lattice.llm-model.v1';

const MODELS: Array<{ id: string; label: string; note: string }> = [
  { id: 'tencent/hy3:free', label: 'tencent/hy3:free', note: 'default; free; streams reliably' },
  { id: 'poolside/laguna-s-2.1:free', label: 'poolside/laguna-s-2.1:free', note: 'free; code-strong' },
  { id: 'stepfun/step-3.7-flash:free', label: 'stepfun/step-3.7-flash:free', note: 'free; fast' },
  { id: 'kilo-auto/free', label: 'kilo-auto/free', note: 'free; auto-router (may reason)' },
];

export function getCurrentModel(): string {
  if (typeof localStorage === 'undefined') return MODELS[0]!.id;
  return localStorage.getItem(STORAGE_KEY) ?? MODELS[0]!.id;
}

export function setCurrentModel(id: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, id);
  // The LLM client reads (globalThis as any).LATTICE_LLM_MODEL at call
  // time, so updating the global is enough.
  (globalThis as { LATTICE_LLM_MODEL?: string }).LATTICE_LLM_MODEL = id;
  document.dispatchEvent(new CustomEvent('lattice:model-changed', { detail: { model: id } }));
}

export function mountModelPicker(host: HTMLElement): void {
  const current = getCurrentModel();
  host.innerHTML = `
    <label class="settings-row">
      <span>LLM model</span>
      <select data-model-select>
        ${MODELS.map(
          (m) =>
            `<option value="${m.id}" ${m.id === current ? 'selected' : ''}>${m.label} — ${m.note}</option>`,
        ).join('')}
      </select>
    </label>
  `;
  const sel = host.querySelector<HTMLSelectElement>('[data-model-select]');
  if (!sel) return;
  // Reflect the persisted choice into the global immediately on mount.
  (globalThis as { LATTICE_LLM_MODEL?: string }).LATTICE_LLM_MODEL = current;
  sel.addEventListener('change', () => {
    setCurrentModel(sel.value);
  });
}
