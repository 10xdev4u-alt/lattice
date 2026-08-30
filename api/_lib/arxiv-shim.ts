/**
 * Store shim — re-exports getStore from the filesystem-backed
 * store so callers get one import surface. In the Docker runtime
 * the same module serves every function.
 */

export { getStore } from './store';
