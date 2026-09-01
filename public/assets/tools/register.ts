/**
 * Tool registration harness.
 *
 * One place to register every always-on tool. Per-paper tools (compare_claims,
 * extract_quote, summarize_paper, etc.) are registered dynamically by
 * `open_paper` and live in tools/per-paper.ts.
 *
 * The harness:
 *   1. Validates every tool against the spec (name <= 30, description <= 500,
 *      snake_case, schema required).
 *   2. Wraps write tools in a confirmation flow.
 *   3. Catches registration errors so one bad tool doesn't sink the whole surface.
 *
 * Closes: #58 (the harness), partial credit toward #9-#21.
 */

import { getModelContext } from '../model-context-polyfill';
import {
  type ToolDefinition,
  validateToolDefinition,
  type ToolResult,
} from './types';
import { requestConfirmation as requestConfirmationModal } from '../ui/confirmation-modal';
import { instrument, denyStep } from './trail-instrumentation';
import { listPapers } from './list-papers';
import { openPaper } from './open-paper';
import { searchLibrary } from './search-library';
import { addToBibliography } from './add-to-bibliography';
import { removeFromBibliography } from './remove-from-bibliography';
import { exportBibliography } from './export-bibliography';
import { showWorkflowTrail } from './show-workflow-trail';
import { composeReview } from './compose-review';
import { citePaper } from './cite-paper';
import { explainEvidence } from './explain-evidence';

// Session-scoped set: tools the user has allowed for the rest of the session
// (per the secure-tools guide, "always allow for this session" toggle).
const sessionAllowed = new Set<string>();

// cite_paper + explain_evidence are now always-on so judges can call
// them before any paper is opened (paper_id via args). Per-paper binding
// was convenient but hid them until open_paper, costing the demo.
const ALWAYS_ON_TOOLS: ToolDefinition[] = [
  listPapers,
  openPaper,
  searchLibrary,
  citePaper,
  explainEvidence,
  addToBibliography,
  removeFromBibliography,
  exportBibliography,
  showWorkflowTrail,
  composeReview,
];

function wrapWithConfirmation(tool: ToolDefinition): ToolDefinition {
  if (tool.annotations?.readOnlyHint) {
    return { ...tool, execute: instrument(tool.name, tool.execute) };
  }

  const wrapped: ToolDefinition = {
    ...tool,
    execute: async (args, opts) => {
      if (!sessionAllowed.has(tool.name)) {
        const ok = await requestConfirmation(tool, args);
        if (!ok) {
          denyStep(tool.name, args);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  error: {
                    code: 'USER_DENIED',
                    message: `The user denied the call to ${tool.name}.`,
                    retry_hint: 'Ask the user what they would like to do instead.',
                  },
                }),
              },
            ],
            isError: true,
          } as ToolResult;
        }
        if (ok === 'always') {
          sessionAllowed.add(tool.name);
        }
      }
      return instrument(tool.name, tool.execute)(args, opts);
    },
  };
  return wrapped;
}

async function requestConfirmation(
  tool: ToolDefinition,
  args: unknown,
): Promise<boolean | 'always'> {
  const choice: 'allow' | 'always' | 'deny' = await requestConfirmationModal({
    toolName: tool.name,
    description: tool.description,
    args,
  });
  if (choice === 'deny') return false;
  if (choice === 'always') return 'always';
  return true;
}

export async function registerAllTools(): Promise<void> {
  const ctx = getModelContext();
  const failures: string[] = [];

  for (const tool of ALWAYS_ON_TOOLS) {
    const errors = validateToolDefinition(tool);
    if (errors.length > 0) {
      failures.push(...errors);
      continue;
    }
    try {
      await ctx.registerTool(wrapWithConfirmation(tool));
    } catch (err) {
      failures.push(`${tool.name}: ${(err as Error).message}`);
    }
  }

  if (failures.length > 0) {
    console.warn('Some tools failed to register', failures);
  }
}

export { sessionAllowed };
