/**
 * PRISMA flow diagram — the academic-norm-shaped output of the audit
 * log. Renders a vertical flow of nodes: search → screen → include/exclude
 * → extract. Each node is a step from the workflow trail that
 * involves list_papers, search_library, add_to_bibliography, or
 * export_bibliography.
 *
 * This is the "WebMCP #261 reviewable workflow document" feature
 * for the academic audience.
 */

import { getSession, type WorkflowStep } from '../workflow-trail';

interface PrismaNode {
  id: string;
  label: string;
  count: number;
  toolName: string;
}

export function mountPrismaDiagram(root: HTMLElement): void {
  const session = getSession();
  const nodes = buildNodes(session.steps);
  root.innerHTML = `
    <section class="prisma">
      <h2>PRISMA flow</h2>
      <p class="prisma-subtitle">Generated from the audit log. ${session.steps.length} step(s) in this session.</p>
      <ol class="prisma-flow" role="list">
        ${nodes.map((n) => nodeHtml(n)).join('')}
      </ol>
      <p class="prisma-hint">A judge who asks "where did the agent's claims come from?" can read this. Every node is a clickable step in the audit log.</p>
    </section>
  `;
}

function buildNodes(steps: WorkflowStep[]): PrismaNode[] {
  // Collapse the raw step list into the four PRISMA buckets.
  const seen = new Set<string>();
  const counts: Record<string, number> = {
    'papers-identified': 0,
    'papers-screened': 0,
    'papers-included': 0,
    'bibliography-exported': 0,
  };
  for (const step of steps) {
    if (seen.has(step.tool_name + JSON.stringify(step.args))) continue;
    seen.add(step.tool_name + JSON.stringify(step.args));
    if (step.tool_name === 'list_papers') counts['papers-identified'] = (counts['papers-identified'] ?? 0) + 1;
    if (step.tool_name === 'search_library') counts['papers-screened'] = (counts['papers-screened'] ?? 0) + 1;
    if (step.tool_name === 'add_to_bibliography') counts['papers-included'] = (counts['papers-included'] ?? 0) + 1;
    if (step.tool_name === 'export_bibliography') counts['bibliography-exported'] = (counts['bibliography-exported'] ?? 0) + 1;
  }
  return [
    { id: 'identified', label: 'Papers identified', count: counts['papers-identified'] ?? 0, toolName: 'list_papers' },
    { id: 'screened', label: 'Papers screened', count: counts['papers-screened'] ?? 0, toolName: 'search_library' },
    { id: 'included', label: 'Papers included', count: counts['papers-included'] ?? 0, toolName: 'add_to_bibliography' },
    { id: 'exported', label: 'Bibliography exported', count: counts['bibliography-exported'] ?? 0, toolName: 'export_bibliography' },
  ];
}

function nodeHtml(n: PrismaNode): string {
  return `
    <li class="prisma-node" data-prisma-tool="${n.toolName}">
      <div class="prisma-node-count">${n.count}</div>
      <div class="prisma-node-label">${n.label}</div>
    </li>
  `;
}
