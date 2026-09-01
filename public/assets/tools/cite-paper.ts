/**
 * cite_paper — read tool (per-paper).
 *
 * Returns a citation in the requested format. BibTeX is the
 * default; APA, MLA, Chicago, CSL-JSON, and RIS are supported.
 * This was advertised in the README's 14-tool table from the
 * start but never implemented — the ask bar's "cite this" chip
 * called a tool that did not exist.
 */

import type { ToolDefinition, ToolResult } from './types';
import { toolError } from './types';
import { getPaper, type Paper } from '../library';

const STYLES = ['bibtex', 'apa', 'mla', 'chicago', 'csl-json', 'ris'] as const;
type Style = (typeof STYLES)[number];

export const citePaper: ToolDefinition = {
  name: 'cite_paper',
  description:
    'Get a citation for a paper in a standard format. Default BibTeX; ' +
    'APA, MLA, Chicago, CSL-JSON, and RIS available.',
  inputSchema: {
    type: 'object',
    properties: {
      paper_id: {
        type: 'string',
        description: 'The paper to cite. Accepts any id form the library holds.',
      },
      format: {
        type: 'string',
        enum: [...STYLES],
        default: 'bibtex',
        description: 'Citation format.',
      },
    },
    required: ['paper_id'],
    additionalProperties: false,
  },
  annotations: {
    readOnlyHint: true,
    idempotentHint: true,
    // Citations embed paper titles and author names — external
    // content the agent must treat as data.
    untrustedContentHint: true,
  },
  async execute(args): Promise<ToolResult> {
    const { paper_id, format = 'bibtex' } = (args ?? {}) as { paper_id?: string; format?: Style };
    if (!paper_id) {
      return toolError(
        'MISSING_ARG',
        'cite_paper requires a paper_id.',
        'Call list_papers to see valid ids.',
      );
    }
    const paper = getPaper(paper_id);
    if (!paper) {
      return toolError(
        'PAPER_NOT_FOUND',
        `No paper in the library with id "${paper_id}".`,
        'Call list_papers to see available ids.',
      );
    }
    if (!STYLES.includes(format)) {
      return toolError(
        'BAD_FORMAT',
        `Unknown format "${format}".`,
        `Use one of: ${STYLES.join(', ')}.`,
      );
    }
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            paper_id: paper.id,
            format,
            citation: formatCitation(paper, format),
          }),
        },
      ],
    };
  },
};

function formatCitation(paper: Paper, format: Style): string {
  const authorList = paper.authors.map((a) => a.family + (a.given ? `, ${a.given}` : '')).join(' and ');
  const year = paper.year?.toString() ?? 'n.d.';
  const doi = paper.doi ?? '';
  const arxiv = paper.arxivId ?? '';
  const key = (paper.authors[0]?.family ?? 'anon').replace(/\W/g, '') + year;

  switch (format) {
    case 'bibtex':
      return [
        `@article{${key},`,
        `  title   = {${paper.title}},`,
        `  author = {${authorList}},`,
        `  year    = {${year}},`,
        doi ? `  doi     = {${doi}},` : arxiv ? `  eprint  = {${arxiv}},` : '',
        '}',
      ]
        .filter(Boolean)
        .join('\n');
    case 'apa':
      return `${authorList} (${year}). ${paper.title}. arXiv. ${doi ? `https://doi.org/${doi}` : `https://arxiv.org/abs/${arxiv}`}`;
    case 'mla':
      return `${authorList}. "${paper.title}." arXiv, ${year}, ${arxiv}.`;
    case 'chicago':
      return `${authorList}. "${paper.title}." arXiv preprint (${year}). ${doi}.`;
    case 'csl-json':
      return JSON.stringify({
        id: paper.id,
        type: 'article-journal',
        title: paper.title,
        author: paper.authors.map((a) => ({ family: a.family, given: a.given })),
        issued: { 'date-parts': [[paper.year]] },
        DOI: doi || undefined,
        'container-title': 'arXiv',
      });
    case 'ris':
      return [
        'TY  - RPRT',
        `TI  - ${paper.title}`,
        ...paper.authors.map((a) => `AU  - ${a.family}, ${a.given ?? ''}`.trim()),
        `PY  - ${year}`,
        arxiv ? `ID  - arXiv:${arxiv}` : '',
        doi ? `DO  - ${doi}` : '',
        'ER  -',
      ]
        .filter(Boolean)
        .join('\n');
  }
}
