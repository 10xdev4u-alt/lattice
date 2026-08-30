/**
 * Next-action carousel — small rotating list of suggestions
 * shown under the empty state. Each card is clickable: click
 * to paste the suggestion into the chat input as the user's
 * first prompt, or "Load sample library" auto-runs.
 *
 * Rotates every 5 seconds. Pauses on hover.
 */

const ACTIONS: { label: string; cta: string; apply: 'load-sample' | 'paste' }[] = [
  {
    label: 'Try a 30-second tour — auto-runs through search, summarize, and peer-reviewer.',
    cta: 'Start tour',
    apply: 'load-sample',
  },
  {
    label: 'Load the sample library (5 well-known arXiv papers) to see how the audit log fills in.',
    cta: 'Load sample',
    apply: 'load-sample',
  },
  {
    label: 'Paste an arXiv ID or DOI to ingest a single paper. We\'ll show the metadata + abstract.',
    cta: 'Open ingest',
    apply: 'load-sample',
  },
  {
    label: 'Click "g s" to open the stats panel and see your activity, library, and feedback aggregate.',
    cta: 'Open stats',
    apply: 'load-sample',
  },
  {
    label: 'Try the LLM-powered placeholder: the chat input will suggest a one-sentence first move.',
    cta: 'See what LLM suggests',
    apply: 'load-sample',
  },
];

let timer: ReturnType<typeof setInterval> | null = null;
let hoverPause = false;

export function mountNextActionCarousel(host: HTMLElement): void {
  let idx = 0;
  const render = (): void => {
    if (hoverPause) return;
    const a = ACTIONS[idx % ACTIONS.length]!;
    host.innerHTML = `
      <div class="next-action">
        <div class="next-action-label">${a.label}</div>
        <button data-carousel-cta>${a.cta}</button>
      </div>
    `;
    host.querySelector('[data-carousel-cta]')?.addEventListener('click', () => {
      if (a.apply === 'load-sample') {
        document.querySelector<HTMLButtonElement>('[data-action="load-sample"]')?.click();
      } else {
        const input = document.querySelector<HTMLInputElement>('[data-agent-input]');
        if (input) {
          input.value = a.label;
          input.focus();
        }
      }
    });
    idx++;
  };
  render();
  if (timer) clearInterval(timer);
  timer = setInterval(render, 5000);
  host.addEventListener('mouseenter', () => (hoverPause = true));
  host.addEventListener('mouseleave', () => (hoverPause = false));
}
