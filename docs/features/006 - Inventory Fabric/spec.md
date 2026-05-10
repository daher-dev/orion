---
id: F-006
slug: inventory-fabric
title: Inventory — Fabric (Bobinas/Tecidos)
status: in-progress
created: 2026-05-10
updated: 2026-05-10
branch: feature/006-fabric
---

# F-006: Inventory — Fabric (Bobinas/Tecidos)

## Problem Statement
The production floor receives rolls of fabric (bobinas) — body fabric for the garment and rib trim for collars/cuffs — and consumes them across cutting orders. Today every roll lives in a spreadsheet that nobody trusts: there's no canonical record of how much weight came in, how much remains, what supplier delivered it, or which cutting orders chipped away at it. F-006 introduces the **Tecidos / Bobinas** module: a tenant-scoped CRUD over `fabric_rolls` with a list view (table + usage bar per row), a per-roll detail page (weight burn-down placeholder + linked-cuts list), and a "receber bobina" creation flow.

The module is the inventory anchor that F-007 (Cutting) will read from and decrement, and that F-015 (Dashboard) will surface as "low-stock" alerts.

## User Stories
- As an inventory manager, I want to register a received fabric roll (body or rib) with supplier, fabric type, color, initial weight and price-per-kg so I always know what's on hand.
- As an inventory manager, I want to filter the list by kind (body / rib) and search by supplier, color or fabric type to find a specific roll quickly.
- As an inventory manager, I want to open a roll's detail page and see how much weight has been consumed, the current saldo, and which cutting orders chipped away at it.
- As an inventory manager, I want to manually adjust the current weight on a roll (e.g. after a re-weigh) so the saldo stays accurate, but the system must never let me set current > initial.
- As an inventory manager, I want to delete a roll that was registered by mistake, but the system must block the delete if any cutting order references the roll.
- As an operator, I should be able to READ the bobinas list (so I can see what fabric is available) but NOT mutate it.

## Acceptance Criteria
1. [ ] Given a manager with `fabric.read`, when they navigate to `/fabric`, then they see a paginated, searchable, filter-by-kind list of all fabric rolls in their company with a per-row usage bar.
2. [ ] Given a manager with `fabric.write`, when they click "Receber tecido" and submit the form, then the roll is created and `current_weight_kg` defaults to `initial_weight_kg` when omitted.
3. [ ] Given a roll exists with initial 20 kg, when a manager edits the current weight to 22 kg, then the backend returns 409 Conflict with "current_weight_kg cannot exceed initial_weight_kg" and the form shows the message.
4. [ ] Given a manager opens a roll's detail page, when the roll has no linked cuts, then the burn-down chart shows an empty placeholder and the consumers section shows "Nenhum corte registrado".
5. [ ] Given a manager confirms deletion of a roll with NO linked cutting orders, when the request succeeds, then the roll disappears and an audit entry is recorded.
6. [ ] Given a manager confirms deletion of a roll that IS referenced by a cutting order, when the request fires, then the API returns 409 Conflict with "Cannot delete fabric roll — it is referenced by a cutting order" and the row remains.
7. [ ] Given an operator (no `fabric.write`), when they load `/fabric`, then they see the list but the "Receber tecido" CTA, edit/delete actions and row-click → form sheet are hidden / disabled.
8. [ ] All endpoints respect tenant isolation — company A cannot read or mutate company B's rolls.
9. [ ] Backend test coverage on new code is ≥ 90% line coverage.

## User Flows

### Happy Path — Receive a roll
1. Manager clicks "Tecidos" in the sidebar's Estoque section.
2. List page loads at `/fabric` with the design page header (eyebrow "Estoque" + title "Bobinas de tecido") and a "Receber tecido" primary button.
3. Manager clicks "Receber tecido" → side sheet slides in.
4. Manager picks kind (Corpo / Ribana radio), fabric type, supplier, color, received date, initial weight (kg), price per kg.
5. Submits — sheet closes; toast confirms; list refreshes with the new row at the top.

### Happy Path — Adjust current weight
1. Manager clicks a roll row → form sheet opens prefilled.
2. Manager edits "Peso atual" (current_weight_kg).
3. Submits "Salvar alterações" → roll updates; usage bar reflects new percentage.

### Happy Path — Visit detail page
1. Manager clicks "Abrir página" inside the row sheet (or opens `/fabric/{id}` directly).
2. Detail page renders: header (supplier · color · received date), big remaining/initial pair, burn-down chart placeholder, list of cutting orders that consumed this roll.
3. F-007 Cutting will populate the consumers list — for v1 the section shows an empty placeholder when the array is empty.

### Edge Cases
- Validation `current > initial`: backend raises 409 Conflict; form shows inline error.
- Validation `initial <= 0` or `price < 0`: 422 from Pydantic.
- Linked cutting order on delete: 409 Conflict; row remains; toast shows the deny reason.
- Empty list: empty-state card with Layers icon, "Nenhuma bobina cadastrada" title, body and CTA "Receber primeira bobina".
- Search: typing in the toolbar input debounces and filters by supplier / color / fabric_type.
- Operator visiting `/fabric` directly: list renders read-only.

## Scope

### In Scope
- CRUD over `fabric_rolls` (create, read list + detail, update, delete with linked-cuts guard).
- Pagination + free-text search (supplier / color / fabric_type) + filter by kind + filter by fabric_type.
- `current_weight_kg` default = `initial_weight_kg` on create when omitted.
- Server-side validation: `current_weight_kg <= initial_weight_kg`.
- Delete guard: refuse if a `CuttingOrder` references the roll via `body_roll_id` or `rib_roll_id`.
- Computed `consumed_kg` field in the read payload (initial - current).
- Tenant isolation (company_id implicit from current user).
- Audit log on every mutation.
- Permission checks: `fabric.read` on router, `fabric.write` per write endpoint.
- Frontend list page with design-faithful PageHead (amber Estoque eyebrow), TanStack table with per-row usage bar, side-sheet form for create/edit, empty state, delete confirm dialog, kind/type filters.
- Frontend detail page (`/fabric/[id]`) with weight burn-down chart skeleton (recharts) and consumers section placeholder.
- EN and PT-BR translations under the existing `fabric` i18n namespace.
- Frontend Vitest tests (form + table + hooks).
- Playwright E2E spec (list/empty/create/edit/validation/delete/deny-delete/permission paths).

### Out of Scope
- Live burn-down data — depends on F-007 Cutting (chart receives empty array placeholder for v1).
- Linked-cuts list (the rolls page links from a CuttingOrder will surface in F-007). For v1 we wire an empty-state placeholder.
- Auto-decrement of `current_weight_kg` from cutting orders — F-007 owns that mutation when it lands.
- Low-stock alert thresholds & dashboard chips — F-015 territory.
- Bulk CSV import.
- Soft-delete + restore.
- Color palette / fabric-type editor surfaces — type lives in the `FabricType` enum.

## UI/UX Notes

Per `/docs/design/source/pages/inventory.jsx` Fabric section and the existing wave-1 patterns:

- Page header eyebrow: "Estoque" with the 18×18 brand-inv (amber) mark, then the 30px Fraunces title "Bobinas <em>de tecido</em>" (em italic + brand-inv color). Sub: "Cada bobina recebida e o quanto resta. Saldo é abatido a cada corte." (PT-BR) / "Every roll received and how much remains. Balance is decremented at each cut." (EN).
- Primary action: "Receber tecido" (btn-primary, Plus icon).
- Card surrounding the table mirrors `.card` from styles.css: `--orion-surface` background, 14px radius, 1px line border, overflow hidden.
- Toolbar inside the card has: search input (220 min-width), kind segmented (Todas / Corpo / Ribana), fabric-type select (or "Todos").
- Table uses the existing `.tbl` mapping (10.5px uppercase header, 12px–13px ink-2 body cells, `--orion-line-soft` divider, hover bg `--orion-bg`).
- Columns: Fornecedor / Tipo (kind+fabric_type) / Cor / Recebida / Peso inicial / **Saldo (usage bar + percent)** / Preço/kg / chevron.
- Usage bar: 6px tall horizontal progress bar inside the saldo cell, color = `--brand-inv` (amber), with low-stock heuristic (< 25% remaining → `--status-err`; < 50% → `--status-warn`).
- Side sheet (right-side) for create/edit: title "Receber bobina" / "Editar bobina"; nested sections "Identificação" (kind radio + fabric_type select), "Detalhes da bobina" (color, supplier, received date), "Peso" (initial, current), "Preço" (price_per_kg). Footer: Cancel + primary save.
- Empty state: same `.empty` block as the design (Layers icon, h3 title, sub-text, primary CTA "Receber primeira bobina").
- Detail page `/fabric/[id]`: header chip (supplier name + received date in pt-BR format), then hero card (`--orion-surface-2` bg, 12px radius, 18px padding) showing remaining weight in big Fraunces 22px next to /initial, plus a 10px-tall progress bar. Below: 2-column FormGrid (Fornecedor, Recebida em, Consumido, Preço). Burn-down section (recharts skeleton) and Consumers section follow.
- All design pixel values are mirrored from `styles.css` (no rounding).

## i18n Keys (existing `fabric` namespace)

| Key | EN | PT-BR |
|-----|-----|-------|
| `fabric.page.eyebrow` | Inventory | Estoque |
| `fabric.list.title` | Rolls | Bobinas |
| `fabric.list.titleEm` | of fabric | de tecido |
| `fabric.list.sub` | Every roll received and how much remains. Balance is decremented at each cut. | Cada bobina recebida e o quanto resta. Saldo é abatido a cada corte. |
| `fabric.list.empty.title` | No rolls registered yet | Nenhuma bobina cadastrada |
| `fabric.list.empty.body` | Register your first incoming roll to start tracking fabric balance. | Registre a primeira bobina recebida para começar a acompanhar o saldo de tecido. |
| `fabric.list.empty.cta` | Receive first roll | Receber primeira bobina |
| `fabric.filters.searchPlaceholder` | Search by supplier, color or fabric type… | Buscar por fornecedor, cor ou tecido… |
| `fabric.filters.kind` | Kind | Tipo |
| `fabric.filters.kindAll` | All | Todas |
| `fabric.filters.fabricType` | Fabric | Tecido |
| `fabric.filters.fabricTypeAll` | All fabrics | Todos os tecidos |
| `fabric.table.columns.supplier` | Supplier | Fornecedor |
| `fabric.table.columns.kind` | Kind | Tipo |
| `fabric.table.columns.fabricType` | Fabric | Tecido |
| `fabric.table.columns.color` | Color | Cor |
| `fabric.table.columns.receivedAt` | Received | Recebida |
| `fabric.table.columns.initialWeight` | Initial | Peso inicial |
| `fabric.table.columns.currentWeight` | Current | Saldo |
| `fabric.table.columns.usage` | Usage | Uso |
| `fabric.table.columns.pricePerKg` | Price/kg | Preço/kg |
| `fabric.table.columns.actions` | Actions | Ações |
| `fabric.fabricRollKinds.body` | Body | Corpo |
| `fabric.fabricRollKinds.rib` | Rib | Ribana |
| `fabric.fabricTypes.jersey` | Jersey | Malha jersey |
| `fabric.fabricTypes.fleece` | Fleece | Moletom |
| `fabric.fabricTypes.french_terry` | French Terry | Moletinho |
| `fabric.fabricTypes.mesh` | Mesh | Tela |
| `fabric.fabricTypes.rib` | Rib | Ribana |
| `fabric.actions.create` | Receive roll | Receber tecido |
| `fabric.actions.edit` | Edit roll | Editar bobina |
| `fabric.actions.delete` | Delete roll | Excluir bobina |
| `fabric.actions.confirmDelete` | Are you sure? This cannot be undone. | Tem certeza? Esta ação não pode ser desfeita. |
| `fabric.actions.back` | Back to rolls | Voltar para bobinas |
| `fabric.actions.openDetail` | Open page | Abrir página |
| `fabric.detail.burndownTitle` | Weight burn-down | Saldo ao longo do tempo |
| `fabric.detail.burndownEmpty` | No consumption recorded yet. | Nenhum consumo registrado ainda. |
| `fabric.detail.consumersTitle` | Cuts that consumed this roll | Cortes que consumiram esta bobina |
| `fabric.detail.consumersEmpty` | No cut has been registered against this roll yet. | Nenhum corte registrado contra esta bobina ainda. |
| `fabric.detail.stats.consumed` | Consumed | Consumido |
| `fabric.detail.stats.remaining` | Remaining | Restante |
| `fabric.detail.stats.initialWeight` | Initial weight | Peso inicial |
| `fabric.detail.stats.supplier` | Supplier | Fornecedor |
| `fabric.detail.stats.receivedAt` | Received on | Recebida em |
| `fabric.detail.stats.pricePerKg` | Price / kg | Preço por kg |
| `fabric.form.title.new` | Receive roll | Receber bobina |
| `fabric.form.title.edit` | Edit roll | Editar bobina |
| `fabric.form.title.newSub` | Register an incoming fabric roll | Registre uma bobina recebida |
| `fabric.form.title.editSub` | Update roll details | Atualizar dados da bobina |
| `fabric.form.sections.identity` | Identification | Identificação |
| `fabric.form.sections.fabric` | Fabric details | Detalhes do tecido |
| `fabric.form.sections.weight` | Weight | Peso |
| `fabric.form.sections.pricing` | Pricing | Preço |
| `fabric.form.labels.kind` | Roll kind | Tipo da bobina |
| `fabric.form.labels.fabricType` | Fabric type | Tipo de tecido |
| `fabric.form.labels.color` | Color | Cor |
| `fabric.form.labels.supplier` | Supplier | Fornecedor |
| `fabric.form.labels.receivedAt` | Received on | Recebida em |
| `fabric.form.labels.initialWeight` | Initial weight (kg) | Peso inicial (kg) |
| `fabric.form.labels.currentWeight` | Current weight (kg) | Peso atual (kg) |
| `fabric.form.labels.pricePerKg` | Price per kg (R$) | Preço por kg (R$) |
| `fabric.form.placeholders.color` | e.g. Off-white | Ex: Off-white |
| `fabric.form.placeholders.supplier` | e.g. Malharia Estrela | Ex: Malharia Estrela |
| `fabric.form.placeholders.weight` | 20.0 | 20.0 |
| `fabric.form.placeholders.price` | 38.00 | 38,00 |
| `fabric.form.validation.supplierRequired` | Supplier is required | Fornecedor é obrigatório |
| `fabric.form.validation.colorRequired` | Color is required | Cor é obrigatória |
| `fabric.form.validation.receivedAtRequired` | Received date is required | Data de recebimento é obrigatória |
| `fabric.form.validation.initialWeightPositive` | Initial weight must be greater than zero | Peso inicial deve ser maior que zero |
| `fabric.form.validation.currentWeightNonNegative` | Current weight cannot be negative | Peso atual não pode ser negativo |
| `fabric.form.validation.currentExceedsInitial` | Current weight cannot exceed initial weight | Peso atual não pode exceder o peso inicial |
| `fabric.form.validation.pricePositive` | Price must be zero or greater | Preço não pode ser negativo |
| `fabric.form.validation.deletionBlocked` | Cannot delete — this roll is referenced by a cutting order. | Não é possível excluir — esta bobina está vinculada a uma ordem de corte. |
| `fabric.form.save` | Save changes | Salvar alterações |
| `fabric.form.cancel` | Cancel | Cancelar |
| `fabric.form.submitNew` | Register roll | Registrar bobina |
| `fabric.toast.created` | Roll registered | Bobina cadastrada |
| `fabric.toast.updated` | Roll updated | Bobina atualizada |
| `fabric.toast.deleted` | Roll deleted | Bobina excluída |
| `fabric.toast.error` | Operation failed | Operação falhou |
| `fabric.fallback.forbidden` | You don't have access to fabric rolls. | Você não tem acesso às bobinas. |

## API Contract

| Method | Path | Request | Response | Purpose |
|--------|------|---------|----------|---------|
| GET    | `/v1/fabric` | query: `q?`, `kind?`, `fabric_type?`, `page?`, `page_size?` | `Page[FabricRollRead]` | List fabric rolls (paginated + filtered). |
| GET    | `/v1/fabric/{id}` | — | `FabricRollRead` | Detail of a single roll. |
| POST   | `/v1/fabric` | `FabricRollCreate` | 201 `FabricRollRead` | Register an incoming fabric roll. |
| PATCH  | `/v1/fabric/{id}` | `FabricRollUpdate` | `FabricRollRead` | Update a roll. |
| DELETE | `/v1/fabric/{id}` | — | 204 / 409 | Delete a roll (blocked if linked to a cutting order). |

All routes require auth. List/detail require `fabric.read`. POST/PATCH/DELETE require `fabric.write`.

`FabricRollRead` shape: `{ id, received_at, supplier_name, kind, fabric_type, initial_weight_kg, current_weight_kg, consumed_kg, color, price_per_kg, created_at, updated_at }`. Decimals are serialized as strings.

## Seed Data Requirements
- Inherit existing role/permission seed (admin + manager hold `fabric.read+write`; operator holds `fabric.read` only — verified in `alembic/versions/3187f02cbc35_seed_roles_and_permissions.py`).
- No production seed for v1. Tests build factories on the fly via `tests.factories.create_fabric_roll`.
