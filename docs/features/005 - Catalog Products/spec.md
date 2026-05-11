---
id: F-005
slug: catalog-products
title: Catalog — Products + Variations
status: in-progress
created: 2026-05-10
updated: 2026-05-10
branch: feature/005-products
---

# F-005: Catalog — Products + Variations

## Problem Statement
A Product is the SKU-bearing combination of a tech spec (ficha técnica) and an
optional print (estampa). Each product fans out into a matrix of variations —
one row per size and color, each carrying its own SKU. Without products there is
nothing for the storefront ads, cutting orders and stock entries to point at.
This feature closes the catalog after F-003 Specs and F-004 Prints landed.

## User Stories
- As a manager, I want to register a product by picking a spec, an optional
  print, and combinations of size + color so the SKU matrix is generated
  automatically and stays consistent.
- As a manager, I want to edit a product and replace the whole variation list
  atomically so removed combinations don't leave dangling SKUs.
- As a manager, I want to filter by product type, spec and print so I can find
  a product quickly.
- As an operator, I want to read products (read-only) so I can pick what to ship
  or cut.
- As a manager, I cannot delete a product while ads reference it — the system
  must guard the chain of references.

## Acceptance Criteria
1. [x] Given a manager visits `/products`, when there are no products, then an
       empty-state with the CTA "Novo produto" is shown.
2. [x] Given a manager fills the form with name, type, spec, optional print, and
       at least one (size, color) cell selected, when they submit, then a new
       Product (HTTP 201) plus its derived ProductVariations land in the DB.
3. [x] Each variation's SKU is derived via `Product.make_sku(spec.code, size,
       color_code, print.code?)` — never computed by the service or UI.
4. [x] Given a (spec_id, print_id) pair already exists for the company, when a
       second product reuses the same pair, then the API returns 409 Conflict
       and the form surfaces "Já existe um produto com essa combinação."
5. [x] Given a product with N variations is patched with M variations, when the
       request resolves, then the prior rows are deleted atomically and the new
       ones inserted with re-derived SKUs.
6. [x] Given the manager tries to delete a product referenced by at least one
       Ad, then the API returns 409 Conflict.
7. [x] Given an operator (read-only on products), when they visit `/products`,
       then the list is visible but write actions are hidden.
8. [x] Each mutation appends an audit-log entry mentioning the product name.

## User Flows

### Happy Path — Create
1. Manager opens `/products` → list (or empty state).
2. Clicks "Novo produto" → side-sheet opens.
3. Picks spec (searchable combobox), optionally a print, sets product type and
   name, builds the variation matrix (toggle sizes + add colors).
4. Submits → 201, list cache invalidates, toast confirms.

### Happy Path — Edit
1. From the table the manager opens the form sheet.
2. Adjusts the variation matrix (toggle cells, add/remove colors).
3. Saves → 200, variations atomically replaced.

### Edge Cases
- Duplicate (spec, print) → 409, inline error.
- Zero variations checked → form blocks submission.
- Delete with linked ad → 409, toast surfaces "Existem anúncios vinculados a
  este produto."

## Scope

### In Scope
- Backend CRUD + nested variation atomic replace.
- Frontend list page, detail page, create/edit sheet with the variation matrix
  builder + read-only matrix on detail.
- Full pt-BR / en i18n pair.
- Backend unit + integration tests; Vitest unit tests; Playwright spec
  authored (not run by Dev).

### Out of Scope
- Stock per variation (placeholder on detail; lives in F-006/F-015 wave).
- Image uploads on the product itself (prints already carry artwork).
- Bulk import.

## UI/UX Notes
Eyebrow chip color: aubergine `--brand-catalog` (matches Specs + Prints).
Page title: Fraunces 30/400/-.025em "Produtos" + optional `<em>` "à venda".
Variation matrix cell: 44×44 rounded card with size letter top + color swatch
below; the row total is the small SKU underneath. The new-product sheet uses
shadcn `Command` comboboxes for spec + print pickers — mirrors the design's
`Select searchable`.

## i18n Keys
Top-level `products.*` namespace, mirroring `clients.*` and `specs.*` shape.

## API Contract
| Method | Path | Body | Response | Purpose |
|--------|------|------|----------|---------|
| GET    | /v1/products | — | `Page[ProductRead]` | Paginate + filter |
| GET    | /v1/products/{id} | — | `ProductRead` | Detail with variations |
| POST   | /v1/products | `ProductCreate` | `ProductRead` 201 | Create |
| PATCH  | /v1/products/{id} | `ProductUpdate` | `ProductRead` | Update + replace variations |
| DELETE | /v1/products/{id} | — | 204 | Block if any Ad links |

Permissions: `products.read` on router; `products.write` per mutation endpoint.

## Seed Data Requirements
Tests rely on existing factories (`create_product_spec`, `create_print_design`,
`create_product`, `create_product_variation`, `create_ad`). No new seeds in
Alembic — the migrations 412d/c8f7 already created the tables.
