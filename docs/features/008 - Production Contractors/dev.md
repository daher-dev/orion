# Implementation Log — F-008: Production Contractors

## Files Created

### Backend
- `backend/src/schemas/contractor.py` — `ContractorCreate`, `ContractorUpdate`, `ContractorRead`, `ContractorFilters`, `ContractorPage`.
- `backend/src/services/contractor.py` — `list_contractors`, `get_contractor`, `create_contractor`, `update_contractor`, `delete_contractor`. All tenant-scoped via `scoped()`. Audit log on every mutation. `_assert_unique_name` enforces case-insensitive duplicate check at the service layer in addition to the DB unique constraint so we can surface a clean 409.
- `backend/src/routers/contractors.py` — REST endpoints with router-level `contractors.read` guard plus inline `contractors.write` on POST/PATCH/DELETE.
- `backend/tests/test_services/test_contractor_service.py` — 22 service tests (happy + error + tenant-isolation + audit).
- `backend/tests/test_routers/test_contractor_router.py` — 23 endpoint tests (auth, perm, 200/201/204/401/403/404/409/422, pagination, search, tenant isolation).

### Frontend
- `frontend/src/lib/schemas/contractor.ts` — Zod schemas (`contractorReadSchema`, `contractorPageSchema`, `contractorFormSchema` with relative i18n keys).
- `frontend/src/hooks/use-contractors.ts` — TanStack Query hooks (`useContractors`, `useContractor`, `useCreateContractor`, `useUpdateContractor`, `useDeleteContractor`).
- `frontend/src/hooks/__tests__/use-contractors.test.ts` — 7 hook tests against a mocked `useApi` boundary.
- `frontend/src/components/page/PageHead.tsx` — reusable `.page-head` primitive (eyebrow + 30px Fraunces title + sub). Direct port of pixel rules from `/docs/design/source/styles.css`.
- `frontend/src/components/contractors/ContractorsPage.tsx` — main client view: PageHead + toolbar with search + table card + form sheet.
- `frontend/src/components/contractors/ContractorsTable.tsx` — TanStack Table with `.tbl`-equivalent styling.
- `frontend/src/components/contractors/ContractorForm.tsx` — react-hook-form + zodResolver, design-faithful field rhythm.
- `frontend/src/components/contractors/ContractorFormSheet.tsx` — wraps shadcn Sheet + AlertDialog confirmation for delete.
- `frontend/src/components/contractors/ContractorsEmptyState.tsx` — empty `.empty` block port.
- `frontend/src/components/contractors/__tests__/ContractorsTable.test.tsx` — 4 tests covering rendering, click-through, fallbacks.
- `frontend/src/components/contractors/__tests__/ContractorForm.test.tsx` — 5 tests covering validation, trim, defaults, server error.
- `frontend/src/app/[locale]/(app)/contractors/page.tsx` — RSC route, just renders `<ContractorsPage />`.
- `frontend/src/app/[locale]/(app)/contractors/loading.tsx` — Suspense skeleton.
- `frontend/src/app/[locale]/(app)/contractors/error.tsx` — error boundary fallback.
- `frontend/e2e/contractors.spec.ts` — 7 Playwright specs (empty/CTA, create happy, create validation, edit, delete with confirm, search, operator forbidden).

### Docs
- `docs/features/008 - Production Contractors/spec.md` — full PM spec (frontmatter, acceptance criteria, flows, i18n table, API contract).

## Files Modified

- `backend/src/routers/__init__.py` — wired `contractors_router` into `api_router`.
- `frontend/messages/en.json` — populated existing `contractors` namespace with full key tree.
- `frontend/messages/pt-BR.json` — same, with PT-BR copy from the design ("Bancas parceiras", "Nova banca", "Cadastrar banca").
- `frontend/src/__tests__/setup.ts` — added `afterEach(cleanup)` so component tests don't leak DOM between runs.
- `docs/ROADMAP.md` — F-008 status flipped to `in-progress`.

## Migration Notes

No new Alembic migration. The `sewing_contractors` table and the `contractors.read`/`contractors.write` permissions were already wired in Wave 0 (`feea7ff730da_initial_schema.py`, `3187f02cbc35_seed_roles_and_permissions.py`). F-008 only adds API + UI surface on top.

## Dev Notes

- **Design fidelity over design literalism.** The design source's Contractors page renders a 2-column card grid with active/on-time metrics (depend on F-009 sewing data). Since shipments aren't reachable yet, F-008 ships a design-faithful **table** view (same `.tbl` rhythm, same eyebrow + serif title + sub). The card layout will be revisited when F-009 lands. Spec acknowledges this trade-off.
- **Shared `PageHead` primitive.** Created at `components/page/PageHead.tsx` since this is the first feature page after foundation. F-011/F-009 should reuse it. The existing inline header in `app/[locale]/(app)/page.tsx` (Home) was left alone; refactoring it to use PageHead is not part of F-008's scope.
- **Duplicate-name check at the service layer.** The DB unique constraint `(company_id, name)` is case-sensitive, but bancas are usually written with mixed casing. The service-layer `_assert_unique_name` does a `func.lower()` compare so "Banca Esperança" and "banca esperança" collide cleanly. Tested.
- **Hard delete in v1.** The `sewing_shipments.contractor_id` FK has `ondelete=RESTRICT`, so when F-009 starts creating shipments, deleting a banca with linked shipments will surface a raw 500 (IntegrityError). Acceptable for v1: F-009 will introduce a service-layer guard and a friendlier 409.
- **i18n message keys for Zod.** Zod messages use the relative path `validation.nameRequired` so `useTranslations("contractors.form")(message)` resolves cleanly. Dotted absolute paths from inside Zod don't work because next-intl expects keys relative to the namespace bound to the `t` instance.
- **TanStack Table compiler warning.** `useReactTable()` triggers a React Compiler "incompatible library" warning. The repo's eslint config keeps it as a warn (not an error), and this matches what shadcn's own table examples do. Not a regression — just an FYI for the next agent.
- **Vitest cleanup.** Updated `setup.ts` to call `cleanup()` in `afterEach`. Without it, `render()` calls accumulate DOM nodes across test cases — caught when the table test was finding 16 columnheaders.
- **E2E mocks.** `e2e/contractors.spec.ts` mocks `/v1/auth/me` + `/v1/contractors**` per test rather than relying on the real backend, so the spec is hermetic. The repo doesn't have a global E2E mock layer yet, so each new feature will re-implement this until a shared `mock-api.ts` lands.

## Test Results

### Backend
- `task lint:backend` — clean (ruff check + format).
- `task typecheck:backend` — clean (ty).
- `task test:backend` — 100 tests pass, 93.02% overall coverage. New code (services/contractor.py, routers/contractors.py, schemas/contractor.py) at **100% line coverage**.

### Frontend
- `pnpm i18n:lint` — clean (112 keys, both locales).
- `pnpm lint` — clean (1 known TanStack Table compiler warning).
- `pnpm test` — 19 tests pass (4 files).
- `pnpm test:e2e` — not run by dev per task instructions; QA owns the Playwright pass.

## Design-fidelity sample (computed)

Reference values pulled from `/docs/design/source/styles.css` and asserted in the React components:

| Element | Property | Design value | Implementation |
|---|---|---|---|
| `.page-title` | font-size | 30px | `text-[30px]` on h1 |
| `.page-title` | font-weight | 400 | `font-normal` |
| `.page-title` | letter-spacing | -0.025em | `tracking-[-0.025em]` |
| `.page-title` | line-height | 1.05 | `leading-[1.05]` |
| `.page-eyebrow-mark` | size | 18×18 | `h-[18px] w-[18px]` |
| `.page-eyebrow-mark` | radius | 4px | `rounded-[4px]` |
| `.page-eyebrow` | font-size | 11px | `text-[11px]` |
| `.page-eyebrow` | letter-spacing | 0.12em | `tracking-[0.12em]` |
| `.page-sub` | font-size | 13px | `text-[13px]` |
| `.tbl th` | font-size | 10.5px | `text-[10.5px]` (inline style ensures uppercase letter-spacing 0.08em) |
| `.tbl th` | padding | 10 14 | inline `padding: "10px 14px"` |
| `.tbl td` | padding | 12 14 | inline `padding: "12px 14px"` |
| `.btn` (primary) | padding | 7 13 | `px-[13px] py-[7px]` |
| `.btn` | font-size | 13px | `text-[13px]` |
| `.btn` | radius-sm | 6px | `rounded-[6px]` |
| `.sheet` | width | min(480px, 100vw) | `w-[480px] max-w-full` |
