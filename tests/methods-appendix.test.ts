/**
 * Unit tests for the methods-appendix exporter.
 */

import { describe, expect, it } from 'vitest';
import { toMarkdownAppendix, type WorkflowStep, type WorkflowSession } from '../public/assets/workflow-trail';

const SAMPLE_STEPS: WorkflowStep[] = [
  {
    step_id: 1,
    timestamp: '2026-08-28T10:00:00.000Z',
    tool_name: 'list_papers',
    args: {},
    result_summary: '5 papers in the library',
    result_full: {},
    duration_ms: 12,
    status: 'ok',
  },
  {
    step_id: 2,
    timestamp: '2026-08-28T10:00:01.500Z',
    tool_name: 'search_library',
    args: { query: 'transformer' },
    result_summary: '3 hits across 2 papers',
    result_full: {},
    duration_ms: 87,
    status: 'ok',
  },
  {
    step_id: 3,
    timestamp: '2026-08-28T10:00:03.000Z',
    tool_name: 'open_paper',
    args: { paper_id: 'arxiv:1706.03762' },
    result_summary: 'opened',
    result_full: {},
    duration_ms: 4,
    status: 'ok',
  },
];

describe('methods-appendix exporter', () => {
  const session: WorkflowSession = {
    session_id: 'sess_test',
    created_at: '2026-08-28T10:00:00.000Z',
    user_id: 'anon',
    steps: SAMPLE_STEPS,
  };

  it('renders a Markdown document with all steps', () => {
    const md = toMarkdownAppendix(session);
    expect(md).toContain('# AI-assisted methods appendix');
    expect(md).toContain('sess_test');
    expect(md).toContain('Step 1');
    expect(md).toContain('Step 2');
    expect(md).toContain('Step 3');
  });

  it('includes tool names, args, and timestamps', () => {
    const md = toMarkdownAppendix(session);
    expect(md).toContain('list_papers');
    expect(md).toContain('search_library');
    expect(md).toContain('"query": "transformer"');
    expect(md).toContain('2026-08-28T10:00:00.000Z');
  });

  it('handles a session with zero steps', () => {
    const empty: WorkflowSession = { ...session, steps: [] };
    const md = toMarkdownAppendix(empty);
    expect(md).toContain('0 step(s)');
  });
});
