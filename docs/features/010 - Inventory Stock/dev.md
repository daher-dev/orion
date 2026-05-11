---
feature_id: F-010
status: implemented
date: 2026-05-11
---

# F-010 — Dev Log

## Files Added

### Backend

- `backend/src/schemas/stock.py` — Pydantic shapes: `VariationStockRead`,
  `StockEntryCreate/Read`, `StockExitCreate/Read`, `StockMovementRead`
  (discriminated union), `StockFilters`, `MovementsFilters`, and the
  paged aliases (`StockPage`, `MovementsPage`).
- `backend/src/services/stock.py` — Service layer. Aggregates `stock_entries -
  stock_exits` per variation (`list_stock_levels`), interleaves the two
  ledgers in Python (`list_movements`), and writes single-row + audit
  on each mutation (`create_entry`, `create_exit`). The
  no-negative-stock invariant is enforced in `create_exit` via
  `_compute_on_hand`.
- `backend/src/routers/stock.py` — Router prefixed `/stock`, four endpoints
  (`GET /levels`, `GET /movements`, `POST /entries`, `POST /exits`).
  `stock.read` enforced on the include, `stock.write` enforced inline on
  the two POSTs.
- `backend/src/routers/__init__.py` — Wired `stock_router` into `api_router`.

### Backend Tests

- `backend/tests/test_services/test_stock_service.py` — 30 tests covering
  every service function: happy path, audit log content, defaults,
  whitespace stripping, the negative-stock guard (including the
  taking-exactly-what-is-available edge case), the empty-ledger
  exclusion behavior in `list_stock_levels`, all filter shapes for
  both lists, ordering, pagination, and tenant isolation.
- `backend/tests/test_routers/test_stock_router.py` — 29 tests covering
  every endpoint: auth, permission gating (admin / operator / no-perm),
  filter forwarding, pagination, the 409 on insufficient stock,
  422 on bad payloads, and tenant isolation.

### Frontend

- `frontend/src/lib/schemas/stock.ts` — Zod schemas mirroring the
  Pydantic shapes plus a `stockAdjustFormSchema` for the dialog form
  layer.
- `frontend/src/hooks/use-stock.ts` — TanStack Query wrappers
  (`useStockLevels`, `useStockMovements`, `useCreateStockEntry`,
  `useCreateStockExit`).
- `frontend/src/components/stock/StockStatusPill.tsx` — `.pill` chip
  showing `low` (amber) / `ok` (green) based on `on_hand <= threshold`.
- `frontend/src/components/stock/LowStockToggle.tsx` — Checkbox toggle
  for the "Apenas baixos" filter.
- `frontend/src/components/stock/StockLevelsTable.tsx` — Variation x
  on-hand table built on TanStack Table. Columns: SKU mono / Product /
  Size pill / Color swatch / On hand (right-aligned, color-coded by
  threshold) / Status pill / Last movement / Chevron.
- `frontend/src/components/stock/MovementsTable.tsx` — Standalone
  movements table used inside the drawer AND on `/stock/movements`.
  Each row shows date, SKU mono, reason/source label with up/down
  arrow icon, signed quantity (green/red), notes.
- `frontend/src/components/stock/MovementsDrawer.tsx` — Right-side
  shadcn Sheet (480px) showing per-variation movement history with a
  hero summary row. Wires "Ajustar" button into the
  `StockAdjustDialog`.
- `frontend/src/components/stock/StockAdjustDialog.tsx` — Modal dialog
  for manual adjustments. Single dialog handles both directions —
  `+` writes an entry, `-` writes an exit. Projected-balance preview,
  inline server-error handling for 409 conflicts.
- `frontend/src/components/stock/StockEmptyState.tsx` — Empty-state
  card with Boxes icon and optional "Lançar movimentação" CTA.
- `frontend/src/app/[locale]/(app)/stock/page.tsx` — Levels list page.
- `frontend/src/app/[locale]/(app)/stock/movements/page.tsx` — Full
  ledger page with a type filter.
- `frontend/src/app/[locale]/(app)/stock/loading.tsx` +
  `error.tsx` — Loading skeleton and error boundary.

### Frontend Tests

- `frontend/src/components/stock/__tests__/StockLevelsTable.test.tsx` —
  Renders rows, OK/LOW pill rendering at threshold boundary, row-click
  callback.
- `frontend/src/components/stock/__tests__/StockAdjustDialog.test.tsx` —
  Submits entry+exit mutations with the expected payloads, blocks
  submission on bad quantity, surfaces a server 409 inline.
- `frontend/src/hooks/__tests__/use-stock.test.ts` — Verifies the
  four hooks forward query params and call the right endpoints
  (MSW handlers).

### i18n

- `frontend/messages/en.json` — Filled the existing `stock` object with
  the new namespace (page header, list, filters, table columns,
  statuses, actions, adjust dialog, movements page, drawer, fallback).
- `frontend/messages/pt-BR.json` — pt-BR mirror.

### E2E

- `frontend/e2e/stock.spec.ts` — Six scenarios: list renders, low-stock
  toggle filters, drawer opens on row-click, manual entry adjustment
  updates the table, exit larger than on_hand surfaces a 409 inline,
  full ledger page renders the seeded movement.

## Migration Notes

- **No new migration required.** Stock permissions are already seeded by
  `alembic/versions/3187f02cbc35_seed_roles_and_permissions.py`
  (admin + manager + operator each hold `stock.read + stock.write`).
- The `stock_entries` and `stock_exits` tables already exist from the
  foundation pass.

## Dev Notes

- **Append-only ledger.** Stock is never edited in place. Mistakes are
  corrected with another row whose `source` or `reason` is
  `adjustment`. This drove the schema choice to omit PATCH/DELETE
  endpoints and to compute `on_hand` live rather than persist it.
- **Negative-stock guard is racey.** `create_exit` aggregates `entries -
  exits` and compares to the requested quantity; under heavy
  concurrency this could let two simultaneous exits both pass the
  guard. v1 ignores that — exits are human-input speed. Future:
  wrap the guard + insert in a single transaction with a row-level
  `SELECT ... FOR UPDATE` against a per-variation hash, or push the
  guard into a Postgres trigger.
- **List filter excludes empty ledgers.** The levels query joins
  variations to the two aggregate subqueries and keeps only rows that
  appear in at least one. Empty variations (no entries, no exits)
  don't bloat the UI.
- **Movements interleave in Python, not SQL.** The two ledger tables
  have different column shapes (`source`/`shipment_id` vs
  `reason`/`order_id`), so a SQL `UNION ALL` would need awkward
  casting + aliasing. Interleaving in Python is `O(n log n)` over a
  small number of rows per request and keeps the SQL readable.
- **Dialog reset uses the render-time pattern.** React Compiler / the
  `react-hooks/set-state-in-effect` lint rule flags `setX(...)` calls
  inside `useEffect`. The adjust dialog uses the tracked-key idiom
  (compare last-seen key during render; setState if it changed) so
  the form resets cleanly on open without violating the rule.
- **Color swatch tinting.** The DB carries `color_code` (3-letter)
  but not the hex. The levels table includes a small `guessHex`
  utility that mirrors the design's swatch palette. Unknown codes
  fall back to a neutral surface tone — no brand color leakage.

## Verification

### Backend

```
cd backend
uv run ruff check src/services/stock.py src/routers/stock.py src/schemas/stock.py
# All checks passed!

uv run ty check src/services/stock.py src/routers/stock.py src/schemas/stock.py
# All checks passed!

DATABASE_URL=... uv run pytest tests/test_services/test_stock_service.py tests/test_routers/test_stock_router.py --no-cov
# 59 passed

DATABASE_URL=... uv run pytest tests/test_services/test_stock_service.py tests/test_routers/test_stock_router.py \
   --cov=src/services/stock --cov=src/routers/stock --cov=src/schemas/stock --cov=src/models/stock
# src/models/stock.py     22  0  100%
# src/routers/stock.py    42  0  100%
# src/schemas/stock.py    74  0  100%
# src/services/stock.py  113  0  100%
```

### Frontend

```
cd frontend
pnpm lint       # 0 errors, 21 warnings (all pre-existing TanStack-table compiler skips)
pnpm test --run # 139 tests pass across 28 files
```

## Outstanding TODOs

- E2E spec lives at `frontend/e2e/stock.spec.ts` but was NOT executed
  in this dev pass — it depends on a running backend + reset DB; QA
  will run it. The script seeds its own product+variation fixtures
  via API.
- Per-variation low-stock thresholds (currently a single global
  `threshold` query param). Out of scope for v1.
- F-013 (Sales: Orders) will wire its order-shipment flow into
  `POST /stock/exits` with `reason=sale` + `order_id`.
