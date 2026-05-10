---
id: F-003
slug: catalog-specs
title: Catalog — Specs (Fichas Técnicas)
status: in-progress
created: 2026-05-10
updated: 2026-05-10
branch: feature/003-specs
---

# F-003: Catalog — Specs (Fichas Técnicas)

## Problem Statement
A spec (ficha técnica) is the production recipe for a product: which fabric, what grammage, optional ribana, the trims/aviamentos used, labor cost, sale price. Without it, downstream features (Products F-005, Cutting F-007, Sewing F-009) have nothing to reference. This is a Wave-1 leaf with no cross-feature dependencies — every other catalog feature consumes specs through the read API surfaced here.

## User Stories
- As a manager, I want to register a new spec with its fabric, ribana flag/percentage, trims and pricing, so I can describe what gets cut and sewn.
- As a manager, I want to edit a spec, replacing the trim list as a whole, so the recipe stays consistent without orphan rows.
- As a manager, I want to filter specs by fabric type and search by code/name, so I can find the recipe I need.
- As an operator, I need to read specs (read-only) to check what fabric/grammage a job requires.
- As a manager, I cannot delete a spec while products reference it — the system must protect the chain of references.

## Acceptance Criteria
1. [x] Given a manager visits `/specs`, when there are no specs, then an empty-state with a CTA "Nova ficha" is shown.
2. [x] Given a manager fills the form with required fields and trims, when they save, then a new spec is created (HTTP 201) and appears at the top of the list with its trims.
3. [x] Given a duplicate `code` for the same company, when the manager tries to save, then the API returns 409 Conflict and the form surfaces the error.
4. [x] Given `has_ribana=true` and no `ribana_weight_pct`, when the manager tries to save, then validation fails (422 / inline error) before any DB write.
5. [x] Given a manager edits a spec and changes the trim list, when they save, then the prior trim rows are atomically replaced by the new list.
6. [x] Given a spec is referenced by one or more Products, when the manager tries to delete it, then the API returns 409 Conflict.
7. [x] Given an operator (read-only on specs), when they visit `/specs`, then the list is visible but write actions ("Nova ficha", "Editar", "Excluir") are hidden.
8. [x] Each mutation appends an audit-log entry mentioning the spec code (e.g. "Created spec FT-003").

## User Flows

### Happy Path — Create
1. Manager opens `/specs` → sees the list (or empty state).
2. Clicks "Nova ficha" → navigates to `/specs/new`.
3. Fills code, name, fabric type, gramatura, peso, optional ribana toggle + slider, trims, custo de mão-de-obra, preço de venda.
4. Clicks "Criar ficha" → 201, redirect to `/specs/{id}` (detail).
5. Toast confirms.

### Happy Path — Edit
1. Manager clicks a row → navigates to `/specs/{id}`.
2. Clicks "Editar" → form opens prefilled.
3. Adjusts trims (add row / remove row / change qty).
4. Clicks "Salvar" → 200, list cache invalidated, detail re-renders.

### Edge Cases
- Duplicate code → 409 surfaces "Esse código já está em uso."
- Has ribana but no percentage → form validation blocks save.
- Has ribana percentage outside 0–100 → form validation blocks.
- Delete with linked products → 409 surfaces "Não é possível excluir: produtos usam esta ficha."

## Scope

### In Scope
- Backend: schemas/services/router for CRUD with nested trim list replacement.
- Frontend: list page, detail page, create/edit form, repeating trim rows, ribana toggle + slider.
- i18n: full pt-BR / en pair for the namespace.
- Tests: backend unit + integration ≥90% coverage; frontend Vitest for table/form/hook; Playwright spec written (not run by Dev).

### Out of Scope
- Bulk import.
- Versioning of specs (a v2 problem).
- Cost/margin charts beyond a single computed total.
- Per-trim audit-log entries (we audit the spec, not each trim row).

## UI/UX Notes
Mirror `/docs/design/source/pages/catalog.jsx` (Specs section). Page rhythm:
- `.page-head` with eyebrow ("Catálogo"), title "Fichas técnicas", subtitle, action button "Nova ficha".
- Table card with columns: code (mono), name, fabric type, GSM (num), labor cost (num), updated_at, chevron.
- Form sections (each with the SectionTitle eyebrow): Identificação, Tecido principal, Ribana, Aviamentos, Custo & preço.
- Ribana segment shows a 0–100 range slider styled via `.ribana-slider`. Ribana fields appear only when toggle is "Sim".
- Trim row: 3-column grid (`1fr 110px 28px`) — type select / unit_price NumField / remove ghost button.
- Sub-product brand color is `--brand-catalog` (aubergine). Page eyebrow mark uses it.

Design fidelity:
- `.page` padding 22px 28px 64px, max-width 1480, centered.
- `.page-title` Fraunces 30px / weight 400 / tracking -0.025em / line-height 1.05.
- `.page-eyebrow` 11px / 0.12em / uppercase / weight 600.
- `.page-eyebrow-mark` 18×18 / radius 4 / brand-catalog bg.
- `.btn` padding 7px 13px / radius (--radius-sm) / font-size 13.
- `.btn-primary` accent bg with inset highlight + soft shadow.
- `.field label` 11.5px / 0.08em / uppercase / weight 600.
- `.field input` padding 8px 11px / 1px line border / radius-sm.

## i18n Keys

All keys live under the `specs` namespace in `frontend/messages/en.json` and `pt-BR.json`. Examples:

| Key | EN | PT-BR |
|-----|-----|-------|
| `specs.page.eyebrow` | Catalog | Catálogo |
| `specs.list.title` | Tech specs | Fichas técnicas |
| `specs.list.sub` | Production recipes: fabric, grammage, trims, CMT cost. | Receitas de produção: tecido, gramatura, ribana e custo CMT. |
| `specs.actions.create` | New spec | Nova ficha |
| `specs.actions.edit` | Edit | Editar |
| `specs.actions.delete` | Delete | Excluir |
| `specs.actions.addTrim` | Add trim | Adicionar aviamento |
| `specs.form.sections.identity` | Identification | Identificação |
| `specs.form.sections.fabric` | Main fabric | Tecido principal |
| `specs.form.sections.ribana` | Ribana | Ribana |
| `specs.form.sections.cost` | Trims | Aviamentos |
| `specs.form.sections.pricing` | Cost & price | Custo & preço |
| `specs.form.labels.code` | Code | Código |
| `specs.form.labels.name` | Spec name | Nome da ficha |
| `specs.form.labels.fabricType` | Fabric type | Tipo de tecido |
| `specs.form.labels.gsm` | Grammage | Gramatura |
| `specs.form.labels.weightPerPiece` | Weight | Peso |
| `specs.form.labels.hasRibana` | Uses ribana? | Tem ribana? |
| `specs.form.labels.ribanaPct` | % weight | % peso |
| `specs.form.labels.laborCost` | Labor cost | Custo de mão-de-obra |
| `specs.form.labels.salePrice` | Sale price | Preço de venda |
| `specs.fabricTypes.jersey` | Jersey | Malha |
| `specs.trimTypes.button` | Button | Botão |
| `specs.validation.ribanaPctRequired` | Ribana percentage is required when 'has ribana' is on. | Informe o % de peso da ribana quando "Tem ribana" estiver ativo. |

(See `frontend/messages/{en,pt-BR}.json` for the full set.)

## API Contract
| Method | Path | Request | Response | Purpose |
|--------|------|---------|----------|---------|
| GET | `/v1/specs` | query: `page`, `page_size`, `q`, `fabric_type` | `Page<SpecRead>` | List with pagination + filters |
| GET | `/v1/specs/{id}` | — | `SpecRead` | Detail (with nested trims) |
| POST | `/v1/specs` | `SpecCreate` | `SpecRead` (201) | Create with optional trims |
| PATCH | `/v1/specs/{id}` | `SpecUpdate` | `SpecRead` | Partial update; if `trims` provided, full replacement |
| DELETE | `/v1/specs/{id}` | — | 204 | Hard delete (cascades to trims, blocks if products link to it) |

All endpoints require `specs.read`; writes additionally require `specs.write`.

## Seed Data Requirements
- A test company + admin user (built by factories).
- Sufficient `FabricType`/`TrimType` enum coverage (already in `models.enums`).
- Test scenarios:
  - `FT-101 Cropped Jersey` — has_ribana=true, 10%, 2 trims (label + zipper).
  - `FT-200 Box Tee` — has_ribana=false, 0 trims.
  - `FT-300 Linho Shirt` — has_ribana=false, 1 trim (button qty 6).
- Operator-role user (from seed) to assert read-only nav + UI guard.
