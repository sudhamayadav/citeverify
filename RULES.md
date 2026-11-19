# CITEVERIFY HARD RULES (READ BEFORE EVERY TASK)
- Stack: npm workspaces (`apps/web` React+Vite+Tailwind+R3F :5173, `apps/api` Next.js App Router+Prisma+SQLite+Zod :3000, `packages/shared`). No Python.
- External API: TAVILY ONLY (`POST /search`, `/extract`, `/research`, `GET /research/{id}`), server-side via `TAVILY_API_KEY`. No other AI/academic APIs.[cite: 2]
- Local Demo Mode: Server-managed `Researcher` / `Faculty Reviewer` role switcher (no login/OAuth). Append-only hash-chained `HumanReview` log.[cite: 2]
- Guardrails:
  1. Never invent titles, DOIs, URLs, page numbers, quotes, or probabilities.[cite: 2]
  2. Every quote must be a contiguous span of a locally stored passage.[cite: 2]
  3. Never force `UNSUPPORTED` on abstract-only/partial/unavailable sources (abstain instead).[cite: 2]
  4. Keep `publicationType`, `peerReviewStatus`, and `retractionStatus` independent. Never infer peer review without explicit evidence.
  5. Never claim "0 citations" (label Tavily forward citations as sampled/non-exhaustive).[cite: 3]
  6. Never overwrite previous verification runs; every recheck creates a new run.[cite: 3]
  7. Store JSON snapshots as `String` (TEXT) + Zod validation unless Prisma SQLite `Json` is verified.[cite: 3]
- Output style: Minimal prose, code diffs only, no long summaries.