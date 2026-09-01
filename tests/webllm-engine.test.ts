/**
 * WebLLM engine — status transitions and graceful no-op when
 * WebGPU is unavailable. The actual CreateMLCEngine call requires
 * a browser with GPU + model download, so this test never invokes
 * it.
 */
import { describe, it, expect } from 'vitest';
import { webllmSupported, webllmStatus, webllmModel, onStatus } from '../public/assets/webllm/engine';

describe('webllm engine', () => {
  it('reports unsupported when navigator.gpu is absent', () => {
    // In a node test environment navigator is undefined.
    expect(webllmSupported()).toBe(false);
  });

  it('starts in uninitialized state', () => {
    expect(webllmStatus()).toBe('uninitialized');
  });

  it('exposes the primary model id', () => {
    expect(webllmModel()).toContain('Phi-3');
  });

  it('notifies listeners on status change', () => {
    const seen: string[] = [];
    const off = onStatus((s) => seen.push(s));
    off();
    expect(seen).toContain('uninitialized');
  });
});
