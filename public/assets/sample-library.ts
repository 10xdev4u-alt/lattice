/**
 * Sample library — 5 well-known papers for the one-click demo.
 * Issue: #84 — which papers to ship.
 *
 * The full ingest + enrichment lands in the pdf-pipeline sprint. For the
 * scaffold we seed the library with metadata only; the agent reads the
 * title/abstract and the demo works against those.
 */

import { addPaper, type Paper } from './library';

const SAMPLE_PAPERS: Omit<Paper, 'addedAt'>[] = [
  {
    id: 'arxiv:1706.03762',
    title: 'Attention Is All You Need',
    authors: [
      { family: 'Vaswani', given: 'A.' },
      { family: 'Shazeer', given: 'N.' },
      { family: 'Parmar', given: 'N.' },
      { family: 'Uszkoreit', given: 'J.' },
      { family: 'Jones', given: 'L.' },
      { family: 'Gomez', given: 'A. N.' },
      { family: 'Kaiser', given: 'Ł.' },
      { family: 'Polosukhin', given: 'I.' },
    ],
    year: 2017,
    doi: '10.48550/arXiv.1706.03762',
    arxivId: '1706.03762',
    abstract:
      'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely.',
    source: 'sample',
  },
  {
    id: 'arxiv:1810.04805',
    title: 'BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding',
    authors: [{ family: 'Devlin', given: 'J.' }, { family: 'Chang', given: 'M.' }, { family: 'Lee', given: 'K.' }, { family: 'Toutanova', given: 'K.' }],
    year: 2018,
    doi: '10.48550/arXiv.1810.04805',
    arxivId: '1810.04805',
    abstract:
      'We introduce a new language representation model called BERT, which stands for Bidirectional Encoder Representations from Transformers. BERT is designed to pre-train deep bidirectional representations from unlabeled text by jointly conditioning on both left and right context in all layers.',
    source: 'sample',
  },
  {
    id: 'arxiv:2005.14165',
    title: 'Language Models are Few-Shot Learners',
    authors: [{ family: 'Brown', given: 'T. B.' }, { family: 'Mann', given: 'B.' }, { family: 'Ryder', given: 'N.' }, { family: 'Subbiah', given: 'M.' }, { family: 'Kaplan', given: 'J.' }],
    year: 2020,
    doi: '10.48550/arXiv.2005.14165',
    arxivId: '2005.14165',
    abstract:
      'Recent work has demonstrated substantial gains on many NLP tasks and benchmarks by pre-training on a large corpus of text followed by fine-tuning on a specific task. We train GPT-3, an autoregressive language model with 175 billion parameters, and test its performance in the few-shot setting.',
    source: 'sample',
  },
  {
    id: 'arxiv:2201.11903',
    title: 'Chain-of-Thought Prompting Elicits Reasoning in Large Language Models',
    authors: [{ family: 'Wei', given: 'J.' }, { family: 'Wang', given: 'X.' }, { family: 'Schuurmans', given: 'D.' }, { family: 'Bosma', given: 'M.' }, { family: 'Ichter', given: 'B.' }],
    year: 2022,
    doi: '10.48550/arXiv.2201.11903',
    arxivId: '2201.11903',
    abstract:
      'We explore how generating a chain of thought — a series of intermediate reasoning steps — significantly improves the ability of large language models to perform complex reasoning.',
    source: 'sample',
  },
  {
    id: 'arxiv:2303.08774',
    title: 'GPT-4 Technical Report',
    authors: [{ family: 'OpenAI' }],
    year: 2023,
    doi: '10.48550/arXiv.2303.08774',
    arxivId: '2303.08774',
    abstract:
      'We report the development of GPT-4, a large multimodal model that can accept image and text inputs and produce text outputs. GPT-4 exhibits human-level performance on various professional and academic benchmarks.',
    source: 'sample',
  },
];

export function loadSampleLibrary(): void {
  const now = new Date().toISOString();
  for (const paper of SAMPLE_PAPERS) {
    addPaper({ ...paper, addedAt: now });
  }
  // Fire the real ingests so the LLM-backed tools have actual
  // paper text to work from (the server fetches the LaTeX and
  // builds the search index). Best-effort and off the critical
  // path: the library is usable immediately from metadata.
  void ingestAll();
}

async function ingestAll(): Promise<void> {
  for (const paper of SAMPLE_PAPERS) {
    if (!paper.arxivId) continue;
    try {
      const res = await fetch('/api/papers/from-arxiv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ arxiv_id: paper.arxivId }),
      });
      // 409 = already ingested; anything else non-201 we ignore so
      // one bad paper can't stall the rest.
      if (!res.ok && res.status !== 409) {
        console.warn(`sample ingest for ${paper.arxivId} returned ${res.status}`);
      }
    } catch {
      // network hiccup — metadata-only is fine for this paper
    }
  }
  document.dispatchEvent(new CustomEvent('lattice:library-changed'));
}
