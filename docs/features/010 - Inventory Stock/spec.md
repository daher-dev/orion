---
id: F-010
slug: inventory-stock
title: Inventory — Stock (Estoque de peças prontas)
status: in-progress
created: 2026-05-11
updated: 2026-05-11
branch: feature/010-stock
---

# F-010: Inventory — Stock (Estoque de peças prontas)

## Problem Statement

Stock-of-finished-goods today lives in spreadsheets. Pieces leave the sewing
floor via `StockEntry` rows (already written by F-009 when a shipment is
received) and we want to consume them when an order ships (F-013). What's
missing is a tenant-scoped readable surface over those two append-only
ledgers — `stock_entries` and `stock_exits` — so the inventory manager can
answer two questions instantly: "how much do I have of SKU X today?" and
"what happened to my stock of SKU X this week?".

F-010 introduces the **Estoque** module: a per-variation live-balance page
(`on_hand = sum(entries) - sum(exits)`) with a low-stock toggle, a per-row
movements drawer, a standalone full-ledger movements page, and a manual
`+/-` adjustment dialog. There is no "edit" or "delete" — the ledger is
append-only: every correction is just another entry/exit row with a
`source` or `reason` of `adjustment`.

## User Stories

- As an inventory manager, I want to see every variation with the current
  on-hand quantity so I know what's available to sell.
- As an inventory manager, I want to filter by "low stock only" so I can
  pull the list of SKUs that need a new cutting order.
- As an inventory manager, I want to click a row and see the full
  movement history for that variation (entries + exits, sorted by date)
  so I can audit how the saldo got where it is.
- As an inventory manager, I want to manually add a stock entry (e.g.
  found pieces during inventory) or stock exit (e.g. brinde / loss)
  without going through a sewing shipment or order, and have it
  reflected immediately.
- As an inventory manager, I should NEVER be able to push a SKU below
  zero — the system blocks any exit that would make `on_hand` negative.
- As an operator, I should be able to read the levels page AND adjust
  stock (operators do production-floor work like reconciling lost
  pieces), but they cannot edit existing entries because the ledger
  itself is append-only.

## Acceptance Criteria

1. [ ] Given a user with `stock.read`, when they navigate to `/stock`,
   then the levels page renders a paginated table of variations with
   columns SKU / Product / Size / Color / Print / On hand / Status.
2. [ ] The Status column shows a `low` pill (amber) when `on_hand <= 5`
   and an `ok` pill (green) otherwise; thresholds are configurable via
   the `threshold` query param.
3. [ ] Toggling "Apenas baixos" filters the list to variations whose
   `on_hand <= threshold` (default 5).
4. [ ] Clicking a row opens a right-side drawer (480px wide) listing
   that variation's movement history (entries + exits, sorted by
   `created_at DESC`), with `+N` / `-N` quantity formatting and pill
   chip showing source / reason.
5. [ ] Clicking "Lançar movimentação" opens a dialog with a +/-
   selector, quantity input, source / reason select, optional notes.
   Submitting creates either a `StockEntry` (when `+`) or `StockExit`
   (when `-`) and refreshes the table.
6. [ ] Attempting to create an exit whose quantity exceeds the current
   `on_hand` returns 409 Conflict with a translated error, the dialog
   surfaces the error inline, and no row is written.
7. [ ] Navigating to `/stock/movements` renders the full ledger
   (interleaved entries + exits across all variations) with filters
   for variation, date range, type, and reason/source.
8. [ ] Stock pages respect tenant isolation — company A cannot see or
   adjust company B's stock.
9. [ ] An operator (role `operator`) holds `stock.read + stock.write`
   per the seed migration; they can both view and adjust stock.
10. [ ] Backend test coverage on new code is ≥ 90% line coverage; the
    negative-stock guard is explicitly tested.

## User Flows

### Happy Path — Visit stock list

1. User clicks "Estoque" in the sidebar (Inventory section, amber).
2. Levels page loads at `/stock` with PageHead (eyebrow "Estoque",
   title "Estoque de peças prontas", subtitle "Inventário de produtos
   acabados por SKU.").
3. Card with toolbar (search input + low-stock toggle + product
   filter); table renders a row per variation with on_hand quantity
   right-aligned in tabular-nums.
4. Each row is clickable and shows a chevron at the far right.

### Happy Path — Inspect a variation's movements

1. Click a row → right-side drawer slides in.
2. Drawer header shows variation summary (product + SKU pill + size
   pill + color swatch).
3. Drawer body lists movements with `+N` (green) or `-N` (red)
   quantity, source/reason chip, timestamp.
4. Close drawer with X or by clicking outside.

### Happy Path — Manual adjustment

1. Click "Lançar movimentação" (or "Ajustar" inside the drawer).
2. Dialog opens with: direction toggle (`+` / `-`), variation selector
   (preselected if entered from a row), quantity, source/reason
   select, notes.
3. Submit → creates entry or exit, audit log row appended, table
   refreshes, drawer (if open) refreshes, toast confirms.

### Happy Path — Full movements ledger

1. Navigate to `/stock/movements` (linked from levels page or
   sidebar's footer).
2. Standalone page listing every entry+exit across all variations
   sorted DESC by `created_at`.
3. Filters: variation_id, date_from, date_to, type
   (entry / exit), reason_or_source.

### Edge Cases

- Empty stock (no entries ever written): empty-state card with
  Boxes icon, "Nenhum estoque cadastrado" title, body + neutral
  copy ("As entradas surgem quando uma remessa é recebida").
- Manual exit of 10 when on-hand is 6: dialog stays open, inline
  error "Saldo insuficiente — disponível: 6", no row written.
- A variation with zero entries (never had any sewing shipment
  received): not listed by default (the levels query lists ONLY
  variations with at least one entry OR exit). Once an adjustment
  pushes a row in either ledger, the variation appears.
- Search by SKU substring filters the levels list client-side
  (or server-side) ignoring case.

## Scope

### In Scope

- READ over the variation × on-hand aggregate (`GET /stock/levels`).
- READ over the interleaved movement ledger (`GET /stock/movements`).
- POST a stock entry — manual adjustment (`POST /stock/entries`).
- POST a stock exit — manual adjustment (`POST /stock/exits`) with
  negative-stock guard.
- Pagination + free-text search on SKU / product name / color.
- Low-stock filter (`low_stock_only=true&threshold=N`).
- Tenant isolation, permission checks, audit log on every mutation.
- Frontend levels page (table + low-stock toggle + drawer).
- Frontend movements page (standalone full ledger).
- Frontend adjust dialog (single dialog for both directions).
- Status pill component.
- EN + PT-BR i18n under `stock` namespace.
- Vitest tests + Playwright E2E.

### Out of Scope

- Editing or deleting existing entries/exits — the ledger is
  append-only by design. Mistakes are corrected with another
  adjustment row.
- Threshold per-variation. v1 supports a single global threshold
  (query param). Per-variation thresholds → out-of-scope, future
  iteration.
- Reservations / pending allocations against orders — F-013 territory.
- Bulk import.
- Stock-by-warehouse — Orion is single-warehouse for v1.

## UI/UX Notes

Mirrors `/docs/design/source/pages/inventory.jsx` `Stock` section:

- Page header eyebrow: "Estoque" with the 18×18 amber (brand-inv)
  mark + Boxes glyph.
- Page title: Fraunces 30px / 400 / -.025em / 1.05 — "Estoque" +
  `<em>` "de peças prontas" (amber).
- Subtitle: "Inventário de produtos acabados por SKU." (pt-BR) /
  "Finished-piece inventory by SKU." (en).
- Primary action: "Lançar movimentação" with ArrowDownUp icon.
- Card surrounding the table: `.card` from styles.css (surface bg,
  14px radius, line border, overflow hidden).
- Toolbar: search input (220 min-width), low-stock toggle (checkbox),
  product select.
- Table: `.tbl` mapping (10.5px uppercase headers, 12.5–13px body).
- Columns: SKU (mono) / Product / Size pill / Color (swatch + name)
  / On hand (num, tabular) / Status (pill) / Last movement (date) /
  Chevron.
- Status pill: `low` = amber (warn), `ok` = green (ok).
- Movements drawer: right-side 480px wide Sheet from shadcn — header
  with variation hero (color swatch + product name + size pill + SKU
  mono); body lists movements with up-arrow / down-arrow icon and
  green / red quantity.
- Adjust dialog: shadcn Dialog with hero card showing currently
  selected variation, direction toggle, quantity input with +/-
  spinners, source/reason select, notes textarea.
- Empty state: same `.empty` pattern as Fabric (Boxes icon, h3 title,
  body, optional CTA).
- Movements page: full ledger table with extra filter row (date
  pickers + type / reason segmented control).

## i18n Keys (`stock` namespace)

| Key | EN | PT-BR |
|-----|-----|-------|
| `stock.page.eyebrow` | Inventory | Estoque |
| `stock.list.title` | Stock | Estoque |
| `stock.list.titleEm` | of finished pieces | de peças prontas |
| `stock.list.sub` | Finished-piece inventory by SKU. | Inventário de produtos acabados por SKU. |
| `stock.list.empty.title` | No stock registered yet | Nenhum estoque cadastrado |
| `stock.list.empty.body` | Entries appear when a sewing shipment is received or you record a manual adjustment. | As entradas surgem quando uma remessa é recebida ou você lança um ajuste manual. |
| `stock.list.empty.cta` | Record an adjustment | Lançar movimentação |
| `stock.filters.searchPlaceholder` | Search SKU, product, color… | Buscar por SKU, produto, cor… |
| `stock.filters.lowStockOnly` | Low stock only | Apenas baixos |
| `stock.filters.threshold` | Threshold | Limite |
| `stock.filters.product` | Product | Produto |
| `stock.filters.productAll` | All products | Todos os produtos |
| `stock.table.columns.sku` | SKU | SKU |
| `stock.table.columns.product` | Product | Produto |
| `stock.table.columns.size` | Size | Tam. |
| `stock.table.columns.color` | Color | Cor |
| `stock.table.columns.onHand` | On hand | Saldo |
| `stock.table.columns.status` | Status | Status |
| `stock.table.columns.lastMovement` | Last move | Última mov. |
| `stock.table.columns.actions` | Actions | Ações |
| `stock.statuses.low` | Low | Baixo |
| `stock.statuses.ok` | OK | OK |
| `stock.actions.adjustUp` | Add entry | Adicionar entrada |
| `stock.actions.adjustDown` | Add exit | Adicionar saída |
| `stock.actions.addEntry` | New entry | Nova entrada |
| `stock.actions.addExit` | New exit | Nova saída |
| `stock.actions.viewMovements` | View movements | Ver movimentações |
| `stock.actions.confirmAdjust` | Record movement | Lançar movimentação |
| `stock.adjust.title` | Record movement | Lançar movimentação |
| `stock.adjust.labels.direction` | Direction | Direção |
| `stock.adjust.labels.variation` | Variation | Variação |
| `stock.adjust.labels.quantity` | Quantity | Quantidade |
| `stock.adjust.labels.reason` | Reason | Motivo |
| `stock.adjust.labels.source` | Source | Origem |
| `stock.adjust.labels.notes` | Notes | Observações |
| `stock.adjust.placeholders.notes` | Optional notes… | Observações (opcional)… |
| `stock.adjust.placeholders.search` | Search variation… | Buscar variação… |
| `stock.adjust.validation.quantityPositive` | Quantity must be greater than zero | Quantidade deve ser maior que zero |
| `stock.adjust.validation.variationRequired` | Select a variation | Selecione uma variação |
| `stock.adjust.validation.insufficientStock` | Insufficient stock — available: {available} | Saldo insuficiente — disponível: {available} |
| `stock.adjust.save` | Save | Salvar |
| `stock.adjust.cancel` | Cancel | Cancelar |
| `stock.adjust.toasts.entryCreated` | Entry recorded | Entrada lançada |
| `stock.adjust.toasts.exitCreated` | Exit recorded | Saída lançada |
| `stock.adjust.toasts.error` | Operation failed | Operação falhou |
| `stock.movements.title` | Movements | Movimentações |
| `stock.movements.titleEm` | full ledger | livro completo |
| `stock.movements.sub` | Every entry and exit, ordered from newest. | Toda entrada e saída, ordenadas do mais recente. |
| `stock.movements.columns.when` | When | Quando |
| `stock.movements.columns.type` | Type | Tipo |
| `stock.movements.columns.quantity` | Qty | Qtd |
| `stock.movements.columns.reasonOrSource` | Reason | Motivo |
| `stock.movements.columns.sku` | SKU | SKU |
| `stock.movements.columns.product` | Product | Produto |
| `stock.movements.columns.notes` | Notes | Observações |
| `stock.movements.columns.sourceLink` | Source | Origem |
| `stock.movements.types.entry` | Entry | Entrada |
| `stock.movements.types.exit` | Exit | Saída |
| `stock.movements.sources.shipment` | Shipment | Remessa |
| `stock.movements.sources.adjustment` | Adjustment | Ajuste |
| `stock.movements.sources.return` | Return | Devolução |
| `stock.movements.reasons.sale` | Sale | Venda |
| `stock.movements.reasons.adjustment` | Adjustment | Ajuste |
| `stock.movements.reasons.loss` | Loss | Avaria |
| `stock.movements.empty` | No movements recorded yet. | Nenhuma movimentação registrada ainda. |
| `stock.drawer.title` | Movement history | Histórico de movimentações |
| `stock.drawer.close` | Close | Fechar |
| `stock.drawer.empty` | This variation hasn't moved yet. | Esta variação ainda não teve movimentações. |
| `stock.fallback.forbidden` | You don't have access to stock. | Você não tem acesso ao estoque. |

## API Contract

| Method | Path | Request | Response | Purpose |
|--------|------|---------|----------|---------|
| GET    | `/v1/stock/levels`    | query: `q?`, `product_id?`, `low_stock_only?`, `threshold?`, `page?`, `page_size?` | `Page[VariationStockRead]` | Variation × on-hand aggregate. |
| GET    | `/v1/stock/movements` | query: `variation_id?`, `date_from?`, `date_to?`, `type?`, `reason_or_source?`, `page?`, `page_size?` | `Page[StockMovementRead]` | Interleaved ledger. |
| POST   | `/v1/stock/entries`   | `StockEntryCreate` | 201 `StockEntryRead` | Manual entry (adjustment / shipment-less). |
| POST   | `/v1/stock/exits`     | `StockExitCreate`  | 201 `StockExitRead`  | Manual exit; 409 if `on_hand < quantity`. |

All routes require auth and `stock.read` at the router level.
`stock.write` is enforced on the POST endpoints inline.

### Schemas

- `VariationStockRead`: `id, variation_id, sku, size, color, color_code,
  product: {id, name, code}, on_hand, entries_total, exits_total,
  last_movement_at?`.
- `StockEntryCreate`: `variation_id, quantity (>0), source (default
  "adjustment"), notes?`.
- `StockEntryRead`: `id, variation_id, sku, source, quantity, notes,
  created_at, shipment: {id} | None`.
- `StockExitCreate`: `variation_id, quantity (>0), reason (default
  "adjustment"), notes?`.
- `StockExitRead`: `id, variation_id, sku, reason, quantity, notes,
  created_at, order: {id} | None`.
- `StockMovementRead`: discriminated union `type: "entry"|"exit"` + the
  matching entry/exit fields.

## Seed Data Requirements

- Roles/permissions seeded by `3187f02cbc35_seed_roles_and_permissions.py`:
  admin + manager + operator hold `stock.read + stock.write`. No
  additional migration needed.
- Tests build factories on the fly via `tests.factories.create_stock_entry`
  / `create_stock_exit`.
