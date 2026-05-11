---
id: FEATURE-015
slug: dashboard-reports
title: Dashboard + Reports
status: in-progress
created: 2026-05-11
updated: 2026-05-11
branch: feature/015-dashboard-reports
---

# FEATURE-015: Dashboard + Reports

## Problem Statement

The home page is currently a "Welcome to Orion" placeholder. With 13 features
already in place (sales, production, inventory) the tenant needs a single
landing surface that summarises the state of the operation today, and a deeper
reports area to slice the data by date range and dimension. This feature
replaces the placeholder with the production dashboard and adds the
`/reports` page with four tabs (Sales, Production, Inventory, Costs).

## User Stories

- As an admin, I want a 5-card KPI strip on the home page so I see the day's
  pulse without clicking anywhere.
- As an admin, I want a production pipeline visual that shows where pieces
  are stuck (pending → cutting → sewing → stock → shipped) so I can spot
  bottlenecks.
- As an admin, I want a "needs action" list with the top pending items
  (orders waiting payment, fabric low, shipments overdue) so I know what to
  open next.
- As an admin, I want a recent activity feed (last 20 audit events) so I see
  what my team did.
- As an admin, I want a `/reports` page with Sales / Production / Inventory
  / Costs tabs so I can cross-cut analytics.
- As an admin, I want each report tab to support a date range so I can
  compare windows.

## Acceptance Criteria

1. [x] Given an authenticated user with `orders.read`, when they visit `/`,
   then the Dashboard page renders the greeting (Bom dia/tarde/noite +
   first name), a KPI strip of five cards, the production pipeline visual,
   and the two-column "needs action" + activity feed.
2. [x] Given the user visits `/reports`, then four tabs (Sales, Production,
   Inventory, Costs) are visible and the deep-blue brand color
   `--brand-reports` is used for the eyebrow and title emphasis.
3. [x] Given a user without `orders.read`, when they hit
   `GET /v1/dashboard/summary` or `GET /v1/reports/...`, then the backend
   returns 403.
4. [x] Given an unauthenticated request to the same endpoints, then the
   backend returns 401.
5. [x] Given the company has no orders / cutting / sewing / stock rows,
   when the dashboard loads, then every KPI shows 0, the pipeline shows
   five zero cards, and the activity feed shows an empty state.
6. [x] Given the user visits the Sales tab with a date range, when the date
   range changes, then the response reflects only orders within that range.
7. [x] All user-facing strings (greeting templates, KPI labels, pipeline
   stage names, tab labels, empty states, etc.) flow through
   `useTranslations()` with both `en` and `pt-BR` values.

## User Flows

### Happy Path — Dashboard

1. Admin logs in and lands on `/`.
2. Page shows "Boa tarde, Joana" (time-based greeting + first name) and a
   sub-line like "Here is your operation today, 11 May".
3. KPI strip: Orders pending · Cutting in progress · Sewing out · Low stock
   · Revenue (last 30 days). Each card has a label, a big value, and (if
   data exists) a delta vs the previous comparable window.
4. Production pipeline visual: 5 cards (Pending, Cutting, Sewing, Stock,
   Shipped 30d) each with a count and a coloured stripe at the top.
5. Two-column row: "Needs action" (top pending items) and "Recent activity"
   (last 20 audit events).

### Happy Path — Reports

1. Admin clicks "Reports" in the sidebar.
2. Top of the page shows the deep-blue eyebrow, title "Reports & analytics",
   and a date range picker (default last 30 days).
3. Tabs: Sales (default), Production, Inventory, Costs.
4. Each tab renders its own panel (charts + tables/lists). Switching tabs
   is purely client-side; data fetches by tab.

### Edge Cases

- Empty company (no rows in any table) → every endpoint returns sane zeros
  and empty arrays, the UI shows empty states.
- A user with no orders permission gets 403 and the reports nav still shows
  but the page returns the same error envelope (handled by the global
  router-level dependency).

## Scope

### In Scope

- Backend aggregations over existing tables — orders, cutting orders,
  sewing shipments, stock movements, audit log.
- One `GET /v1/dashboard/summary` endpoint.
- Four `GET /v1/reports/{sales,production,inventory,costs}` endpoints.
- Two new pages: dashboard (replaces home) + `/reports` with 4 tabs.
- Six new components on the dashboard side, four tabs on the reports side.

### Out of Scope

- CSV export (button is rendered but not wired in v1).
- Customizable date range comparator (we ship a single fixed comparator:
  last-30-days vs previous-30-days for KPI deltas).
- Realtime updates — TanStack `staleTime: 30s` + window focus refresh.
- A dedicated `reports.read` permission (we gate everything on
  `orders.read` for v1 and document this in `dev.md`).

## UI/UX Notes

- Match `/docs/design/source/pages/dashboard.jsx` and
  `/docs/design/source/pages/reports-settings.jsx` faithfully.
- Dashboard accent: default indigo (`--accent`). Reports accent: deep blue
  (`--brand-reports = #1e40af`).
- Pipeline card uses brand colours per stage:
  Pending=sales, Cutting=prod, Sewing=prod, Stock=inv, Shipped=accent.
- Charts use `recharts` (already a dep).

## i18n Keys

| Key | EN | PT-BR |
|-----|-----|-------|
| `dashboard.page.eyebrow` | Home | Início |
| `dashboard.greeting.morning` | Good morning | Bom dia |
| `dashboard.greeting.afternoon` | Good afternoon | Boa tarde |
| `dashboard.greeting.evening` | Good evening | Boa noite |
| `dashboard.sub` | Here is your operation today, {date}. | Aqui está o panorama da sua operação hoje, {date}. |
| `dashboard.kpis.ordersPending` | Pending orders | Pedidos pendentes |
| `dashboard.kpis.ordersRevenue` | Revenue (30 days) | Receita (30 dias) |
| `dashboard.kpis.cuttingPending` | Cutting in progress | Cortes em andamento |
| `dashboard.kpis.stockLow` | Low stock SKUs | SKUs em baixa |
| `dashboard.kpis.bancaActive` | At bancas | Em bancas |
| `dashboard.pipeline.title` | Production pipeline | Pipeline de produção |
| `dashboard.pipeline.sub` | Where your pieces are right now | Onde estão suas peças neste momento |
| `dashboard.pipeline.stages.pending` | Orders | Pedidos |
| `dashboard.pipeline.stages.cutting` | Cutting | Corte |
| `dashboard.pipeline.stages.sewing` | Sewing | Costura |
| `dashboard.pipeline.stages.stock` | Stock | Estoque |
| `dashboard.pipeline.stages.shipped` | Shipped (30d) | Despachado (30d) |
| `dashboard.needsAction.title` | Needs your attention | Precisa da sua atenção |
| `dashboard.needsAction.empty` | All clear — nothing waiting. | Tudo certo — nada pendente. |
| `dashboard.activity.title` | Recent activity | Atividade recente |
| `dashboard.activity.empty` | No activity yet. | Sem atividade ainda. |
| `dashboard.activity.system` | System | Sistema |
| `reports.page.eyebrow` | Reports | Indicadores |
| `reports.title` | Reports | Relatórios |
| `reports.titleEm` | & analytics | & análises |
| `reports.sub` | Cross-cut data from sales, production, stock and costs. | Cruze dados de vendas, produção, estoque e custos. |
| `reports.tabs.sales` | Sales | Vendas |
| `reports.tabs.production` | Production | Produção |
| `reports.tabs.inventory` | Inventory | Estoque |
| `reports.tabs.costs` | Costs | Custos |
| `reports.dateRange.last7d` | Last 7 days | Últimos 7 dias |
| `reports.dateRange.last30d` | Last 30 days | Últimos 30 dias |
| `reports.dateRange.last90d` | Last 90 days | Últimos 90 dias |

## API Contract

| Method | Path | Request Body | Response | Purpose |
|--------|------|-------------|----------|---------|
| GET | `/v1/dashboard/summary` | — | `DashboardSummary` | KPI strip, pipeline, needs-action, activity feed |
| GET | `/v1/reports/sales` | query `date_from`, `date_to` | `SalesReport` | Sales report (channel, status, day breakdown) |
| GET | `/v1/reports/production` | query `date_from`, `date_to` | `ProductionReport` | Cutting + sewing throughput per day, scrap % |
| GET | `/v1/reports/inventory` | — | `InventoryReport` | Stock levels + slow movers |
| GET | `/v1/reports/costs` | — | `CostsReport` | Spec costs + fabric cost per kg |

All endpoints gated on `orders.read` for v1 (see dev.md).

## Seed Data Requirements

The existing factories and `scripts/seed_dev.py` already produce enough rows
to exercise every aggregation. No new seed data is required.
