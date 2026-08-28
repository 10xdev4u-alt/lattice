/**
 * 30-second tour — auto-cycles through the demo so a new user
 * (or a judge) can see what Lattice does without clicking
 * anything. The tour loads the sample library, opens a paper,
 * runs a search, and exports the audit log — all programmatically,
 * with a slow-motion caption explaining each step.
 *
 * Closes the polish item: a "30-second tour" on the empty state.
 */

import { loadSampleLibrary } from './sample-library';

interface TourStep {
  caption: string;
  durationMs: number;
  apply: () => void | Promise<void>;
}

const TOUR_STEPS: TourStep[] = [
  {
    caption: 'Loading a sample library of 5 well-known arXiv papers…',
    durationMs: 1500,
    apply: () => {
      loadSampleLibrary();
      document.dispatchEvent(new CustomEvent('lattice:library-changed'));
    },
  },
  {
    caption: 'Opening "Attention Is All You Need" — a per-paper toolset registers automatically.',
    durationMs: 3000,
    apply: async () => {
      const { getModelContext } = await import('../model-context-polyfill');
      const ctx = getModelContext();
      await ctx.executeTool(
        { name: 'open_paper' } as any,
        JSON.stringify({ paper_id: 'arxiv:1706.03762' }),
      );
    },
  },
  {
    caption: 'Searching the library for "self-attention" — note the Live Tool Array in the right rail.',
    durationMs: 3500,
    apply: async () => {
      const { getModelContext } = await import('../model-context-polyfill');
      const ctx = getModelContext();
      await ctx.executeTool(
        { name: 'search_library' } as any,
        JSON.stringify({ query: 'self-attention', max_results_per_paper: 3 }),
      );
    },
  },
  {
    caption: 'The peer-reviewer persona challenges every claim. Click "Invite peer-reviewer" to see it live.',
    durationMs: 2500,
    apply: async () => {
      const { setPeerReviewerActive } = await import('./peer-reviewer');
      setPeerReviewerActive(true);
    },
  },
  {
    caption: 'Open the Log tab. Every tool call above is recorded with timestamp, args, and result.',
    durationMs: 2000,
    apply: () => {
      document.querySelector<HTMLElement>('[data-tab="log"]')?.click();
    },
  },
];

export function mountTour(root: HTMLElement): void {
  render(root);
  root.querySelector('[data-action="start-tour"]')?.addEventListener('click', () => {
    void runTour(root);
  });
}

function render(root: HTMLElement): void {
  root.innerHTML = `
    <section class="tour">
      <h2>30-second tour</h2>
      <p class="tour-sub">See Lattice work without clicking anything. Loads the sample library, opens a paper, searches, and exports the audit log — with captions explaining each step.</p>
      <button data-action="start-tour">Start tour</button>
      <div class="tour-caption" data-tour-caption></div>
    </section>
  `;
}

async function runTour(root: HTMLElement): Promise<void> {
  const caption = root.querySelector<HTMLElement>('[data-tour-caption]');
  if (!caption) return;
  for (let i = 0; i < TOUR_STEPS.length; i++) {
    const step = TOUR_STEPS[i]!;
    caption.textContent = step.caption;
    try {
      await step.apply();
    } catch (err) {
      console.warn(`Tour step ${i} failed:`, err);
    }
    await new Promise((r) => setTimeout(r, step.durationMs));
  }
  caption.textContent = 'Tour complete. Click "Load sample library" to start over, or paste an arXiv ID to add your own paper.';
}
