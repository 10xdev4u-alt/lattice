/**
 * Two-column read-order reconstruction for academic PDFs.
 *
 * pdfjs-dist's getTextContent returns positioned text items in the order
 * they were drawn on the page. For two-column papers this interleaves
 * the bottom of the left column with the top of the right column, which
 * destroys the reading order.
 *
 * Strategy (closes #54):
 *   1. For each page, bucket the text items by y-coordinate.
 *   2. Detect the column count from the x-coordinate distribution:
 *      - 1 column: items are clustered around a single x-center.
 *      - 2 columns: items form two clusters separated by a horizontal gap.
 *      - 3 columns: three clusters (rare in academic PDFs but handled).
 *   3. Within each column, sort items by y descending (top-to-bottom in
 *      the visual sense; PDF coordinates are bottom-up so we negate).
 *   4. Concatenate columns left-to-right.
 *   5. Detect line breaks via a y-gap threshold (1.5x line height).
 *
 * Tests in tests/column-detector.test.ts cover the cases that matter:
 * single column, two columns, mixed, and pathological wide tables.
 */

export interface TextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ReconstructedPage {
  page_number: number;
  text: string;
  column_count: number;
}

interface Cluster {
  center: number;
  count: number;
  min: number;
  max: number;
}

const COLUMN_GAP_RATIO = 0.15; // a column gap is at least 15% of the page width
const MIN_ITEMS_PER_COLUMN = 4;
const LINE_BREAK_FACTOR = 1.6; // y-jumps > 1.6x median line height become line breaks

export function reconstructPage(
  items: TextItem[],
  pageWidth: number,
  pageNumber: number,
): ReconstructedPage {
  if (items.length === 0) {
    return { page_number: pageNumber, text: '', column_count: 0 };
  }

  const columnCount = detectColumnCount(items, pageWidth);
  const columns = clusterIntoColumns(items, columnCount, pageWidth);
  const lineHeight = medianLineHeight(items);
  const sortedColumns = columns
    .map((col) => sortColumnTopToBottom(col))
    .sort((a, b) => a[0]!.x - b[0]!.x);

  let text = '';
  for (let c = 0; c < sortedColumns.length; c++) {
    const col = sortedColumns[c]!;
    let previousY: number | null = null;
    for (const item of col) {
      if (previousY !== null) {
        const gap = previousY - item.y;
        if (gap > lineHeight * LINE_BREAK_FACTOR) {
          text += '\n';
        } else {
          text += ' ';
        }
      }
      text += item.str;
      previousY = item.y;
    }
    if (c < sortedColumns.length - 1) text += '\n\n';
  }

  return {
    page_number: pageNumber,
    text: text.replace(/[ \t]+/g, ' ').replace(/\n[ \t]+/g, '\n').trim(),
    column_count: columnCount,
  };
}

function detectColumnCount(items: TextItem[], pageWidth: number): number {
  if (items.length < MIN_ITEMS_PER_COLUMN * 2) return 1;
  const gap = pageWidth * COLUMN_GAP_RATIO;
  const clusters = clusterByX(items, gap);
  if (clusters.length === 1) return 1;
  if (clusters.length === 2) return 2;
  if (clusters.length === 3) return 3;
  return 1;
}

function clusterByX(items: TextItem[], gap: number): Cluster[] {
  const sorted = [...items].sort((a, b) => a.x - b.x);
  const clusters: Cluster[] = [];
  for (const item of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && item.x - last.center < gap) {
      last.center = (last.center * last.count + item.x) / (last.count + 1);
      last.count++;
      last.min = Math.min(last.min, item.x);
      last.max = Math.max(last.max, item.x + item.width);
    } else {
      clusters.push({
        center: item.x,
        count: 1,
        min: item.x,
        max: item.x + item.width,
      });
    }
  }
  return clusters;
}

function clusterIntoColumns(
  items: TextItem[],
  columnCount: number,
  pageWidth: number,
): TextItem[][] {
  if (columnCount === 1) return [items];
  const gap = pageWidth * COLUMN_GAP_RATIO;
  const clusters = clusterByX(items, gap);
  // If the heuristic disagreed (e.g. items spill past a column), trust
  // the actual cluster count, capped at columnCount.
  const effectiveCount = Math.min(clusters.length, columnCount);
  const columnBoundaries: number[] = [];
  for (let i = 0; i < effectiveCount; i++) {
    columnBoundaries.push((clusters[i]!.max + (clusters[i + 1]?.min ?? pageWidth)) / 2);
  }
  return items.reduce<TextItem[][]>(
    (cols, item) => {
      const idx = columnBoundaries.findIndex((b) => item.x + item.width / 2 < b);
      const col = idx === -1 ? cols.length - 1 : idx;
      cols[col]!.push(item);
      return cols;
    },
    Array.from({ length: effectiveCount }, () => [] as TextItem[]),
  );
}

function sortColumnTopToBottom(items: TextItem[]): TextItem[] {
  return [...items].sort((a, b) => b.y - a.y);
}

function medianLineHeight(items: TextItem[]): number {
  if (items.length === 0) return 12;
  const heights = items.map((i) => i.height).sort((a, b) => a - b);
  const mid = Math.floor(heights.length / 2);
  return heights[mid] ?? 12;
}
