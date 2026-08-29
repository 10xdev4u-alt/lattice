/**
 * /api/papers/from-arxiv — ingest a paper from its arXiv ID.
 *
 * Fetches the arXiv metadata via the Atom API and the LaTeX source
 * via /e-print. Stores the source text in Blobs and returns a paper
 * record. Falls back to PDF-only metadata if the source fetch fails.
 *
 * Closes #55.
 */

import type { Config, Context } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { fetchArxivSource } from './_lib/arxiv';

interface FromArxivRequest {
  arxiv_id: string;
}

export default async (req: Request, _ctx: Context): Promise<Response> => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' } }, 405);
  }

  let body: FromArxivRequest;
  try {
    body = (await req.json()) as FromArxivRequest;
  } catch {
    return jsonResponse({ error: { code: 'BAD_JSON', message: 'Body is not valid JSON.' } }, 400);
  }

  if (!body.arxiv_id) {
    return jsonResponse(
      { error: { code: 'MISSING_ARG', message: 'arxiv_id is required.' } },
      400,
    );
  }

  const result = await fetchArxivSource(body.arxiv_id);
  if (!result) {
    return jsonResponse(
      {
        error: {
          code: 'ARXIV_FETCH_FAILED',
          message: 'Could not fetch the paper from arXiv. Check the ID.',
          retry_hint: 'Verify the arXiv ID (e.g., 1706.03762) and try again.',
        },
      },
      502,
    );
  }

  const id = `arxiv-${result.metadata.arxiv_id.replace(/[^\w]/g, '')}`;
  const store = getStore('lattice');
  const sourceKey = `papers/${id}/source.tex`;
  const existing = await store.get(sourceKey);
  if (existing) {
    return jsonResponse(
      {
        error: {
          code: 'DUPLICATE',
          message: 'This arXiv paper is already ingested.',
          retry_hint: 'Call list_papers to see existing entries.',
        },
      },
      409,
    );
  }

  await store.set(sourceKey, result.text, {
    metadata: { arxivId: result.metadata.arxiv_id, byteSize: String(result.byte_size) },
  });
  await store.setJSON(`papers/${id}/text.json`, {
    extractedAt: new Date().toISOString(),
    source: 'arxiv-tex',
    pages: [{ page_number: 1, text: result.text }],
  });

  return jsonResponse(
    {
      paper: {
        id,
        title: result.metadata.title,
        abstract: result.metadata.summary,
        authors: result.metadata.authors.map((name) => {
          const parts = name.split(/\s+/);
          const family = parts.pop() ?? name;
          return { family, given: parts.join(' ') };
        }),
        year: result.metadata.published ? Number(result.metadata.published.slice(0, 4)) : undefined,
        doi: result.metadata.doi ?? undefined,
        arxiv_id: result.metadata.arxiv_id,
        categories: result.metadata.categories,
        source: 'arxiv',
        storage_key: sourceKey,
      },
    },
    201,
  );
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const config: Config = {
  path: '/api/papers/from-arxiv',
  method: 'POST',
};
