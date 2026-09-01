/**
 * Response cards — the margin-notes system.
 *
 * Every agent result on a paper becomes a docked card in the
 * right margin of the reader: the verb that produced it, the
 * answer, page chips that jump to the cited passage, the
 * duration, and the trail step it created. Cards are persistent
 * document objects (the Notion-AI lesson), not transient
 * messages — the margin is the home of the agent's work on
 * this paper, newest first.
 *
 * This replaces the old flow where actions wrote results into a
 * host that was never rendered: there is no ghost host left,
 * every action responds visibly or reports its failure in the
 * same card surface.
 */

export interface ResponseCardSpec {
  verb: string;
  title: string;
  body: string;
  pages?: number[];
  durationMs?: number;
  paperId?: string;
}

const CARDS_KEY = 'lattice.response-cards.v1';

interface StoredCard extends ResponseCardSpec {
  id: string;
  createdAt: string;
}

function read(paperId: string): StoredCard[] {
  try {
    const all = JSON.parse(localStorage.getItem(CARDS_KEY) ?? '{}') as Record<string, StoredCard[]>;
    return all[paperId] ?? [];
  } catch {
    return [];
  }
}

function write(paperId: string, cards: StoredCard[]): void {
  try {
    const all = JSON.parse(localStorage.getItem(CARDS_KEY) ?? '{}') as Record<string, StoredCard[]>;
    all[paperId] = cards.slice(0, 40);
    localStorage.setItem(CARDS_KEY, JSON.stringify(all));
  } catch {
    /* best-effort persistence */
  }
}

let hostEl: HTMLElement | null = null;

export function mountResponseCards(host: HTMLElement, paperId: string): void {
  hostEl = host;
  host.dataset.cardsFor = paperId;
  renderCards(paperId);
}

export function addResponseCard(spec: ResponseCardSpec): string {
  const paperId = spec.paperId ?? hostEl?.dataset.cardsFor;
  if (!paperId) return '';
  const card: StoredCard = {
    ...spec,
    id: `c${Date.now()}${Math.floor(Math.random() * 1000)}`,
    createdAt: new Date().toISOString(),
  };
  const cards = [card, ...read(paperId)].slice(0, 40);
  write(paperId, cards);
  if (hostEl && hostEl.dataset.cardsFor === paperId) renderCards(paperId);
  return card.id;
}

/**
 * Dock a pending card immediately and fill it when the work
 * lands. Nielsen's first band: the click must show *something*
 * within 100ms — an empty card with the verb visible proves the
 * input registered before any LLM call can resolve.
 */
export async function runWithCard<T>(opts: {
  verb: string;
  title: string;
  paperId: string;
  run: () => Promise<T>;
  textOf: (result: T) => string;
  pagesOf?: (result: T) => number[];
}): Promise<T | null> {
  const { verb, title, paperId, run, textOf, pagesOf } = opts;
  const t0 = performance.now();
  // Instantaneous: dock the pending card before awaiting anything.
  // The id is captured so the pending RECORD can be removed when
  // the work lands — addResponseCard re-renders all card DOM, so
  // holding a DOM node here is useless (the old removeCard() was
  // removing an already-detached node, leaving pending records
  // in storage forever: the "eternal working" cards).
  const pendingId = addResponseCard({ verb, title, body: 'working…', paperId });
  try {
    const result = await run();
    const durationMs = Math.round(performance.now() - t0);
    discardCard(pendingId, paperId);
    addResponseCard({
      verb,
      title,
      body: textOf(result),
      pages: pagesOf?.(result) ?? [],
      durationMs,
      paperId,
    });
    return result;
  } catch (err) {
    const durationMs = Math.round(performance.now() - t0);
    discardCard(pendingId, paperId);
    // Errors are cards too: content, not a toast.
    addResponseCard({
      verb: `${verb} failed`,
      title,
      body: `${(err as Error).message}. Try again — the call is re-runnable.`,
      durationMs,
      paperId,
    });
    return null;
  }
}

/** Remove a card record by id (the only honest way: addResponseCard
 * rebuilds all DOM, so DOM-node removal never worked). */
function discardCard(id: string, paperId: string): void {
  const cards = read(paperId).filter((c) => c.id !== id);
  write(paperId, cards);
  if (hostEl && hostEl.dataset.cardsFor === paperId) renderCards(paperId);
}

function renderCards(paperId: string): void {
  if (!hostEl) return;
  const cards = read(paperId);
  hostEl.innerHTML = `
    <div class="rcards-head">
      <span class="rcards-count">${cards.length} response${cards.length === 1 ? '' : 's'}</span>
      ${cards.length > 0 ? '<button type="button" class="rcards-clear" data-action="clear-cards">Clear</button>' : ''}
    </div>
    ${
      cards.length === 0
        ? `<p class="rcards-empty">Ask the command bar anything — every answer docks here, tied to this paper.</p>`
        : `<ol class="rcards-list" role="list">${cards.map(cardHtml).join('')}</ol>`
    }
  `;
  hostEl.querySelector('[data-action="clear-cards"]')?.addEventListener('click', () => {
    write(paperId, []);
    renderCards(paperId);
  });
  // Page chips jump the reader to the cited page.
  hostEl.querySelectorAll<HTMLButtonElement>('[data-page-jump]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const page = Number(btn.dataset.pageJump);
      const pageEl = document.querySelector(`[data-page-number="${page}"]`);
      pageEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      pageEl?.classList.add('page-flash');
      setTimeout(() => pageEl?.classList.remove('page-flash'), 1200);
    });
  });
}

function cardHtml(c: StoredCard): string {
  const pages = (c.pages ?? [])
    .map((p) => `<button type="button" class="rcard-page" data-page-jump="${p}">p.${p}</button>`)
    .join('');
  // A card with a duration has settled — never render it as
  // still-working (the shimmer class lives only on cards in
  // flight, applied at dock time).
  const settled = c.durationMs != null;
  return `
    <li class="rcard${settled ? '' : ' rcard-pending'}" data-card-id="${c.id}">
      <div class="rcard-head">
        <span class="rcard-verb">${escapeHtml(c.verb)}</span>
        <span class="rcard-title">${escapeHtml(c.title)}</span>
        ${c.durationMs != null ? `<span class="rcard-ms">${c.durationMs}ms</span>` : ''}
      </div>
      <p class="rcard-body">${escapeHtml(c.body)}</p>
      ${pages ? `<div class="rcard-pages">${pages}</div>` : ''}
      <span class="rcard-time">${formatTime(c.createdAt)}</span>
    </li>
  `;
}

/**
 * Pull the page chips for a card out of a tool result. Tool
 * outputs vary (summary JSON, quotes array, plain prose) — take
 * whatever page numbers exist, deduped, capped.
 */
export function pagesFromResult(result: unknown): number[] {
  const pages = new Set<number>();
  const walk = (v: unknown): void => {
    if (v == null) return;
    if (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 999) {
      pages.add(v);
      return;
    }
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    if (typeof v === 'object') {
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        if (/page|page_number/i.test(k) && typeof val === 'number') pages.add(val);
        else walk(val);
      }
    }
  };
  walk(result);
  return [...pages].slice(0, 8);
}

/** Render a tool result into card prose. */
export function textFromResult(result: unknown): string {
  if (typeof result === 'string') return result;
  const r = result as { content?: Array<{ type?: string; text?: string }> };
  const text = r?.content?.find((c) => c.type === 'text' || c.text)?.text;
  if (text) {
    // Tool results are JSON strings; surface the meaningful field.
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      const key = ['summary', 'quotes', 'claims', 'evidence', 'challenge', 'answer'].find(
        (k) => typeof parsed[k] === 'string' || Array.isArray(parsed[k]),
      );
      if (key) {
        const v = parsed[key];
        if (typeof v === 'string') return v;
        if (Array.isArray(v)) {
          return v
            .map((item) => {
              if (typeof item === 'string') return item;
              const o = item as Record<string, unknown>;
              return typeof o.text === 'string' ? o.text : JSON.stringify(item);
            })
            .join('\n\n');
        }
      }
      return text;
    } catch {
      return text;
    }
  }
  return JSON.stringify(result).slice(0, 600);
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

