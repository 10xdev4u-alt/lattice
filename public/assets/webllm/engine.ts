/**
 * WebLLM offline engine — private LLM in the browser.
 *
 * Singleton `MLCEngine` created on first offline fallback. The
 * weights download once and Cache API serves them forever, even
 * without a network connection. WebGPU is required; if absent we
 * fail open to "gateway only" and the UI shows a "WebGPU
 * unavailable" badge.
 *
 * Model: `Phi-3-mini-4k-instruct-q4f16_1-MLC` (2.1GB Q4, fastest
 * tool-calling small model that fits WebGPU on a MacBook Air).
 * Backup candidates: `Llama-3.2-1B-Instruct-q4f16_1-MLC` (1.1GB).
 */

export type WebLLMStatus = 'unsupported' | 'uninitialized' | 'loading' | 'ready' | 'error';

const PRIMARY_MODEL = 'Phi-3-mini-4k-instruct-q4f16_1-MLC';

let engineInstance: unknown = null;
let initPromise: Promise<unknown> | null = null;
let lastError: string | null = null;
let statusValue: WebLLMStatus = 'uninitialized';
let modelIdInUse: string = PRIMARY_MODEL;
const listeners = new Set<(s: WebLLMStatus) => void>();

function emit(): void {
  for (const l of listeners) l(statusValue);
}

export function onStatus(listener: (s: WebLLMStatus) => void): () => void {
  listeners.add(listener);
  listener(statusValue);
  return () => listeners.delete(listener);
}

export function webllmStatus(): WebLLMStatus {
  return statusValue;
}

export function webllmModel(): string {
  return modelIdInUse;
}

export function webllmError(): string | null {
  return lastError;
}

export function webllmSupported(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

interface MLCEngineLike {
  chat: { completions: { create(opts: {
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    temperature?: number;
    max_tokens?: number;
    stream?: boolean;
  }): Promise<unknown> } };
}

type CreateMLCEngine = (
  id: string,
  opts?: { initProgressCallback?: (r: { progress: number; text: string }) => void },
) => Promise<MLCEngineLike>;

let MLCEngineCtor: CreateMLCEngine | null = null;

export async function getEngine(): Promise<MLCEngineLike | null> {
  if (!webllmSupported()) {
    statusValue = 'unsupported';
    emit();
    return null;
  }
  if (engineInstance) return engineInstance as MLCEngineLike;
  if (initPromise) return (await initPromise) as MLCEngineLike;
  statusValue = 'loading';
  emit();
  initPromise = (async () => {
    try {
      if (!MLCEngineCtor) {
        // Dynamic import keeps the WebLLM bundle out of the initial
        // bundle until offline fallback fires.
        const mod = (await import(/* @vite-ignore */ '@mlc-ai/web-llm')) as unknown as {
          CreateMLCEngine?: CreateMLCEngine;
        };
        MLCEngineCtor = mod.CreateMLCEngine ?? null;
        if (!MLCEngineCtor) throw new Error('@mlc-ai/web-llm did not export CreateMLCEngine');
      }
      const engine = await MLCEngineCtor(PRIMARY_MODEL, {
        initProgressCallback: (r) => {
          document.dispatchEvent(
            new CustomEvent('lattice:webllm-progress', { detail: { progress: r.progress, text: r.text } }),
          );
        },
      });
      engineInstance = engine;
      modelIdInUse = PRIMARY_MODEL;
      statusValue = 'ready';
      emit();
      return engine;
    } catch (err) {
      lastError = (err as Error).message;
      statusValue = 'error';
      emit();
      return null;
    } finally {
      initPromise = null;
    }
  })();
  return (await initPromise) as MLCEngineLike;
}

export async function offlineComplete(
  prompt: string,
  opts: { signal?: AbortSignal; system?: string; maxTokens?: number; temperature?: number } = {},
): Promise<string | null> {
  const engine = await getEngine();
  if (!engine) return null;
  try {
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
    if (opts.system) messages.push({ role: 'system', content: opts.system });
    messages.push({ role: 'user', content: prompt });
    const res = await engine.chat.completions.create({
      messages,
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens ?? 600,
      stream: false,
    });
    const text = String((res as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message?.content ?? '');
    return text.trim();
  } catch (err) {
    lastError = (err as Error).message;
    return null;
  }
}

/** Prewarm on idle so the first offline call is fast. No-op when
 *  WebGPU is unavailable. */
export function prewarmIfIdle(): void {
  if (!webllmSupported() || engineInstance || initPromise) return;
  const w = window as { requestIdleCallback?: (cb: () => void) => number };
  if (typeof w.requestIdleCallback === 'function') {
    w.requestIdleCallback(() => {
      void getEngine();
    });
  } else {
    setTimeout(() => {
      void getEngine();
    }, 5000);
  }
}
