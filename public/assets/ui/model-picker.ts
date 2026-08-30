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
  { id: 'poolside-laguna-free', label: 'poolside-laguna-free', note: 'default; free; fast' },
  { id: 'gpt-4o-mini', label: 'gpt-4o-mini', note: 'cheap; good for short answers' },
  { id: 'gpt-4o', label: 'gpt-4o', note: 'best quality; slower; costs more' },
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
