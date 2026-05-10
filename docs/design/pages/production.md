# Production

Three pages: [Cutting](#cutting), [Sewing](#sewing), [Bancas (contractors)](#bancas-contractors).

## Cutting

`/[locale]/cutting`

**Purpose:** Plan and record fabric cutting jobs.

- **List:** kanban-style by status (pending → cutting → done) OR table view (toggle). Columns: code, product, fabric roll(s), planned pieces, actual pieces, operator, dates.
- **Detail** `/[locale]/cutting/[id]`:
  - Header: status, assigned operator
  - Inputs: product, body fabric roll, optional rib roll
  - Plan: target pieces per size (P/M/G/GG)
  - Output (operator records): actual pieces per size, fabric weight consumed, scrap %
  - Linked: which orders this batch fulfills
  - Actions (operator): start cutting → record output → mark done
  - Audit: who changed what, when
- **Create** `/[locale]/cutting/new`: pick product, allocate roll(s), set target quantities, assign operator. Optional: link to specific pending orders.

---

## Sewing

`/[locale]/sewing`

**Purpose:** Track sewing shipments out to bancas and back.

- **List:** status filter (sent / received / partial / cancelled), banca, dates, # pieces.
- **Detail** `/[locale]/sewing/[id]`:
  - Banca info, shipped date, expected return
  - Cut pieces sent (per size, with link to source cutting order)
  - Returns recorded: per-size received vs. requested, defects
  - Auto-creates Stock entries on receipt
  - Actions: mark received (full / partial), report defects, close shipment
- **Create** `/[locale]/sewing/new`: pick banca, pick cutting order(s) to ship from, confirm piece counts, expected return date.

---

## Bancas (Contractors)

`/[locale]/contractors`

**Purpose:** Sewing contractor directory.

- **List:** name, contact, active shipments, on-time-rate, capacity.
- **Detail** `/[locale]/contractors/[id]`: profile, shipment history, performance metrics, payment terms, notes.
- **Create:** name, address, contacts, capacity, rate.
