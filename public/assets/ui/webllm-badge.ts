/**
 * WebLLM badge — header indicator of the offline engine state.
 * Judges see "Private • Phi-3-mini" when cached, honest states
 * otherwise. The badge is a button: clicking offers the download
 * (2.1GB, cached by the browser forever after).
 *
 * States:
 *   unsupported → "WebGPU unavailable" (warn)
 *   loading     → "Downloading offline model… 42%" (warn)
 *   ready       → "Private • Phi-3-mini" (ok)
 *   error       → "Offline failed — click to retry" (err)
 *   fresh       → "Offline: not loaded — click to preload" (warn)
 */

import { webllmSupported, webllmStatus, onStatus, webllmModel, getEngine } from '../webllm/engine';

export function mountWebLLMBadge(host: HTMLElement): void {
  const render = (): void => {
    const supported = webllmSupported();
    const status = webllmStatus();
    const model = webllmModel().replace('-q4f16_1-MLC', '');
    let label: string;
    let state: string;
    if (!supported) {
      label = 'WebGPU unavailable';
      state = 'warn';
    } else if (status === 'ready') {
      label = `Private • ${model}`;
      state = 'ok';
    } else if (status === 'loading') {
      label = 'Downloading offline model…';
      state = 'warn';
    } else if (status === 'error') {
      label = 'Offline failed — click to retry';
      state = 'err';
    } else {
      // uninitialized = never asked. Honest: not loaded yet.
      label = 'Offline: not loaded — click to preload';
      state = 'warn';
    }
    host.innerHTML = `<button type="button" class="webllm-badge" data-state="${state}" title="${label}${supported && status !== 'ready' ? ' — click to download the private model (~2.1GB, cached once)' : ''}"><span class="webllm-dot" aria-hidden="true"></span>${label}</button>`;
    const btn = host.querySelector<HTMLButtonElement>('.webllm-badge');
    btn?.addEventListener('click', () => {
      if (!webllmSupported()) return;
      // getEngine is idempotent: in-flight or cached calls are
      // no-ops; a fresh click starts (or resumes) the download.
      void getEngine();
    });
  };
  render();
  onStatus(render);
  // Listen for progress events from the engine so the download
  // percentage visibly moves while the weights stream in.
  document.addEventListener('lattice:webllm-progress', (e) => {
    const detail = (e as CustomEvent<{ progress?: number }>).detail;
    const btn = host.querySelector<HTMLButtonElement>('.webllm-badge');
    if (btn && webllmStatus() === 'loading' && typeof detail?.progress === 'number' && detail.progress > 0) {
      const pct = Math.min(100, Math.round(detail.progress * 100));
      const lastNode = btn.childNodes[btn.childNodes.length - 1];
      if (lastNode) lastNode.textContent = `Downloading offline model… ${pct}%`;
    }
  });
}
