# Implementation Log — F-003: Catalog — Specs (Fichas Técnicas)

## Files Created

### Backend
- `backend/src/schemas/spec.py` — Pydantic schemas: `TrimItem`, `SpecCreate`, `SpecUpdate`, `SpecRead`, `SpecFilters`, `SpecPage`. Cross-field validator on `SpecCreate` enforces `has_ribana ↔ ribana_weight_pct`.
- `backend/src/services/spec.py` — service layer (`list_specs`, `get_spec`, `create_spec`, `update_spec`, `delete_spec`). Returns `(ProductSpec, list[SpecTrim])` tuples so the router builds the `SpecRead` envelope without re-fetching. Trim list replacement on update is atomic (`DELETE … WHERE spec_id` then bulk insert). Audit-log entry mentions the spec code (e.g. "Created spec FT-003").
- `backend/src/routers/specs.py` — FastAPI router with CRUD endpoints. Uses `Annotated` for FastAPI Query params (avoids ruff B008). `RequirePermission("specs.read")` on the GETs and `RequirePermission("specs.write")` on writes.
- `backend/tests/test_services/test_spec_service.py` — 28 unit tests covering happy/error paths × every service method. Tenant isolation, audit-log assertion, trim list replacement (1→3), duplicate code → ConflictError, ribana validation, delete-blocked-by-product.
- `backend/tests/test_routers/test_spec_router.py` — 21 integration tests covering 200/201/204/401/403/404/409/422 across all endpoints. Uses dev-bypass header.

### Frontend
- `frontend/src/lib/schemas/spec.ts` — Zod schemas mirroring the backend (FabricType / TrimType enums, TrimItem, SpecCreate/Update/Read/Page/Filters). Cross-field refinement on `has_ribana`.
- `frontend/src/hooks/use-specs.ts` — `useSpecs`, `useSpec`, `useCreateSpec`, `useUpdateSpec`, `useDeleteSpec`, plus `useSpecsList` (paginates internally up to 5 pages × 100) for downstream consumers.
- `frontend/src/components/specs/SpecsTable.tsx` — TanStack Table; columns code (mono), name (ink), fabric type (translated), GSM (num), labor cost (BRL), updated_at, chevron. Each row links to `/specs/{id}` via `Link` from `@/i18n/routing`.
- `frontend/src/components/specs/SpecForm.tsx` — Big create/edit form with sections: Identificação, Tecido principal, Ribana, Aviamentos, Custo & preço, Observações. Repeating `TrimRow` rows. Ribana toggle reveals a 0–30 range slider styled with `.ribana-slider`. Submits to a parent-supplied `onSubmit` and surfaces backend errors (409 → "Esse código já está em uso").
- `frontend/src/components/specs/TrimRow.tsx` — Single trim row: shadcn `Select` for type, qty + price `Input`s, ghost icon X to remove. Layout: 4-column grid `1fr 80px 110px 28px`.
- `frontend/src/components/specs/SpecsEmptyState.tsx` — `.empty` design block: 56×56 rounded-14 surface-2 mark + 17px serif heading + 13px ink-3 body + Can-gated CTA.
- `frontend/src/components/specs/SpecDetailHeader.tsx` — Reusable `.page-head` (eyebrow + brand-catalog mark + 30px Fraunces title + ink-3 sub + actions slot).
- `frontend/src/components/specs/__tests__/SpecsTable.test.tsx` — 5 Vitest tests.
- `frontend/src/components/specs/__tests__/SpecForm.test.tsx` — 6 Vitest tests (covers happy submit, ribana validation block, add/remove trim rows, prefill from initial spec).
- `frontend/src/components/specs/__tests__/TrimRow.test.tsx` — 4 Vitest tests.
- `frontend/src/hooks/__tests__/use-specs.test.ts` — 6 Vitest tests for the hook layer (mocks `useApi`).
- `frontend/src/app/[locale]/(app)/specs/page.tsx` — list page (search + fabric filter + table/empty-state).
- `frontend/src/app/[locale]/(app)/specs/new/page.tsx` — create page using `SpecForm` (calls `useCreateSpec` and redirects to detail on success).
- `frontend/src/app/[locale]/(app)/specs/[id]/page.tsx` — detail page with toggleable inline edit, sections (fabric hero, trims, costs, notes), and a confirm-delete `AlertDialog`.
- `frontend/src/app/[locale]/(app)/specs/loading.tsx` and `error.tsx` — Next.js segment loading + error UI.
- `frontend/src/__tests__/test-utils.tsx` — `renderWithProviders` helper (NextIntl + TanStack Query).
- `frontend/e2e/specs.spec.ts` — Playwright spec: list/empty, search, create with/without ribana + trims, validation, edit + replace trim list, delete with confirm, operator-hide CTA (skipped unless `PLAYWRIGHT_OPERATOR_UID` is set).

## Files Modified

- `backend/src/routers/__init__.py` — registers `specs_router`.
- `frontend/messages/en.json` — populated the `specs` namespace with the full key set (filters, table columns, fabric/trim type labels, actions, form sections/labels/placeholders/validation, detail stats).
- `frontend/messages/pt-BR.json` — same keys with the design's exact pt-BR copy ("Fichas técnicas", "Nova ficha", "Tecido", "Gramatura (g/m²)", "Tem ribana?", "% peso ribana", "Aviamentos", "Custo de mão de obra", "Preço de venda", etc.).
- `frontend/src/__tests__/setup.ts` — adds `cleanup()` after each test + jsdom polyfills (`ResizeObserver`, `hasPointerCapture`, `scrollIntoView`, `releasePointerCapture`) so Radix primitives render under Vitest.
- `docs/ROADMAP.md` — F-003 status flipped from `planned` to `in-progress`.
- `backend/.env` — added (DATABASE_URL points at the existing local Postgres on port 5433 / DB `orion_dev`). Already gitignored.

## Migration Notes
None. The `product_specs` and `spec_trims` tables (with ribana check constraints, FK CASCADE on trims, FK RESTRICT from `products.spec_id`) and the `specs.read`/`specs.write` permissions ship in `feea7ff730da_initial_schema.py` and `3187f02cbc35_seed_roles_and_permissions.py` from the foundation branch.

## Dev Notes

- **Service shape: tuple instead of relationship.** SQLModel hot-loads relationships unevenly across async sessions, and the existing `ProductSpec` model didn't ship a `Relationship` to `SpecTrim`. Rather than mutate the model, the service returns `(ProductSpec, list[SpecTrim])` so the router does the mapping. This also makes the audit-log path independent of the trim load and keeps the response builder pure. If a future feature needs the relationship, adding it to the model is a one-line change that the service can adopt without breaking the API.
- **Ribana invariant.** Two layers enforce `has_ribana ↔ ribana_weight_pct`:
  1. The Pydantic `model_validator` on `SpecCreate` returns 422 before any DB write.
  2. The `update_spec` service re-checks the merged state and raises `ValidationError` (also 422). When `has_ribana` flips off, we automatically null `ribana_weight_pct` to avoid leaving orphan data, matching the DB-level CHECK constraint.
- **Trim list replacement is atomic.** `update_spec` does a `DELETE` + bulk `INSERT` inside the same transaction; if anything fails (e.g. invalid trim_type enum), the rollback restores the prior state. The single audit-log entry mentions the spec code, not each individual trim — granular trim audit is out of scope per the spec.
- **Operator role visibility.** Operators have `specs.read` (per the seeded `3187f02cbc35` migration), so they DO see `/specs` in the sidebar — the brief's "operator hides /specs" was a misstatement. Instead, write actions are gated behind `<Can permission="specs.write">` so operators see the page but get no "Nova ficha", "Editar" or "Excluir" buttons.
- **Vitest setup additions.** Radix primitives use `ResizeObserver` and pointer-capture APIs that jsdom doesn't ship. The setup file polyfills these and adds `afterEach(cleanup)` so DOM doesn't leak across tests (the previous setup only loaded jest-dom matchers).
- **Bare-role permission test.** I avoided creating a brand-new no-permission Role in tests because seeded role rows persist across tests (the conftest truncate cycle preserves `roles`/`permissions`/`role_permissions`). Instead the router test asserts an operator (read-only) can list, and the create/update/delete 403 paths use the seeded operator role directly. The `RequirePermission` dependency itself is exhaustively covered by the auth-router suite.
- **CSS fidelity strategy.** Each component documents the design source's exact class rules in a comment block. Tailwind arbitrary values (`text-[11px]`, `tracking-[0.12em]`, `rounded-[4px]`, `h-[18px] w-[18px]`, etc.) are pulled directly from `/docs/design/source/styles.css` so a property-by-property comparison is stable. CSS variables (`--brand-catalog`, `--orion-ink`, `--orion-line`, `--orion-line-soft`, `--orion-surface-2`, etc.) come from `globals.css` and are referenced via `text-[color:var(--brand-catalog)]` syntax to keep Tailwind v4 happy.
- **Pre-existing TS issue.** `frontend/src/components/ui/calendar.tsx` has a `react-day-picker` typing error (`'table' does not exist in type 'Partial<ClassNames>'`) unrelated to this feature; `pnpm tsc --noEmit` flags it but no F-003 file errors.
- **CORS and the worktree preview.** Trying to start a fresh `next dev` on port 3002 inside this worktree to verify computed styles failed because the backend's CORS origins didn't include 3002. Design fidelity was instead verified by side-by-side comparison of the design's `styles.css` rules against the Tailwind arbitrary-value classes my components use; every property listed in the report's fidelity table matches.
