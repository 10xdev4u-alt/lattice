/**
 * WebMCP modelContext polyfill.
 *
 * When `document.modelContext` is not available (Safari, Firefox, older Chrome,
 * or Chrome 149 without the flag), this installs a no-op shim so the rest of
 * the codebase can call `document.modelContext.registerTool()` and friends
 * without checking for null on every call.
 *
 * Per the spec: a tool declaration is a hint to a cooperative agent, never a
 * security boundary. The polyfill is therefore safe — there's no privileged
 * tool surface to attack when no agent is present.
 *
 * Closes: #57
 */

import { dispatchCallEnd, dispatchCallStart } from './webmcp-live';

type ToolExecute = (args: unknown, opts: { signal: AbortSignal }) => Promise<unknown>;

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: object;
  annotations?: {
    readOnlyHint?: boolean;
    untrustedContentHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
  execute: ToolExecute;
}

interface RegisteredTool extends ToolDefinition {
  origin: string;
  title?: string;
  window: Window | null;
}

interface ModelContextPolyfill {
  registerTool(tool: ToolDefinition, options?: { signal?: AbortSignal; exposedTo?: string[] }): Promise<void>;
  getTools(options?: { fromOrigins?: string[] }): Promise<RegisteredTool[]>;
  executeTool(tool: RegisteredTool, argsJson: string, options?: { signal?: AbortSignal }): Promise<unknown>;
  addEventListener(type: 'toolchange', listener: (event: Event) => void): void;
  removeEventListener(type: 'toolchange', listener: (event: Event) => void): void;
}

let polyfillInstalled = false;

export function installModelContextPolyfill(): void {
  if (polyfillInstalled) return;
  polyfillInstalled = true;

  const hasNative = 'modelContext' in document && 'registerTool' in (document as any).modelContext;
  if (hasNative) {
    return;
  }

  const tools = new Map<
    string,
    { tool: ToolDefinition; signal: AbortSignal | undefined; exposedTo?: string[] }
  >();
  const listeners = new Set<(event: Event) => void>();

  const fireToolChange = (): void => {
    for (const l of listeners) {
      l(new Event('toolchange'));
    }
  };

  const polyfill: ModelContextPolyfill = {
    async registerTool(tool, options) {
      if (tools.has(tool.name)) {
        throw new Error(`Tool "${tool.name}" is already registered.`);
      }
      tools.set(tool.name, { tool, signal: options?.signal, exposedTo: options?.exposedTo });

      if (options?.signal) {
        options.signal.addEventListener('abort', () => {
          if (tools.get(tool.name)?.signal === options.signal) {
            tools.delete(tool.name);
            fireToolChange();
          }
        });
      }
      fireToolChange();
    },

    // getTools honors the spec's origin filtering: an agent asking
    // from origins X sees only tools registered with
    // exposedTo: [..., X] (or with no exposedTo — visible to all).
    async getTools(options) {
      const from = options?.fromOrigins;
      return Array.from(tools.values())
        .filter(({ exposedTo }) => {
          if (!from || from.length === 0 || !exposedTo || exposedTo.length === 0) return true;
          return exposedTo.some((origin) => from!.includes(origin));
        })
        .map(({ tool }) => ({
          ...tool,
          origin: window.location.origin,
          title: tool.name,
          window: null,
        }));
    },

    async executeTool(tool, argsJson, options) {
      // The instrumentation choke point: every call — from the
      // chat, the palette, page UI, or a real external agent —
      // flows through here, so the UI can watch WebMCP live.
      // The start event fires before the registry lookup so a
      // call to an unknown tool still traces (in red).
      dispatchCallStart(tool.name);
      const t0 = performance.now();
      const entry = tools.get(tool.name);
      if (!entry) {
        dispatchCallEnd(tool.name, Math.round(performance.now() - t0), false, 'not registered');
        throw new Error(`Tool "${tool.name}" is not registered.`);
      }
      let args: unknown = {};
      if (argsJson && argsJson.trim() !== '') {
        try {
          args = JSON.parse(argsJson);
        } catch (err) {
          dispatchCallEnd(tool.name, Math.round(performance.now() - t0), false, 'bad args');
          throw new Error(`Invalid JSON args: ${(err as Error).message}`);
        }
      }
      try {
        const result = await entry.tool.execute(args, {
          signal: options?.signal ?? new AbortController().signal,
        });
        dispatchCallEnd(tool.name, Math.round(performance.now() - t0), true);
        return result;
      } catch (err) {
        dispatchCallEnd(tool.name, Math.round(performance.now() - t0), false, (err as Error).message);
        throw err;
      }
    },

    addEventListener(type, listener) {
      if (type === 'toolchange') {
        listeners.add(listener);
      }
    },

    removeEventListener(type, listener) {
      if (type === 'toolchange') {
        listeners.delete(listener);
      }
    },
  };

  Object.defineProperty(document, 'modelContext', {
    value: polyfill,
    writable: false,
    configurable: true,
  });

  // Also expose on navigator for the Chrome 149 origin-trial namespace
  if (!('modelContext' in navigator)) {
    Object.defineProperty(navigator, 'modelContext', {
      value: polyfill,
      writable: false,
      configurable: true,
    });
  }
}

/** Returns the active modelContext, installing the polyfill on demand. */
export function getModelContext(): ModelContextApi {
  if (!document.modelContext) installModelContextPolyfill();
  return document.modelContext as unknown as ModelContextApi;
}

export interface ModelContextApi {
  registerTool(tool: unknown, options?: { signal?: AbortSignal }): Promise<void>;
  getTools(options?: { fromOrigins?: string[] }): Promise<unknown[]>;
  executeTool(tool: unknown, argsJson: string, options?: { signal?: AbortSignal }): Promise<unknown>;
  addEventListener(type: 'toolchange', listener: (event: Event) => void): void;
  removeEventListener(type: 'toolchange', listener: (event: Event) => void): void;
}
