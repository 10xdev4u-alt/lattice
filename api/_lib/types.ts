/**
 * Local handler types — Lattice's replacement for
 * @netlify/functions.
 *
 * Every function is `default async (req: Request, ctx: Context) =>
 * Promise<Response>` plus a `config` export with `path` and
 * `method`. The server (server.mjs) reads `config.path` to route.
 */

export interface Config {
  path: string;
  method?: string;
}

export interface Context {
  /** Route params, e.g. { id } from /api/sessions/:id. */
  params?: Record<string, string>;
}

export type Handler = (req: Request, ctx: Context) => Promise<Response>;
