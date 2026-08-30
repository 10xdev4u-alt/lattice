/**
 * JSON extraction from LLM replies.
 *
 * Models wrap JSON in prose or markdown fences, echo schema
 * fragments, or trail off mid-object. This pulls the first
 * balanced {...} from the reply — fenced block first, then the
 * raw text — and returns null when nothing parses, so callers
 * can fall back to treating the reply as plain text.
 */

export function extractJson(reply: string): Record<string, unknown> | null {
  const fenced = reply.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidates = [fenced?.[1], reply];
  for (const c of candidates) {
    if (!c) continue;
    const start = c.indexOf('{');
    if (start === -1) continue;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < c.length; i++) {
      const ch = c[i]!;
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') inString = !inString;
      if (inString) continue;
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(c.slice(start, i + 1)) as Record<string, unknown>;
          } catch {
            break;
          }
        }
      }
    }
  }
  return null;
}
