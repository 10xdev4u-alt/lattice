/**
 * Prompt diff — compares the user's last 2 submissions. Each
 * submission is recorded with the response it got. The diff shows
 * which input changed and which output changed.
 *
 * For the demo we use a simple LCS-based word diff (like the
 * paper-diff feature). Stored in localStorage.
 */

const STORAGE_KEY = 'lattice.prompt-history.v1';

export interface PromptEntry {
  prompt: string;
  response: string;
  timestamp: string;
  tokens?: number;
}

function read(): PromptEntry[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as PromptEntry[];
  } catch {
    return [];
  }
}

function write(entries: PromptEntry[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function recordPrompt(prompt: string, response: string, tokens?: number): void {
  const all = read();
  all.push({ prompt, response, timestamp: new Date().toISOString(), tokens });
  // Keep the last 20
  if (all.length > 20) all.splice(0, all.length - 20);
  write(all);
  document.dispatchEvent(new CustomEvent('lattice:prompt-history-changed'));
}

export function getRecentPrompts(): PromptEntry[] {
  return read().slice(-10).reverse();
}

export interface DiffSegment {
  kind: 'equal' | 'insert' | 'delete';
  text: string;
}

export function diffWords(a: string, b: string): DiffSegment[] {
  const aw = a.split(/(\s+)/);
  const bw = b.split(/(\s+)/);
  const lcs = lcsTable(aw, bw);
  return backtrack(aw, bw, lcs);
}

function lcsTable(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      else dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
    }
  }
  return dp;
}

function backtrack(a: string[], b: string[], dp: number[][]): DiffSegment[] {
  const ops: DiffSegment[] = [];
  let i = a.length;
  let j = b.length;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      pushOp(ops, 'equal', a[i - 1]!);
      i--;
      j--;
    } else if (dp[i - 1]![j]! >= dp[i]![j - 1]!) {
      pushOp(ops, 'delete', a[i - 1]!);
      i--;
    } else {
      pushOp(ops, 'insert', b[j - 1]!);
      j--;
    }
  }
  while (i > 0) {
    pushOp(ops, 'delete', a[i - 1]!);
    i--;
  }
  while (j > 0) {
    pushOp(ops, 'insert', b[j - 1]!);
    j--;
  }
  return ops.reverse();
}

function pushOp(ops: DiffSegment[], kind: DiffSegment['kind'], text: string): void {
  const last = ops[ops.length - 1];
  if (last && last.kind === kind) last.text += text;
  else ops.push({ kind, text });
}

export function mountPromptDiffOverlay(): void {
  const history = getRecentPrompts();
  if (history.length < 2) {
    showSimple('Not enough history', 'Submit at least 2 prompts to see a diff between the last two.');
    return;
  }
  const a = history[1]!;
  const b = history[0]!;
  const promptDiff = diffWords(a.prompt, b.prompt);
  const responseDiff = diffWords(a.response, b.response);
  const stats = (diff: DiffSegment[]): { added: number; removed: number } => {
    let added = 0;
    let removed = 0;
    for (const seg of diff) {
      const words = seg.text.split(/\s+/).filter((w) => w.length > 0).length;
      if (seg.kind === 'insert') added += words;
      else if (seg.kind === 'delete') removed += words;
    }
    return { added, removed };
  };
  showDiff(a, b, promptDiff, responseDiff, stats(promptDiff), stats(responseDiff));
}

function showDiff(
  a: PromptEntry,
  b: PromptEntry,
  promptDiff: DiffSegment[],
  responseDiff: DiffSegment[],
  promptStats: { added: number; removed: number },
  responseStats: { added: number; removed: number },
): void {
  const overlay = document.createElement('div');
  overlay.className = 'kg-overlay';
  overlay.innerHTML = `
    <div class="kg-modal prompt-diff-modal" role="dialog" aria-modal="true" style="width: 92vw; max-width: 880px">
      <button data-action="close">Close</button>
      <h2>Prompt diff (last 2 submissions)</h2>
      <div class="prompt-diff-grid">
        <section class="prompt-diff-col">
          <h3>Previous</h3>
          <p class="prompt-diff-meta">${escapeHtml(a.timestamp)}</p>
          <h4>Prompt</h4>
          <pre class="prompt-diff-text">${renderDiff(promptDiff)}</pre>
          <h4>Response</h4>
          <pre class="prompt-diff-text">${renderDiff(responseDiff)}</pre>
        </section>
        <section class="prompt-diff-col">
          <h3>Latest</h3>
          <p class="prompt-diff-meta">${escapeHtml(b.timestamp)}</p>
          <h4>Prompt (${promptStats.added}+ / ${promptStats.removed}-)</h4>
          <pre class="prompt-diff-text">${renderDiff(promptDiff)}</pre>
          <h4>Response (${responseStats.added}+ / ${responseStats.removed}-)</h4>
          <pre class="prompt-diff-text">${renderDiff(responseDiff)}</pre>
        </section>
      </div>
    </div>
  `;
  overlay.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.dataset.action === 'close' || t === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
}

function showSimple(title: string, body: string): void {
  const overlay = document.createElement('div');
  overlay.className = 'kg-overlay';
  overlay.innerHTML = `
    <div class="kg-modal" role="dialog" aria-modal="true" style="width: 420px; padding: var(--sp-4)">
      <button data-action="close">Close</button>
      <h2>${escapeHtml(title)}</h2>
      <p class="canvas-empty">${escapeHtml(body)}</p>
    </div>
  `;
  overlay.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.dataset.action === 'close' || t === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
}

function renderDiff(diff: DiffSegment[]): string {
  return diff
    .map((seg) => {
      if (seg.kind === 'equal') return escapeHtml(seg.text);
      if (seg.kind === 'insert') return `<ins>${escapeHtml(seg.text)}</ins>`;
      return `<del>${escapeHtml(seg.text)}</del>`;
    })
    .join('');
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
