/**
 * Theme manager — light / dark / system.
 *
 * Persists the user's choice to localStorage. The CSS tokens in
 * public/assets/styles/tokens.css already include a light-mode
 * override under `@media (prefers-color-scheme: light)`. When
 * the user picks "light" or "dark" explicitly, we apply a
 * `data-theme` attribute on the root which scopes the override.
 */

export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'lattice.theme.v1';

export function getTheme(): Theme {
  if (typeof localStorage === 'undefined') return 'system';
  const v = localStorage.getItem(STORAGE_KEY);
  if (v === 'light' || v === 'dark' || v === 'system') return v;
  return 'system';
}

export function setTheme(theme: Theme): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, theme);
  }
  applyTheme(theme);
  document.dispatchEvent(new CustomEvent('lattice:theme-changed', { detail: { theme } }));
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', theme);
  }
}
