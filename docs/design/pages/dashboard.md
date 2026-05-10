# Dashboard

`/[locale]/dashboard`

**Purpose:** Daily landing — what needs attention right now.

**Audience:** all roles (widget set differs).

## Widgets — Manager / Admin

- KPI strip: Orders pending · Cutting in progress · Shipments out at bancas · Low stock SKUs · Revenue (last 30d)
- "Needs action" list:
  - Orders unassigned to a cutting order
  - Fabric rolls running low
  - Shipments overdue at banca
- Recent activity feed (audit log slice — last 20 events, click → audit log)
- Production pipeline visual: pending → cutting → sewing → in-stock counts

## Widgets — Operator

- "Cutting orders waiting for me" (assigned + status=pending)
- "Shipments arriving today" (status=sent, expected ≤ today)
- Quick actions: "Record cutting output" · "Receive shipment"

## States

- **Empty (first run)** — all zeroes; show "Get started" cards linking to Settings + Catalog
- **Loading** — skeletons
- **Error** — banner with retry
