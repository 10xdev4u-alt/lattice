/**
 * show_workflow_trail — read tool.
 *
 * The killer feature. Returns the full audit log of tool calls for the
 * current session. Answers WebMCP open issue #261 (preserve completed
 * tasks as reviewable workflow documents).
 *
 * Three formats: `summary` (default, prose the model can relay),
 * `jsonl` (raw log), `markdown` (the methods appendix).
 *
 * Closes: #20
 */

import type { ToolDefinition, ToolResult } from './types';
import { getSession, toMarkdownAppendix } from '../workflow-trail';

export const showWorkflowTrail: ToolDefinition = {
  name: 'show_workflow_trail',
  description:
    "Return the audit log of every tool call the agent has made in this session. " +
    'Use when the user asks "what did you just do?" or "show your work". ' +
    "Three formats: 'summary' (prose, default), 'jsonl' (raw log), 'markdown' (PRISMA-style methods appendix).",
  inputSchema: {
    type: 'object',
    properties: {
      format: {
        type: 'string',
        enum: ['summary', 'jsonl', 'markdown'],
        default: 'summary',
      },
      since_step: {
        type: 'integer',
        minimum: 0,
        description: 'Optional: only show steps after this step number.',
      },
    },
    additionalProperties: false,
  },
  annotations: {
    readOnlyHint: true,
  },
  async execute(args): Promise<ToolResult> {
    const { format = 'summary', since_step = 0 } = args as {
      format?: 'summary' | 'jsonl' | 'markdown';
      since_step?: number;
    };
    const session = getSession();
    const steps = session.steps.filter((s) => s.step_id > since_step);

    if (format === 'jsonl') {
      const text = steps.map((s) => JSON.stringify(s)).join('\n');
      return { content: [{ type: 'text', text }] };
    }
    if (format === 'markdown') {
      return { content: [{ type: 'text', text: toMarkdownAppendix(session) }] };
    }

    // summary
    if (steps.length === 0) {
      return {
        content: [{ type: 'text', text: 'No tool calls recorded yet in this session.' }],
      };
    }
    const lines = steps.map(
      (s) =>
        `Step ${s.step_id} (${s.timestamp}): ${s.tool_name} — ${s.status} in ${s.duration_ms}ms. ${s.result_summary.slice(0, 200)}`,
    );
    return {
      content: [{ type: 'text', text: `Session ${session.session_id} — ${steps.length} step(s):\n\n${lines.join('\n')}` }],
    };
  },
};
