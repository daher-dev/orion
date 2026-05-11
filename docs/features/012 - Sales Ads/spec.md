---
id: FEATURE-012
slug: sales-ads
title: Sales — Ads (Anúncios)
status: in-progress
created: 2026-05-10
updated: 2026-05-10
branch: feature/012-ads
---

# FEATURE-012: Sales — Ads (Anúncios)

## Problem Statement
An ad (anúncio) is the link between a Product in the catalog and an
ecommerce channel listing — Shopee, Mercado Livre, Shopify, Instagram or
WhatsApp. Without this link, orders cannot be attributed back to a
product, the dashboard cannot break revenue down by channel, and
operators cannot tell which catalog item is being sold where.

This feature ships the CRUD surface for Ads and the gallery-style page
that lets a manager see, search and curate every ad grouped by its
channel.

## User Stories
- As a manager, I want to see every active listing organised by channel
  so I can compare coverage across Shopee, Mercado Livre, Shopify,
  Instagram and WhatsApp at a glance.
- As a manager, I want to click an ad to edit its title, channel,
  external id or linked product.
- As a manager, I want to register a new ad in a side sheet (or new
  page) without losing my place in the grid.
- As a manager, I cannot delete an ad while orders still reference it,
  to avoid orphaning sales history.

## Acceptance Criteria
1. [ ] Given I have at least one ad in each channel, when I open
   `/ads`, then I see one section per channel with the ads as cards in a
   responsive grid.
2. [ ] Given I type a query, when the search debounces, then only ads
   whose title, external id or product name match remain.
3. [ ] Given I pick a channel from the channel filter, when the page
   updates, then only ads from that channel are shown.
4. [ ] Given I click `New ad`, when I submit a valid form, then the new
   card appears in the right channel section and a success toast fires.
5. [ ] Given I click an ad card, when the side sheet opens, then I can
   edit every field. Saving updates the card without a full reload.
6. [ ] Given an ad has one or more linked Orders, when I confirm a
   delete, then the API returns 409 and the UI surfaces a "linked
   orders" toast — the ad is **not** deleted.
7. [ ] Given an ad has zero linked Orders, when I confirm a delete,
   then the card disappears and a success toast fires.
8. [ ] Given I am an Operator (read-only), when I open `/ads`, then I
   see the grid but no create/edit/delete affordances.
9. [ ] Given an unauthenticated request hits `/v1/ads`, then the API
   returns 401.

## User Flows

### Happy Path — create
1. Manager opens `/ads`.
2. Clicks `New ad` in the page-head.
3. Sheet slides in from the right with title + ecommerce select +
   external id + product combobox.
4. Manager picks a channel, types a title, picks a product, saves.
5. Sheet closes, toast `Ad created` fires, the card lands in the
   matching channel section.

### Happy Path — edit
1. Manager clicks any ad card.
2. Sheet slides in with the same fields pre-filled.
3. Manager changes the title, saves.
4. Sheet closes, toast `Ad updated` fires, the card text updates.

### Edge Cases
- Deleting an ad still referenced by Orders returns 409 with detail
  `Cannot delete ad — orders are linked to it` and the UI shows a
  blocking toast.
- Search clears the page filter; channel filter coexists with search.
- Operators (no `ads.write`) see the grid but no actions.
- An empty grid (no ads at all) shows the empty state with a CTA.

## Scope

### In Scope
- CRUD for `Ad`: title, ecommerce enum, external_id, product_id.
- List, filter (q + channel + product) and group by channel in the UI.
- Backend permissions: `ads.read` for list/detail, `ads.write` for
  mutations. Audit-log on every write.
- Tenant scoping on every query, both filters and joins.
- Side-sheet form (create + edit) and a `/ads/new` standalone page.

### Out of Scope
- Real ecommerce integrations (Shopee/ML/Shopify webhooks). The
  external_id stays an opaque string for now.
- Pause/activate workflow — design source has it but no backing data;
  re-introduce when status comes in the next sprint.
- Performance/orders-30d analytics surfaced in design — needs orders
  feature done first.
- Ad images and prices — design source mocks these.

## UI/UX Notes
- Page eyebrow `Sales` / `Vendas`, terracotta `--brand-sales`.
- Title `Ads`, italic suffix `by channel`.
- Card grid grouped per channel section, each section headed by a
  `ChannelChip` and an ad count.
- `ChannelChip` colors: shopee `#ee4d2d`, mercado_livre `#fff159`
  (dark text), shopify `#95bf47`, instagram `#e4405f`, whatsapp
  `#25d366`, other ink-3.
- Form: ecommerce select (with channel chip preview), title input,
  external_id input (optional), product combobox.
- Confirm dialog on delete reuses the `AlertDialog` pattern from
  Clients.

## i18n Keys
| Key | EN | PT-BR |
|-----|-----|-------|
| `ads.page.eyebrow` | Sales | Vendas |
| `ads.list.title` | Ads | Anúncios |
| `ads.list.titleEm` | by channel | por canal |
| `ads.list.sub` | Manage your listings across ecommerces and social. | Gerencie suas listagens em ecommerces e redes sociais. |
| `ads.list.empty.title` | No ads yet | Nenhum anúncio ainda |
| `ads.list.empty.body` | Hook up a product to a channel and start selling. | Vincule um produto a um canal e comece a vender. |
| `ads.list.empty.cta` | New ad | Novo anúncio |
| `ads.filters.searchPlaceholder` | Search ad… | Procurar anúncio… |
| `ads.filters.channel` | Channel | Canal |
| `ads.filters.channelAll` | All channels | Todos os canais |
| `ads.filters.product` | Product | Produto |
| `ads.filters.productAll` | All products | Todos os produtos |
| `ads.channels.shopee` | Shopee | Shopee |
| `ads.channels.mercado_livre` | Mercado Livre | Mercado Livre |
| `ads.channels.shopify` | Shopify | Shopify |
| `ads.channels.instagram` | Instagram | Instagram |
| `ads.channels.whatsapp` | WhatsApp | WhatsApp |
| `ads.channels.other` | Other | Outro |
| `ads.card.externalId` | External ID | ID externo |
| `ads.card.product` | Product | Produto |
| `ads.card.adCount` | {count, plural, one {# ad} other {# ads}} | {count, plural, one {# anúncio} other {# anúncios}} |
| `ads.actions.create` | New ad | Novo anúncio |
| `ads.actions.edit` | Edit | Editar |
| `ads.actions.delete` | Delete | Excluir |
| `ads.actions.confirmDelete` | Delete this ad? This cannot be undone. | Excluir este anúncio? Não pode ser desfeito. |
| `ads.form.title.new` | New ad | Novo anúncio |
| `ads.form.title.edit` | Edit ad | Editar anúncio |
| `ads.form.labels.title` | Title | Título |
| `ads.form.labels.channel` | Channel | Canal |
| `ads.form.labels.externalId` | External ID | ID externo |
| `ads.form.labels.product` | Product | Produto |
| `ads.form.placeholders.title` | e.g. Cropped Oversized — Summer 2026 | Ex.: Cropped Oversized — Verão 2026 |
| `ads.form.placeholders.externalId` | e.g. SH-AD-12 | Ex.: SH-AD-12 |
| `ads.form.placeholders.product` | Pick a product | Selecione um produto |
| `ads.form.placeholders.searchProduct` | Search product… | Procurar produto… |
| `ads.form.validation.titleRequired` | Title is required | Título obrigatório |
| `ads.form.validation.channelRequired` | Channel is required | Canal obrigatório |
| `ads.form.validation.productRequired` | Product is required | Produto obrigatório |
| `ads.form.save` | Save | Salvar |
| `ads.form.cancel` | Cancel | Cancelar |
| `ads.form.toasts.created` | Ad created | Anúncio criado |
| `ads.form.toasts.updated` | Ad updated | Anúncio atualizado |
| `ads.form.toasts.deleted` | Ad deleted | Anúncio excluído |
| `ads.form.toasts.linkedOrders` | This ad has linked orders and cannot be deleted. | Este anúncio tem pedidos vinculados e não pode ser excluído. |
| `ads.form.toasts.error` | Could not save the ad. | Não foi possível salvar o anúncio. |
| `ads.form.noResults` | No results | Sem resultados |

## API Contract
| Method | Path | Request Body | Response | Purpose |
|--------|------|-------------|----------|---------|
| GET | `/v1/ads` | — (`q`, `ecommerce`, `product_id`, `page`, `page_size`) | `AdPage` | List with filter + pagination |
| GET | `/v1/ads/{id}` | — | `AdRead` | Single ad |
| POST | `/v1/ads` | `AdCreate` | `AdRead` | Create |
| PATCH | `/v1/ads/{id}` | `AdUpdate` | `AdRead` | Partial update |
| DELETE | `/v1/ads/{id}` | — | `204` (or `409` if linked) | Delete |

`AdRead` shape: `{id, title, ecommerce, external_id, product: {id, name, code}, created_at, updated_at}` where `product.code` is the linked product's spec.code.

## Seed Data Requirements
- 3 ads across 3 different channels (already in `tests/fixtures/seed_data.py` ADS).
- Each ad linked to an existing product, used to verify the grouped
  grid and the orders-link delete guard.
