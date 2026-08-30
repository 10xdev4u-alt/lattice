/**
 * Settings — preferences persisted to localStorage.
 *
 * Per-session toggles the user can change without code changes. Read
 * by the tool harness (confirmation preference) and the LLM client
 * (model, audience defaults). Schema is intentionally small.
 */

export interface Settings {
  confirm_writes: boolean;
  default_audience: 'undergrad' | 'grad' | 'phd' | 'lay';
  llm_model: string;
  llm_base: string;
  enable_peer_reviewer: boolean;
}

const STORAGE_KEY = 'lattice.settings.v1';

const DEFAULTS: Settings = {
  confirm_writes: true,
  default_audience: 'grad',
  llm_model: 'kilo-auto/free',
  llm_base: '/api/llm',
  enable_peer_reviewer: false,
};

export function getSettings(): Settings {
  if (typeof localStorage === 'undefined') return { ...DEFAULTS };
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { ...DEFAULTS };
  try {
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function setSettings(patch: Partial<Settings>): Settings {
  const next = { ...getSettings(), ...patch };
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  document.dispatchEvent(new CustomEvent('lattice:settings-changed', { detail: next }));
  return next;
}

export function mountSettingsPanel(root: HTMLElement): void {
  render(root);
}

function render(root: HTMLElement): void {
  const s = getSettings();
  root.innerHTML = `
    <section class="settings">
      <h2>Settings</h2>
      <label class="settings-row">
        <input type="checkbox" data-setting="confirm_writes" ${s.confirm_writes ? 'checked' : ''} />
        <span>Require confirmation for write tools</span>
      </label>
      <label class="settings-row">
        <span>Default audience for <code>summarize_paper</code></span>
        <select data-setting="default_audience">
          <option value="undergrad" ${s.default_audience === 'undergrad' ? 'selected' : ''}>Undergrad</option>
          <option value="grad" ${s.default_audience === 'grad' ? 'selected' : ''}>Grad</option>
          <option value="phd" ${s.default_audience === 'phd' ? 'selected' : ''}>PhD</option>
          <option value="lay" ${s.default_audience === 'lay' ? 'selected' : ''}>Lay</option>
        </select>
      </label>
      <label class="settings-row">
        <span>LLM model</span>
        <input type="text" data-setting="llm_model" value="${escapeHtml(s.llm_model)}" />
      </label>
      <label class="settings-row">
        <span>LLM base URL</span>
        <input type="text" data-setting="llm_base" value="${escapeHtml(s.llm_base)}" />
      </label>
      <label class="settings-row">
        <span>Theme</span>
        <select data-theme-select>
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>
      <label class="settings-row">
        <input type="checkbox" data-setting="enable_peer_reviewer" ${s.enable_peer_reviewer ? 'checked' : ''} />
        <span>Invite peer-reviewer on every open paper</span>
      </label>
      <p class="settings-hint">Settings persist in localStorage. Reset the workflow trail from the right rail.</p>
    </section>
  `;

  const themeSelect = root.querySelector<HTMLSelectElement>('[data-theme-select]');
  if (themeSelect) {
    void import('./theme').then(({ getTheme, setTheme }) => {
      themeSelect.value = getTheme();
      themeSelect.addEventListener('change', () => {
        setTheme(themeSelect.value as 'light' | 'dark' | 'system');
      });
    });
  }

  const modelHost = document.createElement('div');
  modelHost.dataset.modelPicker = '1';
  const section = root.querySelector('section.settings');
  if (section) {
    section.insertBefore(modelHost, section.querySelector('.settings-hint'));
    void import('./ui/model-picker').then(({ mountModelPicker }) => mountModelPicker(modelHost));
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
