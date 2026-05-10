# FEATURE-011 — Dev Log

## Summary

Implemented the Sales: Clients feature end-to-end on top of the
`foundation/app-shell-and-auth` work:

- Backend: `schemas/client.py`, `services/client.py`, `routers/clients.py`,
  registered in `routers/__init__.py`. Five endpoints (list, detail, create,
  update, delete), all permission-gated and audit-logged.
- Frontend: design-faithful list page at `/clients`, side-sheet form for
  create + edit, alert-dialog delete confirm, search filter, sortable table,
  empty state.
- Tests: 37 backend tests (services + routers), 20 Vitest tests
  (hook, table, form), and a Playwright spec covering happy paths,
  validation, and operator denial.

## Files Added

### Backend

- `backend/src/schemas/client.py` — `ClientCreate`, `ClientUpdate`, `ClientRead`,
  `ClientFilters`, `ClientPage` (alias of `Page[ClientRead]`).
- `backend/src/services/client.py` — `list_clients`, `get_client`,
  `create_client`, `update_client`, `delete_client`. Uses `scoped()` on every
  read; writes audit entries on every mutation.
- `backend/src/routers/clients.py` — five endpoints under `/v1/clients`,
  router-level `RequirePermission("clients.read")`, plus per-endpoint
  `clients.write` for mutating routes.
- `backend/tests/test_services/test_client_service.py` — 15 tests covering
  every service path, tenant isolation, and audit-log write-through.
- `backend/tests/test_routers/test_client_router.py` — 22 tests covering every
  endpoint × {200/201/204, 401, 403, 404, 422} and the operator → 403 path.

### Frontend

- `frontend/src/lib/schemas/client.ts` — Zod schemas mirroring the backend.
- `frontend/src/hooks/use-clients.ts` — `useClients`, `useClient`,
  `useCreateClient`, `useUpdateClient`, `useDeleteClient`.
- `frontend/src/components/page/PageHead.tsx` — reusable design-faithful
  page header (eyebrow mark + uppercase label + 30px Fraunces title +
  13px ink-3 sub + actions slot). Used here, will be picked up by any other
  feature that needs the same rhythm.
- `frontend/src/components/clients/ClientsTable.tsx` — TanStack Table-based
  list with avatar + name, contact columns, edit/delete actions, sortable
  headers. Default unsorted (renders as backend gave us — newest first).
- `frontend/src/components/clients/ClientForm.tsx` — react-hook-form +
  Zod-validated form with two sections (Identification, Contact).
- `frontend/src/components/clients/ClientFormSheet.tsx` — side-sheet wrapper.
- `frontend/src/components/clients/ClientsEmptyState.tsx` — empty-state with
  illustration mark, copy, and primary CTA.
- `frontend/src/app/[locale]/(app)/clients/page.tsx` — main page.
- `frontend/src/app/[locale]/(app)/clients/loading.tsx` — skeleton.
- `frontend/src/app/[locale]/(app)/clients/error.tsx` — route-level error
  boundary with retry.
- `frontend/src/__tests__/test-utils.tsx` — `TestProviders` (NextIntl + Query
  client) used by the Vitest specs.
- `frontend/src/components/clients/__tests__/ClientsTable.test.tsx`
- `frontend/src/components/clients/__tests__/ClientForm.test.tsx`
- `frontend/src/hooks/__tests__/use-clients.test.ts`
- `frontend/e2e/clients.spec.ts` — Playwright spec (8 tests + 1 skipped
  operator-only block — see "outstanding" below).

### Docs

- `docs/features/011 - Sales Clients/spec.md`
- `docs/features/011 - Sales Clients/dev.md`
- `docs/features/011 - Sales Clients/assets/` (placeholder, no captures yet)

## Files Modified

- `backend/src/routers/__init__.py` — register the clients router.
- `frontend/messages/en.json` and `frontend/messages/pt-BR.json` — populate the
  `clients.*` namespace (49 leaf keys).
- `frontend/src/__tests__/setup.ts` — add `cleanup()` after each Vitest test
  so DOM doesn't leak between tests.

## Decisions

1. **`name` is required, everything else optional.** The seed model already
   permits null on email/phone/address; the schema mirrors it. The frontend
   form trims empty strings to `undefined` before sending so the backend's
   `EmailStr` validator only fires on non-empty input.
2. **Search uses `LIKE` on `lower(name | email | phone)`.** Address isn't in
   the search predicate to keep the contract aligned with what the design
   surfaces (search by client identity, not their location).
3. **`PageHead` lives in `components/page/`, not `components/clients/`.** It's
   reusable across every feature page that follows the same shell rhythm
   (Orders, Ads, Products, etc.). The first feature owns the file; subsequent
   features add nothing to it.
4. **Default table sort is "as-given"** rather than imposing a column-driven
   default. The backend already orders by `created_at desc`, so the user sees
   the freshest clients first. Sorting by clicking a header still works.
5. **Permission UX uses `useCanAccess("clients.write")`** in two places: the
   "Novo cliente" button hides for operators, and the actions column is
   omitted from the table. The backend remains the source of truth for 403s.
6. **Audit-log messages** include the client name (`"Created client X"`,
   `"Updated client X"`, `"Deleted client X"`). Matches the existing pattern
   used in `services/auth.py`.
7. **Toast i18n** uses `clients.form.toasts.*` namespaces — both success and
   error paths surface localised messages via `sonner`.

## Design-Fidelity Verification

Verified via `getComputedStyle` in the running preview at `/pt-BR/clients`:

| Property | Design value | Computed value |
|---|---|---|
| Page title font-family | Fraunces | "Fraunces, Fraunces Fallback" |
| Page title font-size / weight | 30px / 400 | 30px / 400 |
| Page title letter-spacing | -0.025em (= -0.75px @ 30px) | -0.75px |
| Page title line-height | 1.05 (= 31.5px) | 31.5px |
| Eyebrow font-size / tracking | 11px / 0.12em (=1.32px) | 11px / 1.32px |
| Eyebrow-mark size | 18×18 | 18×18 |
| Eyebrow-mark border-radius | 4px | 4px |
| Eyebrow-mark bg | --brand-sales | terracotta lab(47.57 53.08 67.76) |
| Page sub font-size | 13px | 13px |
| Primary btn padding / font / radius / gap | 7px 13px / 13px·500 / 6px / 7px | exact match |
| Search input wrapper | bg=--orion-bg, line border, 6px radius, 5px 10px padding, min-w 200 | exact match |
| Table th | 10.5px / 0.08em (=0.84px) / 600 / uppercase / padding 10px 14px / bg=--orion-bg | exact match |
| Table td | padding 12px 14px / vertical-align middle / border-bottom 1px line-soft / last row no border | exact match |
| Sheet | width 480px, surface bg, slides from right | exact match |
| Sheet title | Fraunces 18px / 500 | Fraunces 18px / 500 |

## Deviations From Spec / Design

- **`form.sections` keys added** late in the cycle. The original spec didn't
  include section headers ("Identificação" / "Contato"), but they were
  required to mirror the design's `Sheet` form rhythm and to disambiguate
  field labels in the Vitest assertions (an "Email" section header colliding
  with an "Email" field label triggered RTL's `getMultipleElementsFoundError`).
  Added `clients.form.sections.identity` and `clients.form.sections.contact`
  in both locale files. Spec amended.
- **`clients.write` permission is enforced on POST/PATCH/DELETE inline** even
  though the router-level dependency declares `clients.read`. FastAPI
  evaluates the inner dependency first — the inline `RequirePermission(
  "clients.write")` doesn't replace the router-level one, both run, so a
  user with `clients.read` but not `clients.write` still gets 403 on
  mutations.

## Outstanding TODOs

- The Playwright `operator → 403` block is skipped unless
  `NEXT_PUBLIC_DEV_BYPASS_UID=qa-operator-user` is set and that UID has been
  provisioned with the `operator` role in the seed/test DB. We don't yet have
  a seed script that creates that fixture; F-016 (Members & Roles) will likely
  add one. Until then, the matching backend test
  (`test_create_client_403_for_operator`) gives us coverage.
- Captures for `assets/` (page screenshot, sheet screenshot, empty-state
  screenshot) — left for QA, who has the canonical capture workflow.
