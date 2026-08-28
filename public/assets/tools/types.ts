/**
 * Shared types for the Lattice tool surface.
 *
 * Every tool implements `ToolDefinition`. The harness registers them, the
 * polyfill exposes them, the model calls them. Tools are kept in snake_case
 * verb_noun, descriptions under 500 chars, names under 30 chars.
 *
 * Annotations follow the spec:
 *   - readOnlyHint:      the tool does not mutate state
 *   - untrustedContentHint: the result may include user/external data
 *   - destructiveHint:   the tool may destroy user data
 *   - idempotentHint:    calling with the same args has the same effect as once
 *   - openWorldHint:     the tool may return content the model has not seen
 */

export interface ToolAnnotations {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
  annotations?: ToolAnnotations;
  execute: (args: unknown, opts: { signal: AbortSignal }) => Promise<unknown>;
}

export interface ToolResult {
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'image'; data: string; mimeType: string }
  >;
  isError?: boolean;
}

export const TOOL_CHAR_LIMITS = {
  name: 30,
  description: 500,
  paramDescription: 150,
  outputSize: 1500,
} as const;

export function validateToolDefinition(tool: ToolDefinition): string[] {
  const errors: string[] = [];
  if (tool.name.length > TOOL_CHAR_LIMITS.name) {
    errors.push(`name "${tool.name}" is ${tool.name.length} chars, max ${TOOL_CHAR_LIMITS.name}`);
  }
  if (tool.description.length > TOOL_CHAR_LIMITS.description) {
    errors.push(
      `description for "${tool.name}" is ${tool.description.length} chars, max ${TOOL_CHAR_LIMITS.description}`,
    );
  }
  if (!/^[a-z][a-z0-9_]*$/.test(tool.name)) {
    errors.push(`name "${tool.name}" must be snake_case verb_noun`);
  }
  return errors;
}

/**
 * Helper: structured error per the secure-tools guide. The model can
 * read this and self-correct on retry.
 */
export function toolError(
  code: string,
  message: string,
  retryHint: string,
): ToolResult {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ error: { code, message, retry_hint: retryHint } }),
      },
    ],
    isError: true,
  };
}
