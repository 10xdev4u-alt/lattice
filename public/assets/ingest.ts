/**
 * Client-side PDF ingest helper.
 *
 * Reads a File from a drag-drop or file-input, base64-encodes it,
 * POSTs it to /api/papers/ingest, and returns the paper record. Errors
 * are surfaced as structured { error: { code, message, retry_hint } }
 * so the user-facing UI can render them.
 */

export interface IngestResult {
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

export interface IngestError {
  code: string;
  message: string;
  retry_hint?: string;
}

const MAX_PDF_BYTES = 25 * 1024 * 1024;
const PDF_MAGIC = '%PDF-';

export async function ingestPdfFile(file: File): Promise<IngestResult> {
  if (file.size === 0) {
    throw structuredError('EMPTY_FILE', 'The file is empty.');
  }
  if (file.size > MAX_PDF_BYTES) {
    throw structuredError(
      'FILE_TOO_LARGE',
      `File is ${file.size} bytes; max is ${MAX_PDF_BYTES}.`,
    );
  }
  // Sniff the magic bytes from the head of the file. The server does the
  // authoritative check; this is a fast client-side guard.
  const head = await file.slice(0, 5).text();
  if (!head.startsWith(PDF_MAGIC)) {
    throw structuredError('NOT_A_PDF', 'File does not start with the %PDF- magic bytes.');
  }

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  const contentBase64 = btoa(binary);

  const res = await fetch('/api/papers/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: file.name, contentBase64 }),
  });

  const body = (await res.json()) as IngestResult | { error: IngestError };
  if (!res.ok) {
    const err = (body as { error: IngestError }).error;
    throw structuredError(err.code, err.message, err.retry_hint);
  }
  return body as IngestResult;
}

function structuredError(code: string, message: string, retryHint?: string): Error {
  const err = new Error(message) as Error & { structured: IngestError };
  err.structured = { code, message, retry_hint: retryHint };
  return err;
}
