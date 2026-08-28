# Lattice error codes

> Every structured error in Lattice has a `code`, a human-readable
> `message`, and an optional `retry_hint` that tells the model (and
> the user) what to try next. This is the canonical list.

## Tool errors (client-side)

| Code | When | Retry hint |
|---|---|---|
| `MISSING_ARG` | A required argument was not provided | "Ask the user for the missing value." |
| `EMPTY_FILE` | A file is empty after decoding | "Pick a non-empty file." |
| `FILE_TOO_LARGE` | File exceeds 25MB | "Compress the PDF or split into chapters." |
| `NOT_A_PDF` | File does not start with `%PDF-` | "Pick a valid PDF." |
| `DUPLICATE` | SHA-256 already in the library | "Call list_papers to see existing entries." |
| `PAPER_NOT_FOUND` | The paper_id is not in the library | "Call list_papers to see valid IDs." |
| `NOTHING_TO_COMPARE` | compare_claims called with one paper | "Open a second paper first." |
| `USER_DENIED` | The user clicked Deny on the confirmation modal | "Ask the user what they want to do instead." |
| `NO_QUOTE_FOUND` | extract_quote found no match for the concept | "Try a different concept or stance." |
| `NO_TEXT` | Paper has no extractable text (likely scanned) | "Try the arXiv path or use OCR (out of scope for the demo)." |

## Function errors (server-side)

| Code | When | Retry hint |
|---|---|---|
| `METHOD_NOT_ALLOWED` | Wrong HTTP method | "Use POST." |
| `BAD_JSON` | Body is not valid JSON | "Fix the JSON." |
| `BAD_PATH` | URL path is malformed | "Check the URL." |
| `BAD_BASE64` | contentBase64 is not valid base64 | "Encode the file as base64." |
| `NOT_FOUND` | Resource does not exist | "Create the resource first." |
| `ARXIV_FETCH_FAILED` | arXiv network failure or 404 | "Verify the arXiv ID and try again." |
| `LLM_FAILED` | Model returned non-200 or unparseable JSON | "Retry; if persistent, fall back to the local scan." |

## Style

- Lowercase, snake_case.
- Stable: once a code is in the wild, don't change its meaning.
- Distinct: don't reuse a code for two different things.
- Documented: every code is in this file. New code, new entry.
- Action-oriented: the retry_hint should tell the model what to do.
