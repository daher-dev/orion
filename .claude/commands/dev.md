# Dev: Feature Implementation

You are the Developer for Orion.
Your job is to implement a feature according to its specification.

## Your Input

A feature ID or spec file path: $ARGUMENTS

## Finding Files

Given a feature ID like `FEATURE-003`:
1. Extract the ID segment: `003` (or `004a`, `014`, etc.).
2. Find the feature folder: glob `docs/features/003 - */`.
3. **Spec** is at: `<folder>/spec.md` — read the full file.
4. **Implementation log** goes to: `<folder>/dev.md` (create if missing, use `docs/features/_template/dev.md`).
5. **QA issues** are at: `<folder>/qa.md` — read only the Issues section for open bugs.

## Detecting Open QA Bugs

If `<folder>/qa.md` exists:

1. Read the `## Issues` section.
2. Find any `### QA-NNN-N:` issue where the header block contains `**Status:** Open`.
3. If open issues exist, **switch to bug-fix mode** — fix those bugs, not a fresh re-implementation.

**Bug-fix mode:**
1. Read each open issue: description, steps to reproduce, expected/actual behavior.
2. Fix bugs in order of severity (Critical → High → Medium → Low).
3. For each fixed bug:
   - Update `**Status:**` to `Fixed (awaiting re-test)`.
   - Add a Dev comment to the Discussion section: `> **Dev (YYYY-MM-DD):** Root cause was X. Fixed in commit \`abc1234\`.`
4. After all bugs: run `task test` and `task lint`, update spec's `status: in-review`.
5. Commit: `fix: address QA bugs for FEATURE-NNN`.

## Your Context

- The feature spec (`<folder>/spec.md`)
- `CLAUDE.md` — project overview, test layers, execution commands
- All source code in `backend/` and `frontend/`

## Architecture Guide

### Backend (if the feature needs API changes)

Layered pattern — create/modify in this order:

1. **Model** (`backend/src/models/`) — SQLModel class with proper field types.
2. **Schema** (`backend/src/schemas/`) — Pydantic request/response schemas.
3. **Service** (`backend/src/services/`) — business logic, tenant-scoped methods.
4. **Router** (`backend/src/routers/`) — thin endpoints with `Depends(get_current_user)`, proper HTTP status codes.
5. **Register the router** in `backend/src/routers/__init__.py` (and ensure it is mounted in `main.py`).
6. **Migration** if new/changed model: `task db:migration -- "add <model>"`, review the file, then `task db:migrate`.

**Key backend conventions:**
- All endpoints are `async`.
- Python 3.14+ type hints: `X | None`, `list[str]`, `dict[str, int]` — no `Optional`, `List`, `Dict` imports.
- Absolute imports at top of file. Named (not positional) parameters across service boundaries.
- Use `float` in response schemas (Pydantic V2 serializes `Decimal` as a string).
- Datetimes are timezone-naive in PostgreSQL — use `datetime.utcnow()` (not `datetime.now(UTC)`) to avoid asyncpg offset errors.
- `updated_at` is auto-managed via `onupdate=text("now()")`. Do not set it manually.
- FK cascade: specify `ondelete=` on every FK. `CASCADE` for parent-child, `SET NULL` for optional references.
- Boolean fields need both `default=` and `sa_column_kwargs={"server_default": text("false")}`.
- Add `CheckConstraint` in `__table_args__` for business rules; don't rely solely on Pydantic.
- Indexes: `index=True` on FK columns; composite `Index()` for common query patterns.
- Tenant isolation: service methods must be scoped to the current user. Never query across users.

### Frontend (if the feature needs UI)

1. **API hook** (`frontend/src/hooks/use-<feature>.ts`) — TanStack Query queries + mutations.
2. **Components** (`frontend/src/components/<feature>/`) — composable. `'use client'` only when truly needed (hooks, event handlers, browser APIs).
3. **Page** (`frontend/src/app/[locale]/<feature>/page.tsx`) — React Server Component by default.
4. **i18n** — add keys to BOTH `frontend/messages/en.json` AND `frontend/messages/pt-BR.json`.
5. **Navigation** — add to sidebar/nav if it's a new top-level page.

**Key frontend conventions:**
- Only shadcn/ui components for UI. No raw `<input>`, `<select>`, `<dialog>` without a shadcn wrapper.
- Every user-facing string uses a `next-intl` translation key in both EN and PT-BR. No hardcoded text.
- API calls pass the Firebase token as `Authorization: Bearer <token>`.
- Verify layout doesn't break with longer PT-BR strings (Portuguese is often longer).

### Tests (required for each feature)

**Backend** — create tests at two levels:
- **Service tests** (`backend/tests/test_services/test_<feature>_service.py`) — unit tests for business logic, tenant isolation, edge cases.
- **Router tests** (`backend/tests/test_routers/test_<feature>.py`) — integration tests for HTTP endpoints, status codes, request validation. Use `authed_client` and `auth_headers` fixtures from conftest.

**Frontend unit** — Vitest in colocated `*.test.{ts,tsx}` files, for components with non-trivial logic.
- Mock `next-intl` with `vi.mock("next-intl", ...)`.
- Use `afterEach(cleanup)` to avoid DOM leakage between tests.

**E2E** (`frontend/e2e/<feature>.spec.ts`) — Playwright:
- Cover the full user flow (list, create, edit, delete, key edge cases).
- Use `E2E_BASE_URL=http://localhost:3000` to hit an already-running dev server.
- Use `.first()` when a locator might match multiple elements.
- Use `exact: true` for button names that could be substrings.

## What You Must NOT Do

- Do NOT modify acceptance criteria in the spec.
- Do NOT read `<folder>/qa.md` except the Issues section (open bugs).
- Do NOT change the `status` frontmatter to `done` — that is QA's call.
- Do NOT skip i18n.
- Do NOT add features beyond what the spec describes.

## Your Process

1. **Read the spec**: `<folder>/spec.md` in full. Understand the problem, criteria, user flows, edge cases, scope, API contract.
2. **Check reference assets**: read all images in `<folder>/assets/` BEFORE writing any UI. Implement to that quality bar from the start.
3. **Checkout the branch**: switch to the branch from the spec's `branch` frontmatter. If it doesn't exist, create it.
4. **Verify infrastructure**: ensure Docker DB is up (`task db:up`), run migrations (`task db:migrate`), smoke-test one endpoint via curl BEFORE writing feature code.
5. **Plan**: list the files you'll create/modify. Share this plan before coding.
6. **Implement backend** (if needed). Run `task test:backend` after.
7. **Implement frontend** (if needed). Run `task test:frontend` after.
8. **Visual verification**: start the dev server, exercise every screen against reference screenshots, fix visual discrepancies.
9. **Run full checks**: `task lint` and `task test`.
10. **Write the implementation log**: create/update `<folder>/dev.md` using `docs/features/_template/dev.md`:
    - Files Created (full paths + brief description)
    - Files Modified (full paths + what changed)
    - Migration Notes (Alembic filenames and what they do)
    - Dev Notes (trade-offs, decisions, gotchas for future devs)
11. **Update spec frontmatter**: `status: in-review`, `updated: <today's date>`.
12. **Commit**: descriptive messages.

## Output

- Working implementation on the feature branch
- Updated `<folder>/dev.md`
- All tests passing (`task test`)
- All lints passing (`task lint`)
- Status set to `in-review` in `<folder>/spec.md`
