/**
 * export_bibliography — write tool.
 *
 * Triggers a download of the current bibliography in a chosen format.
 * The actual serialization lives in `format-bibliography.ts`. This
 * tool only orchestrates: build the string, hand it to the browser as
 * a Blob, click an invisible link.
 *
 * Closes: #18
 */

import type { ToolDefinition, ToolResult } from './types';
import { toolError } from './types';
import { getBibliography } from '../bibliography';
import { formatBibliography } from '../format-bibliography';

export const exportBibliography: ToolDefinition = {
  name: 'export_bibliography',
  description:
    'Export the current bibliography as a file in the chosen format. ' +
    'Triggers a download in the user\'s browser. ' +
    'Supported formats: csl-json (default), bibtex, ris, apa-md, mla-md. ' +
    'Requires user confirmation.',
  inputSchema: {
    type: 'object',
    properties: {
      format: {
        type: 'string',
        enum: ['csl-json', 'bibtex', 'ris', 'apa-md', 'mla-md'],
        default: 'csl-json',
        description: 'The output format.',
      },
      filename: {
        type: 'string',
        description: 'Optional filename. Default: lattice-bibliography-<date>.<ext>.',
      },
    },
    additionalProperties: false,
  },
  annotations: {
    destructiveHint: false,
  },
  async execute(args): Promise<ToolResult> {
    const { format = 'csl-json', filename } = args as { format?: string; filename?: string };
    const bib = getBibliography();
    if (bib.length === 0) {
      return toolError(
        'EMPTY_BIBLIOGRAPHY',
        'Cannot export an empty bibliography.',
        'Call add_to_bibliography first to add papers.',
      );
    }
    const { content, mime, ext } = formatBibliography(bib, format);
    const date = new Date().toISOString().slice(0, 10);
    const finalName = filename ?? `lattice-bibliography-${date}.${ext}`;
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = finalName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return {
      content: [{ type: 'text', text: JSON.stringify({ exported: true, format, filename: finalName, count: bib.length }) }],
    };
  },
};
