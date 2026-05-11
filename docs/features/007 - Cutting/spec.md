---
id: FEATURE-007
slug: production-cutting
title: Production — Cutting (Corte)
status: in-progress
created: 2026-05-10
updated: 2026-05-10
branch: feature/007-cutting
---

# FEATURE-007: Production — Cutting (Corte)

## Problem Statement

Operators need a single tracked workflow to plan and record cutting orders
that bridge raw fabric rolls (F-006) and the sewing shipments (F-009) that
follow. Today the team uses spreadsheets and WhatsApp, which makes it hard
to know which rolls are reserved against open orders, which sizes are still
to be cut, and what fabric remains.

Cutting (Corte) is the production-floor screen where a manager creates an
order — body roll (+ optional rib roll), planned per-size pieces — and an
operator records actual outputs as the order progresses from pending →
cutting → done.

## User Stories

- As a manager, I want to plan a cutting order against a product and one or
  two fabric rolls so that the floor knows what to do next.
- As an operator, I want to move an order through pending/cutting/done so
  that the office can track progress without ad-hoc messages.
- As an operator, I want to record actual per-size outputs to mirror what
  the cutter produced, so sewing shipments can be built off real numbers.
- As a manager, I want to delete an order that was never started, and I
  want the system to block deletes for orders that already shipped to a
  banca.

## Acceptance Criteria

1. [x] Given I am authenticated with `cutting.read`, when I GET `/v1/cutting`,
   then I see a paginated list of my company's cutting orders.
2. [x] Given I am authenticated with `cutting.write`, when I POST a cutting
   order with `product_id`, `body_roll_id`, optional `rib_roll_id`, and a
   `planned_outputs` list, then the row is created with status `pending`.
3. [x] Given I submit a payload where `body_roll_id == rib_roll_id`, then I
   receive HTTP 409 (the body/rib rolls must be different bobinas).
4. [x] Given an order exists, when I PATCH `status` from `pending` → `cutting`
   → `done`, then each transition appends an audit-log entry referencing the
   target status.
5. [x] Given an order is in any state, when I PATCH `actual_outputs`, then
   the per-size actuals replace the previous set atomically.
6. [x] Given an order has a linked `SewingShipment`, when I DELETE it, then
   I receive HTTP 409 (cannot delete while a banca holds work for it).
7. [x] Given I am authenticated with `cutting.read` but not `.write`, then
   POST/PATCH/DELETE return 403; GET succeeds.
8. [x] Given another company's order id, then GET/PATCH/DELETE return 404
   (tenant isolation).
9. [x] On the frontend, the cutting page defaults to a table list with a
   toggle that switches to a 3-column kanban (pendente/cortando/concluído).
10. [x] On the frontend, the create form validates that body roll ≠ rib roll
    locally and surfaces the backend 409 when the server disagrees.
11. [x] On the frontend, the detail page renders planned vs. actual outputs
    per size, plus the order's current status pill.

## User Flows

### Happy Path — create a cutting order

1. Manager opens `/cutting` and clicks **Nova OS de corte**.
2. Picks a product (combobox), then picks a body roll (filtered to `kind=body`).
3. Optionally picks a rib roll (filtered to `kind=rib`), which must differ
   from the body roll.
4. For each available size, enters planned quantity.
5. Submits → the row appears under **Pendente** in the kanban / at the top
   of the table.

### Happy Path — record progress

1. Operator opens an order.
2. Clicks **Iniciar corte** → status moves to `cutting`.
3. Records per-size actual outputs while cutting.
4. Clicks **Concluir** → status moves to `done`.

### Edge Cases

- Body roll equals rib roll → frontend validation + backend 409.
- Order has a sewing shipment → DELETE → 409 with a banner explaining the
  block; manager must cancel the shipment first.
- Roll deleted by another user → list reload shows the order with a missing
  roll reference (handled by F-006: deletion is blocked while the order
  references the roll, so this is currently impossible to reach in prod).

## Scope

### In Scope

- `CuttingOrder` + `CuttingOrderOutput` schemas, services, routers.
- List filters: `q` (free-text on product name + roll supplier), `status`,
  `product_id`.
- Frontend list page (table + kanban toggle), create page/new sheet, detail
  page (header + planned-vs-actual grid + status actions).
- Audit-log entries on every mutation (create / status change / actuals
  update / delete).

### Out of Scope

- Fabric weight (kg) consumed per order — design shows a "Peso consumido"
  panel; the model has no `consumed_kg` column yet. Adding it would require
  a migration and is deferred to a follow-up.
- Drag-and-drop reordering between kanban columns. The status transition
  uses explicit buttons (Marcar como cortando / Concluir) for now.
- Linking already-shipped orders to a sewing remessa creation flow. That
  belongs to F-009.

## UI/UX Notes

- Eyebrow chip color: teal `--brand-prod`.
- Page title (`Corte & planejamento`) renders in Fraunces 30 / 400 /
  -.025em / lh 1.05.
- StatusPill mirrors `.pill` from the design: pendente=warn, cortando=info,
  concluido=ok. 12% colored bg, colored ink, colored 25%-mix border.
- The view toggle is a `Seg` (segmented control)-style tab — Kanban /
  Tabela.
- Kanban cards display: order id (mono), product name, body roll code,
  planned total, and the status pill at the top right.

## i18n Keys

| Key | EN | PT-BR |
|-----|-----|-------|
| `cutting.page.eyebrow` | Production | Produção |
| `cutting.list.title` | Cutting | Corte |
| `cutting.list.titleEm` | & planning | & planejamento |
| `cutting.list.sub` | Plan and record cutting orders against your fabric rolls. | Planeje e registre lotes de corte contra suas bobinas. |
| `cutting.statuses.pending` | Pending | Pendente |
| `cutting.statuses.cutting` | Cutting | Cortando |
| `cutting.statuses.done` | Done | Concluído |
| `cutting.view.table` | Table | Tabela |
| `cutting.view.kanban` | Kanban | Kanban |
| `cutting.actions.create` | New order | Nova OS de corte |
| `cutting.form.labels.product` | Product to cut | Produto a cortar |
| `cutting.form.labels.bodyRoll` | Body roll | Bobina corpo |
| `cutting.form.labels.ribRoll` | Rib roll | Bobina ribana |
| `cutting.form.validation.bodyRibSame` | Body and rib rolls must be different | Bobina corpo e ribana devem ser diferentes |
| ... (full list in `frontend/messages/{en,pt-BR}.json`) | | |

## API Contract

| Method | Path | Request Body | Response | Purpose |
|--------|------|--------------|----------|---------|
| GET | `/v1/cutting` | – | `Page[CuttingRead]` | List with `q`, `status`, `product_id`, `page`, `page_size` query params. |
| GET | `/v1/cutting/{id}` | – | `CuttingRead` | Fetch one order with product + rolls + outputs eager-loaded. |
| POST | `/v1/cutting` | `CuttingCreate` | `201 CuttingRead` | Create a new order in `pending`. |
| PATCH | `/v1/cutting/{id}` | `CuttingUpdate` | `CuttingRead` | Transition status and/or replace actual outputs. |
| DELETE | `/v1/cutting/{id}` | – | `204` | Delete unless blocked by a linked `SewingShipment` → 409. |

### Permission codes

- `cutting.read` — required for every endpoint on the router (router-level
  dependency).
- `cutting.write` — additionally required for POST / PATCH / DELETE (inline
  dependency).

## Seed Data Requirements

- Existing `cutting` permission codes (`cutting.read`, `cutting.write`) are
  already seeded under both `admin` and `operator` roles.
- E2E + integration tests build fabric rolls, products, and cutting orders
  through `tests/factories/{fabric,product,cutting}.py` — no new fixtures
  are required.
