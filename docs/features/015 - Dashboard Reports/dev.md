# Implementation Log — FEATURE-015: Dashboard + Reports
<!-- Written by Dev only. PM and QA do not read this file. -->

## Files Created

### Backend (already merged via foundation)
- `backend/src/schemas/dashboard.py` — wire shapes for /dashboard/summary
- `backend/src/schemas/reports.py` — wire shapes for /reports/{sales,production,inventory,costs}
- `backend/src/services/dashboard.py` — KPI rollup + pipeline + needs/activity
- `backend/src/services/reports.py` — date-range scoped reports
- `backend/src/routers/dashboard.py`, `backend/src/routers/reports.py`

### Dashboard frontend (already merged into foundation)
- `frontend/src/components/dashboard/{KpiCard,KpiStrip,GreetingHeader,ProductionPipeline,NeedsActionList,ActivityFeed}.tsx`
- `frontend/src/hooks/use-dashboard.ts`
- `frontend/src/lib/schemas/dashboard.ts`
- `frontend/src/app/[locale]/(app)/page.tsx`

### Reports frontend (this PR — `feature/015-reports-frontend`)
- `frontend/src/lib/schemas/reports.ts` — Zod schemas mirroring the backend (Sales, Production, Inventory, Costs + a `ReportDateRange` helper type).
- `frontend/src/hooks/use-reports.ts` — four hooks (`useSalesReport`, `useProductionReport`, `useInventoryReport`, `useCostsReport`), each keyed on `(user.uid, date_from, date_to)` and gated on `!loading && !!user`, `staleTime: 60s`.
- `frontend/src/app/[locale]/(app)/reports/{page.tsx,loading.tsx,error.tsx}` — page shell, defaulting to a 90-day window.
- `frontend/src/components/reports/ChartCard.tsx` — reusable surface card with built-in skeleton + empty state.
- `frontend/src/components/reports/ReportTabs.tsx` — 4-tab switcher (shadcn Tabs / `line` variant).
- `frontend/src/components/reports/DateRangePicker.tsx` — popover with 3 presets (7/30/90d) + custom date inputs.
- `frontend/src/components/reports/SalesTab.tsx` — `total_revenue` + `total_count` KPI tiles, `by_channel` pie, `by_status` bar, `by_day` line.
- `frontend/src/components/reports/ProductionTab.tsx` — scrap KPI + window-pieces KPI, cutting + sewing throughput line charts.
- `frontend/src/components/reports/InventoryTab.tsx` — horizontal stock-levels bar chart + slow-movers table.
- `frontend/src/components/reports/CostsTab.tsx` — spec-cost table + fabric cost-per-kg bar chart.
- `frontend/src/components/reports/__tests__/SalesTab.test.tsx`, `ProductionTab.test.tsx` — vitest unit tests, mocking the hook + ResponsiveContainer.
- `frontend/e2e/reports.spec.ts` — Playwright smoke covering tab navigation, page chrome, and the date range popover.

## Files Modified
- `frontend/messages/en.json`, `frontend/messages/pt-BR.json` — fleshed out the `reports` namespace (page/list/tabs/dateRange/sales/production/inventory/costs/charts). pt-BR uses the design source copy ("Indicadores" eyebrow, "Vendas/Produção/Estoque/Custos", "Últimos 90 dias").

## Migration Notes
- None on the reports-frontend slice. The four backend endpoints + their schemas were already merged into foundation. No new Alembic migrations.

## Dev Notes

### Design fidelity
- Reports page uses `PageHead subColor="var(--brand-reports)"` so the eyebrow chip + emphasized italic title pick up the deep-blue brand (`#1e40af`).
- ChartCard is a direct port of the design's `.card`: surface bg, line border, 14px radius, 14×18 header with serif title and optional sub.
- Tab list uses the shadcn `line` variant which most closely matches the design's `<Seg/>` underline-marker look (no chunky pill).
- Chart palette deliberately spreads brand tokens across categories: pie (channels) uses brand-sales + complementary hues so it's distinct from the brand-reports line chart that follows.

### Recharts type signatures
- Recharts 3.x's `Tooltip.formatter` is typed as a multi-arg `Formatter<ValueType, NameType>`. The naive `(value: number) => string` form doesn't satisfy that constraint; we let TS infer and `Number(value)` inside instead. This is the same pattern already in `src/components/ui/chart.tsx`.

### React Compiler lint
- The DateRangePicker initially re-seeded its draft inputs via `useEffect(setX, [value])`. The repo's `react-hooks/no-cascading-renders` rule (React Compiler ruleset) flags this. Replaced with an inline reset inside `handleOpenChange(open)` — the draft only needs to be in sync when the popover opens.

### Query keys
- Reused the existing `qk.reports.one(slug, params)` factory in `lib/query-keys.ts`. The params object includes the uid (so cache resets across sign-ins) plus the date bounds (so range changes get their own cache slot).

### Backend gotcha (already in foundation, called out for QA)
- All four reports endpoints are gated on `orders.read` for v1; there's no `reports.read` permission seeded yet. Anyone with order-read access can hit the page. This matches the dashboard endpoint's approach.
