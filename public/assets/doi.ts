/**
 * DOI resolver — turns "10.1234/abc" or "https://doi.org/10.1234/abc"
 * into a paper metadata object via the Crossref REST API. Falls
 * back gracefully on 404 / network error.
 *
 * Crossref returns a JSON document with `DOI`, `title` (array of
 * strings — first is the main title), `author` (array), `issued`
 * (with date-parts), `container-title`, and more.
 *
 * Used by the ingest overlay so the user can paste a DOI as
 * well as an arXiv ID.
 */

export interface DoiMetadata {
  doi: string;
  title: string;
  authors: Array<{ family: string; given?: string }>;
  year?: number;
  containerTitle?: string;
  url: string;
}

interface CrossrefAuthor {
  family?: string;
  given?: string;
}

interface CrossrefIssued {
  'date-parts'?: number[][];
}

interface CrossrefMessage {
  DOI: string;
  title?: string[];
  author?: CrossrefAuthor[];
  issued?: CrossrefIssued;
  'container-title'?: string[];
  URL?: string;
}

export async function resolveDoi(doi: string): Promise<DoiMetadata | null> {
  const cleaned = doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, '').trim();
  if (!cleaned) return null;
  try {
    const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(cleaned)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { message?: CrossrefMessage };
    const m = data.message;
    if (!m) return null;
    return {
      doi: m.DOI,
      title: Array.isArray(m.title) ? m.title[0] ?? cleaned : cleaned,
      authors: (m.author ?? []).map((a) => ({ family: a.family ?? '', given: a.given })),
      year: m.issued?.['date-parts']?.[0]?.[0],
      containerTitle: Array.isArray(m['container-title']) ? m['container-title'][0] : undefined,
      url: m.URL ?? `https://doi.org/${m.DOI}`,
    };
  } catch {
    return null;
  }
}
