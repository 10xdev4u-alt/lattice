# Lattice API reference

> Internal API surface for the Netlify Functions. Used by the Lattice
> client and (eventually) by third-party integrations. All endpoints
> accept and return JSON unless noted.

## Conventions

- All endpoints are mounted at `/api/`.
- Authentication is by session cookie or `x-session-id` header.
- Rate limits: 60 calls/min and 1000 calls/hr per session. Returns
  `429` with `Retry-After` when exceeded.
- Errors are structured: `{ error: { code, message, retry_hint } }`.

## Endpoints

### GET /api/healthz

Health check. Returns `200 { status: "ok" }`.

### POST /api/papers/ingest

Ingest a PDF. Body: `{ filename, contentBase64 }`. Returns `201` with
the paper record, or:

- `400 BAD_JSON`, `400 MISSING_ARG`, `400 BAD_BASE64`, `400 EMPTY_FILE`
- `413 FILE_TOO_LARGE` (over 25MB)
- `415 NOT_A_PDF` (no `%PDF-` magic bytes)
- `409 DUPLICATE` (SHA-256 already ingested)

### POST /api/papers/from-arxiv

Ingest a paper by arXiv ID. Body: `{ arxiv_id }`. Fetches the Atom
metadata and the LaTeX source from `/e-print`. Returns `201` with
the paper record, or:

- `400 MISSING_ARG`
- `502 ARXIV_FETCH_FAILED` (network or 404)
- `409 DUPLICATE`

### POST /api/papers/<id>/index

Build the per-paper search index. Reads `text.json`, writes
`index.json`. Idempotent. Returns `200` with the index summary, or
`404 NOT_FOUND` if no `text.json`.

### GET /api/papers/<id>/file

Stream the ingested PDF. Returns `200 application/pdf` or `404`.

### POST /api/agents/peer-reviewer

Run the cross-agent persona on a claim. Body: `{ claim, context?,
persona? }`. Returns `200 { challenge: "..." }` or `502` on LLM
failure.

## Tool surface (WebMCP)

The 14 tools are documented in the README. The full schema is
fetchable at runtime via `document.modelContext.getTools()` from a
Chrome 149+ browser with the flag enabled.

## Error codes

| Code | Meaning |
|---|---|
| `BAD_JSON` | Body is not valid JSON |
| `BAD_PATH` | URL path is malformed |
| `MISSING_ARG` | Required field missing |
| `BAD_BASE64` | Base64 field is not valid |
| `EMPTY_FILE` | Decoded content is empty |
| `FILE_TOO_LARGE` | Over 25MB cap |
| `NOT_A_PDF` | No PDF magic bytes |
| `DUPLICATE` | Already ingested (SHA-256) |
| `NOT_FOUND` | Resource doesn't exist |
| `ARXIV_FETCH_FAILED` | arXiv network failure |
| `USER_DENIED` | User denied a write tool |
| `PAPER_NOT_FOUND` | Library doesn't have that paper ID |
| `NOTHING_TO_COMPARE` | compare_claims called with one paper |
