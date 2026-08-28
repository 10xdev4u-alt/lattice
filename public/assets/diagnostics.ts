/**
 * Diagnostic bundle — capture a JSON snapshot of the local Lattice
 * state for bug reports. Includes: library count, paper ids, the
 * last 20 audit log steps, the persisted chat history, the settings,
 * the theme, the pin list, the branch list, the current session
 * id, browser info, and the Lattice build version.
 *
 * The user can hit "Report a problem" in the footer and we copy
 * the JSON to the clipboard. They paste it into the GitHub issue
 * and we have everything we need to reproduce.
 *
 * Closes the polish item: report a problem.
 */

import { getLibrary } from './library';
import { getSession } from './workflow-trail';
import { getPinnedIds } from './pins';
import { getSettings } from './settings';
import { getTheme } from './theme';
import { listBranches } from './branches';

export interface DiagnosticBundle {
  version: string;
  generatedAt: string;
  userAgent: string;
  url: string;
  sessionId: string;
  theme: string;
  settings: ReturnType<typeof getSettings>;
  library: {
    count: number;
    paperIds: string[];
    pinned: string[];
  };
  workflowTrail: {
    totalSteps: number;
    last20: ReturnType<typeof getSession>['steps'];
  };
  branches: ReturnType<typeof listBranches>;
  chatHistorySize: number;
}

export function buildDiagnosticBundle(): DiagnosticBundle {
  const library = getLibrary();
  const session = getSession();
  let chatHistorySize = 0;
  try {
    const raw = localStorage.getItem('lattice.chat.v1');
    if (raw) chatHistorySize = (JSON.parse(raw) as unknown[]).length;
  } catch {
    // ignore
  }
  return {
    version: '0.1.0',
    generatedAt: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: location.href,
    sessionId: session.session_id,
    theme: getTheme(),
    settings: getSettings(),
    library: {
      count: library.length,
      paperIds: library.map((p) => p.id),
      pinned: getPinnedIds(),
    },
    workflowTrail: {
      totalSteps: session.steps.length,
      last20: session.steps.slice(-20),
    },
    branches: listBranches(),
    chatHistorySize,
  };
}

export async function copyDiagnosticBundleToClipboard(): Promise<boolean> {
  const bundle = buildDiagnosticBundle();
  const text = JSON.stringify(bundle, null, 2);
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
