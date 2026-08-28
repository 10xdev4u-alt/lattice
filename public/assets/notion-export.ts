/**
 * Notion export — the methods appendix formatted for Notion's
 * Markdown import. Notion supports a subset of Markdown: headings,
 * bullet lists, code blocks (with language), bold/italic, and links.
 * Tables and callouts need HTML which Notion imports as a "web
 * bookmark" block — not ideal. We stick to the safe subset.
 *
 * The result is a Markdown string the user pastes into Notion via
 * "Import → Markdown".
 */

import { toMarkdownAppendix, type WorkflowSession } from './workflow-trail';

export function buildNotionImport(session: WorkflowSession): string {
  return toMarkdownAppendix(session);
}

export async function copyNotionImport(md: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(md);
    window.alert('Methods appendix copied. In Notion, click "Import" → "Markdown" and paste.');
  } catch {
    window.alert('Copy failed. Use the regular Export button to download the .md file.');
  }
}
