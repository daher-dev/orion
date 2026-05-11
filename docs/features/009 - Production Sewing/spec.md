---
id: FEATURE-009
slug: production-sewing
title: Production — Sewing (Costura / Remessas)
status: in-progress
created: 2026-05-10
updated: 2026-05-10
branch: feature/009-sewing
---

# FEATURE-009: Production — Sewing (Costura / Remessas)

## Problem Statement

After a cutting order is finished, the resulting bundles of cut pieces leave the
factory and go to a sewing contractor (a "banca"). The team needs a way to:

- record each shipment that leaves (which cutting order, which banca, when,
  what was sent, per size),
- record what comes back when the banca delivers (possibly in a single batch,
  possibly partially), and
- automatically credit the received pieces to stock so the inventory mirrors
  reality without a separate manual entry step.

Currently there is no shipment book at all, so production-floor users either
track everything on paper or in spreadsheets and stock balances drift away
from physical reality.

## User Stories

- As a production manager, I want to register a new shipment (which cutting
  order + which banca + per-size quantities) so I can hand the banca a paper
  copy and we both agree on what left.
- As a production manager, I want to mark a shipment as received with the
  per-size quantities actually returned, so partial returns and defects are
  visible and the difference is obvious.
- As a production manager, I want received pieces to land in stock
  automatically when I record the receive, so we don't double-book.
- As any production-floor user, I want to filter shipments by status,
  contractor and cutting order so I can find a specific remessa fast.

## Acceptance Criteria

1. [x] Given a logged-in user with `sewing.read`, when they navigate to
   `/sewing`, then a table of shipments is shown with: id, banca,
   cutting order code, sent date, expected return date, status pill,
   total requested pieces and total received pieces.
2. [x] Given a user with `sewing.write`, when they create a shipment with
   a cutting order, a contractor, a sent date and per-size requested
   counts, then the shipment is saved with status `sent`,
   `received_quantity = 0` for every item, and an audit entry is written.
3. [x] Given a `sent` shipment, when the user records a receive with
   per-size received quantities that exactly match the requested ones,
   then status flips to `received`, `received_at` is set, and a
   `StockEntry` row is created for each non-zero size.
4. [x] Given a `sent` shipment, when the user records a receive with at
   least one size that is less than requested but more than zero, then
   status flips to `partial`, `received_at` is set, and `StockEntry`
   rows are created only for the received quantities.
5. [x] Given a shipment, when the user tries to receive a quantity greater
   than the originally requested for a size, then the API responds 409
   and nothing changes.
6. [x] Given a shipment that is already `received` or `partial`, when the
   user tries to receive it again, then the API responds 409.
7. [x] Given a `sent` shipment, when the user cancels it, then status
   becomes `cancelled` and an audit entry is written. Cancelled shipments
   cannot be received afterwards.
8. [x] All shipment queries are scoped by `company_id` — a tenant cannot
   see another tenant's shipments, and cross-tenant access returns 404.
9. [x] All user-facing strings come from `next-intl` keys present in both
   `messages/en.json` and `messages/pt-BR.json`.

## User Flows

### Happy Path — Create + Receive
1. Production manager goes to `/sewing` and clicks "New shipment".
2. They pick a cutting order, a contractor, the sent date, and fill the
   per-size quantities (P/M/G/GG).
3. They submit. The table refreshes; the new row shows status "Sent".
4. A week later they click the row, open the receive dialog, type the
   actually-received quantities per size and submit.
5. If every size matches → row status "Received"; otherwise "Partial".
6. The Stock page now reflects the received pieces.

### Edge Cases
- Banca short-delivers one size: status `partial`, received_at set,
  only the received quantities create StockEntry rows.
- Banca over-delivers: API rejects with 409, the user fixes the inputs.
- A shipment gets cancelled before it goes out: no stock entries are
  ever created.
- Multiple receive calls on the same shipment: 409.

## Scope

### In Scope
- SewingShipment + SewingShipmentItem CRUD-ish (create, list, get,
  receive, cancel).
- Auto-create `StockEntry` rows on receive.
- Audit-log every state transition.
- List page, detail page, create page, receive dialog, cancel action.
- i18n keys for both EN and PT-BR.

### Out of Scope (handled elsewhere)
- Stock page itself (F-010).
- Banca payment / cost tracking.
- Print-out of a paper remessa slip.
- Defect tracking (the design mentions defects but F-009 only tracks
  per-size received counts; defects can be inferred from
  `requested - received`).

## API

### `GET /v1/sewing`
List shipments. Returns paginated `ShipmentPage`.

Query params:
- `q` — search by cutting order code or contractor name.
- `status` — single ShipmentStatus (`sent`, `received`, `partial`,
  `cancelled`).
- `contractor_id` — UUID filter.
- `cutting_order_id` — UUID filter.
- `page`, `page_size`.

### `GET /v1/sewing/{id}`
Returns a single `ShipmentRead` with eager-loaded contractor, cutting
order code, and items list.

### `POST /v1/sewing`
Body: `ShipmentCreate`. Returns 201 + `ShipmentRead`.

### `POST /v1/sewing/{id}/receive`
Body: `ShipmentReceiveBody`. Returns 200 + `ShipmentRead`.
- 409 if any received_quantity > requested_quantity.
- 409 if shipment is already received, partial or cancelled.

### `POST /v1/sewing/{id}/cancel`
Returns 200 + `ShipmentRead`. 409 if already received/cancelled.

Permissions: `sewing.read` for GETs, `sewing.write` for POSTs.

## i18n keys (sewing.*)

```
page.eyebrow                              "Production" / "Produção"
list.title                                "Shipments" / "Remessas"
list.titleEm                              "to workshops" / "em bancas"
list.sub                                  short description
list.empty.{title,body,cta}               empty-state strings

filters.searchPlaceholder                 "Search by code or workshop…"
filters.status / filters.statusAll
filters.contractor / filters.contractorAll

statuses.{sent,received,partial,cancelled}

table.columns.{id,contractor,cuttingOrder,sentAt,receivedAt,
               status,totalRequested,totalReceived,actions}

actions.{create,receive,cancel,confirmCancel,back}

form.title.{new}
form.labels.{cuttingOrder,contractor,sentAt,sizeP,sizeM,sizeG,sizeGG}
form.placeholders.{cuttingOrder,contractor}
form.validation.{cuttingOrderRequired,contractorRequired,
                 sentAtRequired,quantitiesRequired,quantitiesPositive}
form.{save,cancel}
form.toasts.{created,error}

receive.title
receive.body
receive.items.{size,requested,received}
receive.{save,cancel}
receive.toasts.{success,partial,error}

detail.title                              "Shipment {code}"
detail.back
```

## Seed Data

For local dev the F-008 contractors seed + F-007 cutting seed already
populate the relations. We don't seed shipments themselves — the
empty-state page is the default first impression.

## Backend layout

- `backend/src/schemas/sewing.py` — Pydantic shapes for items, create,
  receive, read, filters, page.
- `backend/src/services/sewing.py` — list/get/create/receive/cancel.
  Service writes audit + creates StockEntry rows on receive.
- `backend/src/routers/sewing.py` — `/sewing` router, permissioned.

## Frontend layout

- `frontend/src/lib/schemas/sewing.ts` — Zod mirrors.
- `frontend/src/hooks/use-sewing.ts` — TanStack Query hooks.
- `frontend/src/app/[locale]/(app)/sewing/`
  - `page.tsx` — list table + filters.
  - `loading.tsx`, `error.tsx`.
  - `new/page.tsx` — create flow.
  - `[id]/page.tsx` — detail + receive + cancel.
- `frontend/src/components/sewing/` — table, form, sheet, status pill,
  receive dialog, empty state, tests.
- `frontend/e2e/sewing.spec.ts`.

## Notes

Stock crediting: the cutting order knows its `product_id`. Each shipment
item has a `size`. To create a `StockEntry` we need a
`ProductVariation`. We pick the FIRST variation that matches the
shipment's `product_id + size`. Multi-color cutting orders are a known
limitation and tracked as a future enhancement (would require a `color`
field on the shipment item — out of scope for F-009).
