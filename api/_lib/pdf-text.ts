/**
 * PDF text extraction for the Lattice ingest pipeline.
 *
 * Uses pdfjs-dist in a Node context. Returns per-page text, a guessed
 * title (from PDF metadata), the page count, and a list of warnings
 * (e.g. pages with no extractable text, scanned pages).
 *
 * Two-column read-order reconstruction lives in a separate file and a
 * separate PR (issue #44). For the ingest PR we extract per-page text
 * in draw order; the next pass will reorder.
 *
 * Closes: #43 (this is the ingest half; reorder is #44).
 */

interface ExtractedPage {
  page_number: number;
  text: string;
}

interface ExtractionResult {
  title: string | null;
  pageCount: number;
  pages: ExtractedPage[];
  warnings: string[];
}

export async function extractPdfText(bytes: Buffer): Promise<ExtractionResult> {
  // Lazy import so the function bundle stays small for the cold start.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
  });

  const doc = await loadingTask.promise;
  const pages: ExtractedPage[] = [];
  const warnings: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    try {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = content.items
        .map((item: any) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      pages.push({ page_number: i, text });
      if (text.length === 0) {
        warnings.push(`page_${i}_has_no_text`);
      }
      page.cleanup();
    } catch (err) {
      warnings.push(`page_${i}_extraction_failed: ${(err as Error).message}`);
      pages.push({ page_number: i, text: '' });
    }
  }

  let title: string | null = null;
  try {
    const meta = await doc.getMetadata();
    const infoTitle = (meta.info as { Title?: string } | undefined)?.Title;
    if (infoTitle && infoTitle.trim().length > 0) {
      title = infoTitle.trim();
    }
  } catch {
    // Metadata is optional; the client falls back to the filename.
  }

  await doc.cleanup();
  await doc.destroy();

  return {
    title,
    pageCount: doc.numPages,
    pages,
    warnings,
  };
}
