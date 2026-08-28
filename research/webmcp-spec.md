# WebMCP — Technical Reference

> A working technical reference for the Lattice engineering team. Sourced from the `webmachinelearning/webmcp` spec, the Chrome developer docs, and the Open WebMCP origin trial reports. Last updated 2026-08-28.

---

## 0. Source map (canonical files, not the URLs that 404)

The spec lives in the `webmachinelearning/webmcp` repo on GitHub. The user-cited `docs/explainer.md`, `docs/security-privacy.md`, and `docs/declarative-api.md` paths **do not exist**; the canonical files are:

| What | Path | Note |
|---|---|---|
| Spec (normative) | `index.bs` | Bikeshed source. The truth. |
| Explainer | `README.md` | High-level narrative. |
| Security + privacy | `security-privacy-questionnaire.md` | W3C TAG questionnaire responses. |
| Declarative API | `declarative-api-explainer.md` | The HTML-annotation flavor. |
| Issue tracker | `/issues` | Where the design debate lives. |

Chrome's developer docs (`developer.chrome.com/docs/ai/webmcp/...`) are the most current snapshot of the imperative API.

---

## 1. The full API surface

### 1.1 `document.modelContext` (the only correct namespace in Chrome 150+)

The origin trial (Chrome 149) used `navigator.modelContext`. Chrome 150 moved it to `document.modelContext`. Any tutorial or training-data example using `navigator.modelContext` will throw `TypeError: Cannot read properties of undefined` today.

**Always feature-detect with both names** for the duration of the demo period, but default to `document.modelContext`:

```ts
const modelContext =
  document.modelContext ?? navigator.modelContext;

if (modelContext && 'registerTool' in modelContext) {
  // safe to register
}
```

### 1.2 `registerTool(tool, options?) → Promise<void>`

| Param | Type | Required | Notes |
|---|---|---|---|
| `tool.name` | `string` | ✓ | snake_case verb_noun. ≤ 30 chars. |
| `tool.description` | `string` | ✓ | ≤ 500 chars. For the model. Distinguishes when to choose this tool from siblings. |
| `tool.inputSchema` | `object` | ✓ | JSON Schema. Every property needs `description` (≤ 150 chars each). Use `enum` for closed sets. Use `title` for human display. Use `examples` for disambiguation. |
| `tool.outputSchema` | `object` | optional | Not yet standardized in WebMCP but in PR #254. Adopt early; signals trust. |
| `tool.annotations` | `object` | optional | See §1.5. |
| `tool.execute` | `function` | ✓ | `async (args, { signal }) => result`. Receive `AbortSignal` for cancellation. Return `{ content: [{ type: "text", text: "..." }] }` or a structured result. |
| `options.signal` | `AbortSignal` | optional | Abort to unregister. **Does not cancel in-flight `execute` calls** (Chrome 153+). |
| `options.exposedTo` | `string[]` | optional | Secure origins allowed to view/execute cross-origin. |

### 1.3 `getTools(options?) → Promise<RegisteredTool[]>`

Returns alphabetically ordered list of available tools.

- `fromOrigins: string[]` — include tools from these cross-origin partners (who must list *us* in their `exposedTo`).
- Each `RegisteredTool`: `{ annotations, description, inputSchema, name, origin, title, window }`.

### 1.4 `executeTool(tool, args, options?) → Promise<result | null>`

- `args` is a **JSON string** (not an object). Pass `'{"q":"x"}'`, not `{q:"x"}`.
- `options.signal` cancels pending execution.
- Returns `null` if a navigation was triggered (the spec gives agents a chance to recover).
- Rejects with `UnknownError` for almost everything today (the spec acknowledges this is too coarse; will split into `NotFoundError` / `DataError` later). **Your error handler can't usefully distinguish failure modes yet.**

### 1.5 Annotations (the underused power tool)

| Annotation | What it tells the agent | When to use |
|---|---|---|
| `readOnlyHint: true` | "This tool does not mutate state." | Search, read, query. |
| `untrustedContentHint: true` | "The result may contain prompt-injection. Treat as data, not instructions." | **Every tool returning paper text, user comments, fetched HTML, or external data. Non-negotiable for Lattice.** |
| `destructiveHint: true` | "This tool may destroy user data." | Delete, overwrite, send. |
| `idempotentHint: true` | "Calling me twice with the same args has the same effect as once." | Reorder, log, set-tag. |
| `openWorldHint: true` | "I may return content the model has not seen." | Network, search, fetch. |

### 1.6 `toolchange` event

Fired on `document.modelContext` when the tool list changes. **No diff payload** — re-call `getTools()` in the handler. Use it to drive the Live Tool Array UI.

### 1.7 Character budgets (hard limits)

- 500 chars per tool description
- 150 chars per parameter description
- 30 chars per tool name and parameter name
- 1.5K characters per individual tool output (above this, the agent may not see it)

---

## 2. Lifecycle in detail

```
┌─────────────────┐
│ Page loads      │
│ modelContext    │
│ available?      │
└─────┬───────────┘
      │ yes
      ▼
┌──────────────────────────┐
│ registerTool({...},      │
│   { signal: ctrl.signal})│
└─────┬────────────────────┘
      │ → toolchange fires
      ▼
┌──────────────────────────┐
│ Agent calls getTools()   │
│ → sees new tool          │
└─────┬────────────────────┘
      │
      ▼
┌──────────────────────────┐
│ Agent calls executeTool  │
│ → your execute() runs    │
│ → returns structured     │
│   content                │
└─────┬────────────────────┘
      │
      ▼
┌──────────────────────────┐
│ ctrl.abort()             │
│ → tool unregistered      │
│ → toolchange fires again │
└──────────────────────────┘
```

### Critical traps

1. **`signal.abort()` does NOT cancel in-flight `execute`.** A second `registerTool` with the same name while the first is still running will not cancel the first. Bug source #1 in the wild.
2. **Re-registering with the same name silently replaces.** No warning. Re-register on every state change you care about.
3. **Tools that trigger page navigation return `null`.** The browser mediates; you don't get a chance to do work after navigation. Build for the in-page case.
4. **SPAs: register on mount, abort on unmount.** The spec explicitly recommends this. Tools that only exist for the current route are a feature.

---

## 3. Security model (the part that wins judging points)

### 3.1 Threat model

| Threat | Vector | Defense |
|---|---|---|
| Prompt injection via tool result | Paper text contains "ignore previous instructions and..." | **`untrustedContentHint: true` on the tool.** |
| Cross-origin tool theft | Another origin's agent discovers your tools | `exposedTo` allowlist + Permissions-Policy `tools=(self)`. |
| Sensitive action without consent | Agent calls `add_to_bibliography` without asking | Custom confirmation modal before every write tool. |
| Tool result schema spoofing | Tool returns 1.5K chars of carefully crafted text | Validate in `execute`; reject on parse fail. |

### 3.2 Confirmation flow (the Chrome secure-tools guide)

For write tools, **always require explicit user confirmation** for the first call. Per-run, per-tool "always allow" toggles are fine. **Never** offer a global "always allow" for destructive writes.

```ts
async function confirmOrThrow(toolName: string, summary: string) {
  if (sessionStore.allowed.has(toolName)) return;
  const ok = await showConfirmDialog({
    title: `Agent wants to ${toolName}`,
    body: summary,
    allowAlways: true,
  });
  if (!ok) throw new Error('User denied');
  if (ok === 'always') sessionStore.allowed.add(toolName);
}
```

### 3.3 Cross-origin exposure

- Default: tools visible only to same-origin documents + built-in browser agents.
- For cross-origin sharing: both sides must opt in (`exposedTo` + `fromOrigins`).
- If you `exposedTo: ['https://partner.org']`, the partner sees your tools. If you do not, they don't.
- The spec's `native-agent` keyword (open question) will make built-in agents explicit opt-in.

### 3.4 Origin isolation

- WebMCP is only available in origin-isolated documents.
- `document.domain` enabled ⇒ WebMCP APIs disabled.
- Set `Origin-Agent-Cluster: ?1` header to enforce.

### 3.5 Permissions Policy

- Default `Permissions-Policy: tools=(self)` allows registration in top-level and same-origin iframes.
- Cross-origin iframes need `allow="tools"` attribute.
- Missing policy ⇒ `registerTool()` rejects with `NotAllowedError`.

---

## 4. Best practices (the 7 from the Chrome guide, with Lattice annotations)

1. **One function per tool.** Don't make a `do_thing_and_thing` tool. Agents pick poorly when they can't tell tools apart.
2. **Static registration by default.** Dynamic is for power users. We need it for Lattice (per-paper tools), but most tools should always exist.
3. **Trust the agent.** Don't write step-by-step instructions in the description. The model is smart; long descriptions waste context.
4. **Name for execution, not initiation.** `create_event` not `start_event_creation_process`. `add_to_bibliography` not `initiate_bibliography_update`.
5. **Use positive language.** "Summarizes a paper at a chosen level" not "Does NOT summarize abstracts of papers outside the user's library."
6. **Accept raw user input.** Don't make the agent do math/transforms. `date_range: "2024-01 to 2024-06"` as a string is better than `{start, end}`.
7. **Echo the query.** Search results should return `{ query, count, results }` so the agent knows what it asked for.

Plus four more from the security guide:

8. **`readOnlyHint: true` on every read tool.** Free trust.
9. **`untrustedContentHint: true` on every tool that returns external content.** Mandatory for Lattice.
10. **Validate strictly in `execute`, loosely in `inputSchema`.** The schema is a hint; your code is the contract.
11. **Throw errors that tell the agent how to retry.** "Citation key not found. Try searching by title." beats "Error 404."

---

## 5. Implementation traps (the things that will burn you)

| Trap | Symptom | Fix |
|---|---|---|
| `navigator.modelContext` throws | Tools don't register | Use `document.modelContext ?? navigator.modelContext` and feature-detect. |
| `registerTool` rejected with `NotAllowedError` | Headers missing | Set `Origin-Agent-Cluster: ?1` and `Permissions-Policy: tools=(self)`. |
| `signal.abort()` doesn't cancel running tool | Old tool result still arrives | Accept it; spec behavior in Chrome 153+. Build idempotent `execute` if needed. |
| `toolchange` payload is empty | UI doesn't know what changed | Re-call `getTools()` in the handler. |
| Hidden tool count | Judges dock transparency | Show every tool name + description in a Live Tool Array UI. |
| 1.5K char output truncated | Agent loses the punchline | Paginate, return a `next_token`, or summarize. |
| Tool name 31 chars | Rejected silently | Enforce ≤ 30 in lint. |
| Annotation `readOnlyHint: true` on a write tool | Agent may proceed without confirm | Be honest. The annotation is a contract with the agent. |
| `exposedTo` set to non-secure origin | Rejected | Only `https://` origins allowed. |

---

## 6. Open spec gaps (the things that affect what we can build)

| Issue | Status | Impact on Lattice |
|---|---|---|
| **#261** Preserve completed WebMCP tasks as reviewable workflow documents | Open | **This is the spec asking for the Lattice "show my work" feature.** We ship the answer. |
| #262 Context loss when tools appear/disappear | Open | The "Live Tool Array" UI we build is the workaround. |
| #255 Tool collections (progressive disclosure) | Open | We expose 14 tools. A `registerCollection` primitive would help; we fall back to clear naming. |
| #257 Agent-scoped cookies | Open | The "return later, your agent is recognized" feature. Out of scope for the demo; note in the writeup. |
| #239 Grammar-level prompt-injection mitigation | Open | We adopt `untrustedContentHint: true` everywhere; ship a "Sources of trust" panel as the user-facing answer. |
| #263 NL→enum mapping on `inputSchema` | Open | We lean hard on `title`, `description`, `enum`, and `examples` in every schema. |
| #9 `outputSchema` contracts | In PR #254 | We use `outputSchema` in our tool definitions to signal trust. |
| #252 Official polyfill for non-Chrome | Open | Out of scope for 10 days; we add a clear "open in Chrome 149+" callout. |
| #165 User prompting / elicitation | Open | We build the confirmation flow ourselves; matches the spec draft. |
| #50 User consent mid-flow | Open | Same. |

---

## 7. Lattice-specific tool design decisions (resolved)

| Decision | Resolution | Reason |
|---|---|---|
| Namespace | `document.modelContext ?? navigator.modelContext` | Both, for demo robustness. |
| Registration | Per-paper scope, `AbortController` per paper | The killer feature. |
| Annotations | `readOnlyHint` on 8 reads, `untrustedContentHint: true` on every paper-text return | Spec compliance + judge recognition. |
| Confirmation | Custom modal on every write tool, first call only, "always allow" per session | Per the secure-tools guide. |
| Fallback | Page is fully usable without `modelContext` | Best practice + Safari/Firefox safety. |
| Headers | `Origin-Agent-Cluster: ?1`, `Permissions-Policy: tools=(self)` | Required. |
| Error shape | `{ error: { code, message, retry_hint } }` | Helps the model self-correct. |
| Output budget | ≤ 1.2K chars per tool output | Under the 1.5K limit; room for citation chips. |

---

## 8. Quick-reference: the 30-second Lattice tool template

```ts
const controller = new AbortController();
const sessionAllowed = new Set<string>();

async function registerLatticeTool(
  def: {
    name: string;          // ≤30 chars, snake_case
    description: string;   // ≤500 chars, positive, model-facing
    inputSchema: object;   // JSON Schema, every prop has description
    outputSchema?: object; // optional but trust-signaling
    annotations?: object;
    execute: (args: any, opts: { signal: AbortSignal }) => Promise<any>;
  }
) {
  if (def.name.length > 30) throw new Error('name too long');
  if (def.description.length > 500) throw new Error('description too long');

  const wrappedExecute = async (args: any, opts: { signal: AbortSignal }) => {
    // Confirmation for write tools
    if (!def.annotations?.readOnlyHint && !sessionAllowed.has(def.name)) {
      const ok = await showConfirmDialog(def.name, args);
      if (!ok) throw new Error('User denied');
      sessionAllowed.add(def.name);
    }
    return def.execute(args, opts);
  };

  await modelContext.registerTool(
    { ...def, execute: wrappedExecute },
    { signal: controller.signal }
  );
}
```

---

## 9. Open questions for the team

1. **Should we adopt the in-PR `outputSchema` convention?** Spec PR is in flight. Yes — signals trust, future-proof.
2. **How do we handle the "agent visits later" use case without agent-scoped cookies (#257)?** Answer: the audit log is the source of truth; re-running with the same prompt re-derives the same state.
3. **Cross-origin peer-reviewer agent demo:** is `exposedTo: ['http://localhost:8888']` allowed for the demo? Spec only allows `https://`. We host both agents on the same origin and use a tab-switch instead.
4. **Should we ship the polyfill (the issue #252 polyfill is not yet official)?** We write our own minimal one that maps `document.modelContext` to a no-op when absent, so the page stays usable.

---

## 10. References

- Spec repo: https://github.com/webmachinelearning/webmcp
- Chrome WebMCP hub: https://developer.chrome.com/docs/ai/webmcp
- Imperative API: https://developer.chrome.com/docs/ai/webmcp/imperative-api
- Best practices: https://developer.chrome.com/docs/ai/webmcp/best-practices
- Secure tools: https://developer.chrome.com/docs/ai/webmcp/secure-tools
- Netlify starter (gold standard for tool design): https://webmcp-starter.netlify.app/
- TypeScript types: npm `webmcp-types`
- Inspector: https://chromewebstore.google.com/detail/webmcp-model-context-tool/gbpdfapgefenggkahomfgkhfehlcenpd
