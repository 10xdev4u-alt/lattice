/**
 * share-entry — the built entry for share.html.
 *
 * Reads the #share fragment (v1.<b64url>), decrypts it (with a
 * passphrase when p=1), and mounts the read-only session view.
 * The old page imported /assets/share.ts raw — a 404 after vite
 * build; this module is bundled properly.
 */

const params = new URLSearchParams(window.location.hash.slice(1));
const fragment = params.get('share') ?? '';
const wantsPass = params.get('p') === '1';
const passphrase = wantsPass
  ? window.prompt('This link is encrypted. Enter the passphrase:') ?? ''
  : '';
const root = document.getElementById('app-main');

async function main(): Promise<void> {
  const { mountShareView, decodeSessionFromFragmentAsync } = await import('./share');
  if (!root) return;
  if (!fragment) {
    root.innerHTML = '<p class="empty-state">Invalid or missing share link.</p>';
    document.getElementById('app')?.setAttribute('data-state', 'ready');
    return;
  }
  const payload = await decodeSessionFromFragmentAsync(fragment, wantsPass ? passphrase : undefined);
  if (!payload) {
    root.innerHTML = '<p class="empty-state">Invalid share link or wrong passphrase.</p>';
  } else {
    mountShareView(root, payload);
  }
  document.getElementById('app')?.setAttribute('data-state', 'ready');
}

void main();
