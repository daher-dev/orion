# Implementation Log — FEATURE-018: Settings — Audit Log Viewer

## Files Created

### Backend

- `backend/src/schemas/audit_log.py` — Pydantic shapes: `AuditLogActor`,
  `AuditLogRead`, `AuditLogFilters`, and the `AuditLogPage = Page[…]`
  alias.
- `backend/src/services/audit_log.py` — `list_audit_logs(...)` plus a
  small `AuditLogRow(audit, user)` dataclass that bundles each row with
  its (possibly null) author. Append-only — no create/update/delete.
- `backend/src/routers/audit_log.py` — `GET /v1/audit-logs` with
  `RequirePermission("users.read")` (see TODO below).
- `backend/tests/test_services/test_audit_log_service.py` — 13 tests:
  sort order, tenant isolation, every filter dimension, pagination,
  joined-user shape (both branches), and `SET NULL` after author delete.
- `backend/tests/test_routers/test_audit_log_router.py` — 15 tests:
  401 unauth, 403 operator, 422 invalid params, success path, every
  filter as a query string, tenant isolation, and pagination.

### Frontend

- `frontend/src/lib/schemas/audit-log.ts` — Zod read/page schemas, the
  `AuditLogFilters` type, and the `AUDIT_RESOURCE_TYPES` catalog used by
  the filter dropdown.
- `frontend/src/hooks/use-audit-logs.ts` — `useAuditLogs(filters?)`
  TanStack Query hook hitting `GET /v1/audit-logs`. Reuses the existing
  `qk.audit.list(...)` key from the central key factory.
- `frontend/src/components/settings/audit/ResourceTypeChip.tsx` —
  brand-colored chip with the resource-type → sub-product map.
- `frontend/src/components/settings/audit/AuditLogTable.tsx` — the
  `.tbl` port (When · Who · Resource · Target · Detail). Exports a
  `formatRelative` helper.
- `frontend/src/components/settings/audit/AuditLogFiltersBar.tsx` —
  toolbar with search input, two `Select`s (resource type + user),
  two native date inputs, and a Clear button.
- `frontend/src/app/[locale]/(app)/settings/audit/page.tsx` — client
  component owning filter + page state, rendering the card +
  filters bar + table + pagination footer.
- Three `__tests__/` Vitest files (16 tests in total).
- `frontend/e2e/settings-audit.spec.ts` — 4 Playwright scenarios:
  rows render, search filter, resource-type filter, pagination.

### Docs

- `docs/features/018 - Audit Log/spec.md` and this `dev.md`.

## Files Modified

- `backend/src/routers/__init__.py` — wire `audit_log_router` into the
  aggregate `api_router`.
- `frontend/messages/en.json` + `frontend/messages/pt-BR.json` —
  populated the previously empty `audit.*` namespace (~50 keys per
  locale). `i18n-lint` is green.
- `docs/ROADMAP.md` — F-018 status moved from `planned` to `in-progress`.

## Migration Notes

No schema changes: the `audit_logs` table already exists from the
foundation migration (`models/audit_log.py`). Two indexes are already
in place (`company_id+created_at` and `company_id+resource_type+...`)
which cover the queries this feature runs.

## Dev Notes

### Service shape: row dataclass over joinedload

The `AuditLog` model intentionally does not declare a SQLAlchemy
`Relationship` to `User`, so calling `joinedload(AuditLog.user)` would
have required mutating a foundation model. Instead, the service performs
an explicit `select(AuditLog, User).join(User, …, isouter=True)` and
projects rows into a small `AuditLogRow(audit, user)` dataclass. Net
result: no foundation churn, and the router still gets `user` data
without a lazy load.

### Author null-handling

The service test `test_list_returns_null_user_when_author_deleted`
exercises the FK `SET NULL` cascade. On the frontend we render the
italic "System" string (i18n key `audit.table.system`) for both system
events (`user_id IS NULL` at insert time) and post-deletion entries —
the user shouldn't have to distinguish them.

### Permission TODO (audit.read)

There is no `audit.read` permission code seeded yet. For v1 the router
gates on `users.read` — every admin + manager already has it; operators
do not. A follow-up migration should:

1. Add `("audit", "Audit log")` to `DOMAINS` in
   `alembic/versions/3187f02cbc35_seed_roles_and_permissions.py` (or a
   new migration that just adds the `audit.read` permission and grants
   it to admin + manager).
2. Change `RequirePermission("users.read")` in
   `backend/src/routers/audit_log.py` to `RequirePermission("audit.read")`.
3. Update the spec acceptance criteria to reference `audit.read`.

This is tracked in the spec under the "Permissions" heading.

### Pagination: client-controlled page state

The page component owns `page` state as a regular `useState`. Filter
setters wrap `setPage(1)` so users don't land on an empty page after
narrowing. We chose this over a `useEffect` watcher because React 19's
compiler flags set-state-in-effect as a cascading-render warning (and
ESLint then errors). The pagination footer is always rendered as long
as the page has data.

### Resource-type chip colours

Resource → sub-product mapping lives in `ResourceTypeChip.tsx`. Sales
rows (orders/clients/ads) get `--brand-sales` (terracotta), catalog rows
(products/specs/prints/trims) get `--brand-catalog` (aubergine),
production (sewing) gets `--brand-prod` (teal), inventory (fabric,
cutting, stock) gets `--brand-inv` (amber), and settings resources
fall back to `--brand-settings` (stone).

### User filter options derived from visible rows

Rather than introduce a new `GET /v1/members` endpoint just for the
filter dropdown, we derive the unique authors from the rows visible on
the current page. The filter dropdown therefore shows users who have
recently performed an action — which is the realistic UX target anyway.
A future enhancement could wire this to a proper members endpoint once
F-002 (Members & Roles) lands.

### Date filter UX

The page passes `date_from` as `YYYY-MM-DDT00:00:00Z` and `date_to` as
`YYYY-MM-DDT23:59:59Z` so users get the intuitive "everything on this
date" inclusive behaviour from a date picker (not a datetime picker).

### Backend tests' coverage

The backend coverage gate is configured at 85% global. New audit_log
modules sit at 100% coverage for service, router, schema (verified
with `--cov=src/services/audit_log --cov=src/routers/audit_log
--cov=src/schemas/audit_log`). The overall 85% threshold isn't met
because the audit-log tests only exercise the audit-log code paths;
running the full suite together stays above the 85% gate.

### Pre-existing test flakiness

The full backend suite has pre-existing order-dependent failures when
`pytest-random-order` shuffles test modules together — confirmed by
running the suite on the baseline commit before any of my changes.
My new test modules pass every seed I tried (123, 456, 789, 1024,
2048, 256070) when run alone or alongside each other.
