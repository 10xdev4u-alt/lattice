/**
 * Client-safe arXiv metadata fetcher.
 *
 * This is the browser-facing half of netlify/functions/_lib/arxiv.ts.
 * The server version also fetches the gzipped .tex source via
 * node:zlib, which cannot run in the browser — so any client import
 * of the server module crashes the whole app at boot.
 *
 * Only the metadata fetch (plain XML over HTTP) is duplicated here.
 * If you need the .tex source from the client, call the
 * /api/papers/from-arxiv Netlify Function instead.
 */

export interface ArxivMetadata {
  arxiv_id: string;
  title: string;
  summary: string;
  authors: string[];
  published: string | null;
  categories: string[];
  doi: string | null;
}

const ARXIV_API = 'http://export.arxiv.org/api/query';

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

export function stripArxivId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const m = trimmed.match(/(\d{4}\.\d{4,5}(v\d+)?)/);
  if (m) return m[1]!;
  const oldStyle = trimmed.match(/([a-z-]+(?:\.[A-Z]{2})?\/\d{7}(v\d+)?)/);
  if (oldStyle) return oldStyle[1]!;
  return null;
}

function parseAtomEntry(xml: string): ArxivMetadata | null {
  const entryMatch = xml.match(/<entry>([\s\S]*?)<\/entry>/);
  if (!entryMatch) return null;
  const entry = entryMatch[1]!;
  const title = decodeEntities(extractTag(entry, 'title') ?? '').trim();
  const summary = decodeEntities(extractTag(entry, 'summary') ?? '').trim();
  const published = extractTag(entry, 'published');
  const doi = extractTag(entry, 'arxiv:doi') ?? extractTag(entry, 'doi');
  const authors = [...entry.matchAll(/<author>\s*<name>([^<]+)<\/name>\s*<\/author>/g)].map((m) => decodeEntities(m[1]!).trim());
  const categories = [...entry.matchAll(/<category\s+term="([^"]+)"/g)].map((m) => m[1]!);
  const idMatch = entry.match(/<id>([^<]+)<\/id>/);
  const arxivId = idMatch ? idMatch[1]!.split('/').pop() ?? '' : '';
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
