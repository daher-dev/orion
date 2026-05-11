# Implementation Log — FEATURE-013: Sales — Orders

## Files Created

### Backend
- `backend/src/schemas/order.py` — Pydantic schemas: `OrderCreate`, `OrderUpdate`, `OrderRead`, `OrderFilters`, `OrderPage`, `OrderStatusTransition`, plus the embedded `OrderAdRead`, `OrderVariationRead`, `OrderProductMini`, `OrderClientRead`.
- `backend/src/services/order.py` — Service layer with `list_orders`, `get_order`, `create_order`, `update_order`, `transition_status`, `delete_order`. Holds the `_FORWARD` transition map, side effects (StockExit on `shipped`, StockEntry on `returned`), and the delete guard against existing stock movements.
- `backend/src/routers/orders.py` — HTTP layer exposing `GET /v1/orders`, `GET /v1/orders/{id}`, `POST /v1/orders`, `PATCH /v1/orders/{id}`, `POST /v1/orders/{id}/status`, `DELETE /v1/orders/{id}`. Permission gate: router-level `orders.read`, inline `orders.write` on every mutation.
- `backend/tests/test_services/test_order_service.py` — 37 service tests covering create/get/list/update/transition/delete and the matrix of allowed transitions + side effects.
- `backend/tests/test_routers/test_order_router.py` — 24 router/integration tests covering tenant isolation, auth, operator permissions, status transitions and the 409 delete-guard.

### Frontend
- `frontend/src/lib/schemas/order.ts` — Zod schemas + helper utilities (`ALLOWED_TRANSITIONS`, `canTransition`, `phaseIndex`, `buildOrderCreatePayload`, `ORDER_TIMELINE_PHASES`).
- `frontend/src/hooks/use-orders.ts` — TanStack Query hooks `useOrders`, `useOrder`, `useCreateOrder`, `useUpdateOrder`, `useTransitionOrderStatus`, `useDeleteOrder`. The transition hook invalidates `qk.stock.all()` to cascade stock movements.
- `frontend/src/components/orders/OrdersTable.tsx` — `.tbl` port with channel chip + product+variation cell + status pill + value + delete confirmation. Exposes the `shortOrderCode` helper reused by the detail header.
- `frontend/src/components/orders/OrderStatusPill.tsx` — Tone-mapped pill mirroring `.pill.{warn,info,ok,err,muted}` from the design.
- `frontend/src/components/orders/OrderChannelChip.tsx` — Re-uses the existing `CHANNEL_THEME` palette from F-012 Ads to keep parity across the Sales section.
- `frontend/src/components/orders/OrderStatusTimeline.tsx` — Horizontal 4-phase rail (pending → paid → shipped → delivered) with click-to-transition wiring guarded by `canTransition()`.
- `frontend/src/components/orders/OrderLineItem.tsx` — Variation card with garment glyph, color, size badge and unit price.
- `frontend/src/components/orders/OrderDetailHeader.tsx` — Back link + code + status pill + channel chip + edit/delete actions.
- `frontend/src/components/orders/OrderForm.tsx` — Client combobox + ad combobox (cascades the product → variations) + qty/price/date/external ID. Cascaded variation `<select>` because Radix `Select` doesn't play with dynamic option lists in the existing test setup.
- `frontend/src/components/orders/OrderFormSheet.tsx` — Sheet wrapping the form. After create, navigates to `/orders/{id}` unless `navigateOnCreate={false}` (used on the detail-page edit flow).
- `frontend/src/components/orders/OrdersEmptyState.tsx` — Empty state with terracotta tile + CTA gated by `canWrite`.
- `frontend/src/app/[locale]/(app)/orders/page.tsx` — List with search + status + channel filters.
- `frontend/src/app/[locale]/(app)/orders/[id]/page.tsx` — Detail with customer block + ad block + line item + timeline + transition rail (cancel + return side actions).
- `frontend/src/app/[locale]/(app)/orders/new/page.tsx` — Standalone wrapper around the sheet (matches Ads pattern).
- `frontend/src/app/[locale]/(app)/orders/{loading,error}.tsx` — Skeleton + error reset.
- `frontend/src/components/orders/__tests__/OrdersTable.test.tsx`, `OrderForm.test.tsx`, `OrderStatusTimeline.test.tsx` — 11 Vitest tests.
- `frontend/src/hooks/__tests__/use-orders.test.ts` — 7 MSW-backed hook tests.
- `frontend/e2e/orders.spec.ts` — Playwright E2E suite (empty state, list+filter, detail+timeline transitions, delete-blocked-on-stock-exit, delete-happy-path).

## Files Modified
- `backend/src/routers/__init__.py` — Registered `orders_router` in alphabetical order.
- `frontend/messages/en.json`, `frontend/messages/pt-BR.json` — Populated the `orders` namespace (≈140 keys per locale, all parity-checked by `i18n:lint`).

## Migration Notes
- No new migrations. The `Order`, `StockEntry`, `StockExit` tables were already part of the foundation migration. The `(company_id, ad_id, external_order_id)` partial-unique index lives on the model.

## Dev Notes
- **Transition map** lives in `services/order.py::_FORWARD`. Mirror copy on the frontend (`ALLOWED_TRANSITIONS` in `lib/schemas/order.ts`) keeps the UI buttons in sync with what the API will accept — both must change together if the rules evolve.
- **Stock side effects** are idempotent: re-shipping skips the StockExit insert when one already exists for the order; returning skips the StockEntry insert when no exit ever happened (cancel-from-paid path). Tests cover both edges.
- **Delete guard** uses a `StockExit` row count rather than the status field so manual stock corrections that leave the order at `paid` still block the delete.
- **Variation cascade**: when the operator picks an ad, the form fetches `/v1/products/{ad.product_id}` and uses its `variations[]`. We picked an OS-native `<select>` for the variation step to keep the form working in the test harness without further Radix mocks.
- **Channel chip parity**: reuses `CHANNEL_THEME` exported from `AdsGrid.tsx` to share the brand colors between Ads and Orders. If a third Sales feature consumes it, hoist the constant to `lib/sales/channels.ts`.
- **Timeline disabled state**: the timeline buttons are clickable for forward transitions only when `canTransition(current, target)` returns true; the destructive `cancel`/`return` actions sit on a separate rail below the timeline so the linear flow stays clean.
- **Audit messages** follow `Created order ORD-XXXX`, `Edited order ORD-XXXX field <name>`, `Marked order ORD-XXXX as <STATUS> (was <PREV>)`, `Deleted order ORD-XXXX`. The 8-char short hex is the same scheme used by Cutting (`OC-XXXX`).
- **Coverage** for the new modules:
  - `backend/src/schemas/order.py` — 100%
  - `backend/src/routers/orders.py` — 100%
  - `backend/src/services/order.py` — 99% (one defensive fallback audit-message line)

## Outstanding
- The frontend dev-bypass auth flow needed for the e2e suite assumes the local DB has been reset via `scripts/reset-test-db.sh`. The spec recommends running that before invoking `task test:e2e`.
- The "activity rail" mentioned in the design is currently not surfaced — the timeline + audit log entries cover the same data. A future iteration can add a dedicated audit-log filter scoped to the order's `resource_id`.
