/**
 * WebMCP live status — the real-time visibility layer.
 *
 * The polyfill's executeTool is the single choke point every
 * agent call passes through, regardless of who made the call
 * (the chat, a palette action, the page's own UI, or a real
 * external agent in Chrome 149+). Instrumenting there means
 * nothing can execute without the UI knowing.
 *
 * The polyfill dispatches webmcp:call-start and webmcp:call-end
 * DOM events; this module is the typed surface the rest of the
 * app listens with, plus helpers for the parts that need to
 * observe without reacting.
 *
 * Events carry: toolName, startedAt (call-start) and durationMs
 * (call-end), ok/error (call-end).
 */

export interface CallStartDetail {
  toolName: string;
  startedAt: number;
}

export interface CallEndDetail {
  toolName: string;
  durationMs: number;
  ok: boolean;
  error?: string;
}

const START = 'webmcp:call-start';
const END = 'webmcp:call-end';

export function onCallStart(listener: (d: CallStartDetail) => void): () => void {
  const h = (e: Event): void => listener((e as CustomEvent<CallStartDetail>).detail);
  document.addEventListener(START, h);
  return () => document.removeEventListener(START, h);
}

export function onCallEnd(listener: (d: CallEndDetail) => void): () => void {
  const h = (e: Event): void => listener((e as CustomEvent<CallEndDetail>).detail);
  document.addEventListener(END, h);
  return () => document.removeEventListener(END, h);
}

/** Dispatch helpers — called from the instrumented polyfill. */
export function dispatchCallStart(toolName: string): void {
  document.dispatchEvent(
    new CustomEvent<CallStartDetail>(START, { detail: { toolName, startedAt: performance.now() } }),
  );
}

export function dispatchCallEnd(toolName: string, durationMs: number, ok: boolean, error?: string): void {
  document.dispatchEvent(
    new CustomEvent<CallEndDetail>(END, { detail: { toolName, durationMs, ok, error } }),
  );
}
