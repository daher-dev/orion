# Inventory

Two pages: [Fabric (bobinas)](#fabric-bobinas), [Stock](#stock).

## Fabric (Bobinas)

`/[locale]/fabric`

**Purpose:** Track fabric rolls — what's in the warehouse, what's been consumed.

- **List:** filters by kind (body / rib), supplier, status. Columns: code, kind, fabric type, gsm, initial weight, current weight, supplier, received_at.
- **Detail** `/[locale]/fabric/[id]`:
  - Roll info, weight history (initial → after each cutting consumption)
  - Cutting orders that consumed from this roll
  - Visual: weight burn-down chart
- **Create** `/[locale]/fabric/new`: receive a new roll — kind, type, gsm, weight, supplier, cost.

---

## Stock

`/[locale]/stock`

**Purpose:** Finished goods inventory by ProductVariation.

- **List:** variation × current count, filters by product, low-stock toggle. Click a row → variation drawer with movement history.
- **Movement history** `/[locale]/stock/movements`: append-only ledger of entries (from shipment / adjustment / return) and exits (sale / adjustment / loss). Filters by reason, date, product.
- **Manual adjust** (modal): reason required, audit-logged.
