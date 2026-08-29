/**
 * Session timer — a tiny pill in the app header that shows how
 * long the user has been on the page. Click to pause. Persists
 * the accumulated time across reloads so the timer doesn't reset.
 *
 * Closes the polish item: a session timer pill.
 */

const STORAGE_KEY = 'lattice.session-timer.v1';
let startedAt = Date.now();
let paused = false;
let totalAccumulatedMs = 0;
// interval kept in scope so tests can clear it. Not used in the
// current render loop, which uses requestAnimationFrame-style ticks.
const _interval: ReturnType<typeof setInterval> | null = null;

interface State {
  accumulatedMs: number;
  lastStartedAt: number;
  paused: boolean;
}

function read(): State {
  if (typeof localStorage === 'undefined') return { accumulatedMs: 0, lastStartedAt: 0, paused: false };
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as State;
  } catch {
    return { accumulatedMs: 0, lastStartedAt: 0, paused: false };
  }
}

function write(s: State): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function mountSessionTimer(root: HTMLElement): void {
  const state = read();
  totalAccumulatedMs = state.accumulatedMs;
  paused = state.paused;
  startedAt = state.lastStartedAt || Date.now();
  if (paused) startedAt = Date.now();

  const pill = document.createElement('button');
  pill.className = 'session-timer';
  pill.setAttribute('aria-label', 'Session timer (click to pause)');
  pill.innerHTML = `<span data-timer-text>0:00</span><span data-timer-state>${paused ? 'paused' : 'live'}</span>`;
  root.appendChild(pill);
  pill.addEventListener('click', () => {
    paused = !paused;
    pill.querySelector('[data-timer-state]')!.textContent = paused ? 'paused' : 'live';
    if (!paused) startedAt = Date.now();
    persist();
  });

  function tick(): void {
    if (paused) return;
    const elapsed = totalAccumulatedMs + (Date.now() - startedAt);
    const totalSec = Math.floor(elapsed / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const text = pill.querySelector('[data-timer-text]');
    if (text) text.textContent = `${m}:${s.toString().padStart(2, '0')}`;
  }
  function persist(): void {
    write({
      accumulatedMs: paused ? totalAccumulatedMs : totalAccumulatedMs + (Date.now() - startedAt),
      lastStartedAt: startedAt,
      paused,
    });
  }
  tick();
  interval = setInterval(tick, 1000);
  window.addEventListener('beforeunload', persist);
}
