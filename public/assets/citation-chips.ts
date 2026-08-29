/**
 * Citation chips — turn paper-id references in the agent's text
 * into hover-card chips. The agent's replies may contain the
 * literal `arxiv:1706.03762` or `pdf-abc123…` tokens; this module
 * replaces them with clickable chips that show author, year, and
 * a "Read" button.
 *
 * The "challenge this claim" affordance renders a small button
 * beneath every claim the agent makes. Click it and the chat
 * re-asks the agent to defend or retract, with the original claim
 * prepended as context.
 */

import { getPaper } from './library';

const PAPER_ID_PATTERN = /\b(arxiv:[\w.-]+|pdf-[\w]+)\b/g;

export function decorateCitations(root: HTMLElement, onChallenge: (claim: string) => void): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  const textNodes: Text[] = [];
  let node = walker.nextNode();
  while (node) {
    if (node.nodeValue && PAPER_ID_PATTERN.test(node.nodeValue)) {
      textNodes.push(node as Text);
    }
    node = walker.nextNode();
  }
  for (const textNode of textNodes) {
    const parent = textNode.parentNode;
    if (!parent) continue;
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    const text = textNode.nodeValue ?? '';
    for (const match of text.matchAll(PAPER_ID_PATTERN)) {
      const index = match.index ?? 0;
      if (index > lastIndex) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, index)));
      }
      const chip = renderChip(match[0]!);
      fragment.appendChild(chip);
      lastIndex = index + match[0]!.length;
    }
    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }
    parent.replaceChild(fragment, textNode);
  }

  // Add a "challenge" button beneath every agent message.
  root.querySelectorAll<HTMLDivElement>('.agent-message-agent p').forEach((p) => {
    if (p.parentElement?.querySelector('.challenge-btn')) return;
    const text = p.textContent?.trim() ?? '';
    if (text.length < 20) return;
    const btn = document.createElement('button');
    btn.className = 'challenge-btn';
    btn.textContent = 'Challenge this claim';
    btn.addEventListener('click', () => onChallenge(text));
    p.parentElement?.appendChild(btn);
  });
}

function renderChip(paperId: string): HTMLElement {
  const paper = getPaper(paperId);
  const chip = document.createElement('span');
  chip.className = 'citation-chip';
  chip.tabIndex = 0;
  chip.dataset.paperId = paperId;
  if (paper) {
    chip.innerHTML = `
      <span class="citation-chip-label">${escapeHtml(paper.title)}</span>
      <span class="citation-chip-meta">${paper.year ?? 'n.d.'} · ${escapeHtml(paper.authors[0]?.family ?? 'Unknown')}</span>
    `;
  } else {
    chip.innerHTML = `<code class="citation-chip-id">${escapeHtml(paperId)}</code>`;
  }
  chip.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('lattice:paper-opened', { detail: { paper_id: paperId } }));
  });
  return chip;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
