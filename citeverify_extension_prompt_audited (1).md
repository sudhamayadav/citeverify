# AUDITED EXTENSION EXECUTION PROMPT — CITEVERIFY RESEARCH INTELLIGENCE (MODULES A–E)

## PURPOSE

Extend the existing CiteVerify application with research intelligence modules A–E without weakening or rewriting the verified M1–M6 workflow.

The modules are:
- **A — Forward Citation Context Analysis**
- **B — Citation Health Report**
- **C — Research Collections and Manual Rechecking**
- **D — Reproducibility and Audit Trail**
- **E — Publication Type and Peer-Review Evidence**

The goal is not to imitate a comprehensive scholarly citation index. The goal is to provide a transparent, source-traceable, sampled research intelligence layer using Tavily as the only external research provider.

Priorities, in order:
1. Preserve the existing working M1–M6 implementation.
2. Never invent citation relationships, publication metadata, quotations, counts, peer-review status or retraction status.
3. Distinguish `NO_RESULT_FOUND` from `SEARCH_FAILED` and from `NOT_CHECKED`.
4. Preserve every prior verification run and human-review event.
5. Report search coverage and uncertainty prominently.

---

# 0. PREREQUISITE GATE — VERIFY M1–M6 BEFORE WRITING CODE

Do not start M9, M10 or M11 until every condition below has been verified against the actual repository.

## 0.1 Repository and test verification

1. Inspect the current repository, current Git branch, working tree, root and workspace `package.json` files, Prisma schema, migrations, database location, API routes, UI routes and test configuration.
2. Do not print secret values. It is acceptable to print environment-variable names and whether a value is configured.
3. Verify that the end-to-end path works:
   `upload → parse → extract → resolve → retrieve → compare → human review → export`.
4. Run the project's actual test scripts and production builds. Do not rely on README claims, comments, screenshots or a previous agent's summary as proof that tests pass.
5. Verify all 12 M1–M6 core judge-facing tests individually. Produce the test names, actual results and command output summary.
6. Verify that the current SQLite database can be opened and that its integrity check passes.
7. Verify that every M1–M6 schema migration is present and applied.
8. Verify that the reviewer role switcher, review routes, immutable review history and report export work in the existing implementation.

## 0.2 Stop condition

If any prerequisite is missing, broken or unverified:
- STOP the extension work.
- Report the exact failing or missing prerequisite.
- Do not create M9–M11 schema changes.
- Do not run a destructive reset, `prisma migrate reset`, database deletion, or schema push that could discard data.
- Resume only after M1–M6 are complete and all 12 core tests pass.

## 0.3 Migration backup gate

Before any schema migration:
1. Identify the actual SQLite database path from the existing configuration. Do not guess it.
2. Make a timestamped backup using a SQLite-consistent backup method. If WAL mode is active, do not rely on copying only the `.db` file while the database is open; include/checkpoint WAL safely or use SQLite's online backup mechanism.
3. Run `PRAGMA integrity_check` on the backup and require `ok`.
4. Record the backup path, timestamp, database size and SHA-256 checksum in the migration report. Never expose private document paths or secret values.
5. Inspect the generated migration SQL before applying it.
6. Apply only additive migrations. If Prisma detects drift or proposes destructive changes, stop and report them instead of accepting them automatically.
7. Verify that all old rows and relationships still exist after migration.

---

# 1. LOCKED TECHNICAL RULES

## 1.1 Preserve the existing architecture

- Keep the current React + Vite frontend and Next.js App Router backend.
- Keep SQLite + Prisma + Zod unless the existing repository has a documented, already-approved alternative.
- No Python, FastAPI, second backend, or new external service.
- Do not rename or restructure existing models/routes merely to match this prompt. Inspect the real schema and adapt the new relationships to it.
- Do not overwrite working M1–M6 modules.

## 1.2 External API restriction — Tavily only

Use only the following Tavily server-side endpoints from `apps/api`:
- `POST https://api.tavily.com/search`
- `POST https://api.tavily.com/extract`
- `POST https://api.tavily.com/research`
- `GET https://api.tavily.com/research/{request_id}`

Authentication:
- Use `Authorization: Bearer ${TAVILY_API_KEY}`.
- Keep the key in server-only environment variables.
- Never expose it to the browser, return it from any route, or write it to logs/audit snapshots.

Forbidden integrations:
- Crossref, OpenAlex, Semantic Scholar, Unpaywall, NCBI, Google Gemini, OpenAI, other LLMs, embedding APIs, scholarly metadata APIs or citation-index APIs.

Local-only processing is allowed, including hashing, URL normalization, parsing, deterministic matching, local BM25, local classification guardrails and database operations.

Tavily is a web search/extract/research provider, not a canonical scholarly metadata registry or a comprehensive citation index. The UI and reports must state this clearly.

## 1.3 API resilience and budget

- Reuse the existing Tavily adapter from M1–M6; do not create a second independent Tavily client.
- Reuse existing caching, timeout, retry and budget mechanisms where they exist.
- Handle at least: `400`, `401`, `403` if returned, `408`, `422`, `429`, `432`, `433`, `434`, `500`, `502`, `503`, `504`, network errors and timeouts. Treat the list as defensive handling, not a promise that every code is returned by every endpoint.
- For `429`, respect `Retry-After` when present. Use bounded exponential backoff with jitter and a hard maximum attempt count.
- For usage/plan limits, do not retry endlessly. Mark the operation as budget/plan blocked.
- For Extract, inspect both `results` and `failed_results`, even when HTTP status is 200.
- Persist request/operation status and errors without logging credentials or private user content unnecessarily.
- Apply configurable budgets per operation, reference, verification run and local demo session. Do not allow a single request to trigger unbounded searches or URL extraction.
- Cache only when query, normalized parameters and content identity are compatible. A recheck must be able to create a new check and record whether cached results were reused.

## 1.4 Local-only demo role switcher is not real authentication

- Retain the existing `Researcher` / `Faculty Reviewer` role switcher.
- Display **Local-Only Demo Mode — roles are simulated and are not identity-verified**.
- Enforce reviewer-only UI and route behavior for the demonstration, but explicitly document that the role switcher is not a production security boundary.
- Do not claim that a user is a verified faculty member.
- Do not expose this demo role mechanism as production authentication.
- Keep review events append-only and label the actor as a local demo role/identifier.

---

# 2. DATA-MODEL DESIGN RULES BEFORE ADDING MODELS

## 2.1 Inspect the real existing model names and relationships

The names `Reference`, `VerificationRun`, `Document` and `HumanReview` below are logical targets. Before editing `schema.prisma`, inspect the existing definitions and use their actual relation fields and ID types.

Do not guess relation names, cascade behavior, IDs or optionality. Show a short proposed schema diff before applying the migration.

## 2.2 Keep publication type, peer review and retraction separate

Do not use `RETRACTED_PUBLICATION` as a publication type. Retraction is an independent status that can apply to journal articles, conference papers, preprints and other publication types.

Do not infer peer review from:
- a journal-looking website;
- `.org`, `.edu` or publisher domain;
- an ISSN alone;
- the word “journal” in a title;
- a search snippet alone.

Use separate fields:

`publicationType`:
- `JOURNAL_ARTICLE`
- `CONFERENCE_PROCEEDING`
- `PREPRINT`
- `BOOK_OR_CHAPTER`
- `THESIS`
- `EDITORIAL_OR_CORRECTION_NOTICE`
- `REPORT_OR_WORKING_PAPER`
- `UNKNOWN`

`peerReviewStatus`:
- `VERIFIED_BY_PUBLISHER_OR_VENUE_STATEMENT`
- `NOT_ESTABLISHED`
- `UNKNOWN`

A publisher/venue statement must be captured as a source URL plus a short, verified basis. This is still a reported publisher/venue signal, not independent proof that a particular article underwent peer review. If the evidence only establishes that it is a journal article, set `publicationType = JOURNAL_ARTICLE` and `peerReviewStatus = NOT_ESTABLISHED` or `UNKNOWN`.

Keep `retractionStatus` separate:
- `CONFIRMED_RETRACTED`
- `SEARCHED_NO_NOTICE_FOUND`
- `UNKNOWN`

`SEARCHED_NO_NOTICE_FOUND` means only that the configured search did not find a notice at the recorded time. It must never be displayed as “confirmed not retracted”.

Keep correction status separate:
- `CONFIRMED_CORRECTION`
- `SEARCHED_NO_CORRECTION_FOUND`
- `UNKNOWN`

Keep currentness separate:
- `POSSIBLY_SUPERSEDED`
- `NO_SUPERSESSION_SIGNAL_FOUND`
- `UNKNOWN`

A journal article can be retracted and still remain a journal article. A preprint can also be withdrawn or corrected. Do not collapse these dimensions into a single “quality” score.

## 2.3 SQLite/Prisma data types

- Check the installed Prisma version and actual SQLite connector support before choosing Prisma `Json` fields or enum syntax.
- For maximum portability, it is acceptable to store structured JSON snapshots in `String`/TEXT columns using `JSON.stringify`, then validate with Zod on read and write.
- If Prisma `Json` fields are supported by the installed version, use them only after `prisma validate`, migration generation and round-trip tests succeed.
- SQLite does not provide the same enum enforcement behavior as every server database. Validate all enum-like values at API boundaries with Zod and add database checks in custom migration SQL only when compatible with existing Prisma migrations.
- Add indexes for foreign keys, status fields and lookup paths used by the new routes.
- Define explicit referential actions. Do not cascade-delete audit snapshots or human-review records when a user removes a collection item or document.

---

# 3. SCHEMA ADDITIONS

Add these models only after reviewing the actual existing schema. Adapt names and relation fields without breaking existing M1–M6 models.

## 3.1 `ForwardCitationSearchRun` — required coverage record

Add this model in addition to `ForwardCitationContext`. It is essential because an empty list of contexts must not ambiguously mean “no citations exist”, “the search failed” or “the user never checked”.

Suggested fields:
- `id`
- `referenceId` FK to the actual Reference model
- `verificationRunId` FK to the source run used for this check, nullable only if the existing model requires it
- `status`: `QUEUED | SEARCHING | EXTRACTING | CLASSIFYING | COMPLETED | PARTIAL | FAILED | BUDGET_EXHAUSTED | CANCELLED`
- `idempotencyKey`
- `querySnapshot` (serialized JSON/text)
- `searchStartedAt`, `completedAt`
- `queriesAttempted`, `candidateUrlsFound`, `urlsExtracted`, `urlsFailed`, `verifiedCitationRelationships`, `contextsClassified`
- `resultsMayBeTruncated` Boolean
- `budgetConsumed` integer
- `errorCode` and `errorSummary` nullable
- `createdAt`, `updatedAt`

Add an appropriate uniqueness constraint for idempotency. A new explicit recheck must create a new search run; a retry of the same operation must resume or return the existing run.

## 3.2 `ForwardCitationContext`

Suggested fields:
- `id`
- `forwardCitationSearchRunId` FK to ForwardCitationSearchRun
- `referenceId` FK to Reference
- `verificationRunId` FK to the source VerificationRun
- `citingTitle`
- `citingUrl`
- `citingDoi` nullable
- `citingAuthorsSnapshot` nullable serialized JSON/text
- `citingPublishedDate` nullable
- `citingDomain`
- `citationMatchBasis`
- `matchedBibliographyQuote` nullable — exact quote proving the candidate paper's bibliography contains the target publication
- `inTextCitationMarker` nullable — e.g. `[12]` or `(Smith, 2021)`
- `surroundingQuote` — exact contiguous body-text passage around the in-text citation
- `sourceLocation` nullable
- `sourceStartOffset` nullable integer
- `sourceEndOffset` nullable integer
- `sourceOffsetUnit` — explicitly document whether offsets are JavaScript UTF-16 code units
- `sourceContentHash`
- `quoteVerified` Boolean
- `contextClass`: `SUPPORTING | CONTRASTING | MENTIONING | UNCLEAR`
- `classificationBasis`
- `classificationConfidence`: `HIGH | MEDIUM | LOW`
- `tavilyResearchRequestId` nullable
- `retrievedAt`

Deduplicate results using DOI when available, otherwise a conservative normalized title/author/year key plus canonicalized URL. Do not count preprint and publisher versions as separate citing publications unless the UI clearly marks them as versions of one work.

## 3.3 `ResearchCollection`

Suggested fields:
- `id`
- `name`
- `description` nullable
- `createdAt`
- `updatedAt`

## 3.4 `CollectionItem`

Suggested fields:
- `id`
- `collectionId` FK
- `referenceId` FK
- `documentId` nullable FK if the existing application needs a document-specific context
- `notes` nullable
- `lastCheckedAt` nullable
- `nextScheduledCheckAt` nullable
- `createdAt`

Add a duplicate-prevention constraint appropriate to the actual product semantics. If a reference may appear only once per collection, use a unique `(collectionId, referenceId)` constraint. If document-specific duplicates are required, define and test that rule explicitly; remember that nullable columns can affect uniqueness behavior in SQLite.

Removing a CollectionItem must not delete the Reference, VerificationRun, ForwardCitationContext, RunAuditSnapshot or HumanReview records.

## 3.5 `RunAuditSnapshot`

Suggested fields:
- `id`
- `verificationRunId` unique FK
- `documentSha256`
- `verdictRuleVersion`
- `claimSnapshot` serialized JSON/text — original claim, normalized claim and claim IDs
- `tavilyQueriesSnapshot` serialized JSON/text — exact query strings, non-secret parameters, endpoint, timestamps and response/request IDs when available
- `retrievedUrlsSnapshot` serialized JSON/text
- `contentHashesSnapshot` serialized JSON/text — URL, SHA-256 and extraction timestamp
- `passageOffsetsSnapshot` serialized JSON/text — passage ID, start/end offsets and offset unit
- `researchOutputsSnapshot` serialized JSON/text — request IDs and schema-validated, appropriately minimized outputs
- `localValidationSnapshot` serialized JSON/text — quote, URL provenance, numeric comparability and verdict rule checks
- `resultSnapshot` serialized JSON/text — final automated result before human review
- `snapshotSha256`
- `createdAt`

Do not put API keys, authorization headers, local filesystem paths, full secrets or unnecessary personal information in this model.

Do not store unrestricted full-text copies of external publications indefinitely. Follow provider terms, source-site conditions and applicable copyright constraints. Prefer hashes, required short evidence passages and provenance metadata; retain more only when the applicable permissions and retention policy allow it.

## 3.6 Append-only audit events

A snapshot is created when a VerificationRun reaches its finalized state. Human review happens later, so do not attempt to mutate the old snapshot to add future reviews.

Add an append-only `RunAuditEvent` (or extend an existing equivalent) with:
- `id`
- `verificationRunId`
- `sequenceNumber`
- `eventType`
- `payloadSnapshot` serialized JSON/text
- `previousEventHash` nullable for the first event
- `eventHash`
- `createdAt`

Record later review events separately and link them to the relevant run. If an existing `HumanReview` table already records append-only events, link it into the audit response rather than duplicating reviews.

Enforce append-only behavior at both application and database levels where feasible:
- Application code exposes create/read only operations for finalized audit records.
- Add SQLite migration triggers that reject UPDATE and DELETE on audit snapshots/events and human review events, after confirming table names and migration compatibility.
- Add hash-chain verification to detect alteration or deletion of event history.

Describe this as **tamper-evident and append-only for normal application operations**, not absolutely immutable against someone with direct database-file/administrator access. A local SQLite administrator can still modify the database file.

## 3.7 Extend `Reference`

Add:
- `publicationType` with the categories defined in Section 2.2, default `UNKNOWN`
- `publicationTypeBasis` nullable
- `publicationTypeSourceUrl` nullable
- `peerReviewStatus` default `UNKNOWN`
- `peerReviewBasis` nullable
- `peerReviewSourceUrl` nullable
- Retain or add separate `retractionStatus`, `correctionStatus`, `currentnessAssessment` fields if not already present.

Never classify peer review based on ISSN/publisher existence alone. Never put retraction status inside publicationType.

---

# M9 — MODULE D (REPRODUCIBILITY & AUDIT) + MODULE E (PUBLICATION TYPE / PEER-REVIEW EVIDENCE)

## 4.1 M9A — Audit snapshot implementation (`apps/api/src/lib/audit.ts`)

For every completed VerificationRun:
1. Persist a `RunAuditSnapshot` in the same logical finalization transaction as the run's final automated result, where feasible.
2. Capture original and normalized claims, document SHA-256, exact non-secret Tavily queries/parameters, retrieved URLs, retrieval timestamps, content hashes, passage IDs and offsets, request IDs, schema-validated research output, local guardrail results, verdict-rule version and the final automated result.
3. Store a snapshot checksum over a canonical, deterministic serialization. Define canonical key ordering and UTF-8 encoding before hashing.
4. Add append-only audit events for run creation, stage transitions, source retrieval, guardrail outcomes, finalization and later human-review actions.
5. When the same document/reference is rechecked, create a NEW VerificationRun and NEW RunAuditSnapshot. Never update the historical result snapshot.
6. Verify that two runs of the same file can be inspected side by side without overwriting one another.

### Audit API

Implement the route consistent with the existing job/run model, preferably:
`GET /api/verification-runs/:runId/audit`

If the application only exposes a verification-job ID, verify that the job maps unambiguously to one run and use:
`GET /api/verification-jobs/:jobId/audit`

The response must:
- Include the audit snapshot, events, human-review history and hash-chain validation result.
- Exclude API keys, authorization headers, private filesystem paths and unrelated users' data.
- Clearly indicate unavailable or redacted fields.
- Verify access through the existing local-demo behavior and state that it is not production authentication.

### Audit UI (`AuditInspectorDrawer.tsx`)

Add an “Inspect Provenance / Audit” control on each relevant claim card. Show:
`document hash → exact Tavily query → retrieved URL → content hash → passage ID and offsets → quote/URL/numeric guardrails → automated verdict → later human review events`.

Show timestamps and the rule version. Distinguish raw API response data from locally validated data. Never imply that a hash proves the scientific conclusion is true; it only helps establish content/run integrity.

## 4.2 M9B — Publication type and peer-review evidence (`apps/api/src/lib/sourceQuality.ts`)

Implement deterministic classification from verified metadata and explicit source signals.

Examples:
- arXiv, bioRxiv or medRxiv repository record → `PREPRINT`.
- Explicit thesis/dissertation record in a university repository → `THESIS`.
- Explicit conference proceedings record → `CONFERENCE_PROCEEDING`.
- Explicit publisher/journal article metadata → `JOURNAL_ARTICLE`.
- Explicit book/chapter record → `BOOK_OR_CHAPTER`.
- Editorial, correction or retraction notice → `EDITORIAL_OR_CORRECTION_NOTICE`.
- Insufficient evidence → `UNKNOWN`.

A retracted journal article remains `JOURNAL_ARTICLE`; set `retractionStatus = CONFIRMED_RETRACTED` separately.

Peer-review status is a separate assessment:
- Only set `VERIFIED_BY_PUBLISHER_OR_VENUE_STATEMENT` when an accessible authoritative statement explicitly describes that venue's peer-review process and the relationship to the publication is sufficiently clear.
- A journal ISSN, publisher page or journal name alone is not enough.
- If it cannot be established, set `UNKNOWN` or `NOT_ESTABLISHED` and explain the limitation.

Every classification must include:
- `publicationType`
- `publicationTypeBasis`
- `publicationTypeSourceUrl` when available
- `peerReviewStatus`
- `peerReviewBasis`
- `peerReviewSourceUrl` when available

Do not generate a numerical “quality score” from publication type.

### UI

Display separate badges for:
- Publication type
- Peer-review evidence status
- Retraction status
- Correction status

Tooltips must show the evidence basis and source link. Avoid a single badge that implies a preprint is inherently poor quality or a journal article is automatically reliable.

## 4.3 M9 acceptance gate

Write unit/integration tests proving:
1. Rechecking creates Run #2 and leaves Run #1's result, audit snapshot and events unchanged.
2. Audit endpoint returns document SHA-256, queries, URLs, content hashes, passage offsets and rule version.
3. Audit endpoint never returns `TAVILY_API_KEY`, Authorization headers or private filesystem paths.
4. Audit snapshot/event update and delete attempts are rejected by the application and tested SQLite triggers.
5. Hash-chain verification detects a modified or removed event in a test database.
6. An unknown domain defaults to `UNKNOWN`.
7. ISSN/publisher metadata alone does not establish peer review.
8. arXiv/bioRxiv/medRxiv signals classify as preprint where verified.
9. A retracted journal article retains its journal publication type and has an independent retraction status.
10. Audit endpoint correctly includes reviews created after the original snapshot without mutating that snapshot.

Do not start M10 until M9 acceptance tests pass and M1–M6 tests remain green.

---

# M10 — MODULE A (FORWARD CITATION CONTEXT) + MODULE B (CITATION HEALTH REPORT)

## 5.1 M10A — Forward-citation search workflow (`apps/api/src/lib/forwardCitations.ts`)

### API

`POST /api/references/:id/forward-citations`

The request must be idempotent. Accept or create an idempotency key. A repeated request with the same key and same parameters must return the same search run/job rather than spend Tavily budget again.

Return a persisted job/search-run ID promptly. Do not rely on a single long-running HTTP request for all search, extraction and research steps.

Add status retrieval, for example:
`GET /api/forward-citation-search-runs/:searchRunId`

Use the existing durable job framework if available. If none exists, add persisted state transitions and a documented one-step worker/cron/CLI execution path. Do not launch untracked fire-and-forget promises from a Next.js Route Handler; serverless instances can terminate after the request ends.

### Candidate discovery

1. Only start from a Reference with `resolutionState = MATCHED`.
2. Use the matched DOI and/or exact title + first author to search for later publications.
3. Exclude the original paper's own canonical URL and its duplicate versions.
4. Do not assume Tavily search results are citing papers. They are discovery candidates only.
5. Extract accessible candidate URLs using Tavily Extract.
6. Inspect both `results` and `failed_results`.
7. Deduplicate candidates by DOI where available, then normalized title/authors/year and canonical URL.
8. Check that the candidate publication date is later than the cited publication date when both dates are reliably available. If dates are missing/ambiguous, retain the uncertainty rather than inventing an order.

### Mandatory citation-relationship gate

A topical mention is not a citation relationship.

For a candidate to be stored as a verified forward citation context:
1. Find the target paper in the candidate's bibliography/reference list using exact DOI OR a sufficiently strong title + author match.
2. Record the exact matched bibliography evidence and the matching basis.
3. Locate the corresponding in-text citation marker in the candidate's body text (numeric or author-year style) and map it to that bibliography entry where possible.
4. Extract the surrounding sentence/paragraph from the body text around that in-text marker.
5. Verify the surrounding quote is a contiguous span in the stored extracted body text.

If the bibliography entry is found but the corresponding in-text marker cannot be mapped, do not present a verified citation context. Store the candidate as `CITATION_RELATION_UNVERIFIED` or expose it in a separate candidate list with an explicit warning.

If the paper only discusses the same topic or mentions the target in passing without a verifiable reference relationship, reject it as a verified forward citation.

### Context classification

Allowed classes:
- `SUPPORTING`
- `CONTRASTING`
- `MENTIONING`
- `UNCLEAR`

Definitions:
- `SUPPORTING`: the citing paper's citation context explicitly uses or endorses the cited work as evidence for a compatible proposition.
- `CONTRASTING`: the citing paper explicitly disputes, qualifies or reports findings inconsistent with the cited work.
- `MENTIONING`: the cited work is referenced without a clear endorsement or dispute, such as background/context or a routine method citation.
- `UNCLEAR`: the extracted context is too short, ambiguous, truncated or not semantically classifiable.

Use Tavily Research only as an advisory classifier over the exact stored context passage and necessary surrounding text. Instruct it not to use unrelated web sources to determine the class. Return a structured classification and explanation. Validate it locally with Zod and verify the quoted context independently.

Do not let Tavily Research's general web answer replace the extracted citing-paper passage. If classification remains unclear, use `UNCLEAR` and lower confidence.

### Required provenance fields

Persist:
- citing-paper title, URL, domain and date where available;
- DOI/authors/year where verified;
- matched target bibliography entry;
- in-text citation marker;
- exact surrounding passage;
- source text hash and offsets;
- quote-verification result;
- context classification and explicit basis;
- Tavily request IDs where supplied;
- extraction/classification timestamps.

### Search coverage reporting

Every search run must expose:
- number of queries attempted;
- candidate URLs discovered;
- URLs extracted successfully;
- URLs failed;
- candidates with bibliography match;
- candidates with mapped in-text citation;
- contexts verified and classified;
- whether Tavily results may be truncated;
- Tavily budget consumed;
- last checked timestamp;
- final search-run status.

Use distinct states such as:
- `COMPLETED_WITH_CONTEXTS`
- `COMPLETED_NO_VERIFIED_CONTEXTS`
- `PARTIAL`
- `FAILED`
- `BUDGET_EXHAUSTED`
- `NOT_CHECKED`

A completed search with no verified contexts is not the same as a failed search. Do not show a citation count of zero unless the UI labels it as zero verified contexts in this sampled search.

### Mandatory UI disclaimer

Display prominently:

“Sampled, non-exhaustive forward citation context discovered through Tavily Search. Results and counts do not represent total scholarly citations or a complete citation index.”

Use labels such as “Verified contexts found in this search” rather than “Total citations”.

## 5.2 M10B — Citation Health Report

### API

`GET /api/references/:id/health`

Accept an optional `verificationRunId` or clearly use the latest completed run. Return the run ID and timestamp so the UI never mixes historical data from different runs without indicating it.

### Required health dimensions

1. Bibliographic resolution: `MATCHED | MISMATCHED | UNRESOLVED | AMBIGUOUS | MISSING`.
2. Publication type.
3. Peer-review evidence status.
4. Retraction status: `CONFIRMED_RETRACTED | SEARCHED_NO_NOTICE_FOUND | UNKNOWN`.
5. Correction status: `CONFIRMED_CORRECTION | SEARCHED_NO_CORRECTION_FOUND | UNKNOWN`.
6. Currentness assessment: `POSSIBLY_SUPERSEDED | NO_SUPERSESSION_SIGNAL_FOUND | UNKNOWN`.
7. Source access state.
8. Forward-citation search-run status and sampled context counts.
9. Supporting, contrasting, mentioning and unclear context links/quotes.
10. Search coverage and last checked timestamp.
11. Human-review status and reviewer event history.

### Separation rule

Visually separate:
- **Historical Claim Support** — whether the original cited paper supports the specific historical claim in the uploaded document.
- **Current Publication Health** — retraction/correction/currentness and subsequent sampled citation contexts.

A confirmed retraction must be prominent, but must not erase or rewrite the historical support verdict. Example: preserve `supportVerdict = SUPPORTED` while displaying `retractionStatus = CONFIRMED_RETRACTED` and a high-visibility warning.

`POTENTIALLY_OUTDATED` is a currentness/claim assessment only when credible evidence of supersession exists. Preserve the underlying historical support result separately.

Do not describe `SEARCHED_NO_NOTICE_FOUND` as “not retracted”. Display “No notice found in the searches performed” with a timestamp and coverage summary.

## 5.3 M10 acceptance gate

Add mocked Vitest tests proving:
1. A topical search result that does not cite the target paper is not stored as a verified forward citation.
2. A bibliography match without a mapped in-text citation is marked unverified/unclear, not a confirmed context.
3. A hallucinated or non-contiguous surrounding quote fails quote verification.
4. A candidate without reliable later-publication date does not receive an invented date/order.
5. Original-paper and duplicate-version results are excluded/deduplicated.
6. A retracted paper displays both its historical support verdict and a prominent `CONFIRMED_RETRACTED` warning.
7. A successful search with no verified contexts differs from a failed Tavily search.
8. Extract partial failures appear in coverage counts and do not disappear behind HTTP 200.
9. Repeating the same idempotency key does not spend Tavily budget a second time.
10. Search coverage and sampled-count disclaimers appear in the UI.

Do not start M11 until M10 acceptance tests pass and all M1–M9 tests remain green.

---

# M11 — MODULE C (RESEARCH COLLECTIONS & MANUAL RECHECKING)

## 6.1 Collection APIs

Implement routes consistent with the existing Next.js App Router structure:
- `GET /api/collections`
- `POST /api/collections`
- `POST /api/collections/:id/items`
- `DELETE /api/collections/:id/items/:itemId`
- `POST /api/collections/:id/items/:itemId/recheck`
- `GET /api/collections/:id/items/:itemId/diff`
- `POST /api/collections/run-due-checks` — protected scheduler/cron entry point

Use Zod schemas for every request and response. Validate IDs, names, notes and collection-item references.

## 6.2 Collection behavior

Users can:
- create and rename collections;
- list saved publications;
- save/remove collection items;
- record notes;
- inspect publication health;
- trigger a manual recheck;
- compare previous and latest runs.

Removing an item must not delete its Reference or any previous run, evidence, audit snapshot or human review.

Prevent duplicate items according to the chosen unique constraint.

## 6.3 Recheck behavior

`POST /api/collections/:id/items/:itemId/recheck` must:
1. Create a new durable recheck job/run with an idempotency key.
2. Create a new VerificationRun (or the existing run abstraction appropriate for a reference-level check).
3. Re-run only the configured checks within the current Tavily budget.
4. Preserve Run #1, its evidence, audit snapshot and human reviews.
5. Create a new RunAuditSnapshot for the new completed run.
6. Update `lastCheckedAt` only after the recheck reaches a defined terminal state; retain failed-attempt information separately.
7. Return a job/run ID and status so the UI can follow progress.

Do not treat a failed/partial recheck as evidence that the paper's health changed.

## 6.4 Run-to-run diff

`GET /api/collections/:id/items/:itemId/diff` compares two explicitly identified runs, normally latest completed and previous completed.

Compare:
- retraction status;
- correction status;
- currentness assessment;
- publication type / peer-review evidence changes;
- source access changes;
- newly sampled forward citation contexts;
- removed contexts only when a prior context is no longer found in a later sample (label this as “not found in latest sample”, not “citation removed”);
- verdict/support changes;
- evidence content hash changes;
- search coverage and timestamps.

Do not claim that a previously found forward citation has disappeared from the literature merely because it was absent in a later non-exhaustive search.

## 6.5 Scheduler honesty and security

- Do not use in-memory `setInterval`/`setTimeout` as the scheduler.
- Store `nextScheduledCheckAt` only when the collection item has an explicitly configured schedule and an external scheduler is actually configured.
- If no scheduler exists, use manual recheck and display:
  “Manual recheck active. Automated background monitoring requires an external cron/scheduler triggering the protected endpoint.”
- Protect `POST /api/collections/run-due-checks` with a dedicated `CRON_SECRET` or equivalent server-side secret, constant-time comparison where practical, request limits and audit logging. Do not rely on the local demo role switcher to authorize cron calls.
- Never expose `CRON_SECRET` or Tavily credentials to the browser.
- Claim due items atomically to prevent overlapping cron runs and duplicate Tavily calls.
- Apply bounded concurrency, Tavily budgets, retries and idempotency.
- Return counts of due, claimed, processed, skipped, failed and budget-blocked items.
- Document how an operator can run the endpoint manually or configure a real external cron provider. Do not claim monitoring is automatic until that scheduler is installed and tested.

## 6.6 M11 acceptance gate

Add integration tests proving:
1. A reference can be saved to and removed from a collection without deleting its historical runs.
2. Duplicate collection items are rejected or idempotently returned.
3. Manual recheck creates Run #2 and preserves Run #1.
4. A mocked change from `SEARCHED_NO_NOTICE_FOUND` to `CONFIRMED_RETRACTED` is shown correctly in `/diff`.
5. A prior forward-citation context missing from a later sample is labelled “not found in latest sample”, not deleted from history.
6. Diff compares explicit run IDs and does not silently mix different runs.
7. Due-check endpoint rejects missing/invalid `CRON_SECRET`.
8. Concurrent due-check invocations do not process the same item twice.
9. No background schedule is claimed when no external scheduler is configured.
10. A failed recheck does not overwrite the last successful health report.

---

# 7. USER INTERFACE REQUIREMENTS

Add the following views only after their backend acceptance gates pass:

## 7.1 Audit Inspector

- Open from claim cards and publication detail views.
- Show document hash, run ID, timestamps, exact search query snapshots, retrieved URLs, content hashes, passage offsets, local validation results, verdict-rule version and human-review event chain.
- Include an integrity status (`VALID`, `MISMATCH`, `INCOMPLETE`) with explanation.
- Do not imply that a valid hash validates scientific truth.

## 7.2 Publication Details / Citation Health

Use separate labelled panels:
1. Bibliographic identity.
2. Publication type.
3. Peer-review evidence.
4. Historical claim support.
5. Retraction/correction/currentness.
6. Sampled forward-citation contexts.
7. Search coverage and last checked time.

Do not use a single generic “quality score”.

## 7.3 Collections

- Collection sidebar/list.
- Saved references with health badges.
- Manual “Recheck Now” action.
- Previous/latest run selector.
- Run-to-run diff panel.
- Clear scheduler status and limitations.

## 7.4 Local-only demo notice

Keep the Local-Only Demo Mode notice visible. Do not imply account-level permissions or faculty identity verification.

---

# 8. MILESTONE EXECUTION ORDER

Execute strictly one milestone at a time.

### Preflight
Verify M1–M6 and all 12 core tests. If not complete, stop and finish them first.

### M9 — Audit + Publication Type / Peer-Review Evidence
1. Backup and verify SQLite database.
2. Inspect existing schema and produce additive migration diff.
3. Add ForwardCitationSearchRun schema only if needed for later M10 preparation; otherwise add it with M10 schema migration. Do not create unused schema prematurely.
4. Add RunAuditSnapshot, RunAuditEvent and Reference metadata fields.
5. Add audit service, source-type service, API and UI.
6. Run all M9 acceptance tests and all M1–M6 regression tests.
7. Report files changed, migration details, test totals and remaining limitations.

### M10 — Forward Citation + Citation Health
1. Add ForwardCitationSearchRun and ForwardCitationContext models/relations.
2. Implement search, extraction, bibliography match, in-text citation mapping, exact context quote validation and advisory classification.
3. Implement durable search-run state and idempotency.
4. Implement Citation Health API and UI.
5. Run all M10 acceptance tests and all M1–M9 regression tests.
6. Report sampled coverage, Tavily budget behavior and known limitations.

### M11 — Collections + Manual Rechecking
1. Add ResearchCollection and CollectionItem models/relations.
2. Implement collection CRUD and duplicate prevention.
3. Implement durable manual recheck and run-to-run diff.
4. Implement protected due-check endpoint for optional external cron.
5. Add Collections UI and scheduler honesty notice.
6. Run all M11 acceptance tests and all M1–M10 regression tests.
7. Report files changed, migrations, exact test totals and known limitations.

Do not begin the next milestone until the current milestone passes its acceptance gate.

---

# 9. FINAL REPORT AFTER M11

Provide a factual completion report containing:
1. Prerequisite gate result for M1–M6.
2. Files created and modified by M9, M10 and M11.
3. Prisma migrations applied and backup integrity results.
4. Exact Vitest unit/integration pass/fail counts.
5. Exact Playwright pass/fail counts.
6. Test commands and any skipped tests.
7. Audit-chain integrity test results.
8. Tavily queries, extraction successes/failures, research tasks and budget usage from test runs (do not expose credentials).
9. Search coverage limitations and non-exhaustive citation discovery warning.
10. Whether an external cron scheduler is configured and tested; otherwise state “manual recheck only”.
11. Known limitations, unresolved defects and production-readiness warnings.
12. Updated README with setup, environment variables, migration/backup procedure, manual recheck instructions, API routes, test commands and limitations.

Never claim:
- complete scholarly citation coverage;
- a total citation count from Tavily sampling;
- confirmed peer review without explicit evidence;
- “not retracted” merely because no notice was found;
- automatic monitoring without a configured and tested scheduler;
- absolute immutability of a local SQLite file;
- production authentication from the demo role switcher.

## START INSTRUCTION

Start now with the **M1–M6 prerequisite gate**. Do not write code or change the database until the gate is proven complete. If it passes, proceed to the SQLite backup and M9 schema-diff review, then implement M9 only.