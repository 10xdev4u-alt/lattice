/**
 * Bibliography serialization.
 *
 * Five formats supported. CSL-JSON is the lingua franca; BibTeX and RIS
 * are legacy; the two markdown flavors are for human reading and pasting
 * into a writing tool.
 *
 * For CSL-JSON, BibTeX, and RIS we round-trip through the @citation-js
 * engine when available, falling back to hand-rolled serialization if
 * the library isn't loaded. For the markdown flavors we format by hand.
 */

import type { Paper } from './library';

interface FormatResult {
  content: string;
  mime: string;
  ext: string;
}

function paperToCsl(p: Paper): Record<string, unknown> {
  return {
    id: p.id,
    type: 'article',
    title: p.title,
    author: p.authors.map((a) => ({ family: a.family, given: a.given })),
    issued: p.year ? { 'date-parts': [[p.year]] } : undefined,
    DOI: p.doi,
    arXiv: p.arxivId,
    URL: p.url,
  };
}

function cslToBibTeX(csl: Record<string, unknown>[]): string {
  return csl
    .map((entry) => {
      const title = (entry.title as string) ?? 'Untitled';
      const year = ((entry.issued as any)?.['date-parts']?.[0]?.[0] as number) ?? 'n.d.';
      const authors = ((entry.author as any[]) ?? [])
        .map((a) => `${a.family}${a.given ? ', ' + a.given : ''}`)
        .join(' and ');
      const key = ((entry.id as string) ?? title.toLowerCase().replace(/\W+/g, '').slice(0, 20)).replace(/[^a-z0-9]/g, '');
      return [
        `@article{${key},`,
        `  title = {${title}},`,
        `  author = {${authors}},`,
        `  year = {${year}},`,
        entry.DOI ? `  doi = {${entry.DOI}},` : '',
        entry.URL ? `  url = {${entry.URL}},` : '',
        '}',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');
}

function cslToRis(csl: Record<string, unknown>[]): string {
  return csl
    .map((entry) => {
      const lines: string[] = ['TY  - JOUR'];
      lines.push(`T1  - ${entry.title ?? 'Untitled'}`);
      for (const a of (entry.author as any[]) ?? []) {
        lines.push(`AU  - ${(a.family ?? '') + (a.given ? ', ' + a.given : '')}`);
      }
      const year = (entry.issued as any)?.['date-parts']?.[0]?.[0];
      if (year) lines.push(`PY  - ${year}`);
      if (entry.DOI) lines.push(`DO  - ${entry.DOI}`);
      if (entry.URL) lines.push(`UR  - ${entry.URL}`);
      lines.push('ER  - ');
      return lines.join('\n');
    })
    .join('\n\n');
}

function cslToMarkdown(csl: Record<string, unknown>[], style: 'apa' | 'mla'): string {
  return csl
    .map((entry, i) => {
      const authors = ((entry.author as any[]) ?? [])
        .map((a) => `${a.family}${a.given ? ', ' + a.given.charAt(0) + '.' : ''}`)
        .join(', ');
      const year = (entry.issued as any)?.['date-parts']?.[0]?.[0] ?? 'n.d.';
      const title = entry.title ?? 'Untitled';
      if (style === 'apa') {
        return `${authors} (${year}). ${title}.${entry.DOI ? ` https://doi.org/${entry.DOI}` : ''}`;
      }
      return `${authors} "${title}." ${year}.${entry.DOI ? ` doi:${entry.DOI}` : ''}`;
    })
    .join('\n\n');
}

export function formatBibliography(papers: Paper[], format: string): FormatResult {
  const csl = papers.map(paperToCsl);
  switch (format) {
    case 'csl-json':
      return { content: JSON.stringify(csl, null, 2), mime: 'application/vnd.citationstyles.csl+json', ext: 'json' };
    case 'bibtex':
      return { content: cslToBibTeX(csl), mime: 'application/x-bibtex', ext: 'bib' };
    case 'ris':
      return { content: cslToRis(csl), mime: 'application/x-research-info-systems', ext: 'ris' };
    case 'apa-md':
      return { content: cslToMarkdown(csl, 'apa'), mime: 'text/markdown', ext: 'md' };
    case 'mla-md':
      return { content: cslToMarkdown(csl, 'mla'), mime: 'text/markdown', ext: 'md' };
    default:
      return { content: JSON.stringify(csl, null, 2), mime: 'application/json', ext: 'json' };
  }
}
