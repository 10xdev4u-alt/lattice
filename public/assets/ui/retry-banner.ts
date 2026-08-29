/**
 * Retry banner — when a tool call errors, the UI surfaces a
 * small inline banner next to the call in the workflow trail
 * with a "Retry" button. Clicking re-issues the call with the
 * same args and re-runs the wrapper.
 *
 * Uses modelContext.executeTool under the hood, so the retry
 * goes through the same WebMCP path as the original call.
 *
 * Closes the polish item: a per-tool-call retry banner.
 */

import { recordStep } from '../workflow-trail';
import { getModelContext } from '../model-context-polyfill';

export interface RetryableStep {
  tool_name: string;
  args: unknown;
  message_index: number;
}

export async function retryStep(step: RetryableStep, signal: AbortSignal): Promise<unknown> {
  const ctx = getModelContext();
  const start = performance.now();
  try {
    const result = await ctx.executeTool(
      { name: step.tool_name } as any,
      JSON.stringify(step.args ?? {}),
      { signal },
    );
    recordStep({
      tool_name: `${step.tool_name}_retry`,
      args: step.args,
      result_summary: JSON.stringify(result).slice(0, 500),
      result_full: { result, retry: true },
      duration_ms: Math.round(performance.now() - start),
      status: 'ok',
    });
    return result;
  } catch (err) {
    recordStep({
      tool_name: `${step.tool_name}_retry`,
      args: step.args,
      result_summary: `error: ${(err as Error).message}`,
      result_full: { error: (err as Error).message },
      duration_ms: Math.round(performance.now() - start),
      status: 'err',
    });
    throw err;
  }
}

export function appendRetryBanner(
  stepElement: HTMLElement,
  toolName: string,
  args: unknown,
  messageIndex: number,
): void {
  const banner = document.createElement('div');
  banner.className = 'retry-banner';
  banner.innerHTML = `
    <span>Last call to <code>${escapeHtml(toolName)}</code> failed. Want to retry?</span>
    <button data-action="retry">Retry</button>
    <button data-action="dismiss">Dismiss</button>
  `;
  stepElement.appendChild(banner);
  banner.querySelector('[data-action="retry"]')?.addEventListener('click', () => {
    const controller = new AbortController();
    banner.querySelector('[data-action="retry"]')!.textContent = 'Retrying…';
    retryStep({ tool_name: toolName, args, message_index: messageIndex }, controller.signal)
      .then(() => {
        banner.remove();
      })
      .catch((err) => {
        banner.querySelector('[data-action="retry"]')!.textContent = `Failed: ${(err as Error).message}`;
      });
  });
  banner.querySelector('[data-action="dismiss"]')?.addEventListener('click', () => {
    banner.remove();
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
