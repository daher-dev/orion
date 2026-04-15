# Orion

A monorepo scaffolded for AI-assisted development with Claude — see `CLAUDE.md` for the working agreement.

## Requirements

- Docker (for local Postgres)
- [go-task](https://taskfile.dev) — `brew install go-task/tap/go-task`
- [uv](https://docs.astral.sh/uv/) — `brew install uv`
- [pnpm](https://pnpm.io/) — `brew install pnpm`

## Setup

```bash
task setup          # Install backend + frontend dependencies
task db:up          # Start local Postgres
task db:migrate     # Apply Alembic migrations
```

## Development

```bash
task dev            # Start backend (:8000) + frontend (:3000)
task dev:backend
task dev:frontend
```

## Testing

```bash
task test           # All tests: backend unit + frontend unit + E2E
task test:backend   # pytest
task test:frontend  # Vitest
task test:e2e       # Playwright
```

## Lint / Format / Typecheck

```bash
task lint
task format
task typecheck:backend
```

## Layout

- `backend/` — FastAPI + SQLModel + Alembic (Python, `uv`)
- `frontend/` — Next.js 16 + React 19 + Tailwind v4 + shadcn/ui (`pnpm`)
- `docs/` — Roadmap and per-feature specs (`docs/features/NNN - Title/`)
- `.claude/` — Agent commands (PM, Dev, QA, Reviewer, Checkout)
- `.github/workflows/` — CI/CD
