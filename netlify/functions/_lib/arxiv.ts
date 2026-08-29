/**
 * arXiv source ingestion fallback.
 *
 * For papers with an arXiv ID we fetch the LaTeX source (vastly more
 * accurate than PDF parsing) and return a clean text dump. Falls back
 * to null on any failure so the caller can use the PDF path instead.
 *
 * The arXiv API returns an Atom 1.0 XML feed on
 * http://export.arxiv.org/api/query?id_list=<id>. The .tex source lives
 * at https://arxiv.org/e-print/<id> as a gzipped tarball or a single .tex
 * file. We try a simple GET, decompress if gzipped, and strip LaTeX
 * commands to get plain text.
 *
 * Closes #55.
 */

import { gunzipSync } from 'node:zlib';

const ARXIV_API = 'http://export.arxiv.org/api/query';
const ARXIV_EPRINT = 'https://arxiv.org/e-print';

export interface ArxivMetadata {
  arxiv_id: string;
  title: string;
  summary: string;
  authors: string[];
  published: string | null;
  categories: string[];
  doi: string | null;
}

export interface ArxivSourceResult {
  metadata: ArxivMetadata;
  text: string;
  byte_size: number;
  is_gzipped: boolean;
}

export async function fetchArxivMetadata(arxivId: string): Promise<ArxivMetadata | null> {
  const cleaned = stripArxivId(arxivId);
  if (!cleaned) return null;

  try {
    const res = await fetch(`${ARXIV_API}?id_list=${encodeURIComponent(cleaned)}`, {
      headers: { Accept: 'application/atom+xml' },
    });
    if (!res.ok) return null;
    const xml = await res.text();
    return parseAtomEntry(xml);
  } catch {
    return null;
  }
}

export async function fetchArxivSource(arxivId: string): Promise<ArxivSourceResult | null> {
  const cleaned = stripArxivId(arxivId);
  if (!cleaned) return null;

  let res: Response;
  try {
    res = await fetch(`${ARXIV_EPRINT}/${encodeURIComponent(cleaned)}`, {
      headers: { Accept: 'application/x-eprint' },
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const buffer = Buffer.from(await res.arrayBuffer());
  const isGzipped = buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
  const text = isGzipped ? gunzipSync(buffer).toString('utf8') : buffer.toString('utf8');

  const metadata = await fetchArxivMetadata(cleaned);
  if (!metadata) return null;

  return {
    metadata,
    text: stripLatex(text),
    byte_size: buffer.length,
    is_gzipped: isGzipped,
  };
}

export function stripArxivId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Accept forms: "1706.03762", "arXiv:1706.03762", "https://arxiv.org/abs/1706.03762v3"
  const m = trimmed.match(/(\d{4}\.\d{4,5}(v\d+)?)/);
  if (m) return m[1]!;
  const oldStyle = trimmed.match(/([a-z\-]+(?:\.[A-Z]{2})?\/\d{7}(v\d+)?)/);
  if (oldStyle) return oldStyle[1]!;
  return null;
}

function parseAtomEntry(xml: string): ArxivMetadata | null {
  const entryMatch = xml.match(/<entry>([\s\S]*?)<\/entry>/);
  if (!entryMatch) return null;
  const entry = entryMatch[1]!;
  const title = decodeEntities(extractTag(entry, 'title') ?? '').trim();
  const summary = decodeEntities(extractTag(entry, 'summary') ?? '').trim();
  const published = extractTag(entry, 'published') ?? null;
  const doi = extractTag(entry, 'arxiv:doi') ?? extractTag(entry, 'doi') ?? null;
  const authorMatches = [...entry.matchAll(/<author>\s*<name>([^<]+)<\/name>\s*<\/author>/g)];
  const authors = authorMatches.map((m) => decodeEntities(m[1]!).trim());
  const categoryMatches = [...entry.matchAll(/<category\s+term="([^"]+)"/g)];
  const categories = categoryMatches.map((m) => m[1]!);
  const arxivIdMatch = entry.match(/<id>([^<]+)<\/id>/);
  const arxivId = arxivIdMatch
    ? arxivIdMatch[1]!.split('/').pop() ?? ''
    : '';
  if (!title) return null;
  return { arxiv_id: arxivId, title, summary, authors, published, categories, doi };
}

function extractTag(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return m ? m[1]!.trim() : null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

export function stripLatex(src: string): string {
  return src
    .replace(/%[^\n]*/g, '') // strip line comments (including mid-line)
    .replace(/\\begin\{[^}]+\}[\s\S]*?\\end\{[^}]+\}/g, '') // strip environments
    .replace(/\\\w+(\[[^\]]*\])?\s*/g, '') // strip commands (preserve args)
    .replace(/[{}]/g, '') // strip remaining braces
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
