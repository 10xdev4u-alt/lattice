/**
 * remove_from_bibliography — write tool.
 *
 * Inverse of add_to_bibliography. Destructive in the sense that it
 * shrinks a user-curated list, so the harness will confirm.
 *
 * Closes: #17
 */

import type { ToolDefinition, ToolResult } from './types';
import { getBibliography, setBibliography } from '../bibliography';

export const removeFromBibliography: ToolDefinition = {
  name: 'remove_from_bibliography',
  description:
    'Remove a paper from the current bibliography export list. ' +
    'No-op if the paper is not present. Requires user confirmation.',
  inputSchema: {
    type: 'object',
    properties: {
      paper_id: {
        type: 'string',
        description: 'The ID of the paper to remove.',
      },
    },
    required: ['paper_id'],
    additionalProperties: false,
  },
  annotations: {
    // Write tool (destructive): removes a bibliography entry —
    // the confirmation gate must fire.
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
  },
  async execute(args): Promise<ToolResult> {
    const { paper_id } = args as { paper_id: string };
    const current = getBibliography();
    const next = current.filter((p) => p.id !== paper_id);
    setBibliography(next);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ removed: next.length < current.length, paper_id, bibliography_size: next.length }),
        },
      ],
    };
  },
};
