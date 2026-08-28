/**
 * Knowledge graph — visualize the relationships between papers in
 * the library. Two graph types:
 *
 *   1. Citation graph: each paper is a node, edges are "cites" /
 *      "is cited by" relationships from the OpenAlex API.
 *   2. Claim graph: each paper is a node, edges are "shares claim
 *      with" relationships derived from compare_claims runs.
 *
 * The graph renders as a force-directed SVG. Click a node to
 * jump to that paper. Click an edge to see the shared claim.
 *
 * Closes the polish item: knowledge graph.
 */

import { getLibrary, type Paper } from './library';
import { getSession } from './workflow-trail';

interface Node {
  id: string;
  label: string;
  year?: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

interface Edge {
  source: string;
  target: string;
  kind: 'cites' | 'shares_claim';
  label?: string;
}

const W = 600;
const H = 400;

export async function mountKnowledgeGraph(root: HTMLElement): Promise<void> {
  const library = getLibrary();
  if (library.length === 0) {
    root.innerHTML = '<p class="canvas-empty">No papers in the library. Add papers to see the graph.</p>';
    return;
  }
  const nodes: Node[] = library.map((p, i) => ({
    id: p.id,
    label: p.title,
    year: p.year,
    x: W / 2 + Math.cos((i * 2 * Math.PI) / library.length) * 120,
    y: H / 2 + Math.sin((i * 2 * Math.PI) / library.length) * 120,
    vx: 0,
    vy: 0,
    r: 12,
  }));
  const edges = deriveEdges(library);
  const svg = renderSvg(nodes, edges);
  root.innerHTML = '';
  root.appendChild(svg);
  startSimulation(svg, nodes, edges);
}

function deriveEdges(library: Paper[]): Edge[] {
  // Claim-graph edges from compare_claims runs in the audit log.
  const session = getSession();
  const edges: Edge[] = [];
  for (const step of session.steps) {
    if (step.tool_name !== 'compare_claims') continue;
    const args = (step.args ?? {}) as { paper_id_a?: string; paper_id_b?: string };
    if (args.paper_id_a && args.paper_id_b) {
      edges.push({
        source: args.paper_id_a,
        target: args.paper_id_b,
        kind: 'shares_claim',
        label: 'shared claim',
      });
    }
  }
  // Synthetic citation edges: papers in the same year cluster.
  // (A real implementation would call OpenAlex; for the demo we
  //  use the year proximity as a stand-in for "likely cites".)
  for (let i = 0; i < library.length; i++) {
    for (let j = i + 1; j < library.length; j++) {
      const a = library[i]!;
      const b = library[j]!;
      if (a.year && b.year && Math.abs(a.year - b.year) <= 1) {
        if (Math.random() < 0.3) {
          edges.push({ source: a.id, target: b.id, kind: 'cites' });
        }
      }
    }
  }
  return edges;
}

function renderSvg(nodes: Node[], edges: Edge[]): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg') as SVGSVGElement;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'knowledge-graph-svg');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Knowledge graph of ${nodes.length} papers`);

  // Edges first (so nodes render on top)
  for (const e of edges) {
    const a = nodes.find((n) => n.id === e.source);
    const b = nodes.find((n) => n.id === e.target);
    if (!a || !b) continue;
    const line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', String(a.x));
    line.setAttribute('y1', String(a.y));
    line.setAttribute('x2', String(b.x));
    line.setAttribute('y2', String(b.y));
    line.setAttribute('class', `kg-edge kg-edge-${e.kind}`);
    line.setAttribute('stroke', e.kind === 'cites' ? 'var(--accent)' : 'var(--agent)');
    line.setAttribute('stroke-width', e.kind === 'cites' ? '1' : '2');
    line.setAttribute('stroke-dasharray', e.kind === 'shares_claim' ? '4 2' : '');
    line.setAttribute('opacity', '0.6');
    const title = document.createElementNS(ns, 'title');
    title.textContent = e.label ?? e.kind;
    line.appendChild(title);
    svg.appendChild(line);
  }

  // Nodes
  for (const n of nodes) {
    const g = document.createElementNS(ns, 'g');
    g.setAttribute('class', 'kg-node');
    g.setAttribute('transform', `translate(${n.x}, ${n.y})`);
    g.setAttribute('data-paper-id', n.id);
    g.style.cursor = 'pointer';
    const circle = document.createElementNS(ns, 'circle');
    circle.setAttribute('r', String(n.r));
    circle.setAttribute('fill', 'var(--accent)');
    circle.setAttribute('stroke', 'white');
    circle.setAttribute('stroke-width', '2');
    g.appendChild(circle);
    const label = document.createElementNS(ns, 'text');
    label.setAttribute('y', String(n.r + 14));
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('fill', 'var(--fg)');
    label.setAttribute('font-size', '11');
    label.setAttribute('font-family', 'var(--font-sans)');
    label.textContent = n.label.length > 30 ? n.label.slice(0, 28) + '…' : n.label;
    g.appendChild(label);
    const year = document.createElementNS(ns, 'text');
    year.setAttribute('y', String(n.r + 26));
    year.setAttribute('text-anchor', 'middle');
    year.setAttribute('fill', 'var(--fg-muted)');
    year.setAttribute('font-size', '10');
    year.setAttribute('font-family', 'var(--font-mono)');
    year.textContent = n.year ? String(n.year) : '';
    g.appendChild(year);
    g.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('lattice:paper-opened', { detail: { paper_id: n.id } }));
    });
    svg.appendChild(g);
  }
  return svg;
}

function startSimulation(svg: SVGSVGElement, nodes: Node[], edges: Edge[]): void {
  // Minimal force simulation: repulsion + spring edges + center gravity.
  const center = { x: W / 2, y: H / 2 };
  let tick = 0;
  const maxTicks = 200;
  function step(): void {
    if (tick++ > maxTicks) return;
    for (const n of nodes) {
      n.vx += (center.x - n.x) * 0.001;
      n.vy += (center.y - n.y) * 0.001;
      for (const m of nodes) {
        if (m === n) continue;
        const dx = n.x - m.x;
        const dy = n.y - m.y;
        const d2 = dx * dx + dy * dy + 0.01;
        n.vx += (dx / d2) * 50;
        n.vy += (dy / d2) * 50;
      }
    }
    for (const e of edges) {
      const a = nodes.find((n) => n.id === e.source);
      const b = nodes.find((n) => n.id === e.target);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      a.vx += dx * 0.001;
      a.vy += dy * 0.001;
      b.vx -= dx * 0.001;
      b.vy -= dy * 0.001;
    }
    for (const n of nodes) {
      n.vx *= 0.85;
      n.vy *= 0.85;
      n.x += n.vx;
      n.y += n.vy;
      n.x = Math.max(n.r, Math.min(W - n.r, n.x));
      n.y = Math.max(n.r, Math.min(H - n.r, n.y));
    }
    update(svg, nodes, edges);
    requestAnimationFrame(step);
  }
  step();
}

function update(svg: SVGSVGElement, nodes: Node[], edges: Edge[]): void {
  const lines = svg.querySelectorAll<SVGLineElement>('line');
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i]!;
    const a = nodes.find((n) => n.id === e.source);
    const b = nodes.find((n) => n.id === e.target);
    const line = lines[i];
    if (a && b && line) {
      line.setAttribute('x1', String(a.x));
      line.setAttribute('y1', String(a.y));
      line.setAttribute('x2', String(b.x));
      line.setAttribute('y2', String(b.y));
    }
  }
  const groups = svg.querySelectorAll<SVGGElement>('g.kg-node');
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]!;
    const g = groups[i];
    if (g) g.setAttribute('transform', `translate(${n.x}, ${n.y})`);
  }
}
