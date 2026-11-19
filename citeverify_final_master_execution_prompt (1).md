# FINAL MASTER EXECUTION PROMPT — CITEVERIFY (HACKATHON PROBLEM STATEMENT 03)

> **Product:** CiteVerify — Scientific Claim and Citation Verification System  
> **Operating mode:** Local-Only Hackathon Demo  
> **Primary objective:** Evidence-backed, claim-by-claim citation verification with transparent uncertainty and mandatory human review.

---

## ROLE AND EXECUTION CONTRACT

Act as a senior full-stack engineer, document-processing engineer, research-verification engineer, UI/UX designer, security engineer, and QA engineer.

Build CiteVerify against the uploaded official Problem Statement 03. Treat that problem statement as the functional source of truth. Preserve the existing repository's working functionality and data wherever possible.

Engineering priorities, in order:

1. Evidence integrity and source traceability.
2. Correct distinction between reference validity, claim support, source currentness, and access limitations.
3. Honest abstention when evidence is incomplete or ambiguous.
4. Reproducibility, testability, and human-review auditability.
5. Usability and presentation.
6. 3D effects and optional educational features.

Never claim zero hallucination, perfect accuracy, complete coverage, or successful verification without measurable test evidence. The system must never present automated output as a final academic judgment.

### Mandatory execution behavior

- Begin with a read-only repository audit.
- After the audit, immediately start M1 unless a missing credential or a concrete blocker prevents it.
- Do not ask for confirmation between milestones. Work one milestone at a time and report the result before moving to the next.
- Do not overwrite working files blindly, delete user data, reset a database, discard uncommitted Git changes, rotate credentials, or rewrite Git history.
- If the repository is inaccessible, say so and stop; do not invent a repository audit.
- If a feature cannot be completed, mark it `NOT IMPLEMENTED` or `BLOCKED`; do not simulate completion.

---

# 0. PREFLIGHT — READ-ONLY REPOSITORY AUDIT

Before modifying any file:

1. Print the repository tree, excluding `node_modules`, virtual environments, build outputs, caches, and secret files.
2. Inspect all root and workspace `package.json` files, lockfiles, TypeScript/Vite/Next configuration, frontend pages/components, backend routes/services, database schema/migrations, tests, and README files.
3. Inspect environment-variable **names only**. Never print `.env` values, API keys, tokens, passwords, or private URLs containing credentials.
4. Inspect `git status`, current branch, and recent commit summary. Do not run destructive Git commands.
5. Identify existing upload, parsing, extraction, citation, retrieval, report, database, and UI functionality.
6. Identify whether the existing app is the VeriCite repository and whether it currently uses FastAPI, Docling, Gemini, Sentence Transformers, or other services.
7. Produce a feature coverage matrix against the official problem statement with statuses: `IMPLEMENTED`, `PARTIAL`, `MISSING`, `BROKEN`, or `UNKNOWN`.
8. Produce a file-by-file migration plan showing what will be preserved, adapted, replaced, added, or left untouched.
9. Record existing database path, schema, backup plan, and migration risk. Create a backup before any schema-changing migration. Never run `prisma migrate reset`, delete the database, or replace it with a fresh empty database.
10. Record known setup blockers, including missing `TAVILY_API_KEY`, unsupported Node version, incompatible package versions, and unavailable OCR language data.

After reporting the audit and migration plan, start M1. Do not wait for a confirmation unless an irreversible action or a genuinely missing user decision is unavoidable.

---

# 1. LOCKED ARCHITECTURE AND TECHNOLOGY

## 1.1 Monorepo

Use one repository with npm workspaces:

```text
citeverify/
├── package.json
├── package-lock.json
├── apps/
│   ├── web/                 # React + Vite frontend, port 5173
│   └── api/                 # Next.js App Router backend, port 3000
├── packages/
│   └── shared/              # Shared TypeScript types and Zod contracts
├── storage/                 # Local private storage; never served statically
├── test-fixtures/           # Explicitly labelled synthetic demo fixtures
├── tests/                   # Cross-workspace test support
├── .env.example
└── README.md
```

Root scripts must provide:

- `npm run dev` — start both workspaces using `concurrently`.
- `npm run dev:web` — start only Vite.
- `npm run dev:api` — start only Next.js.
- `npm run build` — build both workspaces.
- `npm run typecheck` — type-check all workspaces.
- `npm run test` — run unit/integration tests.
- `npm run test:e2e` — run Playwright tests.

Use one package manager and one committed lockfile. Do not create nested conflicting lockfiles. Pin compatible dependency versions. Do not mix Prisma v6 and v7 configuration examples; inspect the installed major version and follow that version's current configuration and migration conventions.

## 1.2 Frontend — `apps/web`

- React, Vite, TypeScript.
- Tailwind CSS.
- React Router or the routing library already present if it is working.
- Three.js, `@react-three/fiber`, and `@react-three/drei` for M7 only.
- Vitest and React Testing Library.
- Playwright for end-to-end tests.
- Vite development proxy: `/api` → `http://localhost:3000`.
- Production API origin through `VITE_API_BASE_URL`; never put secrets in Vite environment variables.

## 1.3 Backend — `apps/api`

- Next.js App Router.
- TypeScript.
- Next.js Route Handlers only; no Pages Router API routes.
- Node.js runtime for document parsing, filesystem access, and SQLite.
- Prisma ORM + SQLite for the local hackathon prototype.
- Zod for runtime validation of requests, persisted JSON, and external responses.

Do not build Python, FastAPI, a second backend service, a separate Redis service, or an external worker service.

## 1.4 Local document processing

Use Node.js libraries only:

- PDF: `pdfjs-dist` for page text extraction and page-level provenance.
- DOCX: `mammoth` for paragraph/text extraction.
- TXT: local UTF-8 text parser.
- OCR: `tesseract.js` as an optional local fallback, only where the page appears image-based or text extraction is inadequate.
- Passage retrieval: local BM25/keyword ranking. No external embedding API.
- Numeric checks: local deterministic parsing and comparison of structured quantities.
- Quote checks: local exact/contiguous-span validation against stored source passages.

**PDF.js compatibility rule:** Do not blindly pass `disableWorker: true`. Pin a compatible `pdfjs-dist` version and use its supported Node.js worker configuration. Add a PDF smoke test that loads a real fixture PDF and extracts text from at least two pages. Avoid undocumented or deprecated options.

**OCR rule:** A page with fewer than 40 extracted characters is only an OCR candidate, not proof that it is a scanned page. Record OCR attempt, language, confidence, result, and failure per page. Make OCR page limits configurable. If the cap is reached, set `PARTIAL_OCR` and list every page not processed. Do not silently skip remaining pages. If local OCR model data is unavailable, return `OCR_UNAVAILABLE` rather than pretending OCR ran.

---

# 2. LOCAL-ONLY DEMO MODE AND ROLE SWITCHER

Do not build signup, login, OAuth, external identity providers, or user registration.

Show a persistent top-bar label: **LOCAL-ONLY DEMO MODE — NOT FOR PRODUCTION USE**.

Provide a visible role selector:

- `Researcher`
- `Faculty Reviewer`

Backend review routes must check the current demo role, not trust a role value supplied in the request body. Use a server-managed demo session/cookie and a server-side role check. The frontend role selector calls a dedicated local-demo role-switch route.

**Security disclosure:** Because there is no real authentication, anyone with access to the local app can switch to Faculty Reviewer. This is a demonstration of role-based workflow, not real identity verification or production access control. Do not describe it as secure authentication or strong authorization.

For local demo auditability:

- Every human review is a new append-only audit event.
- Never overwrite the automated verdict when a reviewer approves or overrides it.
- Store role, reviewer display label (clearly marked as a demo identity), timestamp, action, notes, previous decision reference, and resulting review state.
- Enforce application-level append-only behavior and SQLite triggers that reject UPDATE/DELETE on review audit records.
- Add a hash chain (`previousHash`, `recordHash`) so accidental or ordinary application-level tampering can be detected.
- Describe the log as **tamper-evident within the demo application**, not absolutely immutable against someone who controls the machine or SQLite file.

---

# 3. STRICT EXTERNAL API RESTRICTION — TAVILY ONLY

Tavily is the only external search, extraction, and AI/research provider. All calls must be server-side from `apps/api`.

Forbidden integrations:

- Crossref
- OpenAlex
- Semantic Scholar
- Unpaywall
- NCBI APIs
- Gemini
- OpenAI
- Other LLM, embedding, academic search, or web search APIs

Normal local npm dependencies are allowed. Do not introduce external font CDNs, analytics, telemetry, or cloud storage providers without explicit approval. Keep assets local where practical.

## 3.1 Tavily endpoints

Use the current documented REST endpoints:

- `POST https://api.tavily.com/search`
- `POST https://api.tavily.com/extract`
- `POST https://api.tavily.com/research`
- `GET https://api.tavily.com/research/{request_id}`

Authentication:

```http
Authorization: Bearer <TAVILY_API_KEY>
Content-Type: application/json
```

Store `TAVILY_API_KEY` only in `apps/api/.env` or the backend deployment secret store. Never prefix it with `NEXT_PUBLIC_` or `VITE_`. Commit only `.env.example` with placeholders.

Do not log request headers, keys, or full sensitive document content.

## 3.2 Tavily Search

Use narrow search queries in a controlled order:

1. Exact DOI, when provided.
2. Exact paper title in quotes.
3. Title + first author + year.
4. Title + journal/venue or alternative author spelling only when earlier searches are ambiguous.

Request a bounded number of results. Store original query, request ID if supplied, response timestamp, returned title, URL, snippet/content, published date if present, and usage metadata if present.

Prioritize publisher pages, official journal pages, trusted repositories, institutional repositories, and PubMed Central pages where relevant. Blogs/news may help discover a paper but must not be treated as the original scientific source without evidence.

Search API errors to handle include documented `400`, `401`, `422`, `429`, `432`, `433`, `434`, and `500`, plus network errors and timeouts.

## 3.3 Tavily Extract

- Extract only candidate URLs that passed the URL validation policy.
- Batch no more than 20 URLs per request.
- Inspect BOTH `results` and `failed_results` even when HTTP status is 200.
- HTTP 200 does not mean every URL was extracted successfully.
- Preserve request ID, each result URL, raw extracted content, extraction timestamp, content hash, response time, and per-URL failure information.
- Do not assume the returned text is the complete article.

## 3.4 Tavily Research

Use Research as an **advisory analysis tool**, not as the final source of truth.

- Use `model: "mini"` for a narrow single-claim comparison unless tests show another model is needed.
- Use `stream: false` for the persisted asynchronous job flow.
- Use a minimal `output_schema` containing only the documented simple schema structures needed by the task. The schema must include `properties`; `required` may be included. Avoid untested advanced JSON Schema features such as complex unions, custom validators, or unsupported keywords.
- Validate the returned `content` with local Zod regardless of whether Tavily returns a structured object or text.
- If returned content is absent, malformed, or fails validation, set `ANALYSIS_FAILED`.
- Tavily Research can search the wider web and may introduce sources beyond the cited paper. Store these as `ADVISORY_CONTEXT` only. They must never replace or silently supplement evidence from the cited publication when assigning the claim's `supportVerdict`.
- Do not present Tavily Research's own confidence language as a calibrated probability.

## 3.5 Tavily Research asynchronous workflow

Tavily Research creation returns a `request_id`. Persist it. The status endpoint may report `pending`, `in_progress`, `completed`, or `failed`; the GET endpoint documents `200` for completed/failed results and `202` for in-progress state.

Do not keep a Next.js request open while waiting for research to finish. Do not rely on `setTimeout`, an in-memory promise, or a module-global job list for durable job progress.

Use a persisted, resumable state machine:

1. `POST /api/verification-jobs` creates a job and returns `jobId` immediately.
2. `POST /api/verification-jobs/:id/advance` executes at most one bounded stage/step, persists all outputs, and returns the new state.
3. The frontend polls `GET /api/verification-jobs/:id` for read-only status and invokes `advance` while work remains.
4. If the browser closes or the Next.js process restarts, reopening the workspace allows the job to resume from the last persisted checkpoint.
5. Each step must be idempotent, guarded by a DB lease/version or transaction so duplicate browser requests cannot run the same step concurrently.
6. Store Tavily `request_id`, next poll time, attempt count, last error, and per-document usage budget.
7. Poll Tavily on subsequent `advance` requests using bounded exponential backoff and jitter. Never sleep for minutes inside a route handler.
8. If Tavily accepted a Research POST but the client timed out before receiving a request ID, record `SUBMISSION_UNKNOWN`. Do not blindly resubmit indefinitely; expose a controlled retry action and warn that duplicate credit usage may occur.

This request-driven worker model is intentional: it supports a single Next.js backend without adding another worker service and avoids relying on ephemeral in-memory background tasks.

## 3.6 Error handling, usage, caching

Handle:

- `400`: invalid request; do not retry unchanged input.
- `401`: invalid/missing key; stop and show configuration error without exposing the key.
- `422`: validation error; record a sanitized error detail.
- `429`: rate limit; honor `Retry-After` if present, otherwise use bounded exponential backoff with jitter.
- `432` / `433`: usage/plan limit; stop automatic retries and show the limit state.
- `434`: live-content-fetch availability error; record it separately and only retry according to a bounded policy.
- `404` on Research status: invalid/expired/missing request ID; mark the job as requiring recovery, not completed.
- `500`, network errors, and timeouts: bounded retries only where safe.

Do not retry every POST automatically. Use request fingerprints and local cache. Cache stable publication search/extract results using normalized query/URL + API options + content version. Give retraction/currentness searches shorter cache lifetimes than publication metadata. Never reuse old evidence without displaying its retrieval date.

Enforce a configurable per-document Tavily credit/request budget. Record actual `usage` returned by Tavily when available. Show the user when the budget is reached.

---

# 4. DATA INTEGRITY AND VERIFICATION MODEL

Do not collapse the following concepts into one status field. Store them independently:

1. `referenceResolutionState`: whether the bibliography entry matches a real publication candidate.
2. `supportVerdict`: whether the cited paper supports the specific claim.
3. `sourceAccessState`: what source content was actually retrieved.
4. `retractionStatus`: what is known about formal retraction.
5. `correctionStatus`: whether a correction/erratum notice was found.
6. `currentnessAssessment`: whether newer evidence appears to supersede the source.
7. `verificationState`: whether the verification process completed or abstained.
8. `humanReviewStatus`: whether a human has reviewed/approved/overridden the automated result.

The official five scientific verdicts are:

- `SUPPORTED`
- `PARTLY_SUPPORTED`
- `CONTRADICTORY`
- `UNSUPPORTED`
- `POTENTIALLY_OUTDATED`

Additional states are process/access states, NOT extra scientific verdicts.

Recommended process states:

- `PENDING`
- `RUNNING`
- `COMPLETED`
- `ABSTAINED`
- `ANALYSIS_FAILED`
- `API_ERROR`
- `CANCELLED`
- `NEEDS_HUMAN_REVIEW`

Recommended source access states:

- `FULL_TEXT_RETRIEVED`
- `PARTIAL_TEXT`
- `ABSTRACT_ONLY`
- `SEARCH_SNIPPET_ONLY`
- `SOURCE_UNAVAILABLE`
- `EXTRACTION_FAILED`
- `UNKNOWN`

Use `FULL_TEXT_RETRIEVED` only when there is affirmative evidence of full-text content (for example, a complete uploaded source document or a reliably identified full-text repository source with appropriate article sections). A long webpage or a word-count threshold is not proof of full text. Store a separate `sourceCompletenessBasis` explanation. If uncertain, use `PARTIAL_TEXT` or `UNKNOWN`.

Retraction states:

- `CONFIRMED_RETRACTED`
- `NOTICE_NOT_FOUND`
- `UNKNOWN`

Never describe `NOTICE_NOT_FOUND` as proof that a paper is not retracted.

Correction states:

- `CORRECTION_FOUND`
- `NO_CORRECTION_NOTICE_FOUND`
- `UNKNOWN`

Currentness assessments:

- `NO_CURRENTNESS_CONCERN_FOUND`
- `POSSIBLY_SUPERSEDED`
- `UNKNOWN`

Never mark a paper outdated based solely on publication age. Require a reliable newer review, guideline, consensus statement, correction/retraction notice, or other explicit evidence that changes how the finding should be interpreted.

If a paper is retracted, preserve the historical claim-support result in `supportVerdict`, and show `POTENTIALLY_OUTDATED` as a separate currentness/retraction warning. Do not overwrite one concept with the other.

---

# 5. EXACT FIVE-STAGE VERIFICATION PIPELINE

## STAGE 1 — Document Ingestion

File: `apps/api/src/lib/parser.ts`

Accept:

- `.pdf`
- `.docx`
- `.txt`

LaTeX is out of MVP scope.

### File safety

- Validate filename extension AND file signature/content type.
- Enforce configurable byte-size, page-count, text-length, and processing-time limits.
- Use an opaque server-generated storage filename; never use the user-supplied filename as a filesystem path.
- Store original files in a private non-public directory outside `public/`.
- Compute SHA-256 hash of original bytes.
- Prevent path traversal and unsafe MIME handling.
- For DOCX, validate that the ZIP container contains expected Word document parts; enforce decompressed-size limits to reduce ZIP-bomb risk.
- Reject password-protected or corrupt PDFs with an explicit state.
- Never execute embedded files, macros, scripts, or document hyperlinks.

### Preserve provenance

A PDF/DOCX parser cannot guarantee byte-for-byte preservation of the original file text. Therefore:

- Preserve the original uploaded bytes unchanged.
- Preserve a hash of the original file.
- Preserve the exact extracted text string as emitted by the parser.
- Store page/paragraph/block IDs and offsets into the extracted text.
- Store PDF page number and bounding boxes when the parser provides reliable information.
- Do not claim original-file byte offsets unless actually available.
- Do not invent page numbers. Use `null` when unreliable or unavailable.

Extract, where possible:

- Original extracted text.
- Page-level text blocks.
- Paragraphs and paragraphs IDs.
- Section headings and hierarchy.
- Tables and captions.
- Abstract and bibliography boundaries.
- Reliable page numbers.
- Text extraction warnings and per-page OCR metadata.

Extraction states:

- `SUCCESS`
- `PARTIAL`
- `PARTIAL_OCR`
- `FAILED`
- `UNSUPPORTED_FORMAT`
- `PASSWORD_PROTECTED`
- `LIMIT_EXCEEDED`
- `OCR_UNAVAILABLE`

A low-text page is not automatically empty. Record what was extracted and what remains unprocessed.

## STAGE 2 — Claim, Citation, and Bibliography Extraction

File: `apps/api/src/lib/extractor.ts`

Because no external LLM is permitted, use deterministic heuristics, citation regexes, section parsing, and a required manual correction interface.

### Reference parsing

Separate body text and bibliography entries. For each reference store:

- `referenceId`
- `rawReferenceText`
- nullable title
- nullable author list
- nullable publication year
- nullable DOI
- nullable journal/venue
- nullable volume/issue/pages
- source block/page/paragraph location
- extraction warnings

Never fill missing metadata by guessing.

### Citation detection

At minimum support:

- `[1]`
- `[1, 2]`
- `[3-5]`
- `(Smith et al., 2022)`
- `(Smith and Brown, 2023)`
- multiple citation groups in one sentence

Treat numbered lists, footnotes, equation numbers, and ordinary bracketed text as possible false positives. Record the citation span and mapping confidence. Do not silently treat every `[number]` as a reference citation.

### Claim extraction

Detect potential factual assertions, findings, numerical/statistical claims, comparisons, causal statements, and conclusions using local rules and heuristics.

**Limitation rule:** Rule-based extraction cannot guarantee detection of every factual claim. Label heuristic findings as `POTENTIAL_CLAIM` and let the user review/add/remove/split/merge claims before verification. Do not report 100% recall or complete claim coverage.

For each claim store:

- `claimId`
- `originalSentence` as an exact substring of the parser's stored extracted text
- `normalizedClaim` separately
- extracted-text offsets
- page/paragraph/section/block anchor where available
- citation mention IDs
- claim type
- extraction method
- extraction confidence/basis
- user correction history

Do not call `originalSentence` byte-for-byte original PDF/DOCX content. It is an exact substring of the extracted text, while original file bytes are preserved separately.

### Citation mapping and missing references

Use these states:

- `MATCHED`
- `AMBIGUOUS`
- `MISSING`
- `UNUSED_REFERENCE`
- `UNCITED_CLAIM`
- `POTENTIAL_UNCITED_CLAIM`

An orphaned in-text citation marker with no bibliography entry is `MISSING`. A bibliography item not cited in the body is `UNUSED_REFERENCE`. A factual sentence without a detected citation is only a potential uncited claim unless a human confirms it.

### Mandatory correction UI

Before external verification, show a review screen where the researcher can:

- edit claim boundaries and normalized text;
- split or merge claims;
- mark a false-positive claim;
- add a missed claim;
- correct citation-to-reference mappings;
- create or edit bibliography metadata;
- mark an assertion as intentionally uncited.

Store all corrections as versioned events. Never erase the originally extracted data.

## STAGE 3 — Publication Resolution

File: `apps/api/src/lib/resolver.ts`

Use Tavily Search in order: DOI → exact title → title + first author + year → carefully scoped alternative query.

For every candidate store:

- original URL;
- canonical comparison URL (do not discard original URL);
- page title;
- publication title candidate;
- author candidate(s);
- publication date/year candidate;
- DOI candidate;
- venue candidate;
- host/domain;
- Tavily query/request provenance;
- retrieval timestamp;
- candidate source type;
- match signals and missing signals.

### Candidate matching

Score candidates across title similarity, author overlap, year, DOI, venue, and source type. Use a configurable acceptance threshold AND a configurable minimum margin between the top two candidates.

- An exact DOI conflict is a strong mismatch signal.
- A high title similarity alone is never enough to accept a paper.
- Similar titles or tied candidates must become `AMBIGUOUS`.
- A blog/news article can be discovery-only; it does not prove the original paper's identity.
- Never mark a reference fabricated simply because search did not find it.

Resolution states:

- `MATCHED`
- `MISMATCHED`
- `UNRESOLVED`
- `AMBIGUOUS`
- `MISSING`

### Retraction/correction/currentness searches

Perform separately scoped Tavily searches for:

- paper title + DOI + retraction/retracted/retraction notice;
- paper title + correction/erratum/corrigendum;
- claim topic + newer systematic review/guideline/consensus/superseding evidence.

Require authoritative evidence for `CONFIRMED_RETRACTED`. Search absence is `NOTICE_NOT_FOUND` or `UNKNOWN`, never proof that no retraction exists.

Do not make `POTENTIALLY_OUTDATED` solely from the year. Store source URL, exact supporting context, retrieval date, and why the newer evidence may supersede the older source.

## STAGE 4 — Source Access, Evidence Retrieval, and Comparison

File: `apps/api/src/lib/retriever.ts`

### Source access assessment

Use Tavily Extract on matched candidate URLs only. Validate URLs are HTTP/HTTPS, reject unsafe schemes, localhost/private network destinations, and malformed URLs before submitting them to Tavily.

Classify access using evidence of article structure and extraction coverage, not word count:

- `FULL_TEXT_RETRIEVED`
- `PARTIAL_TEXT`
- `ABSTRACT_ONLY`
- `SEARCH_SNIPPET_ONLY`
- `SOURCE_UNAVAILABLE`
- `EXTRACTION_FAILED`
- `UNKNOWN`

Store `sourceCompletenessBasis`, `sourceSectionsFound`, `sourceTextLength`, `extractedAt`, and the exact failed URL details. Do not assume Tavily Extract has returned the complete paper just because the page is long.

### Evidence passages

- Split text by paragraphs/sections before applying word-count limits.
- Target 150–300 words per passage, keeping relevant context together.
- Preserve passage ID, source candidate ID, URL, section, nullable page, extracted-text offsets, and exact passage text.
- Do not concatenate unrelated sections into one quoteable passage.
- Rank locally with BM25/keyword scoring.
- Keep the top passages for display, but do not assume the top 4 passages represent the entire paper.
- Search the full locally stored extracted text for relevant terms and numbers where feasible.

### Source hierarchy

Evidence used to support or contradict a claim must come from the matched cited publication. Store other publications and Tavily Research discoveries as `ADVISORY_CONTEXT` only.

Do not let a newer paper prove that the cited paper itself supported the original claim. Newer sources may inform currentness, not historical citation support.

### Semantic and numerical comparison

Compare:

- finding;
- direction of effect;
- outcome/metric;
- numerical magnitude;
- unit;
- denominator;
- population/sample;
- comparator/control group;
- baseline;
- timeframe;
- statistical significance/uncertainty;
- study design;
- limitations and scope.

Use a local structured quantitative parser for values, units, percentages, denominators, confidence intervals, p-values, and time periods where possible.

Tavily Research may provide advisory comparison of semantic comparability. It must not be the only reason for a numerical downgrade. If metric/unit/denominator/population/timeframe comparability cannot be established locally or from an exact source passage, attach `NUMERIC_COMPARABILITY_UNCERTAIN` and require human review.

Do not compare a relative percentage change with a percentage-point change as if they were equivalent. Do not compare different outcomes or populations without explicitly identifying the difference.

## STAGE 5 — Verdict, Guardrails, and Report

File: `apps/api/src/lib/verifier.ts`

### 5.1 Verdict policy

`SUPPORTED`:
- The matched cited source supports the claim's actual finding, direction, scope, and meaningful quantitative details.

`PARTLY_SUPPORTED`:
- The source supports part of the assertion, but one or more important details are overstated, numerically inconsistent, broader than the study population, or missing a material caveat.

`CONTRADICTORY`:
- The matched cited source contains evidence that directly refutes the claim or reports the opposite result. Do not use this merely because a related paper disagrees.

`UNSUPPORTED`:
- Use only when the correct source has been matched and sufficiently complete relevant text has been examined, but the claim is not substantiated by the cited source. Absence from a few top-ranked passages is not enough. When source completeness is uncertain, abstain.

`POTENTIALLY_OUTDATED`:
- Use only when evidence indicates the finding may have been superseded, formally retracted, corrected, or materially displaced by newer consensus. Preserve the underlying historical `supportVerdict` separately.

### 5.2 Incomplete verification must abstain

Never force an `UNSUPPORTED` verdict when the source is:

- abstract-only;
- partial text;
- search-snippet-only;
- unavailable;
- failed extraction;
- unresolved or ambiguous publication;
- missing required evidence context.

Use `verificationState` such as `ABSTAINED`, `ABSTRACT_ONLY`, `PARTIAL_TEXT`, `UNRESOLVED_SOURCE`, `SOURCE_UNAVAILABLE`, `EXTRACTION_FAILED`, `API_ERROR`, or `ANALYSIS_FAILED`.

### 5.3 Hard local guardrails

1. **Contiguous quote validation:** Every displayed `evidenceQuote` must be a contiguous span of one stored `EvidencePassage`. Normalization may account for whitespace and Unicode quote variants only. Never remove or alter words, negation, numbers, units, or qualifiers to force a match. Store passage ID and start/end offsets. If validation fails, reject the quote, set `quoteVerified=false`, lower confidence to `LOW`, and require review.
2. **URL provenance:** Every evidence URL must belong to a retrieved candidate/source record for that verification run. Validate URL scheme before making it clickable.
3. **Source identity:** The support verdict must cite the matched cited paper, not an unrelated Tavily Research result.
4. **Abstention:** Incomplete or ambiguous sources must not be called unsupported.
5. **Retraction separation:** Retraction/currentness status must not overwrite historical support verdict.
6. **Comparable numeric downgrade:** Downgrade `SUPPORTED` to `PARTLY_SUPPORTED` only when a deterministic/local comparison establishes that the compared quantities represent the same metric and comparable unit, denominator, population, baseline, and timeframe. Otherwise create an issue flag and require human review.
7. **No unsupported confidence probabilities:** Use `HIGH`, `MEDIUM`, `LOW` only, each with explicit evidence basis. Do not present invented probabilities.
8. **Human review:** Every automated claim verdict begins with review status `PENDING`. A human can approve or override with notes. Preserve the prior automated result and append a separate audit event.
9. **No fabricated locations:** If page/section/paragraph cannot be verified, set it to `null` or `UNKNOWN`.
10. **No external source substitution:** A different paper can support general context but cannot retroactively validate the particular citation.

### 5.4 Confidence policy

- `HIGH`: Publication identity matched, full relevant source content retrieved with an explicit completeness basis, evidence passage is quote-verified, and claim dimensions align or conflict clearly.
- `MEDIUM`: Publication matched, but context or scope is incomplete, or some dimensions need interpretation.
- `LOW`: Source is incomplete, ambiguous, abstract-only, quote validation fails, quantitative comparison is uncertain, or source access is unreliable.

Confidence is an evidence-strength label, not a calibrated probability. Show the basis and limitations next to it.

### 5.5 Required claim report fields

Every claim report must include:

- claim ID;
- original sentence/exact extracted-text span;
- normalized claim;
- document page/section/paragraph anchor (nullable);
- linked citation mention(s);
- reference resolution state;
- matched publication metadata with nulls for unknown values;
- source access state and completeness basis;
- support verdict or abstention state;
- currentness/retraction/correction flags kept separately;
- confidence level and explicit basis;
- evidence passage(s) with exact quotations, passage IDs, URLs, source section/page where reliable;
- quote verification result;
- mismatch/limitation issue flags;
- explanation that distinguishes source finding from system inference;
- Tavily retrieval timestamp/request IDs where appropriate;
- needs-human-review flag and review status.

All JSON must pass Zod validation before persistence or export.

---

# 6. DATABASE MODEL REQUIREMENTS

Design and document Prisma models for at least:

- `Document`
- `DocumentPage`
- `DocumentBlock`
- `ExtractionRun`
- `Claim`
- `ClaimVersion`
- `CitationMention`
- `Reference`
- `ReferenceCandidate`
- `VerificationJob`
- `VerificationStep`
- `TavilyRequest`
- `EvidencePassage`
- `ClaimVerification`
- `HumanReview`
- `LabCase`
- `LabAttempt`
- `BenchmarkDataset`
- `BenchmarkLabel`

Use explicit IDs and foreign keys. Add indexes for document/job/claim/reference lookups. Use transactions for multi-record state changes. Use SQLite WAL mode if supported by the selected driver and verify it in integration tests. Keep database migrations versioned.

Store original document content in private filesystem storage; do not place large raw files in SQLite. Store file hash and private path in the database. Do not expose storage paths to the frontend.

Persist each verification stage's output and status so jobs can resume after restart. Use `createdAt`, `updatedAt`, `startedAt`, `completedAt`, `attemptCount`, and sanitized error fields.

---

# 7. REQUIRED API ROUTES

Implement and document route contracts. All request bodies and returned objects must be validated with Zod.

Minimum routes:

- `GET /api/health` — backend and database health; must not expose secrets.
- `GET /api/demo/session` — current local demo role.
- `POST /api/demo/session/role` — change local demo role.
- `POST /api/documents/upload` — upload and validate file.
- `GET /api/documents/:id` — document metadata and extraction state.
- `GET /api/documents/:id/pages/:page` — page/block text for viewer.
- `POST /api/documents/:id/extraction/confirm` — persist user's extraction corrections.
- `POST /api/verification-jobs` — create idempotent verification job; return `jobId`.
- `POST /api/verification-jobs/:id/advance` — process one bounded resumable step.
- `GET /api/verification-jobs/:id` — read-only job status/progress.
- `GET /api/verification-jobs/:id/report` — report when available.
- `POST /api/claims/:id/reviews` — append human-review audit event; Faculty Reviewer demo role required.
- `GET /api/documents/:id/reviews` — review audit history.
- `GET /api/lab/cases` — list lab cases.
- `POST /api/lab/attempts` — submit an experiment.
- `GET /api/lab/metrics` — compute benchmark metrics only from labelled datasets.
- Optional `POST /api/lab/find-citations` — reverse citation discovery; all returned results must be labelled `CANDIDATE SOURCE — REQUIRES REVIEW`, never verified citations.

Provide a file deletion/retention operation for local demo data, with confirmation and clear deletion result. Do not silently retain uploaded files forever.

---

# 8. FRONTEND REQUIREMENTS

Build usable, responsive pages:

1. Landing page explaining CiteVerify and its limitations.
2. Upload workspace with file validation and document preview.
3. Extraction correction screen.
4. Live processing timeline reflecting persisted backend state.
5. Claim explorer.
6. Citation explorer.
7. Publication details.
8. Side-by-side claim/evidence comparison with exact passage highlighting.
9. Verification report with filters and export.
10. Human review interface.
11. Local demo role switcher.
12. Academic Lab (M8).
13. Reviewer dashboard/history.

The UI must distinguish:

- automated result;
- source-derived evidence;
- Tavily advisory context;
- currentness warning;
- incomplete verification;
- human reviewer decision.

Never use a green `SUPPORTED` badge if quote validation fails or required evidence is missing. Do not hide ambiguity, unresolved citations, or extraction warnings.

Exports:

- JSON with full structured data and provenance.
- Markdown report readable by a researcher.
- Include generation time, retrieval times, source URLs, access state, limitations, and human-review state.
- Do not export private filesystem paths or API keys.

---

# 9. MILESTONE EXECUTION PRIORITY

**M1–M6 must be complete before starting M7 or M8.**

## M1 — Audit, workspace foundation, database, health route

- Complete preflight audit and matrix.
- Create npm workspaces without destroying existing code.
- Set up React/Vite and Next.js/Route Handlers.
- Configure Vite `/api` proxy.
- Configure SQLite/Prisma with safe initial migrations.
- Add shared types and Zod schemas.
- Add `/api/health`.
- Add root `npm run dev`.
- Verify both apps start and frontend can call backend.

Acceptance:
- Both ports work.
- Health route returns success.
- Database connection is verified.
- Existing repository changes and DB remain intact.

## M2 — Stage 1 document ingestion

- Secure PDF/DOCX/TXT upload.
- File size/signature/type validation.
- Private file storage and SHA-256.
- PDF.js extraction with supported worker setup.
- DOCX/TXT extraction.
- OCR candidate/fallback and per-page status.
- Page/block anchors and extraction warnings.

Acceptance:
- Digital PDF, DOCX, TXT, scanned PDF, malformed PDF, password-protected PDF, wrong MIME, oversized file, and path-traversal filename tests.
- No public file access.

## M3 — Stage 2 claim/citation extraction

- Body/reference separation.
- Numbered and author-year citation detection.
- Potential claim extraction.
- Citation-to-reference mapping.
- Orphaned and unused reference handling.
- Manual correction UI and versioned correction history.

Acceptance:
- Multiple citation formats and multi-citation sentences.
- Clear statement that heuristic extraction can miss claims.
- User can fix extraction before proceeding.

## M4 — Tavily adapter and durable job orchestration

- Tavily Search, Extract, Research creation, and Research status retrieval.
- Bearer auth and server-only environment variable.
- Request schemas and Zod validation.
- Durable `VerificationJob` state machine and resumable `advance` route.
- Idempotency, DB lease/version, caching, budgets, error handling, and telemetry.
- Mock all Tavily responses in tests; do not require real credits for unit tests.

Acceptance:
- Duplicate advance requests do not duplicate work.
- Restart resumes a pending job.
- API errors are truthful and recoverable.

## M5 — Stages 3–5 verification engine and core tests

- Publication resolver.
- Source access classification.
- Evidence chunking/ranking.
- Quote provenance and contiguous span checker.
- Numerical comparison.
- Retraction/correction/currentness separation.
- Verdict policy and abstention logic.
- Zod-validated report output.
- 12 core judge-facing tests (below).

Acceptance:
- Every displayed quote maps to a stored passage.
- Every source URL belongs to the run's candidate set.
- No unsupported result from incomplete source content.
- Historical support is preserved when retraction/currentness flags exist.

## M6 — Complete core React app, human review, report export

- Finish upload-to-report user flow.
- Evidence highlighter.
- Claim/citation explorer.
- Reviewer role gating for local demo workflow.
- Append-only, hash-chained review log.
- JSON and Markdown exports.
- Playwright end-to-end flow.

Acceptance:
- End-to-end upload → extraction correction → verification → evidence inspection → reviewer override → report export works.
- Reviewer-only API route rejects Researcher demo role.
- UI clearly warns local role selector is not authentication.

## M7 — 3D visualization (only after M6 acceptance)

- `Pipeline3D.tsx`: five nodes driven by actual persisted job states; no fake progress.
- `CitationGraph3D.tsx`: document → claims → citation mentions → reference candidates → evidence passages.
- Use React Three Fiber and Drei.
- `dpr={[1, 1.5]}` or a tested equivalent.
- ErrorBoundary around WebGL.
- Auto 2D fallback for `prefers-reduced-motion: reduce` and WebGL failures.
- Manual 2D mode toggle.
- Keep all primary workflows usable without WebGL.

## M8 — Academic Lab and benchmark suite

Four workspace tabs, housing eight modules:

**Tab 1 — Capture Relevant Evidence**
1. Scientific Claims.
2. Evidence Retrieval.

**Tab 2 — Validation Environment**
3. Citation Authenticity.
4. Citation Mapping.
5. Contradiction Detection.
6. Numerical Exaggeration.
7. Outdated/Retraction Research.
8. Human Verification.

Include Simulation, Lab, and Field Deployment modes. Field mode uses real Tavily calls and records actual latency, request usage, errors, and access states.

**Tab 3 — Comparator / Benchmark**
Compute actual:

- citation precision;
- citation recall;
- citation matching F1;
- claim classification macro F1;
- per-class precision/recall/F1;
- confusion matrix;
- quote verification rate;
- evidence coverage;
- abstention rate;
- human agreement where labels exist.

Use only a human-labelled gold dataset. If it is absent or too small, display `NOT ENOUGH LABELLED DATA`. Never show invented accuracy numbers.

**Tab 4 — Find Citation(s)**
Optional reverse citation finder. Search an uncited claim with Tavily and extract candidate sources. Label every result `CANDIDATE SOURCE — REQUIRES HUMAN REVIEW`. It is not the same as verifying an existing citation.

### Mandatory 1-click demo fixture

Preload a visibly labelled `DEMO FIXTURE` inspired by the official problem-statement example:

- Document claim: “A particular study found that a learning app improved test scores by 30%.”
- Synthetic teaching source: a small pilot reports an improvement, but does not establish the claim's stated 30% or broad population scope.
- Expected teaching outcome: `PARTLY_SUPPORTED` and `NEEDS_HUMAN_REVIEW`.

Do not invent or imply that this synthetic fixture is a real publication or a real measured study. Mark it synthetic throughout the UI, reports, and benchmark data. Do not count it as real-world model accuracy.

---

# 10. THE 12 CORE JUDGE-FACING TESTS

Use fixtures with explicit expected outputs. Mock Tavily in all deterministic tests. Add live Tavily smoke tests only as opt-in tests requiring a configured key and real API credits.

1. **Correct citation and supporting claim:** matching publication + quote-verified evidence → `SUPPORTED`.
2. **Fake/nonmatching DOI:** DOI conflict → `MISMATCHED`; unresolved search → `UNRESOLVED`, never fabricated by default.
3. **Wrong author or year:** conflicting metadata → `MISMATCHED` or `AMBIGUOUS` according to matching evidence.
4. **Exaggerated percentage, same metric:** comparable metric/unit/denominator/population/timeframe established → `PARTLY_SUPPORTED`.
5. **Opposite finding:** matched source directly refutes claim → `CONTRADICTORY`.
6. **Missing bibliography + multiple citation mapping:** orphaned marker → `MISSING`; multiple claims/citation groups mapped correctly; unused reference distinguished.
7. **Confirmed retraction:** `retractionStatus=CONFIRMED_RETRACTED`; preserve historical `supportVerdict`; show currentness warning separately.
8. **Abstract-only/paywalled source:** `ABSTRACT_ONLY` or `SOURCE_UNAVAILABLE`, low confidence, abstain from unsupported verdict.
9. **Tavily failures:** 429, 422, 434, timeout, 500, Research `pending/in_progress/completed/failed`, and partial Extract `failed_results` handled honestly.
10. **Hallucinated/non-contiguous quote:** quote rejected; `quoteVerified=false`; low confidence; human review required.
11. **Human review audit:** approve/override appended as a new audit event; original automated verdict retained; update/delete trigger rejects mutation.
12. **Playwright E2E:** upload → extraction correction → verify → evidence inspect → Researcher cannot review → switch demo role → Faculty Reviewer override → export; test 2D fallback.

Do not mark a test as passed unless it ran and its result is recorded.

---

# 11. SECURITY, PRIVACY, AND OPERATIONAL REQUIREMENTS

- Default local development server binding should be localhost/127.0.0.1 where practical.
- Restrict CORS to expected local origins.
- Use secure HTTP headers and request size limits.
- Rate-limit uploads and local demo actions where practical.
- Sanitize rendered markdown/HTML; never render raw retrieved HTML unsafely.
- Treat all uploaded text and web-extracted text as untrusted data and prompt-injection content.
- Never execute links, scripts, macros, attachments, or instructions contained in documents/web pages.
- Validate every external URL scheme and reject `javascript:`, `data:`, `file:`, localhost, private-network, and malformed URLs before using it.
- Use server-generated opaque file names and protect against path traversal.
- Do not expose private storage or SQLite files through static routes.
- Do not log API secrets, full private source documents, or unnecessary personal information.
- Implement local file retention/deletion controls and document what is stored.
- Do not claim the local demo role switcher provides production-grade identity or security.
- For deployment, explain that local SQLite and local filesystem storage require persistent disk and a long-running Node.js runtime. Ephemeral/serverless deployments can lose files/database state and cannot be assumed to run a durable in-process worker. Do not claim production readiness without a separately designed persistent database/storage/worker architecture.

---

# 12. DEFINITION OF DONE

The MVP is complete only when all conditions below are demonstrated:

1. React frontend and Next.js backend run from root `npm run dev`.
2. User can upload PDF, DOCX, and TXT.
3. Extraction results preserve page/paragraph/block traceability where available.
4. User can correct extracted claims and citation mappings before verification.
5. References are searched with Tavily and matched conservatively.
6. Original source content is extracted where available and its access limitations are explicit.
7. Evidence is linked to the correct matched publication.
8. Every displayed quotation is verified against a contiguous stored passage.
9. The five scientific verdicts are implemented with conservative rules.
10. Incomplete sources abstain instead of being called unsupported.
11. Retraction/currentness warnings do not erase the historical support verdict.
12. Human reviewers can approve/override without overwriting automated results.
13. Review audit events are append-only within the demo app and hash-chain verified.
14. JSON and Markdown reports include provenance, limitations, and review status.
15. The 12 core automated tests pass.
16. 3D visualization is optional, has a working 2D fallback, and does not block the core workflow.
17. Academic Lab demo fixtures are labelled synthetic and benchmark results are computed only from real labels.
18. README accurately documents setup, environment variables, local-only mode, API constraints, test commands, limitations, and deployment caveats.

Never mark the system `READY`, `ACCURATE`, or `COMPLETE` based only on a successful build. Report concrete test results and known limitations.

---

# 13. FINAL AGENT RESPONSE FORMAT AFTER EACH MILESTONE

After every milestone, report:

1. **Status:** completed / partial / blocked.
2. **Files created.**
3. **Files modified.**
4. **Existing files preserved.**
5. **Features implemented.**
6. **Commands executed.**
7. **Tests executed and exact pass/fail counts.**
8. **Known limitations and unresolved risks.**
9. **Next milestone.**

Start now with **Step 0: Read-only repository audit**, then implement **M1**. Do not skip the audit and do not replace the existing project blindly.