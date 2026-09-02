/**
 * Regression: the browser reload shortcut must never be hijacked.
 *
 * workspace.ts once bound plain Cmd/Ctrl+R to the agent-rail
 * toggle with preventDefault — judges reload, and the app ate
 * it. Worse, the branch above it matched Cmd+Shift+R too (no
 * Shift exclusion), making the floating-rail branch dead code
 * with a case bug on top. The fix: reload is reload; rails move
 * to Shift-combos that match case-insensitively.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('keyboard: reload is sacred', () => {
  const src = readFileSync('public/assets/ui/workspace.ts', 'utf8');

  it('no plain Cmd/Ctrl+R hijack remains', () => {
    // The old bug: a branch matching (meta||ctrl) && key === 'r'
    // WITHOUT a shiftKey guard, with preventDefault.
    expect(src).not.toMatch(/\(e\.metaKey \|\| e\.ctrlKey\) && e\.key === 'r'\) \{\s*\n\s*e\.preventDefault\(\);/);
  });

  it('the floating-rail branch requires Shift and matches case-insensitively', () => {
    expect(src).toContain("e.shiftKey && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'r'");
  });

  it('the help modal documents Shift+R and Shift+E, not plain R', () => {
    expect(src).not.toContain('<kbd>R</kbd></dt>\n        <dd>Toggle the agent rail');
    expect(src).toContain('Shift</kbd> + <kbd>R</kbd>');
    expect(src).toContain('Shift</kbd> + <kbd>E</kbd>');
  });
});
