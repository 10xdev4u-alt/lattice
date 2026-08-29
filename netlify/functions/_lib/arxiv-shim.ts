/**
 * Netlify Blobs wrapper re-exported for the client.
 *
 * The client can't import from the Functions directory directly
 * because Vite's bundler treats `netlify/functions` as a server
 * entry. This shim re-exports the public surface (getStore) so the
 * client can call into Blobs via the same API the Functions use.
 *
 * In a Netlify deploy, the runtime provides the real `getStore` via
 * `@netlify/blobs`. In the browser demo, the shim is stubbed.
 */

export { getStore } from '@netlify/blobs';
