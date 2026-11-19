# CiteVerify

> Scientific Claim and Citation Verification System

CiteVerify is a local-first system designed to verify scientific assertions against cited publications using deterministic citation mapping, local text parsing, BM25 passage ranking, and verified contiguous quote extraction.

---

## Architecture & Workspaces

- `apps/web`: React 19 + Vite + Tailwind CSS + React Three Fiber / Drei + Playwright
- `apps/api`: Next.js 15 (App Router) + Prisma + SQLite (WAL mode) + Zod
- `packages/shared`: Shared TypeScript types and Zod schemas

---

## Hard Rules & Constraints

1. **Stack**: npm workspaces, Node.js, Next.js App Router, Vite, SQLite via Prisma. No Python.
2. **External API Restriction**: Tavily is the **ONLY** external search and extraction API (`/search`, `/extract`, `/research`, `/research/:id`). No OpenAI, Gemini, Crossref, OpenAlex, Semantic Scholar, or other LLMs.
3. **Local Demo Mode**: Role switcher (`Researcher` vs `Faculty Reviewer`) with server-managed cookies. Human review log is append-only with SHA-256 hash chaining and SQLite mutation-prevention triggers.
4. **Guardrails**:
   - Every displayed quote must be a contiguous span of a locally stored passage.
   - Never force `UNSUPPORTED` on incomplete/abstract-only/paywalled sources (honest abstention).
   - Independent status fields: `supportVerdict`, `referenceResolutionState`, `retractionStatus`, `correctionStatus`, and `currentnessAssessment`.
   - Never claim "0 citations": Tavily forward citations are explicitly labelled as sampled/non-exhaustive.
   - Rechecking creates a new `VerificationRun` (Run #2) without overwriting historical runs or audit snapshots.

---

## Setup & Running

```bash
# Install dependencies
npm install

# Push database schema and generate Prisma client
npm run db:push

# Run local development servers (Vite on :5173, Next.js on :3000)
npm run dev

# Run full Vitest test suite across all workspaces
npm run test

# Run Playwright E2E suite
npm run test:e2e
```

---

## Environment Variables

Copy `.env.example` to `apps/api/.env`:

```env
DATABASE_URL="file:./citeverify.db"
TAVILY_API_KEY="your-tavily-api-key"
CRON_SECRET="citeverify_demo_cron_secret"
```

---

## Tested Milestones & Test Coverage

- **M1–M6**: Foundations, document ingestion (PDF/DOCX/TXT), extraction, Tavily adapter, verification engine (12 core judge-facing tests), and human review.
- **M7**: 3D Visualizations with 2D mode fallback.
- **M8**: Academic Lab & Benchmark Suite (4 tabs: Evidence Capture, Validation Environment, Gold Comparator, Reverse Citation Discovery).
- **M9**: Reproducibility Audit, SQLite append-only triggers, and Publication Type / Peer-Review Evidence.
- **M10**: Forward Citation Contexts (gate-checked bibliography & in-text citation mapping) & Citation Health Cards.
- **M11**: Research Collections, Run-to-Run Diffing, and CRON_SECRET protected due-checks.

**Automated Test Suite Status:**
- `apps/api`: 12 test suites, **75 tests passed, 0 failed**.
- `apps/web`: 3 test suites, **14 tests passed, 0 failed**.
- `e2e`: Playwright E2E flow passed.
- **Total:** **89 tests passed, 0 failed**.

---

## Known Limitations & Honest Disclosures

- **Local Demo Mode**: The role switcher is a local demonstration of role-based workflow; it is not production authentication or cryptographic authorization.
- **Sampled Forward Citations**: Forward citation contexts discovered via Tavily are sampled and non-exhaustive; they do not represent total scholarly citations or a complete citation index.
- **Scheduler**: Automated background monitoring requires an external cron trigger to call `POST /api/collections/run-due-checks` with `CRON_SECRET`. In-memory timers are intentionally avoided.
