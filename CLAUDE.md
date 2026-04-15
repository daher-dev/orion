# Orion

Monorepo scaffolded for AI-assisted development. This file is the entry point for Claude agents working in this repo.

## Quick Commands

```bash
task dev           # Backend (:8000) + frontend (:3000)
task test          # All test suites
task lint          # Lint all
task setup         # Install all dependencies
task db:up         # Start local Postgres
task db:migrate    # Apply migrations
```

## Architecture

Monorepo with two applications:

- `backend/` — FastAPI, SQLModel, Alembic, PostgreSQL. Managed with `uv`. Python 3.14+.
- `frontend/` — Next.js 16 (App Router), React 19, Tailwind v4, shadcn/ui, TanStack Query, next-intl. Managed with `pnpm`.

### Backend Layers

Strictly layered, in this order when adding features:

1. **Model** (`backend/src/models/`) — SQLModel table classes.
2. **Schema** (`backend/src/schemas/`) — Pydantic request/response shapes.
3. **Service** (`backend/src/services/`) — Business logic, tenant-scoped.
4. **Router** (`backend/src/routers/`) — Thin HTTP endpoints, `Depends(get_current_user)` on protected routes.
5. **Migration** — `task db:migration -- "add <model>"` after model changes.

### Frontend Patterns

- RSC (React Server Components) by default; `'use client'` only when needed (hooks, event handlers, browser APIs).
- All user-facing strings go through `next-intl` translation keys in BOTH `messages/en.json` and `messages/pt-BR.json`.
- Data fetching: TanStack Query hooks in `src/hooks/use-<feature>.ts`.
- UI: shadcn/ui components — no raw `<input>`, `<button>`, `<select>` without a shadcn wrapper.
- Pages live in `src/app/[locale]/<feature>/page.tsx`.

### Auth

Firebase Auth: client SDK on frontend, token verification on backend. Non-prod dev bypass is available via `X-Dev-Bypass-*` headers (see `backend/src/dependencies.py`). Tests use dev bypass — Firebase is never actually contacted in tests.

## Test Layers

| Layer | Location | Runner |
|-------|----------|--------|
| Backend unit (services) | `backend/tests/test_services/` | pytest (`task test:backend`) |
| Backend integration (routers) | `backend/tests/test_routers/` | pytest |
| Frontend unit | colocated `*.test.{ts,tsx}` under `frontend/src/` | Vitest (`task test:frontend`) |
| E2E | `frontend/e2e/*.spec.ts` | Playwright (`task test:e2e`) |

### Test Data & DB Reset

- Reset test DB: `scripts/reset-test-db.sh`
- E2E envs: `NEXT_PUBLIC_DEV_BYPASS_AUTH=true`, `NEXT_PUBLIC_DEV_BYPASS_UID=qa-dev-user`, `NEXT_PUBLIC_API_URL=http://localhost:8000`
- Backend tests truncate tables after each test — see `backend/tests/conftest.py`.

## Configuration

**Backend** (`backend/.env`, see `backend/.env.example`):
- `DATABASE_URL` — Postgres connection string. Accepts `postgresql://` or `postgresql+asyncpg://`. Add `?sslmode=require` for managed Postgres (Neon, Supabase, etc.).
- Firebase Admin uses Application Default Credentials (`gcloud auth application-default login`) in dev; service account JSON in production.

**Frontend** (`frontend/.env.local`, see `frontend/.env.local.example`):
- `NEXT_PUBLIC_API_URL` — backend URL (default `http://localhost:8000`)
- `NEXT_PUBLIC_FIREBASE_*` — Firebase web app config
- `NEXT_PUBLIC_DEV_BYPASS_AUTH=true` + `NEXT_PUBLIC_DEV_BYPASS_UID=<uid>` for local/E2E development without Firebase

## Feature Catalog

Each feature lives in `docs/features/NNN - Title/` with `spec.md`, `dev.md`, `qa.md`, and `review.md`.

Add new features to `docs/ROADMAP.md` when their spec is created.

_No features implemented yet — the scaffold is empty. The first feature seeds this catalog._

## Feature Management

### Workflow

1. `/pm <idea>` — PM agent researches and brainstorms with the user before writing the spec.
2. Human reviews and approves the spec, creates the feature branch.
3. `/dev FEATURE-NNN` — Dev agent implements the spec.
4. `/qa FEATURE-NNN` — QA agent validates the implementation.
5. `/review-branch` — optional framework/code-quality audit against the diff.
6. `/checkout FEATURE-NNN` — reconciles spec against dev/qa logs, updates ROADMAP.
7. Human reviews and merges.

### Agent Boundaries

- **PM** reads: `ROADMAP.md`, existing `spec.md` files, frontend pages, i18n keys. Writes: `spec.md`, screenshots to `assets/`. Does NOT create branches or commits.
- **Dev** reads: `spec.md` (full), `qa.md` Issues section (open bugs only), all source code. Writes: code + `dev.md`, updates `spec.md` frontmatter (status).
- **QA** reads: `spec.md` only. Writes: `qa.md` (Jira-style bug tickets), updates `spec.md` frontmatter (status).
- **Reviewer** writes: `review.md` (Jira-style review tickets).
- **Checkout** reads all four files. Writes: updates `spec.md`, extracts reusable learnings back into `.claude/commands/dev.md` and `.claude/commands/qa.md`.

### Feature Spec Format

Templates in `docs/features/_template/`. Each feature folder:

```
docs/features/NNN - Title/
  spec.md     ← PM writes (problem, criteria, flows, API, i18n, seed data)
  dev.md      ← Dev writes (files, migration notes, dev notes)
  qa.md       ← QA writes (test results + Jira-style bug tickets)
  review.md   ← Reviewer writes (Jira-style code review tickets)
  assets/     ← screenshots and QA evidence
```

Each `spec.md` has YAML frontmatter with `id`, `status`, `branch` fields.
