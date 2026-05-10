---
id: F-008
slug: production-contractors
title: Production — Bancas (Contractors)
status: in-progress
created: 2026-05-10
updated: 2026-05-10
branch: feature/008-contractors
---

# F-008: Production — Bancas (Contractors)

## Problem Statement
Production teams send cut pieces out to third-party sewing workshops ("bancas") who stitch the garments and return the finished pieces. Today the directory of these contractors lives in spreadsheets and notebooks — there is no source of truth, no contact phone tied to a workshop, and no way to consistently link sewing shipments to a partner. F-008 introduces the canonical Bancas (Contractors) module: a tenant-scoped CRUD over `sewing_contractors` that downstream features (F-009 Sewing shipments, F-007 Cutting handoff) can reference by ID.

## User Stories
- As a production manager, I want to register a new banca with name, address, and phone so I can reference it consistently in sewing shipments.
- As a production manager, I want to edit a banca's contact details when they move or change number.
- As a production manager, I want to search bancas by name or phone so I can quickly locate a workshop in a long list.
- As a production manager, I want to remove a banca that no longer works with us.
- As an operator, I should NOT see the Bancas page or be able to manage contractors — that's a manager / admin concern.

## Acceptance Criteria
1. [ ] Given a manager with `contractors.read`, when they navigate to `/contractors`, then they see a paginated, searchable list of all bancas in their company.
2. [ ] Given a manager with `contractors.write`, when they click "Nova banca" and submit a name, then the banca is created and appears at the top of the list.
3. [ ] Given a banca with name "Banca Esperança" exists, when a manager creates another banca with the same name, then the API returns 409 Conflict and the form shows "Banca já cadastrada".
4. [ ] Given a manager edits the phone of a banca, when they save, then the new phone is persisted and the audit log records the update.
5. [ ] Given a manager confirms deletion of a banca, when the request succeeds, then the banca disappears from the list and the audit log records the delete.
6. [ ] Given an operator (no `contractors.read`), when they load the app shell, then the Bancas item is hidden from the sidebar AND a direct visit to `/contractors` returns 403 from the backend.
7. [ ] All endpoints respect tenant isolation — company A cannot see company B's bancas.
8. [ ] Backend test coverage on new code is ≥ 90% line coverage.

## User Flows

### Happy Path — Create a banca
1. Manager clicks "Bancas" in the Production sidebar section.
2. List page loads at `/contractors` with the design page header (eyebrow "Produção" + title "Bancas parceiras") and a "Nova banca" primary button.
3. Manager clicks "Nova banca" — a side sheet slides in from the right.
4. Manager fills name (required), address, phone — clicks "Cadastrar banca".
5. Sheet closes; toast confirms; list refreshes; new row at top.

### Happy Path — Edit a banca
1. Manager clicks a banca row in the list.
2. Side sheet opens prefilled with the banca's current values.
3. Manager edits the phone, clicks "Salvar alterações".
4. Sheet closes; toast confirms; row reflects the new phone.

### Happy Path — Delete a banca
1. Manager opens a banca's edit sheet.
2. Manager clicks "Excluir banca" (destructive action).
3. Confirmation dialog: "Tem certeza? Esta ação não pode ser desfeita."
4. Manager confirms; banca is hard-deleted; row disappears.

### Edge Cases
- Duplicate name: backend raises 409 Conflict; form shows the validation error inline.
- Empty list: empty-state card with icon, title "Nenhuma banca cadastrada", body and CTA "Cadastrar primeira banca".
- Search: typing in the toolbar's search input debounces and filters by name or phone.
- Operator visiting `/contractors` directly: backend returns 403; the page shows the standard "permissão negada" empty state. NavConfig already hides the link for operators.
- Banca with linked sewing shipments: v1 hard-deletes (no FK ondelete check) — F-009 will introduce a guard. For v1 the model's ondelete=RESTRICT on `sewing_shipments.contractor_id` would surface a database-level IntegrityError; we accept the raw 500 in v1 since shipments aren't created yet by another feature and we don't want premature optimization. Documented in dev.md.

## Scope

### In Scope
- CRUD over `sewing_contractors` (create, read list + detail, update, delete).
- Pagination + search by name or phone.
- Tenant isolation (company_id implicit from current user's company).
- Audit log on every mutation.
- Permission checks: `contractors.read` to list/detail, `contractors.write` to mutate.
- Frontend: design-faithful page (PageHead with Production eyebrow), TanStack table list, side-sheet forms, empty state, validation, optimistic invalidation.
- Both EN and PT-BR translations.
- E2E spec covering list/empty/create/edit/delete/search/permission paths.

### Out of Scope
- Banca metrics (active shipments count, on-time delivery %) — those depend on F-009 Sewing.
- WhatsApp integration / link-out — phone is a plain string for v1.
- Bulk import / CSV.
- Soft-delete + restore.
- Specialty / type-of-product tagging from the design — model doesn't carry it; defer to a later iteration.

## UI/UX Notes
Per `/docs/design/source/pages/production.jsx` Contractors section:
- Page header eyebrow: "Produção" with the 18×18 brand-prod mark, then the 30px Fraunces title "Bancas <em>parceiras</em>" (em italic + brand-prod color).
- Sub: "Diretório de bancas de costura e suas métricas." (PT-BR) / "Sewing workshop directory." (EN).
- Primary action: "Nova banca" (btn-primary, Plus icon).
- The design renders bancas as a 2-column card grid, but card metrics (active shipments, on-time %) require F-009 data. **For F-008 we ship the design-faithful table view** (`.tbl` class equivalents) — same visual rhythm, columns: name / address / phone / created / actions. The card grid will be revisited when F-009 lands and metrics become available.
- Side sheet (right-side) for create/edit: prefix block (factory icon + name preview), then "Identificação" section (name), "Contato" section (address, phone). Footer: Cancel + Cadastrar/Salvar.
- Empty state: same `.empty` block as the design (factory icon, h3 title, sub-text, primary CTA).

## i18n Keys
| Key | EN | PT-BR |
|-----|-----|-------|
| `contractors.page.eyebrow` | Production | Produção |
| `contractors.list.title` | Sewing workshops | Bancas parceiras |
| `contractors.list.titleEm` | partners | parceiras |
| `contractors.list.sub` | Sewing workshop directory. | Diretório de bancas de costura. |
| `contractors.list.empty.title` | No workshops yet | Nenhuma banca cadastrada |
| `contractors.list.empty.body` | Register your first sewing partner to start tracking shipments. | Cadastre sua primeira banca para acompanhar remessas. |
| `contractors.list.empty.cta` | Register first workshop | Cadastrar primeira banca |
| `contractors.filters.searchPlaceholder` | Search by name or phone… | Buscar por nome ou telefone… |
| `contractors.table.columns.name` | Name | Nome |
| `contractors.table.columns.address` | Address | Endereço |
| `contractors.table.columns.phone` | Phone | Telefone |
| `contractors.table.columns.created` | Created | Criada em |
| `contractors.table.columns.actions` | Actions | Ações |
| `contractors.actions.create` | New workshop | Nova banca |
| `contractors.actions.edit` | Edit workshop | Editar banca |
| `contractors.actions.delete` | Delete workshop | Excluir banca |
| `contractors.actions.confirmDelete` | Are you sure? This cannot be undone. | Tem certeza? Esta ação não pode ser desfeita. |
| `contractors.form.title.new` | New workshop | Nova banca |
| `contractors.form.title.edit` | Edit workshop | Editar banca |
| `contractors.form.title.newSub` | Register a new sewing partner | Cadastre um novo parceiro de costura |
| `contractors.form.title.editSub` | Update workshop details | Atualizar dados da banca |
| `contractors.form.sectionId` | Identification | Identificação |
| `contractors.form.sectionContact` | Contact | Contato |
| `contractors.form.labels.name` | Workshop name | Nome da banca |
| `contractors.form.labels.address` | Address | Endereço |
| `contractors.form.labels.phone` | Phone | Telefone |
| `contractors.form.placeholders.name` | e.g. Banca Dona Lúcia | Ex: Banca Dona Lúcia |
| `contractors.form.placeholders.address` | e.g. R. das Palmeiras, 120 — São Paulo, SP | Ex: R. das Palmeiras, 120 — São Paulo, SP |
| `contractors.form.placeholders.phone` | (11) 91234-5678 | (11) 91234-5678 |
| `contractors.form.validation.nameRequired` | Name is required | Nome é obrigatório |
| `contractors.form.validation.nameTooLong` | Name is too long | Nome é muito longo |
| `contractors.form.validation.duplicateName` | A workshop with this name already exists | Já existe uma banca com esse nome |
| `contractors.form.save` | Save changes | Salvar alterações |
| `contractors.form.cancel` | Cancel | Cancelar |
| `contractors.form.submitNew` | Register workshop | Cadastrar banca |
| `contractors.toast.created` | Workshop registered | Banca cadastrada |
| `contractors.toast.updated` | Workshop updated | Banca atualizada |
| `contractors.toast.deleted` | Workshop deleted | Banca excluída |
| `contractors.toast.error` | Operation failed | Operação falhou |
| `contractors.fallback.forbidden` | You don't have access to workshops. | Você não tem acesso às bancas. |

## API Contract
| Method | Path | Request | Response | Purpose |
|--------|------|---------|----------|---------|
| GET    | `/v1/contractors` | query: `q?`, `page?`, `page_size?` | `Page[ContractorRead]` | List bancas (paginated + search). |
| GET    | `/v1/contractors/{id}` | — | `ContractorRead` | Detail of a single banca. |
| POST   | `/v1/contractors` | `ContractorCreate` | 201 `ContractorRead` | Create a banca. |
| PATCH  | `/v1/contractors/{id}` | `ContractorUpdate` | `ContractorRead` | Update a banca. |
| DELETE | `/v1/contractors/{id}` | — | 204 | Hard-delete a banca. |

All routes require auth. List/detail require `contractors.read`. POST/PATCH/DELETE require `contractors.write`.

## Seed Data Requirements
- Inherit existing role/permission seed (admin, manager hold `contractors.read+write`; operator does not).
- No production seed for v1. Tests build factories on the fly.
