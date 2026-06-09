# Capability Gap Analysis: Underground → Orion

> **Lens.** Orion is a new-and-improved system, not a 1:1 port of the legacy **Underground** app
> (base44, source at `../underground-sistem-intelligence`). Gaps are mapped as **missing capabilities**
> — *jobs an operator needs to do* — not missing tables or unmigrated rows. Legacy models/pages are cited
> only as **reference**.

> **Grounding & stages.** Each capability is tagged with the furthest lifecycle **stage** it has reached,
> reconciling two sources of truth: the **code** (`backend/src/**`, `backend/alembic/**`,
> `frontend/src/app/[locale]/**`, `frontend/src/components/**`) for what's *built*, and the **design
> prototype** (`docs/design/**` — static `.jsx` mockups) for what's *designed*. The old
> `docs/features` / `docs/ROADMAP.md` were deleted and are **not** used.

**Stages:**
- 🟢 **Implemented** — built and operable in code.
- 🟡 **Partial** — meaningfully built, but sub-parts missing.
- 🔵 **Designed** — designed in `docs/design`, not built (code has at most a model stub or placeholder shell).
- ⚪ **Gap** — neither designed nor built.

---

## Capability stages — master table

Ordered by remaining work (Gap → Designed → Partial → Implemented), then priority.

| Capability (the job) | Stage | Pri | Designed? (`docs/design`) | Built? (code) |
|---|:--:|:--:|---|---|
| **Print stock inventory & auto-netting** | ⚪ Gap | P1 | ❌ not designed | ❌ absent (batch `qty_stock` is a snapshot, not a ledger) |
| **Configurable stock alerting** | ⚪ Gap | P2 | ❌ not designed (only aspirational "defina o mínimo" text) | ❌ only a hard-coded `LOW_STOCK_THRESHOLD = 10` tile |
| **Consumables / supply inventory (insumos)** | ⚪ Gap | P3 | ❌ not designed | ❌ absent |
| **Turnover / "giro" reporting** | ⚪ Gap | P3 | ❌ not designed (generic revenue chart only) | ❌ absent (4 other reports exist) |
| **Order-item → variation mapping (De/Para)** | 🔵 Designed | P1 | ✅ `pages/lotes.jsx` *Mapeamento* (De/Para + suggestion engine, progress, filters) | ❌ only the `Ad`↔`Product` link |
| **Order separation, labeling & check-out** | 🔵 Designed | P1 | ✅ `pages/separacao.jsx` (piece rows, 100×50 etiqueta + QR, scan-to-check) | ❌ `OrderItem` model + read-only list; workflow unwired |
| **Marketplace channel integration (OAuth)** | 🔵 Designed | P2 | ✅ `pages/settings.jsx` *Integrações* (tenant connect/sync) | ❌ placeholder stub, no backend |
| **Licensing / billing** | 🔵 Designed | P3 | ✅ `settings.jsx` Billing + `admin/plans.jsx` (no payment flow) | ❌ illustrative UI shell, no plan/billing model |
| **Print queue & send-to-press (per batch)** | 🟡 Partial | P1 | ✅ `pages/lotes.jsx` *Lotes* tab | 🟡 `BatchPrintAdjustment` qty-to-print + Montador send built; batch-scoped only |
| **Per-run production costing** | 🟡 Partial | P2 | ⚠️ unit/spec cost + cut consumo-variance designed; per-run cost ledger not | 🟡 aggregate costs report + spec cost inputs; no stored per-run record |
| **Granular / editable access control** | 🟡 Partial | P2 | ⚠️ read-only matrix designed; custom-role editor not | 🟡 RBAC + 3 fixed roles + read-only matrix; no custom-role backend |
| **Marketplace order intake (CSV/PDF→LLM, Upseller)** | 🟢 Implemented | — | ✅ `pages/sales.jsx` import modal | ✅ `orders_import` (Anthropic API); `/orders/import/{parse,commit,upseller}` |
| **Production pipeline (cut → sew → receive)** | 🟢 Implemented | — | ✅ `pages/production.jsx` | ✅ specs · fabric · cutting · sewing · receive-to-stock |
| **Finished-goods inventory & movements** | 🟢 Implemented | — | ✅ `pages/inventory.jsx` | ✅ stock levels + entry/exit audit |
| **Returns handling** | 🟢 Implemented | — | — (via order status) | ✅ status `returned` → `return` stock entry |
| **Sales / production / inventory / cost reporting** | 🟢 Implemented | — | ✅ `pages/reports-settings.jsx` | ✅ 4 report endpoints + tabs |
| **Dashboard KPIs** | 🟢 Implemented | — | ✅ `pages/dashboard.jsx` | ✅ KPIs/pipeline/needs-action/activity (revenue limited — see fidelity note) |
| **Multi-tenancy, members, invites, Console** | 🟢 Implemented | — | ✅ `settings.jsx` + `admin/*` | ✅ RBAC + invites + Console w/ impersonation (some console cards stub) |
| **Audit trail** | 🟢 Implemented | — | ✅ `settings.jsx` audit | ✅ `audit_logs` + filterable viewer |

> **P1 is one workspace.** Mapping, separation, and the per-batch print queue are the three tabs of a single
> designed *"Pedidos & expedição"* fulfillment workspace (`docs/design/pages/{lotes,separacao}.jsx`). Two tabs
> are 🔵 Designed-not-built, the Lotes tab is 🟡 Partial — so most P1 work is "implement the existing design."

---

## ⚪ Gaps — not designed, not built (need design first)

### Print stock inventory & auto-netting — P1
**The job.** Keep a ledger of **printed stamps on hand** (per design × color) and auto-net print demand against
it, so only the shortfall is printed. **Built:** nothing — `BatchPrintAdjustment.qty_stock` is a one-time snapshot
at batch creation, not a ledger; no print-stock fields on `print_design`. **Designed:** nothing — `docs/design`
has "qty to print per lote" (a decision) but no print-stock inventory screen. **To do:** design + build it; this is
the missing half of the print workflow (the queue/send half is Partial, below).
*Legacy reference:* `EstampaEstoque`, `AjusteEstampa` (the `impresso` ledger).

### Configurable stock alerting — P2
**The job.** Operator-set low-stock thresholds (per product/variation) + an actual alert. **Built:** only a
hard-coded `LOW_STOCK_THRESHOLD = 10` dashboard tile (`services/dashboard.py`). **Designed:** no threshold editor —
`pages/inventory.jsx` hard-codes 25/50% bands and only shows aspirational text ("Defina o mínimo…").
*Legacy reference:* `AlertaEstoque`.

### Consumables / supply inventory (insumos) — P3
**The job.** Track non-fabric supplies as their own inventory. **Built:** none. **Designed:** none — `inventory.jsx`
covers fabric + finished goods only. *Legacy reference:* `InsumoEstoque`.

### Turnover / "giro" reporting — P3
**The job.** Inventory turnover/velocity reporting. **Built:** `reports.py` has Sales/Production/Inventory/Costs but
no turnover metric. **Designed:** `reports-settings.jsx` only mentions "giro" in help text + a generic revenue chart.
*Legacy reference:* `RelatorioGiro.jsx`.

---

## 🔵 Designed, not built (implement the design)

### Order-item → variation mapping (De/Para) — P1
**The job.** Resolve each marketplace **order-item** (ad title + ad-variation) to the correct internal
**Product → Variation (SKU)**; the **estampa follows from the product** (not a separate per-color matrix). Unmapped
items can't proceed to separation. **Built:** only the `Ad`↔`Product` M:N + `imported_orders` snapshots. **Designed:**
`docs/design/pages/lotes.jsx` *Mapeamento* tab — full De/Para with a score-based `suggestMapping` engine,
Accept / Accept-all / Swap, a pending→linked progress bar, Pendentes/Vinculados/Todos filters, search, and
many-to-one SKU tracking. *Legacy reference:* `Memoria.jsx` (`InvokeLLM` suggestions), `Pedidos.jsx`,
`StampaMemory.combinacoes[]` (the Orion design intentionally drops the per-color matrix).

### Order separation, labeling & check-out — P1
**The job.** Pick each piece, print a label (tracking/QR, "1 of N"), scan to confirm; pending → labeled → checked.
**Built:** scaffolding only — `OrderItem` model + read-only `GET /orders/{id}/items`; **no transition endpoints, no
label generation, no picking UI** (the batch "Print Labels" button only flips batch status). **Designed:**
`docs/design/pages/separacao.jsx` — one row per physical piece, a 100×50mm etiqueta print modal with QR, and the
scan-to-check flow ("bipe o QR… libere a etiqueta de envio"). *Legacy reference:* `ItemPedido`, `ItemEstoque`,
`ImpressaoEtiquetaZPL`.

### Marketplace channel integration (OAuth) — P2
**The job.** Connect a tenant to a marketplace (ML/Shopee) and pull orders automatically. **Built:** none —
`settings/integrations` is a placeholder stub. **Designed:** `pages/settings.jsx` *Integrações* pane — tenant-facing
connect/configure cards with connected/available status and sync timestamps (Shopee, Mercado Livre, Shopify,
Instagram, WhatsApp, Claude, etc.). *Lower urgency if file import covers daily intake.*
*Legacy reference:* `ml*` functions, `MLToken`.

### Licensing / billing — P3
**The job.** Per-company plans, limits, expiry, billing. **Built:** `settings/billing` + `console/plans` are
illustrative UI shells with no model behind them. **Designed:** tenant `settings.jsx` Billing pane (plan/usage/
invoices, "cobrança ainda não habilitada") + `admin/plans.jsx` (plan catalog, limits, MRR) — but no payment flow.
*Legacy reference:* `Licenca`.

---

## 🟡 Partial — built, with gaps

### Print queue & send-to-press (per batch) — P1
**Built & working:** `services/batch.py` + `BatchPrintAdjustment` (qty_needed/qty_stock/qty_to_print/prints_sent),
operator edits via `PATCH /batches/{id}/adjustments`, `services/montador.py` sends to Montador DTF
(`POST /batches/{id}/send-to-montador`). **Designed:** `pages/lotes.jsx` *Lotes* tab. **Gap:** it's **batch-scoped**
(needs a hand-made batch) and can't net against real print stock (that inventory doesn't exist — see Gaps above).

### Per-run production costing — P2
**Built:** aggregate `reports.costs_report()` + `product_spec` cost inputs. **Designed:** unit/spec cost breakdown
(`catalog.jsx` Custo tab) and cutting consumo-variance (`production.jsx`). **Gap:** no **stored, viewable
cost-per-run record** (fabric/ribana/trims/labor/total + yield per cutting run) — neither designed nor built.
*Legacy reference:* `CustoProducao`, `Custos` tab.

### Granular / editable access control — P2
**Built:** real RBAC — 3 seeded roles (admin/manager/operator), 14 domains × `.read`/`.write`, enforced by
`RequirePermission` in `dependencies.py`; `settings/roles` renders a **read-only** matrix. **Designed:** the matrix
(`settings.jsx` Funções) — read-only, with a "Criar função personalizada" affordance but no editor. **Gap:** editable
/ custom roles (and finer grain if needed — legacy went to per-user sub-tab level).
*Legacy reference:* `permissoes` strings, `GerenciarUsuariosTab`, `PermissoesModal`.

---

## 🟢 Implemented (parity or better)

- **Marketplace order intake** — `services/orders_import.py` parses CSV + PDF (text via `pypdf` → **Anthropic
  Messages API**, one corrective retry); `/orders/import/{parse,commit,upseller}`. Designed in `sales.jsx`.
- **Production pipeline** — specs → fabric rolls → cutting (+ per-size outputs) → sewing → receive-into-stock.
- **Finished-goods inventory & movements** — stock levels + entry/exit movement audit.
- **Returns** — `OrderStatus = returned` reverses stock via a `return` stock entry (legacy `Devolucao` was unused).
- **Reporting & dashboard** — 4 report tabs + a rich dashboard (KPIs, pipeline, needs-action, activity, revenue-by-channel, sparklines).
- **Multi-tenancy, members, invites, Console** — company scoping + RBAC + invite flow + operator Console with real
  impersonation (some Console cards are "Em breve" placeholders).
- **Audit trail** — first-class `audit_logs` + filterable viewer (better than legacy `LogEntradaEstoque`).

---

## Appendix — Operational data fidelity (form, not capability)

Realities of the migration already run, regardless of how capabilities are rebuilt:
- **Imported orders carry no price or customer** → revenue/margin analytics and customer history are empty for historical orders.
- **Size coverage is narrower than legacy** (legacy had PP/XG/XXG, kids numerics, "Único"); rows outside Orion's
  size set didn't carry over. **If those sizes are sold today, the size model needs widening** — a real decision, not a footnote.
- **Separation & print-plan history** largely didn't carry over → rebuild the *capabilities* (P1), don't backfill rows.

## Appendix — Legacy artifact → capability reference

Migration mechanics (entity/field maps, counts, skip reasons) live in `backend/scripts/base44/mappings.py`
and `backend/scripts/base44/last_run_report.md`.

| Legacy artifact | Capability |
|---|---|
| `StampaMemory`, `Memoria.jsx`, `Pedidos.jsx` | Order-item → variation mapping (De/Para) |
| `AjusteEstampa`, `EstampaEstoque`, `TabelaEstampas.jsx` | Print stock & queue |
| `ItemPedido`, `ItemEstoque`, `ImpressaoEtiquetaZPL`, `etiquetas` | Order separation, labeling & check-out |
| `CustoProducao`, `Custos` tab | Per-run production costing |
| `MLToken`, `ml*` functions | Marketplace channel integration |
| `AlertaEstoque` | Stock alerting |
| `permissoes` strings, `GerenciarUsuariosTab`, `PermissoesModal` | Granular access control |
| `InsumoEstoque` | Consumables inventory |
| `Licenca` | Licensing / billing |
| `RelatorioGiro.jsx` | Turnover reporting |
| `Produto`, `BobinaTecido`, `OrdemCorte`, `BancaCostura`, `RemessaCostura` | Production pipeline 🟢 |
| `EntradaEstoque`, `SaidaEstoque` | Finished-goods inventory 🟢 |
| `Devolucao` → Returns 🟢 · `Company`/`Admin` → Multi-tenancy 🟢 · `LogEntradaEstoque` → Audit 🟢 | |
