/**
 * WebLLM badge — tiny header indicator that the offline engine is
 * ready. Judges see "Private • offline ready" vs "WebGPU unavailable".
 * The badge subscribes to the engine's status events so it flips
 * without a reload.
 */

import { webllmSupported, webllmStatus, onStatus, webllmModel } from '../webllm/engine';

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
      label = 'Offline failed';
      state = 'err';
    } else {
      label = 'Private • offline ready*';
      state = 'warn';
    }
    host.innerHTML = `<span class="webllm-badge" data-state="${state}" title="${label}"><span class="webllm-dot" aria-hidden="true"></span>${label}</span>`;
  };
  render();
  onStatus(render);
  // Listen for progress events from the engine
  document.addEventListener('lattice:webllm-progress', render as EventListener);
}
