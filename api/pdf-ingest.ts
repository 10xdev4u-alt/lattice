/**
 * /api/papers/ingest — PDF ingestion endpoint.
 *
 * Validates the upload, stores the PDF in Netlify Blobs, extracts text
 * via pdf.js, computes basic metadata (title, page count, sha256), and
 * returns a paper record the client can save into the library.
 *
 * Closes #43.
 *
 * The actual two-column read-order reconstruction and per-page index
 * land in separate PRs (#44, #46, #47). This PR is the foundation: a
 * paper is uploaded, validated, stored, and its raw text is extracted.
 */

import type { Config, Context } from './_lib/types';
import { getStore } from './_lib/store';
import { storeFor } from './_lib/session';
import { tenantSetCookieHeader } from './_lib/session';
import { createHash } from 'node:crypto';
import { extractPdfText } from './_lib/pdf-text';
import { buildIndex, type PageText } from './_lib/search-index';

interface IngestRequest {
  filename: string;
  contentBase64: string;
}

interface IngestResponse {
  paper: {
    id: string;
    title: string;
    page_count: number;
    sha256: string;
    storage_key: string;
    byte_size: number;
  };
  warnings: string[];
}

const MAX_PDF_BYTES = 25 * 1024 * 1024;
const PDF_MAGIC = Buffer.from('%PDF-', 'utf8');

export default async (req: Request, _ctx: Context): Promise<Response> => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' } }, 405);
  }

  let body: IngestRequest;
  try {
    body = (await req.json()) as IngestRequest;
  } catch {
    return jsonResponse({ error: { code: 'BAD_JSON', message: 'Body is not valid JSON.' } }, 400);
  }

  if (!body.filename || !body.contentBase64) {
    return jsonResponse(
      { error: { code: 'MISSING_ARG', message: 'filename and contentBase64 are required.' } },
      400,
    );
  }

  let bytes: Buffer;
  try {
    bytes = Buffer.from(body.contentBase64, 'base64');
  } catch (_err) {
    return jsonResponse(
      { error: { code: 'BAD_BASE64', message: 'contentBase64 is not valid base64.' } },
      400,
    );
  }

  if (bytes.length === 0) {
    return jsonResponse(
      { error: { code: 'EMPTY_FILE', message: 'Decoded content is empty.' } },
      400,
    );
  }
  if (bytes.length > MAX_PDF_BYTES) {
    return jsonResponse(
      {
        error: {
          code: 'FILE_TOO_LARGE',
          message: `File is ${bytes.length} bytes; max is ${MAX_PDF_BYTES}.`,
        },
      },
      413,
    );
  }
  if (!bytes.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)) {
    return jsonResponse(
      {
        error: {
          code: 'NOT_A_PDF',
          message: 'File does not start with the %PDF- magic bytes.',
        },
      },
      415,
    );
  }

  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const paperId = `pdf-${sha256.slice(0, 16)}`;
  const { tenantId, store } = storeFor(req);
  const needsCookie = !req.headers.get('x-session-id') && !(req.headers.get('cookie') ?? '').includes('lattice_sid=');
  const storageKey = `papers/${paperId}/source.pdf`;

  const existing = await store.get(storageKey);
  if (existing) {
    return jsonResponse(
      {
        error: {
          code: 'DUPLICATE',
          message: 'This PDF is already ingested.',
          retry_hint: 'Call list_papers to see existing entries.',
        },
      },
      409,
    );
  }

    await store.set(storageKey, bytes.toString('base64'), {
      metadata: { originalFilename: body.filename, sha256, mime: 'application/pdf' },
    });

    const warnings: string[] = [];
    let pageCount = 0;
    let title = body.filename.replace(/\.pdf$/i, '');
    let pages: PageText[] = [];
    try {
      const extraction = await extractPdfText(bytes);
      pageCount = extraction.pageCount;
      if (extraction.title) title = extraction.title;
      pages = extraction.pages;
      await store.setJSON(`papers/${paperId}/text.json`, {
        extractedAt: new Date().toISOString(),
        pages: extraction.pages,
        tenant: tenantId ?? 'global',
      });
      for (const w of extraction.warnings) warnings.push(w);
    } catch (_err) {
      void _err;
      warnings.push(`text_extraction_failed`);
    }

    // Auto-build the search index on ingest so the first
    // search_library call has something to read.
    try {
      const index = buildIndex(paperId, pages);
      await store.setJSON(`papers/${paperId}/index.json`, index);
    } catch (_err) {
      void _err;
      warnings.push(`index_build_failed`);
    }

  const response: IngestResponse = {
    paper: {
      id: paperId,
      title,
      page_count: pageCount,
      sha256,
      storage_key: storageKey,
      byte_size: bytes.length,
    },
    warnings,
  };

  return jsonResponse(response, 201);
};

function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  const headers = new Headers({ 'Content-Type': 'application/json', ...extraHeaders });
  return new Response(JSON.stringify(body), { status, headers });
}
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const config: Config = {
  path: '/api/papers/ingest',
  method: 'POST',
};
