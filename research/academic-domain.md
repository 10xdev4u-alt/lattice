# Academic Research Domain — Brief for Lattice

> Last updated 2026-08-28. Sourced from primary documentation, public pricing pages, and the user-research literature on academic reference management.

---

## 0. TL;DR

Lattice targets a real, deep, unaddressed pain: **the AI did work, but I can't see what it did and I can't show my committee.** Every existing research AI tool (Elicit, Consensus, Scite, ResearchRabbit, Litmaps, Connected Papers) hides the process. Lattice makes the process the page.

---

## 1. Who we are building for

### 1.1 The graduate student / postdoc doing a literature review

Standard workflow (per PRISMA 2020 — endorsed by 170+ medical journals and the default for systematic reviews in CS, economics, and policy):

1. Define the question (PICO for quant, PICo for qual, free-form scoping otherwise)
2. Search databases (PubMed, Embase, Web of Science, Scopus, arXiv, ACL Anthology, IEEE Xplore, ACM DL)
3. Screen titles/abstracts against pre-registered inclusion/exclusion (often in PROSPERO)
4. Retrieve full text, screen again
5. Extract data (often into a piloted extraction sheet)
6. Synthesize (narrative or meta-analytic)
7. Write up to PRISMA 2020

**Time cost:** ~1,189 hours per Cochrane-style review (Elsevier 2022 estimate). Even a quick lit-review chapter is 2–6 weeks part-time.

**Pain points the user-research literature repeats:**

- Metadata round-tripping (BibTeX from Scholar → Zotero → Overleaf → wrong month)
- PDF re-naming and deduping ("Scan0001.pdf" × 400)
- Reformatting on submission (each journal has its own house style)
- Note/highlight fragmentation (Zotero / .docx / .bib / three PDF readers)

### 1.2 The undergraduate writing a research paper

- Source discovery: Google Scholar, Wikipedia, Google (library DBs feel hostile)
- Cites from first 10–20 results, not the 3 most relevant ("satisficing")
- Writes in Google Docs, with EasyBib / Paperpile plugin
- Pain point: format switching (APA / Chicago / MLA / IEEE)

### 1.3 The active researcher reading papers weekly

- 5–30 new papers/week via arXiv daily mail, Scholar alerts, Semantic Scholar alerts, lab Slack, X, conferences
- Triage: TLDR → abstract → figures → skim. Read / later / ignore.
- Reads in PDF reader with annotation (Mac Preview, Zotero, Sioyek, Papers, Readwise Reader)
- Pain point: **the synthesis layer.** "What did I learn from 200 papers?" — no good tool.

### 1.4 Tools they use and why they switch

| Tool | Cost | Storage | Why they choose it | Why they leave |
|---|---|---|---|---|
| **Zotero** | Free (AGPL, by Digital Scholar) | 300MB free sync | Open, LaTeX-friendly, 9,000+ CSL styles, Unpaywall, plugins | Sync is the only paid feature; UI dated |
| **Mendeley** | Free tier, 2GB (Elsevier) | 2GB | Once default, polished UI | 2013 acquisition broke trust; 2018 update lost data; mobile apps removed 2021 |
| **EndNote** | $275 perpetual | Local | University site licenses; Word integration | No LaTeX, no CSL, 1988-era UX |
| **Paperpile** | $2.99/mo academic, $9.99/mo otherwise | Web + G-Drive | Google Docs / Scholar integration | Chrome-only; web-only; vendor lock-in |
| **Papers (ReadCube)** | $3/mo students, $5/mo academic | Cloud | Best PDF reading UX on Mac; iOS Apple Pencil | Conslidated into ReadCube July 2026; not LaTeX-friendly |
| **Citavi** | $89–$1,947 | Local + SQL Server | German medical research | Windows-only; expensive |
| **Bookends** | $59.99 | iCloud | Mac/iOS | Niche |
| **JabRef** | Free (MIT) | Local `.bib` | LaTeX purists, CS researchers | No PDF reader; dated UI |

**Layered on top:**

- **Readwise Reader** — $9.99/mo, 50% academic discount. PDF/EPUB/newsletter/RSS/YouTube/X in one inbox. Highlights → spaced-repetition review. Has an MCP server.
- **Obsidian** — Free for personal; $4–$10/mo for Sync/Publish. Markdown + wikilinks + graph + Canvas. The Zettelkasten tool of choice for grad students.
- **Notion** — Free personal; $10/mo Pro; $8/mo AI add-on. Hierarchical pages, linked DBs, Notion AI.
- **Roam Research** — $15/mo or $500 lifetime. Block-level bidirectional links. Shrinking but passionate base.

**What they pay for vs. what is free:**

- *Free and used daily:* Zotero, arXiv, Semantic Scholar, OpenAlex, Connected Papers (limited), ResearchRabbit, Scholarcy (limited)
- *Free with institution:* EndNote, RefWorks, Mendeley (institutional)
- *Willing to pay $3–$10/mo:* Paperpile, Papers, Readwise, Consensus, Elicit Basic/Pro, Scite, Obsidian Sync
- *Hard to charge:* pure-PDF readers, note apps (habit too strong)

---

## 2. Citation standards

### 2.1 Format shootout

| Format | Era | Strength | Weakness |
|---|---|---|---|
| **BibTeX** (`.bib`) | 1985 | Ubiquitous in STEM; git-versionable; stable 40 years | No real standard; freeform fields; brittle quoting |
| **CSL JSON** | 2010s | Schema-validated; lossless round-trip; vendor-neutral | Verbose; not human-edited |
| **RIS** (`.ris`) | 1980s | Older-than-BibTeX legacy; still everywhere | Under-specified; two-digit year |
| **MODS / TEI** | Library | Rigorous; lossless for libraries | Overkill for end users |
| **APA / MLA / Chicago** | Style | Human-readable | Not a data format |

**The canonical 2026 pipeline:** publisher deposits BibTeX/JSON-XML to Crossref → tools (Zotero, Mendeley, OpenAlex) re-serialize to CSL JSON or BibTeX → CSL processor (citeproc-js, Pandoc) renders to APA/MLA/Chicago.

**Lattice should support CSL JSON as the lingua franca.** That interops with Zotero, Mendeley, Pandoc, Quarto, R Markdown via papaja, Jupyter, every reference manager in the comparison table.

### 2.2 The CSL project

- **Maintainer:** community project; sponsored by Zotero, Mendeley, Papers, RefWorks, Paperpile, Bibcitation
- **What:** XML vocabulary for citation formatting + 10,000+ style files (`.csl`)
- **Processors:** `citeproc-js` (reference implementation; Zotero and Pandoc), `citeproc-py`, `citeproc-rs`
- **Inputs:** BibTeX, BibLaTeX, CSL JSON, CSL YAML, RIS
- **Repo:** https://github.com/citation-style-language/styles
- **Award:** 2019 Open Publishing Award for Open Source Software

### 2.3 arXiv API

- **Endpoint:** `http://export.arxiv.org/api/query` (HTTP GET or POST)
- **Format:** Atom 1.0 XML (unusual in 2026, a small interop tax)
- **Query:** field prefixes — `ti:`, `au:`, `abs:`, `co:`, `jr:`, `cat:`, `all:`. Boolean `AND`, `OR`, `ANDNOT`.
- **Pagination:** `start` + `max_results`
- **Identifiers:**
  - Old-style `archive/YYMMNNN` (e.g., `hep-ex/0307015`)
  - New-style `YYMM.NNNNN` (e.g., `1507.00123`), optional `vN` for version
  - DOIs since 2022: `10.48550/arXiv.YYMM.NNNNN`
- **Categories:** Subject-class taxonomy at https://arxiv.org/category_taxonomy
- **Metadata per entry:** `id`, `published`, `updated`, `title`, `summary`, `author`, `arxiv:comment`, `arxiv:journal_ref`, `<link>` (HTML and PDF), `arxiv:primary_category`, `<category>` (multi)
- **Bulk data:** OAI-PMH + monthly/daily tarballs
- **Rate limit:** undocumented; polite is a few/sec
- **Terms:** Acknowledge required; "arXiv" cannot appear in your product name; commercial users should consider arXiv affiliate status

### 2.4 OpenAlex, Semantic Scholar, Crossref

| Need | Best source |
|---|---|
| Resolve a citation key → DOI | Crossref `/works` search by title |
| Citation graph (forward + backward) | OpenAlex (CC0, free) > Semantic Scholar > Lens.org |
| TLDR / abstractive summary | Semantic Scholar `tldr` field |
| OA copy | OpenAlex `best_oa_location.oa_url` or Unpaywall API |
| Preprint | arXiv API (primary) + OpenAlex `primary_location.source.type == "repository"` |
| Reformat a `.bib` to APA | CSL JSON → citeproc-js (via Pandoc) |
| Bulk dump of a field's papers | OpenAlex `/works?filter=...` paginated, or OpenAlex Snapshot on S3 |

**OpenAlex specifics:**
- 240M+ works, CC0
- Entity types: `works`, `authors`, `sources`, `institutions`, `topics`, `concepts`, `publishers`, `funders`, `keywords`
- ID prefixes: `W`, `A`, `S`, `I`, `T`, `C`, `P`, `F`, `K`
- Work fields: `id`, `doi`, `title`, `publication_year`, `abstract_inverted_index` (yes, inverted because of copyright), `authorships`, `cited_by_count`, `counts_by_year`, `referenced_works`, `related_works`, `open_access`, `best_oa_location`, `primary_topic`, `topics`, `keywords`, `concepts`, `is_retracted`
- Free API key gives 10× rate-limit headroom; pay-as-you-go exists for heavy use

**Semantic Scholar specifics:**
- 200M+ papers, 2.49B citations, 79M authors
- Free REST API, no auth for most
- 1000 RPS shared unauth; API key = 1 RPS dedicated
- Fields: `title`, `abstract`, `year`, `citationCount`, `url`, `publicationTypes`, `publicationDate`, `openAccessPdf`, `authors`, `citations`, `references`, **`tldr`** (auto-generated ~20-word summary, ~60M papers in CS/bio/med), `embedding` (SPECTER2 vector)
- TLDR is the most-cited feature in the LLM era

**Crossref specifics:**
- 3,000+ publishers backing it
- Free REST at `api.crossref.org`, no auth, no rate limit
- Add `?mailto=you@example.com` for "polite pool" priority
- Endpoints: `/works/{doi}`, `/works?filter=...`, `/journals`, `/funders`, `/members`, `/types`, `/licenses`, `/prefixes/{prefix}/works`
- Content negotiation: same endpoint returns JSON, XML, or several citation formats
- Each work: bibliographic metadata, funding, license, ORCID, ROR, sometimes abstracts

**DOI resolution:** `https://doi.org/10.1038/nature12373` → publisher landing. Run by Crossref on behalf of the IDF. No auth, no rate limit. For machine-readable metadata, hit Crossref's `/works/{doi}` directly.

### 2.5 Citation graph data

- OpenAlex: `cited_by_count`, `counts_by_year`, `referenced_works`, `related_works`, `cited_by_percentile_year`, `citation_normalized_percentile`, `fwci`
- Semantic Scholar: `citations`, `references`, `citationCount`, **`influentialCitationCount`** (S2's secret sauce — cites that influenced the citing paper's findings vs. ceremonial)
- Connected Papers: graph viz, not data source. Built on S2. $5/mo, 5 free graphs. Acquired by S2/Ai2 in 2023.
- Litmaps: co-citation + bibliographic-coupling, timeline-first. Free, $10/mo Pro.
- ResearchRabbit: iterative citation-graph discovery. Free (grant + institutional). Claims 1M+ users.

**Distinction to teach users:**
- *Bibliographic coupling* — "papers that cite the same papers as this one" (forward-looking, surfaces foundations)
- *Co-citation* — "papers cited together with this one" (backward-looking, surfaces applications)
- *Direct citation* — literal graph edges

---

## 3. The PDF problem

### 3.1 How academic PDFs are structured

A typical arXiv preprint is a two-column LaTeX document compiled via `pdflatex`/`xelatex`/`lualatex`.

- **Logical structure tree** — usually missing unless `\pdfoutput=1` and a tagged-PDF class is used (rare for preprints)
- **Text** drawn as positioned glyphs with kerning; no "words" in the PDF stream; word boundaries are heuristic
- **Layout:** two-column body, one-column abstract, footnotes, multi-row tables, math equations, figures, citations as `[12]` or `(Smith et al., 2020)`
- **Citations** are hyperlinks since ~2005 (with `hyperref`) pointing to reference-list entries, which hyperlink to DOI URLs. Outbound only.
- **Embedded XMP:** title, author, DOI, journal, keywords — depends on `\pdfinfo`. Often missing on arXiv.
- **Embedded fonts:** TeX/LaTeX commonly embeds Type 3 (glyph-as-bitmap) for math, which is hell on text extractors.

### 3.2 pdf.js capabilities and limits

PDF.js renders PDFs to HTML5 Canvas. The default browser reader everywhere.

- **Strengths:** Renders most PDFs. Forms + XFA. Extracts text per page via `getTextContent()` (a stream of positioned text items).
- **Limits that matter for Lattice:**
  - **No reading order.** Text in the order drawn on the page; two-column papers interleave left-column-bottom with right-column-top. This is the headline problem for "summarize this PDF."
  - **No structural awareness** — no sections, tables, figures, footnotes as concepts.
  - **Math equations** often unrecoverable as text (Type 3, missing Unicode).
  - **Tables** are visual messes; structure must be re-derived.
  - **Performance:** graphics-heavy papers render slowly in pure JS.

This is why "open PDF, paste into GPT, get a summary" is a 60%-accuracy story.

### 3.3 Realistic extraction pipelines

1. **pdf.js textContent + post-processing** (read order, de-hyphenation, math recovery, table reconstruction). Cheapest, browser-friendly, ~80% accuracy on prose, ~30% on tables/equations.
2. **GROBID** (ML-based) → TEI XML with header, body sections, figures, tables, footnotes, bibliographic references, with PDF bounding boxes. F1 ~0.87–0.90 on PubMed Central for header; ~0.76–0.91 for references. Used by ResearchGate, Academia.edu, HAL, European Patent Office, CERN, Internet Archive. Java service; not real-time.
3. **Nougat / PDFTron / Mistral-OCR / commercial APIs.** Vision-LLM based; better on tables/equations, worse on throughput. Meta's Nougat, Adobe Extract API, AWS Textract.
4. **LaTeX source.** arXiv stores source for most papers under `/e-print`. Parsing `.tex` is vastly more accurate than PDF parsing; macros are wildly inconsistent.

**For Lattice:** option 1 is the only practical choice for a PDF the user has open in their browser. For known arXiv IDs, option 4 (fetch source) is the right call.

### 3.4 Citation graph data — see §2.5 above.

---

## 4. The "AI for research" market

### 4.1 The players (2026)

| Tool | Core function | Pricing | Strengths | Weaknesses |
|---|---|---|---|---|
| **Elicit** | AI search over 125M papers; data extraction; systematic-review workflow; Research Reports. 2M+ users. | Free / $49/mo Pro / $169/mo Scale / Enterprise. MCP server + API as of July 2026. | Sentence-level citations. PRISMA 2020 support. Closest to "ChatGPT for serious literature review." | Free tier usage-pool capped. "Up to 80% time savings" is best-case. |
| **Consensus** | AI search engine; question → answer with citations. "Yes/no/maybe" classification. | Free / ~$9/mo | Excellent UX for non-researchers. Bounded hallucination. Web-scale. | Answers are synthesized from abstracts, not full text. Hallucination known. |
| **Scite** | **Smart Citations** — classifies each citation as supporting / contradicting / mentioning the cited claim. Browser extension. | Free / ~$20+/mo / institutional | Only tool that answers "do others agree with this claim?" Surfaces retractions, corrections. | Partial coverage; classifies citation sentence, not whole claim. Paywalled for serious use. |
| **ResearchRabbit** | Iterative citation-graph discovery. | Free | Beautiful network viz. Private libraries. | Coverage gaps outside STEM. No AI summary, no LLM chat. |
| **Litmaps** | Visual seed-map of a literature. | Free (20 papers, 2 maps, monthly alerts) / $10/mo Pro / Team | Monitoring — daily alerts for new citations. Loved by PhDs doing 6-month lit reviews. | "Seed must have enough citations" — broken for niche topics. |
| **Connected Papers** | One-shot graph of ~50 papers related to a seed. | $5/mo, 5 free graphs | Fastest "what's around this paper?" Now part of S2. | One-shot, no monitoring. |
| **Scholarcy** | Summarizes papers into flashcards. | Free / paid | Long-form summary of a single paper. | Quality varies wildly. |

### 4.2 What each does well, what each fails at

- **Elicit owns systematic reviews** (PRISMA workflows, screening, data extraction). Only tool that models the review process.
- **Consensus owns "quick answer"** for non-researchers. Bounded hallucination.
- **Scite owns "do others agree?"** — only tool that exposes support/contradict/mention at sentence level.
- **ResearchRabbit + Litmaps own "what should I read next?"** — discovery and monitoring.
- **Connected Papers owns "what's the neighborhood of this paper?"** — single-shot exploration.
- **Scholarcy owns "give me the gist of this one paper"** — single-paper summarization.

**Fails, in order of costliness:**

1. **No tool exposes an audit trail of the AI's work.** You get a polished answer or a table; you cannot replay the steps.
2. **All tools are walled gardens** for the source corpus. Even though Elicit reads 125M papers, you cannot see which or why a paper was excluded.
3. **"Sources" are not the user's own library.** A researcher's 200 PDFs in Zotero cannot be reasoned over unless the tool is also a Zotero plug-in.
4. **Full-text is gated.** Most tools work on abstracts. Full-text only on Pro+ tiers, and only on OA copies.
5. **Hallucinated citations are still possible.** Consensus and ChatGPT-with-ScholarGPT can cite papers that don't exist.
6. **Reproducibility is weak.** A "Research Report" generated Tuesday cannot be regenerated identically Wednesday.

### 4.3 The "auditable AI" gap

**No, no existing research tool exposes a real audit trail.** Scite comes closest with its visible classification, but the chain behind the classification is hidden. Elicit shows columns + extracted sentence, but not the search that surfaced the paper. Readwise's Ghostreader shows a citation but not the prompt or retrieval.

**Closest analog in non-research software:** the audit log in financial AI tools (Bloomberg's AI features, AlphaSense's Q&A) — but enterprise, not academic.

**Lattice's wedge: auditable AI for research.** This is the cleanest, most defensible gap.

---

## 5. Why WebMCP changes this

### 5.1 What WebMCP uniquely enables

1. **See the user's open PDFs.** A Lattice workspace exposes `lattice://papers/{doi}/current-page` and `lattice://papers/{doi}/selection` as MCP resources. The model already running in the user's browser reads what the user is looking at. **No copy in a vendor's cloud. No "premium tier for full-text."**
2. **Reason over the user's own annotations and notes.** Linked notes (highlights, margin notes, Zettelkasten nodes) exposed as MCP resources. Existing AI tools reason over Elicit's corpus. Lattice reasons over **your** Zettelkasten.
3. **Read AND write back to the same surface.** `add_highlight`, `add_citation`, `link_paper_to_note` as tools. Existing AI tools are mostly read-only and round-trip through `.bib` exports.
4. **Be auditable by construction.** Every MCP tool call is a logged JSON-RPC request. A Lattice workspace persists this log and presents it as the "methods appendix." None of the existing AI research tools have this affordance because none are built on MCP.
5. **Be a peer to other tools, not a destination.** Elicit does not compose with your Zotero library and your Obsidian vault. MCP is composable.
6. **Get the trust of academics who already distrust AI in research.** "The AI saw the paper I had open, retrieved the sentence, generated the claim, and here is the JSON log" is a stronger story than "the AI scanned 50M papers in the cloud."

### 5.2 The "agent sees your open PDFs" angle — done well anywhere?

**No.** Closest analogs:

- **Zotero PDF reader** has a built-in chat that reads the open PDF. But the model is server-side, the log is hidden.
- **Readwise Reader's Ghostreader** summarizes a PDF, but it's Readwise's corpus + Readwise's AI.
- **PDFgear, ChatPDF, AskYourPDF** are read-only cloud services — you upload each one.
- **Browser extensions** (Scite, Elicit, Consensus) inject UI into publisher pages but do not see the PDF the user has open in a separate tab.
- **Sioyek** has a Lua-scriptable shell. Power users wire it to a local LLM. Power-user territory.

**A WebMCP-native Lattice is the first product where the AI agent, the user's open PDF, the user's library, and the user's notes are in the same context window of the same user, with an auditable log.**

### 5.3 The "reviewable workflow" angle — done anywhere in research?

**No.** Adjacent fields:

- **Weights & Biases, MLflow, neptune.ai** expose experiment tracking for ML training. The "run" abstraction (steps with params, code version, environment, results) is what a Lattice "session" should be.
- **Datasheet / Model Card** movements in ML demand provenance. Lattice's audit trail is a "datasheet for AI-assisted literature work."
- **PRISMA flow diagrams** are the closest *academic* analog — search → screen → include/exclude → extract. **No tool today auto-generates a PRISMA diagram from an AI session.**

**The opportunity:** Lattice's audit trail is a PRISMA diagram, a methods appendix, and a weights-and-biases run page, all in one.

---

## 6. The "show your work" expectation

### 6.1 Why academic citation culture demands provenance

- **Reproducibility crisis.** The replication crisis in psych, medicine, ML, economics (Esther Duflo, Brian Nosek, ML Reproducibility Checklist 2018+) made "how do you know?" a first-order question.
- **Peer review is adversarial verification.** Reviewers and readers must retrace a claim to its source. This is the entire function of a citation.
- **Methods sections are sacrosanct.** A paper without "we searched PubMed for X with terms Y on date Z, getting N hits, of which M were included" is considered unverifiable. PRISMA 2020 formalizes; DORA and TOP push further.
- **AI work currently has no equivalent.** "ChatGPT was used to draft" is not a methods section. There is no field-standard for documenting an AI-assisted literature review. This is a regulatory vacuum the community is watching.
- **The community wants this.** Every recent AI policy (Nature 2023, Science 2023, NeurIPS 2024, ICML 2024) requires disclosure **and** the ability to defend outputs. "We can't tell you what the model did" is no longer acceptable.

### 6.2 How this maps to the WebMCP `untrustedContentHint`

In the WebMCP type system, every resource, tool result, prompt result, and sampling message can carry annotations. The standard annotation fields include `audience`, `priority`, `lastModified`, plus the proposed **`untrustedContentHint`** (in active SEP discussion).

**For Lattice:** when the agent reads a PDF the user has open, every MCP resource returned (`lattice://papers/{doi}/page/{n}`, `lattice://selection`) is annotated as untrusted. When the agent cites a paper, the citation carries the source URI, the page, the sentence, and a hash. This is "show your work" as a protocol primitive.

### 6.3 What a "methods appendix for AI work" looks like

```markdown
## AI-Assisted Methods Appendix

### Session
- Tool: Lattice v0.7.3
- Date: 2026-08-28 14:22 UTC
- Model: claude-sonnet-4-5 (host: claude.ai)
- Corpus: OpenAlex snapshot 2026-08-01, arXiv API (full), Semantic Scholar 2.49B citation edges

### Question
"Does self-consistency decoding improve math-reasoning accuracy over greedy decoding?"

### Search
- Initial query: ("self-consistency" AND "chain-of-thought" AND "math")
- Filters: 2021-01-01..2026-08-28, peer-reviewed or arXiv cs.CL/cs.LG/cs.AI
- Hits: 1,842
- After screening (model + user): 47 included

### Extraction
- Per paper: dataset, model, decoding strategy, accuracy, sample size
- Cross-paper synthesis: 3 distinct claims, 2 contradictions identified

### Claims, in order of generation
1. [Claim] — derived from Sentence X of Paper Y (DOI: ..., PDF p.7); Lattice step 14; confidence 0.82; verified by user.
2. [Claim] — derived from Paper Z (DOI: ..., PDF p.4); Lattice step 22; confidence 0.65; flagged for re-check.
3. [Claim] — derived from Paper A (DOI: ..., PDF p.9); Lattice step 31; contradicts Claim 2; flagged.

### Audit trail
- Full JSONL log of MCP tool calls: lattice://sessions/{id}/log
- Replayable: load log into Lattice to regenerate all intermediate outputs deterministically.
```

This is the kind of artifact a PI, a reviewer, or a thesis committee can actually evaluate.

---

## 7. UX patterns to study

### 7.1 PDF readers

- **Sioyek** — Open source, keyboard-driven, two-column papers. Highlights + references hyperlinked for one-key follow-citation navigation. Gold standard for "follow the citation graph visually inside the PDF."
- **Zotero PDF reader** — Built-in since Zotero 6. Annotations, highlights, notes stored in Zotero. Default for most academics today.
- **Papers (ReadCube)** — Best Mac PDF reading UX; iOS Apple Pencil. Now under ReadCube.
- **Mendeley PDF reader** — Readable but unremarkable.
- **Adobe Acrobat** — Industry standard for non-academic PDFs; hated by academics.
- **PDF Expert** — Mac/iOS; beloved.
- **Browser-based (pdf.js) viewers** — Every modern browser. Zero install, zero features. Dominant casual reader.

**UX patterns to steal:**

- Visual citation links (Sioyek)
- Per-paper notes pane (Zotero)
- Search across the library's full text (Zotero, Mendeley)
- Reading position memory (every modern reader)

### 7.2 Highlight + annotation patterns

- Margin color-coding (Zotero's yellow/blue/red/green) — semantic meaning by color. Replaced in newer tools by tags.
- Tag-based highlights (Readwise) — filterable, export to Notion/Obsidian.
- Floating highlights (Apple Books, Kindle) — collection of "all my highlights" in a side pane.
- **W3C Web Annotation Data Model** — `Annotation` has `target` (selector — fragment, range, position), `body` (comment, tag, image), `creator`, `created`, `modified`. Underlies Hypothes.is.

**Lattice recommendation:** highlights should be (a) exportable to W3C Web Annotation, (b) filterable by tag and by paper, (c) addressable as MCP resources (`lattice://highlights/{id}`), (d) re-anchored against the PDF if the PDF version changes (with a confidence score).

### 7.3 Linked notes patterns

- **Zettelkasten** — Niklas Luhmann's 90,000-card system. Atomic notes, link between notes, branch by topic. The philosophical claim: links *are* the knowledge.
- **Obsidian** — Local Markdown, wikilinks `[[note]]`, backlinks, graph view, plugins.
- **Roam Research** — Original block-level bidirectional linking. $15/mo or $500 lifetime.
- **Logseq** — Open-source, local, block-level.
- **Notion** — Hierarchical pages, linked databases, Notion AI.

**Patterns to steal:**

- Backlinks pane (Obsidian, Roam)
- Block-level addressing (Roam, Logseq) — every paragraph has a stable id
- Graph view
- Daily note / journal

### 7.4 Zotero's data model

- Library → Collection (nested, many-to-many with items) → Item (type + CSL fields + stable itemID) → Attachment (PDF, snapshot) + Note (rich text or MD)
- Tag (flat, color-coded)
- Saved search (virtual collection)

**Lattice implications:** A Lattice workspace could be a Zotero library extended with AI-extracted claims as Notes, MCP addresses as Tags, and the audit trail as a hidden item-type. The Better BibTeX "auto-export on change" pattern is gold — Lattice should auto-emit `.bib` / `.csl.json` / `.md` files on every change.

### 7.5 Notion's database / linked-records model

- Master database: `Papers {title, authors, year, doi, status, collection, tags, …}`
- Views: Table, Gallery, Calendar, Kanban, Timeline, By author
- Linked records: `Highlights` → `Paper` (many-to-one), `Notes` → `Paper` (many-to-one), `Claims` → many `Papers` and many `Notes` (many-to-many), `Sessions` → many `Claims` and many `Papers`

**Lattice UX recommendation:** every entity in the library is a row in a database; every view is a query; the AI's claims, highlights, and notes are first-class rows. This is how Notion escaped folders and how Lattice can escape the "where did I put that paper?" problem.

---

## 8. Two-sentence pitch for the team

> Lattice is the first research workspace where the AI agent, your open PDF, your library, and your notes share one context — and where every claim the agent makes is a re-openable, re-playable, citable event in your own audit log. The technology that makes this possible is WebMCP; the academic norm that makes it necessary is "show your work."
