---
id: FEATURE-013
slug: sales-orders
title: Sales — Orders (Pedidos)
status: in-progress
created: 2026-05-11
updated: 2026-05-11
branch: feature/013-orders
---

# FEATURE-013: Sales — Orders (Pedidos)

## Problem Statement
A sale only becomes traceable once it is captured as an `Order` linking a
`Client` to an `Ad` to a `ProductVariation` at a known sale price. Without
the manual order surface, the team cannot:

- attribute revenue to a channel/ad,
- reduce stock when a piece is shipped,
- reverse a movement when an order is returned,
- inspect the lifecycle (timeline) of any single order.

This feature ships the manual CRUD + status-transition surface for orders,
the server-paginated multi-channel list, and the detail page with the
clickable status timeline. CSV/LLM/webhook import is deferred to F-014.

## User Stories
- As a manager, I want to see every order in a single multi-channel list
  with channel chip, status pill, client, value, so I can scan the day's
  sales at a glance.
- As a manager, I want to filter by status, channel and client.
- As a manager, I want to register a new order manually (pick client, pick
  ad which cascades into the product, pick a variation, set qty & price).
- As a manager, I want to open an order and see the timeline plus all the
  references (client block, ad block, variation card).
- As a manager, I want to transition the order through
  `pending → paid → shipped → delivered` from the detail page. When I mark
  it `shipped`, the system should automatically decrement stock for the
  variation. When I mark it `returned`, the system should re-add stock.
- As a manager, I want to delete a draft order, but I cannot delete an
  order that has already shipped (stock has moved).
- As an operator (read-only on orders), I should see the list and detail
  but no actions.

## Acceptance Criteria
1. [ ] Given I have orders across multiple channels and statuses, when I
   open `/orders`, then I see a server-paginated table with columns:
   code, channel chip, client, product+variation, quantity, value,
   status pill, ordered_at.
2. [ ] Given I type a query, when the search debounces, then only orders
   whose client name, product name or external order id match remain.
3. [ ] Given I pick a status from the status segmented control, when the
   page updates, then only orders in that status are shown.
4. [ ] Given I pick a channel and/or a client, when the page updates,
   then only matching orders are shown.
5. [ ] Given I click `New order`, when I submit a valid form, then the
   order is created in `pending` status and I land on its detail page.
6. [ ] Given I am on `/orders/{id}` and click `Mark paid`, then the
   status pill flips, the timeline advances, an audit-log entry is
   written, and the detail data refreshes.
7. [ ] Given I am on an order in `paid` and I click `Mark shipped`, then
   the status flips to `shipped` AND a `StockExit` (reason=`sale`,
   `quantity=order.quantity`) is created for the variation.
8. [ ] Given I am on an order in `shipped` and click `Return`, then the
   status flips to `returned` AND a `StockEntry` (source=`return`,
   `quantity=order.quantity`) is created to reverse the exit.
9. [ ] Given I am on an order in `pending`, when I click `Delete` and
   confirm, then it is removed and an audit entry is written.
10. [ ] Given an order already shipped (has a `StockExit`), when I try to
    delete it, the API returns 409 and the UI shows a "stock has moved"
    toast — the order is not deleted.
11. [ ] Given the same ad is used twice with the same `external_order_id`
    string, the second create returns 409 (uniqueness violated).
12. [ ] Given I am an operator without `orders.write`, when I open the
    list or detail, then I see the data but no create/edit/transition/
    delete affordances.
13. [ ] Given an unauthenticated request hits `/v1/orders`, then 401.

## User Flows

### Happy Path — create
1. Manager opens `/orders`.
2. Clicks `New order` in the page-head.
3. Sheet (or `/orders/new` page) opens with: client combobox, ad
   combobox (cascades the product), variation combobox (filtered by
   product), quantity, unit sale price, ordered_at, optional external
   order id.
4. Manager fills and submits. Order is created in `pending` status,
   sheet closes, toast `Order created` fires and the manager lands on
   the detail page.

### Happy Path — ship + deliver
1. Manager opens an order in `paid`.
2. Clicks `Mark shipped`. Status pill turns blue, timeline highlights
   the `shipped` phase, audit log lists `Marked order ORD-XXXX as
   SHIPPED`, and a `StockExit` row is written.
3. Manager later clicks `Mark delivered`. Final phase highlighted.

### Happy Path — return
1. Manager opens an order in `delivered` (or `shipped`).
2. Clicks `Return`. Status flips to `returned`, audit log lists
   `Marked order ORD-XXXX as RETURNED`, and a `StockEntry` (source =
   `return`) reverses the exit.

### Edge Cases
- Attempting an illegal transition (e.g. `pending → shipped` without
  going through `paid`) returns 409 with a clear detail.
- Cancelling is allowed from any non-final state (not `delivered` /
  `returned`).
- Deleting an order that already has a `StockExit` is blocked with 409.
- Re-using the same `(ad_id, external_order_id)` pair returns 409.
- The variation must belong to the same product the ad points to —
  otherwise create returns 422.

## Scope

### In Scope
- CRUD for `Order`: `ad_id`, `variation_id`, `client_id`, `quantity`,
  `sale_price`, `ordered_at`, `status`, `external_order_id`.
- List + filter (q, status, channel, client_id, ad_id, date range) +
  pagination.
- Detail page with: status pill, client block, ad block, variation
  card, status timeline.
- Status-transition endpoint `POST /v1/orders/{id}/status`. Side effects:
  `shipped` writes `StockExit`; `returned` writes `StockEntry` to reverse.
- Tenant-scoped queries; `orders.read` on the router, `orders.write`
  inline on writes.
- Audit-log on every mutation (create, update, transition, delete).

### Out of Scope
- CSV/PDF/webhook import flows (covered by F-014).
- Channel-side push of the new order back to the ecommerce.
- Multi-line orders (one Order row carries a single variation; multiple
  pieces of the same variation are expressed via `quantity`).
- Partial returns (entire order is reversed on `returned`).

## UI/UX Notes
- Page eyebrow `Sales` / `Vendas`, terracotta `--brand-sales`.
- Title `Orders`, italic suffix `multi-channel` / `multi-canal`.
- List card uses the design's `.tbl`. Hover row turns `--bg`.
- Each row shows: `#ORD-XXXX` + external id underneath in mono,
  `ChannelChip` (mirrors the Ads palette), product + variation mini,
  qty (tabular), `StatusPill`, `ordered_at` formatted, value in BRL.
- Detail page: header (back link, code, status pill, ordered_at),
  client block, ad block, variation card, timeline. The timeline is a
  horizontal rail with five phases:
  `pending → paid → shipped → delivered`, plus a destructive `Return`
  side action and `Cancel` side action.
- Pills follow `.pill.warn` (pending), `.pill.info` (paid/shipped),
  `.pill.ok` (delivered), `.pill.err` (cancelled), `.pill` muted
  (returned).
- Delete uses the same `AlertDialog` pattern as Clients/Ads, and rejects
  with a toast when the API answers 409.
- Create form has client combobox, ad combobox (cascades product),
  variation select (filtered by product), qty stepper, sale_price input
  with BRL prefix, ordered_at date picker, optional external id.

## i18n Keys
Both EN and PT-BR strings live in the `orders` namespace.

| Key | EN | PT-BR |
|-----|----|-------|
| `orders.page.eyebrow` | Sales | Vendas |
| `orders.list.title` | Orders | Pedidos |
| `orders.list.titleEm` | multi-channel | multi-canal |
| `orders.list.sub` | Track every order from every channel in one place. | Acompanhe todos os pedidos em um só lugar. |
| `orders.list.empty.title` | No orders yet | Nenhum pedido ainda |
| `orders.list.empty.body` | Create your first order or wait for a channel webhook to drop one in. | Crie seu primeiro pedido ou aguarde a chegada via canal. |
| `orders.list.empty.cta` | New order | Novo pedido |
| `orders.list.noResults` | No orders match these filters. | Nenhum pedido corresponde aos filtros. |
| `orders.list.loadError` | Could not load orders. | Não foi possível carregar os pedidos. |
| `orders.filters.searchPlaceholder` | Search order… | Procurar pedido… |
| `orders.filters.status` | Status | Status |
| `orders.filters.statusAll` | All | Todos |
| `orders.filters.channel` | Channel | Canal |
| `orders.filters.channelAll` | All channels | Todos os canais |
| `orders.filters.client` | Client | Cliente |
| `orders.filters.clientAll` | All clients | Todos os clientes |
| `orders.statuses.pending` | Pending | Pendente |
| `orders.statuses.paid` | Paid | Pago |
| `orders.statuses.shipped` | Shipped | Enviado |
| `orders.statuses.delivered` | Delivered | Entregue |
| `orders.statuses.cancelled` | Cancelled | Cancelado |
| `orders.statuses.returned` | Returned | Devolvido |
| `orders.channels.shopee` | Shopee | Shopee |
| `orders.channels.mercado_livre` | Mercado Livre | Mercado Livre |
| `orders.channels.shopify` | Shopify | Shopify |
| `orders.channels.instagram` | Instagram | Instagram |
| `orders.channels.whatsapp` | WhatsApp | WhatsApp |
| `orders.channels.other` | Other | Outro |
| `orders.table.columns.code` | Order | Pedido |
| `orders.table.columns.channel` | Channel | Canal |
| `orders.table.columns.client` | Client | Cliente |
| `orders.table.columns.product` | Product | Produto |
| `orders.table.columns.qty` | Qty | Qtd |
| `orders.table.columns.value` | Value | Valor |
| `orders.table.columns.status` | Status | Status |
| `orders.table.columns.orderedAt` | Date | Data |
| `orders.table.columns.actions` | Actions | Ações |
| `orders.actions.create` | New order | Novo pedido |
| `orders.actions.edit` | Edit | Editar |
| `orders.actions.delete` | Delete | Excluir |
| `orders.actions.confirmDelete` | Delete this order? This cannot be undone. | Excluir este pedido? Não pode ser desfeito. |
| `orders.actions.markPaid` | Mark paid | Marcar como pago |
| `orders.actions.markShipped` | Mark shipped | Marcar como enviado |
| `orders.actions.markDelivered` | Mark delivered | Marcar como entregue |
| `orders.actions.cancel` | Cancel order | Cancelar pedido |
| `orders.actions.returnOrder` | Return order | Devolver pedido |
| `orders.actions.back` | Back to orders | Voltar para pedidos |
| `orders.detail.customerBlock` | Customer | Cliente |
| `orders.detail.adBlock` | Ad | Anúncio |
| `orders.detail.lineItem` | Item | Item |
| `orders.detail.statusTimeline` | Timeline | Linha do tempo |
| `orders.detail.activityRail` | Activity | Atividade |
| `orders.detail.externalCode` | External code | Código externo |
| `orders.detail.unitPrice` | Unit price | Valor unitário |
| `orders.detail.total` | Total | Total |
| `orders.detail.placedOn` | Placed on {date} | Realizado em {date} |
| `orders.form.title.new` | New order | Novo pedido |
| `orders.form.title.edit` | Edit order | Editar pedido |
| `orders.form.labels.client` | Client | Cliente |
| `orders.form.labels.ad` | Ad | Anúncio |
| `orders.form.labels.variation` | Variation | Variação |
| `orders.form.labels.quantity` | Quantity | Quantidade |
| `orders.form.labels.salePrice` | Unit price | Valor unitário |
| `orders.form.labels.orderedAt` | Order date | Data do pedido |
| `orders.form.labels.externalOrderId` | External order ID | ID externo |
| `orders.form.placeholders.client` | Pick a client | Selecione um cliente |
| `orders.form.placeholders.ad` | Pick an ad | Selecione um anúncio |
| `orders.form.placeholders.variation` | Pick a variation | Selecione uma variação |
| `orders.form.placeholders.externalOrderId` | Optional channel order id | ID opcional do canal |
| `orders.form.placeholders.searchClient` | Search client… | Procurar cliente… |
| `orders.form.placeholders.searchAd` | Search ad… | Procurar anúncio… |
| `orders.form.validation.clientRequired` | Client is required | Cliente obrigatório |
| `orders.form.validation.adRequired` | Ad is required | Anúncio obrigatório |
| `orders.form.validation.variationRequired` | Variation is required | Variação obrigatória |
| `orders.form.validation.quantityPositive` | Quantity must be at least 1 | Quantidade deve ser ao menos 1 |
| `orders.form.validation.pricePositive` | Price must be zero or greater | Preço não pode ser negativo |
| `orders.form.save` | Save | Salvar |
| `orders.form.cancel` | Cancel | Cancelar |
| `orders.form.toasts.created` | Order created | Pedido criado |
| `orders.form.toasts.updated` | Order updated | Pedido atualizado |
| `orders.form.toasts.deleted` | Order deleted | Pedido excluído |
| `orders.form.toasts.transitioned` | Order updated | Pedido atualizado |
| `orders.form.toasts.error` | Could not save the order. | Não foi possível salvar o pedido. |
| `orders.form.toasts.deleteBlocked` | This order already shipped — stock has moved. | Pedido já enviado — o estoque foi movimentado. |
| `orders.fallback.forbidden` | You don't have access to orders. | Você não tem acesso aos pedidos. |
| `orders.timeline.pending` | Received | Recebido |
| `orders.timeline.paid` | Paid | Pago |
| `orders.timeline.shipped` | Shipped | Enviado |
| `orders.timeline.delivered` | Delivered | Entregue |
| `orders.timeline.cancelled` | Cancelled | Cancelado |
| `orders.timeline.returned` | Returned | Devolvido |

## API Contract
| Method | Path | Request Body | Response | Purpose |
|--------|------|-------------|----------|---------|
| GET | `/v1/orders` | — (filters: `q`, `status`, `channel`, `client_id`, `ad_id`, `date_from`, `date_to`, `page`, `page_size`) | `OrderPage` | List with filter + pagination |
| GET | `/v1/orders/{id}` | — | `OrderRead` | Single order |
| POST | `/v1/orders` | `OrderCreate` | `OrderRead` (201) | Create |
| PATCH | `/v1/orders/{id}` | `OrderUpdate` | `OrderRead` | Partial update of price / date / external id / status |
| POST | `/v1/orders/{id}/status` | `OrderStatusTransition` (`{status}`) | `OrderRead` | Validated transition (with side effects on shipped/returned) |
| DELETE | `/v1/orders/{id}` | — | `204` (or `409` if stock has moved) | Delete |

`OrderRead` shape:
```
{
  id, ad: {id, title, ecommerce},
  variation: {id, sku, size, color, color_code, product: {id, name, code}},
  client: {id, name, email?},
  quantity, sale_price, ordered_at, status, external_order_id,
  created_at, updated_at
}
```

## Seed Data Requirements
- 1 company, 1 client, 1 product with one variation, 1 ad pointing at
  that product. The test suite builds these per test via factories — no
  permanent seed file is needed because Orders is exercised end-to-end
  by the QA Playwright spec rather than via fixtures.
