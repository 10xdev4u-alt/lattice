/**
 * Feedback — 👍/👎 on every agent message.
 *
 * Each agent message gets two buttons. Click 👍 to record a
 * positive signal, 👎 for negative. The data persists to
 * localStorage as a session-scoped log. The Lattice team can
 * use this to fine-tune prompts and the tool surface.
 *
 * The data shape:
 *   { sessionId, messageHash, text, feedback: 'up' | 'down', timestamp }
 *
 * messageHash is a short stable fingerprint of the message text,
 * not an index, so the feedback survives message-array reordering.
 *
 * In a real deploy, this would sync to a server endpoint. For
 * the demo, the local log is enough to demonstrate the pattern.
 */

const STORAGE_KEY = 'lattice.feedback.v1';

export interface FeedbackEntry {
  sessionId: string;
  messageIndex: number;
  text: string;
  feedback: 'up' | 'down';
  timestamp: string;
}

function read(): FeedbackEntry[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as FeedbackEntry[];
  } catch {
    return [];
  }
}

function write(entries: FeedbackEntry[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function recordFeedback(entry: Omit<FeedbackEntry, 'timestamp'>): void {
  const all = read();
  all.push({ ...entry, timestamp: new Date().toISOString() });
  write(all);
  document.dispatchEvent(new CustomEvent('lattice:feedback-changed'));
}

export function getFeedbackForMessage(sessionId: string, messageIndex: number): 'up' | 'down' | null {
  return read().find((e) => e.sessionId === sessionId && e.messageIndex === messageIndex)?.feedback ?? null;
}

export function getAllFeedback(): FeedbackEntry[] {
  return read();
}
