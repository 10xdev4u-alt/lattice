/**
 * Global type augmentations for the Lattice client.
 *
 * The modelContext polyfill adds `modelContext` to the Document
 * interface at runtime. The official @types/webmcp-types package
 * doesn't ship with the Netlify dependency, so we declare what we
 * use here. Other augmentations (HTMLElement for getElementById
 * casts, etc.) can land alongside.
 */

declare global {
  interface Document {
    modelContext?: {
      registerTool(
        tool: unknown,
        options?: { signal?: AbortSignal; exposedTo?: string[] },
      ): Promise<void>;
      getTools(options?: { fromOrigins?: string[] }): Promise<unknown[]>;
      executeTool(
        tool: unknown,
        argsJson: string,
        options?: { signal?: AbortSignal },
      ): Promise<unknown>;
      addEventListener(type: 'toolchange', listener: (event: Event) => void): void;
      removeEventListener(type: 'toolchange', listener: (event: Event) => void): void;
    };
  }

  interface Navigator {
    modelContext?: unknown;
  }
}

export {};
