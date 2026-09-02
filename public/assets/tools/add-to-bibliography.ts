/**
 * add_to_bibliography — write tool.
 *
 * Adds a paper to the export list. Requires user confirmation on the
 * first call per session (per the secure-tools guide). The
 * confirmation flow is wrapped at the harness level; this tool only
 * needs to mutate state.
 *
 * Closes: #16
 */

import type { ToolDefinition, ToolResult } from './types';
import { toolError } from './types';
import { getPaper } from '../library';
import { getBibliography, setBibliography } from '../bibliography';

export const addToBibliography: ToolDefinition = {
  name: 'add_to_bibliography',
  description:
    'Add a paper to the current bibliography export list. ' +
    'Idempotent: adding twice is a no-op. ' +
    'Requires user confirmation on the first call per session.',
  inputSchema: {
    type: 'object',
    properties: {
      paper_id: {
        type: 'string',
        description: 'The ID of the paper to add.',
      },
      note: {
        type: 'string',
        description: 'Optional note from the agent about why this paper is being added.',
      },
    },
    required: ['paper_id'],
    additionalProperties: false,
  },
  annotations: {
    // Write tool: mutates the bibliography — must be explicit so
    // the confirmation gate fires (absent = falsy = read-only).
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
  },
  async execute(args): Promise<ToolResult> {
    const { paper_id, note } = args as { paper_id: string; note?: string };
    const paper = getPaper(paper_id);
    if (!paper) {
      return toolError('PAPER_NOT_FOUND', `Paper ${paper_id} not found.`, 'Call list_papers first.');
    }
    const current = getBibliography();
    if (current.some((p) => p.id === paper_id)) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ added: false, reason: 'already in bibliography', paper_id }) }],
      };
    }
    setBibliography([...current, { ...paper, note }]);
    return {
      content: [{ type: 'text', text: JSON.stringify({ added: true, paper_id, bibliography_size: current.length + 1 }) }],
    };
  },
};
