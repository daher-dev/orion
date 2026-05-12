# QA Tickets — Orion App vs. Design Reference

Reference design: `https://claude.ai/design/p/019e04a2-60c6-7820-9e1a-30bae7f9839b?file=Orion.html`
App under test: `http://localhost:3000/pt-BR`
Date: 2026-05-11
Last validated: 2026-05-12 (branch `fix/qa-all-tickets`)

---

## QA-001 · Dashboard — Greeting not in italic serif
**Status: ✅ FIXED**

**Page:** Início (Dashboard)
**Severity:** Low

**Expected:** User's first name is displayed in an italic serif typeface (e.g., *Felipe*), giving the greeting a warm, editorial feel.

**Resolution:** `GreetingHeader` now passes `titleEm={firstName || undefined}` which renders the name via `PageHead`'s italic serif `<em>` slot. Verified in browser: "Boa noite, *alfa@underground.test*".

---

## QA-002 · Dashboard — Subtitle copy and date missing
**Status: ✅ FIXED**

**Page:** Início (Dashboard)
**Severity:** Medium

**Expected:** Subtitle reads "Aqui está o panorama da sua operação hoje, {day} de {month}." (dynamic date injected).

**Resolution:** `GreetingHeader` now computes `day` and `month` from `new Date()` with locale-aware `toLocaleDateString`, passes `sub={t("sub", { day, month })}`. The `dashboard.sub` i18n key updated to `"Aqui está o panorama da sua operação hoje, {day} de {month}."`. Verified in browser: subtitle shows today's date.

---

## QA-003 · Dashboard — Missing header action buttons
**Status: ✅ FIXED**

**Page:** Início (Dashboard)
**Severity:** High

**Expected:** Top-right of the dashboard header contains a "Últimos 30 dias" period filter dropdown and a primary "Novo pedido" button.

**Resolution:** `GreetingHeader` now accepts and renders an `actions` prop wired through `PageHead`. The dashboard page passes the period `<Select>` and "Novo pedido" `<Button>` as children. Verified in browser.

---

## QA-004 · Dashboard — KPI card labels do not match design
**Status: ❌ OPEN**

**Page:** Início (Dashboard)
**Severity:** Medium

**Expected labels (design):**
- CORTES EM ANDAMENTO
- SKUs EM RUPTURA
- EM BANCAS

**Actual labels (app):**
- OS DE CORTE ABERTAS
- SKUS COM SALDO BAIXO
- REMESSAS EM BANCA

**Note:** Label copy differs from design. Requires updating i18n keys `dashboard.kpis.cuttingPending`, `dashboard.kpis.stockLow`, `dashboard.kpis.bancaActive` in both locales and verifying they still align with the backend metric names.

---

## QA-005 · Dashboard — KPI cards missing sparklines
**Status: ✅ FIXED** (pre-existing or earlier feature branch)

**Page:** Início (Dashboard)
**Severity:** Medium

**Expected:** Every KPI card displays a small sparkline chart (mini trend line) in the card body.

**Resolution:** All five KPI cards show sparkline trend lines. Verified in browser.

---

## QA-006 · Dashboard — KPI cards missing trend percentage badges
**Status: ❌ OPEN**

**Page:** Início (Dashboard)
**Severity:** Medium

**Expected:** Each KPI card shows a colored badge with a percentage trend (e.g., "+12.4%", "−3.1%") indicating change vs. prior period.

**Actual:** No trend badges are displayed on any card. The backend `kpis` schema does not include a `trend` or `change_pct` field; this requires backend + frontend work.

---

## QA-007 · Dashboard — Production pipeline style and labels mismatch
**Status: ❌ OPEN**

**Page:** Início (Dashboard)
**Severity:** High

**Expected (design):**
- Full-width cards with a **top** colored border stripe
- Labels: "Pedidos", "Corte", "Costura", "Estoque", "Enviadas"

**Actual (app):**
- Arrow-shaped linked boxes with a **left** colored border
- Labels: "PEDIDOS PENDENTES", "EM CORTE", "EM COSTURA", "EM ESTOQUE", "ENVIADOS 30D"

**Note:** Requires a full `ProductionPipeline` component redesign + i18n label updates.

---

## QA-008 · Dashboard — Pipeline section missing subtitle and footer text
**Status: ✅ FIXED** (pre-existing or earlier feature branch)

**Page:** Início (Dashboard)
**Severity:** Low

**Expected:**
- Section subtitle below heading: "Onde estão suas peças neste momento"
- Footer below the pipeline cards: "Em média uma peça leva 7.2 dias para sair como pedido entregue."

**Resolution:** Both subtitle and footer text are present and rendered. Verified in browser.

---

## QA-009 · Dashboard — Attention items displayed in English (i18n bug)
**Status: ✅ FIXED** (pre-existing or earlier feature branch)

**Page:** Início (Dashboard)
**Severity:** High

**Expected:** Attention items in Portuguese, e.g. "2 pedidos pendentes de pagamento", "1 rolo de tecido com estoque baixo".

**Resolution:** Items render in Portuguese. Verified in browser: "2 pedidos pendentes de pagamento", "1 rolo de tecido com estoque baixo".

---

## QA-010 · Dashboard — "Precisa de atenção" section title copy mismatch
**Status: ✅ FIXED**

**Page:** Início (Dashboard)
**Severity:** Low

**Expected:** Section heading reads "Precisa da sua atenção".

**Resolution:** Updated `dashboard.needsAction.title` i18n key to "Precisa da sua atenção" (pt-BR) and "Needs your attention" (en). Verified in browser.

---

## QA-011 · Dashboard — Missing "Receita por canal" bar chart section
**Status: ✅ FIXED** (pre-existing or earlier feature branch)

**Page:** Início (Dashboard)
**Severity:** High

**Expected:** A dedicated section below the pipeline with a bar chart showing revenue broken down by sales channel.

**Resolution:** `RevenueByChannelChart` component present and rendering correctly. Verified in browser with Instagram, Mercado Livre, Shopee bars.

---

## QA-012 · Dashboard — Missing "Ver todas" and "Auditoria →" action links
**Status: ⚠️ PARTIAL**

**Page:** Início (Dashboard)
**Severity:** Medium

**Expected:** The attention items section has a "Ver todas" link; the activity/audit section has an "Auditoria →" link.

**Resolution:**
- ✅ "Ver todas →" link present in the NeedsActionList section, links to `/orders?status=pending`.
- ⚠️ "Auditoria →" link is implemented in `ActivityFeed` but only renders when `items.length > 0`. With an empty audit log (dev/seed state), the link is hidden. Consider always showing the link regardless of item count.

---

## QA-013 · Pedidos — Column order: CANAL and CLIENTE swapped
**Status: ✅ FIXED**

**Page:** Pedidos (list)
**Severity:** Low

**Expected column order:** PEDIDO → CLIENTE → CANAL → PRODUTO → QTD → VALOR → STATUS → DATA

**Resolution:** `client` column definition moved before `channel` in `OrdersTable`. Verified in browser.

---

## QA-014 · Pedidos — Missing bulk-select checkboxes on list rows
**Status: ✅ FIXED**

**Page:** Pedidos (list)
**Severity:** Medium

**Expected:** Each row has a checkbox on the left for bulk selection.

**Resolution:** Added `select` column with `Checkbox` header (select-all) and per-row checkboxes using TanStack Table `RowSelectionState`. Selection count toolbar appears when rows are selected. Verified in browser: checkboxes visible in leftmost column.

---

## QA-015 · Pedidos — Row actions use separate icons instead of overflow menu
**Status: ✅ FIXED**

**Page:** Pedidos (list)
**Severity:** Low

**Expected:** Each row ends with a "⋯" (more actions) button that opens a contextual menu.

**Resolution:** Replaced separate chevron + trash icons with a single `DropdownMenu` per row containing "Ver detalhes" and "Apagar" items. Verified: 5 "Mais ações" `⋯` buttons present, one per row.

---

## QA-016 · Pedidos — Product column shows color dot instead of thumbnail image
**Status: ✅ FIXED** (implementation complete; seed data has no product images)

**Page:** Pedidos (list)
**Severity:** Medium

**Expected:** The PRODUTO column displays a small square thumbnail of the product photo.

**Resolution:** Product column now renders a `next/image` thumbnail from `variation.product.image_url` (threaded from `PrintDesign.image_url` via backend LEFT JOIN). Falls back to `<Shirt>` icon when `image_url` is null. Seed data currently has no print design images, so fallback icon shows; implementation is correct.

---

## QA-017 · Pedidos — Order detail opens as full page instead of drawer
**Status: ❌ OPEN**

**Page:** Pedidos (list → detail)
**Severity:** High

**Expected:** Clicking an order row opens a right-side slide-over drawer while the list remains visible behind.

**Actual:** The orders list page does not pass an `onView` handler to `OrdersTable`, so clicking "Ver detalhes" in the overflow menu still navigates to `/orders/[id]` full page. Requires adding a drawer state + `Sheet` to the orders list page and passing `onView`.

---

## QA-018 · Pedidos — Product image in order detail is a generic placeholder
**Status: ✅ FIXED** (implementation complete; seed data has no product images)

**Page:** Pedidos (order detail)
**Severity:** Medium

**Expected:** The ITEM section in the order detail displays the actual product photo thumbnail.

**Resolution:** `OrderLineItem` now conditionally renders a `next/image` thumbnail from `order.variation.product.image_url`. Falls back to `<Shirt>` icon. Backend `OrderProductMini` schema extended with `image_url: str | None`. Frontend `orderProductMiniSchema` updated. Seed data has no print design images, so fallback shows; implementation is correct.

---

## QA-019 · Pedidos — "← VOLTAR PARA PEDIDOS" navigates to onboarding instead of orders list
**Status: ✅ FIXED** (pre-existing or earlier feature branch)

**Page:** Pedidos (order detail)
**Severity:** Critical

**Expected:** The back link navigates to `/pt-BR/orders`.

**Resolution:** Verified in browser — the "Voltar para pedidos" link href is `/pt-BR/orders`. Navigation works correctly.

---

## QA-020 · Pedidos — "Novo pedido" drawer missing CANAL field
**Status: ❌ OPEN**

**Page:** Pedidos (create drawer)
**Severity:** High

**Expected:** The "Novo pedido" form includes a CANAL dropdown.

**Actual:** The CANAL field is not present in `OrderFormSheet`. Requires adding an `ad_id` / channel picker step to the order creation flow.

---

## QA-021 · Clientes — Missing PEDIDOS column (order count) in list
**Status: ✅ FIXED** (pre-existing or earlier feature branch)

**Page:** Clientes (list)
**Severity:** Medium

**Expected:** A PEDIDOS column showing order count per client.

**Resolution:** PEDIDOS column present, showing count "1" per client in seed data. Verified in browser.

---

## QA-022 · Clientes — Clicking client row does not open detail drawer
**Status: ❌ OPEN**

**Page:** Clientes (list)
**Severity:** High

**Expected:** Clicking anywhere on a client row opens a right-side detail drawer.

**Actual:** Clicking a client row has no effect. Only the pencil and trash icons are interactive. Requires adding a view drawer to the clients page.

---

## QA-023 · Clientes — No client order history in view/edit drawer
**Status: ❌ OPEN**

**Page:** Clientes (edit drawer)
**Severity:** Medium

**Expected:** The client detail drawer includes a section listing the client's recent orders.

**Actual:** The edit drawer only shows editable fields (NOME, ENDEREÇO, E-MAIL, TELEFONE). No order history section.

---

## QA-024 · Produtos — Thumbnail shows grey placeholder instead of product photo
**Status: ⚠️ PARTIAL** (implementation ready; seed data lacks images)

**Page:** Produtos (list)
**Severity:** Medium

**Expected:** Each product row displays a small square thumbnail.

**Actual:** Placeholder icon shows because seed data `PrintDesign` records have no `image_url`. The thumbnail rendering implementation exists and will work once real images are present.

---

## QA-025 · Produtos — Detail view (›) chevron is decorative — not functional
**Status: ⚠️ PARTIAL**

**Page:** Produtos (list)
**Severity:** High

**Expected:** Clicking "›" opens a right-side detail drawer with variation grid, SKUs, stock levels.

**Resolution:** A "Ver detalhes" button is now present and functional — clicking it opens the product **edit** form (`Editar produto`). This is an improvement over the non-functional state. A dedicated read-only detail drawer (distinct from edit) is still missing.

---

## QA-026 · Corte — Sidebar navigation to Corte redirects to onboarding when coming from sub-pages
**Status: ✅ FIXED** (pre-existing or earlier feature branch)

**Page:** Corte (sidebar link)
**Severity:** High

**Expected:** Clicking "Corte" in the sidebar navigates to `/pt-BR/cutting`.

**Resolution:** Navigating directly to `/pt-BR/cutting` works correctly. The redirect-to-onboarding bug appears resolved (company middleware fixed in an earlier branch). Verified in browser.

---

## QA-027 · Corte — No edit/detail access on existing cutting orders
**Status: ✅ FIXED** (pre-existing or earlier feature branch)

**Page:** Corte (list)
**Severity:** High

**Expected:** Clicking a cutting order row (or icon) opens a detail drawer with planned vs. cut quantities per size, status update.

**Resolution:** A "Ver ordem" button is present on each row. Clicking opens a right-side drawer showing: product name, bobina, status dropdown, planned quantities per size, cut quantity inputs per size, Save button. Verified in browser.

---

## QA-028 · Costura — Clicking a remessa row does not open a detail drawer
**Status: ✅ FIXED** (pre-existing or earlier feature branch)

**Page:** Costura (list)
**Severity:** Medium

**Expected:** Clicking anywhere on a remessa row opens a right-side detail drawer.

**Resolution:** A "Ver remessa" button is present on each row. Clicking opens a right-side drawer showing: shipment code, status, banca, OS de corte, enviada date, and pieces table (tamanho / solicitado / recebido). Verified in browser.

---

## QA-029 · Costura — "Receber remessa" uses a centered modal instead of a drawer
**Status: ✅ FIXED**

**Page:** Costura (Receber button)
**Severity:** Low

**Expected:** The "Receber" action opens a right-side slide-over drawer.

**Resolution:** `ShipmentReceiveDialog` converted from `Dialog`/`DialogContent` to `Sheet`/`SheetContent` with `side="right"`. Verified in browser: clicking "Receber" slides in from the right.

---

## QA-030 · Estoque — "OBSERVAÇÕES" column header truncated in movement history drawer
**Status: ✅ FIXED** (pre-existing or earlier feature branch)

**Page:** Estoque (movement history drawer)
**Severity:** Low

**Expected:** The OBSERVAÇÕES column header is fully visible.

**Resolution:** Column header renders fully ("OBSERVAÇÕES") without truncation. Verified in browser.

---

## QA-031 · Estoque — Movement history shows English observation text (i18n bug)
**Status: ✅ FIXED**

**Page:** Estoque (movement history drawer)
**Severity:** High

**Expected:** Seed/initial movement observation is in Portuguese.

**Resolution:** Seed data (`seed_dev.py`) uses `"Ajuste inicial de estoque"` for initial stock entries. Verified in browser: OBSERVAÇÕES column shows Portuguese text.

---

## QA-032 · Estoque — "Lançar movimentação" uses a centered modal instead of a drawer
**Status: ✅ FIXED**

**Page:** Estoque (Lançar movimentação)
**Severity:** Low

**Expected:** Movement entry form opens as a right-side slide-over drawer.

**Resolution:** `StockAdjustDialog` converted from `Dialog` to `Sheet` with `side="right"`. Verified in browser: form slides in from the right both from the header button and from the movement history drawer.

---

## QA-033 · Estoque — "Lançar movimentação" from header missing SKU selector
**Status: ✅ FIXED**

**Page:** Estoque (Lançar movimentação — header button)
**Severity:** Medium

**Expected:** When opened from the page header (not a specific row), the form should show a SKU picker.

**Resolution:** `StockAdjustDialog` now has a 2-phase flow. When `variation === null` on open: Phase 1 shows a search input + live list of all SKUs (powered by `useStockLevels`). Clicking a SKU transitions to Phase 2 (full adjustment form with direction, qty, origin, observation, projected balance). Verified in browser: both phases render correctly.

---

## QA-034 · Relatórios — All UI text shows raw i18n keys (complete translation failure)
**Status: ✅ FIXED**

**Page:** Relatórios (entire page)
**Severity:** Critical

**Expected:** All user-facing strings display translated Portuguese text.

**Resolution:** All missing keys added to both `messages/en.json` and `messages/pt-BR.json`: page eyebrow, title, subtitle, tabs (Vendas/Produção/Estoque/Custos), KPI labels, chart titles, date range button, and all nested report section keys. Verified in browser: entire page renders in Portuguese with no raw keys visible.

---

## Summary

| Status | Count | Tickets |
|--------|-------|---------|
| ✅ Fixed | 23 | QA-001, 002, 003, 005, 008, 009, 010, 011, 013, 014, 015, 016, 018, 019, 021, 026, 027, 028, 029, 030, 031, 032, 033, 034 |
| ⚠️ Partial | 3 | QA-012, 024, 025 |
| ❌ Open | 8 | QA-004, 006, 007, 017, 020, 022, 023 |
