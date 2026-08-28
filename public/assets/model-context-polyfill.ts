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
  registerTool(tool: ToolDefinition, options?: { signal?: AbortSignal }): Promise<void>;
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

  const tools = new Map<string, { tool: ToolDefinition; signal: AbortSignal | undefined }>();
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
      tools.set(tool.name, { tool, signal: options?.signal });

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

    async getTools() {
      return Array.from(tools.values()).map(({ tool }) => ({
        ...tool,
        origin: window.location.origin,
        title: tool.name,
        window: null,
      }));
    },

    async executeTool(tool, argsJson, options) {
      const entry = tools.get(tool.name);
      if (!entry) {
        throw new Error(`Tool "${tool.name}" is not registered.`);
      }
      let args: unknown = {};
      if (argsJson && argsJson.trim() !== '') {
        try {
          args = JSON.parse(argsJson);
        } catch (err) {
          throw new Error(`Invalid JSON args: ${(err as Error).message}`);
        }
      }
      return entry.tool.execute(args, { signal: options?.signal ?? new AbortController().signal });
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

export function getModelContext(): ModelContextPolyfill | (typeof document)['modelContext'] {
  return (document as any).modelContext as ModelContextPolyfill;
}
