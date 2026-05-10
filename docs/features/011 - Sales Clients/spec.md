---
id: FEATURE-011
slug: sales-clients
title: Sales — Clients
status: in-progress
created: 2026-05-10
updated: 2026-05-10
branch: feature/011-clients
---

# FEATURE-011: Sales — Clients

## Problem Statement

Operators need a single tenant-scoped directory of buyers across every sales channel
(Shopee, Mercado Livre, Shopify, Instagram, WhatsApp). Today there's no way to
record who is buying or to find a returning customer's contact info, which blocks
follow-ups, repeat sales, and any future "who placed this order?" lookups
required by Orders (F-013).

## User Stories

- As a manager, I want to see a list of every client we've ever sold to so that
  I can find a returning buyer in one place.
- As a manager, I want to add, edit, or remove client records so that the
  directory stays accurate.
- As a manager, I want to search the directory by name, email, or phone so that
  I can locate a specific client quickly.
- As an operator, I want to read the directory but not modify it so that
  accidental edits stay impossible from the production floor.

## Acceptance Criteria

1. [ ] Given a manager visits `/clients`, when the page loads, then the design's
       page header (terracotta eyebrow badge, 30px serif title "Clientes",
       13px ink-3 subtitle) and a `.tbl`-styled table appear with the seeded
       clients.
2. [ ] Given a user lacks `clients.read`, when they request `/v1/clients`, then
       the backend returns 403 and the sidebar entry is hidden.
3. [ ] Given a manager submits a valid create form, when they confirm, then the
       new client appears at the top of the list, an audit-log entry is written,
       and a success toast fires.
4. [ ] Given a manager edits a client's contact info, when they save, then the
       row updates without a full reload and an audit-log entry is written.
5. [ ] Given a manager deletes a client, when they confirm the prompt, then the
       client disappears from the list and an audit-log entry is written.
6. [ ] Given a manager types in the search input, when the query matches a
       client's name, email, or phone, then only matching rows render.
7. [ ] Given an operator (no `clients.write`) opens the page, when they try to
       create or edit, then the action buttons are hidden and direct API calls
       return 403.
8. [ ] Given a user from company A is signed in, when they read `/v1/clients`,
       then no rows from company B are returned.
9. [ ] Given the form is submitted with an empty `name`, when validation runs,
       then an inline error is shown and no request is sent.

## User Flows

### Happy Path — Browse + Search

1. Manager clicks "Clientes" in the sidebar.
2. Page renders with header, search box, and table of clients.
3. Manager types "Mariana" — table filters in place to matching rows only.

### Happy Path — Create

1. Manager clicks "Novo cliente" in the page header (terracotta primary button).
2. Side sheet slides in from the right with the create form.
3. Manager fills name (required), email/phone/address (optional) and clicks "Criar cliente".
4. Sheet closes, toast confirms creation, list refetches and shows new row.

### Happy Path — Edit / Delete

1. Manager clicks a row's "Edit" action — sheet opens with prefilled form titled "Editar cliente".
2. After save, list refetches.
3. Delete uses an alert dialog with confirm copy; on confirm, row is removed.

### Edge Cases

- Empty list → empty state with illustration, copy, and primary CTA.
- 422 from backend (e.g. malformed email) → inline field error from the server.
- 403 on POST/PATCH/DELETE → toast surfacing the missing permission.
- Tenant isolation: rows from other companies must never appear (enforced via
  `scoped()` in the service layer).

## Scope

### In Scope

- CRUD on `clients` (read, create, update, delete) for the active tenant.
- Search on name/email/phone with case-insensitive substring match.
- Permission gating (`clients.read`/`clients.write`).
- Audit-log entries on every mutation.
- Side-sheet create/edit form, alert-dialog delete confirmation.
- pt-BR + en translations under the `clients.*` namespace.
- E2E coverage for happy path, search, validation, and permission denial.

### Out of Scope

- Channel chips, lifetime totals, "first channel", tags, and order history
  (those rely on F-012/F-013 — deferred).
- Bulk import / CSV upload.
- Channel chart in detail panel.
- VIP / recurring tags toggle UI (no model field yet).

## UI/UX Notes

- `PageHead` (new shared component): terracotta `--brand-sales` eyebrow with an
  18×18 mark + uppercase 11px label, 30px Fraunces title, 13px ink-3 sub.
- Toolbar above the table holds the search input.
- `.tbl`-styled table — design borders, padding, hover row highlight.
- Side sheet matches the design's `Sheet` (480px max width, slides from right,
  has title row, body, and a footer with "Cancelar" + "Criar cliente" /
  "Salvar" buttons).
- Empty state is centred — an icon-marked badge, title in ink, body copy in
  ink-3, and a "Novo cliente" CTA.

## i18n Keys

| Key | EN | PT-BR |
|-----|-----|-------|
| `clients.list.title` | Clients | Clientes |
| `clients.list.sub` | Directory of clients across all channels. | Diretório de clientes através de todos os canais. |
| `clients.list.empty.title` | No clients yet | Nenhum cliente ainda |
| `clients.list.empty.body` | Track every buyer in one place — start by adding your first client. | Acompanhe cada comprador em um só lugar — comece criando seu primeiro cliente. |
| `clients.list.empty.cta` | New client | Novo cliente |
| `clients.filters.searchPlaceholder` | Search client… | Procurar cliente… |
| `clients.table.columns.name` | Client | Cliente |
| `clients.table.columns.email` | Email | E-mail |
| `clients.table.columns.phone` | Phone | Telefone |
| `clients.table.columns.address` | Address | Endereço |
| `clients.table.columns.created` | Created | Criado em |
| `clients.table.columns.actions` | Actions | Ações |
| `clients.actions.create` | New client | Novo cliente |
| `clients.actions.edit` | Edit | Editar |
| `clients.actions.delete` | Delete | Excluir |
| `clients.actions.confirmDelete` | Delete this client? This cannot be undone. | Excluir este cliente? Esta ação não pode ser desfeita. |
| `clients.form.title.new` | New client | Novo cliente |
| `clients.form.title.edit` | Edit client | Editar cliente |
| `clients.form.labels.name` | Name | Nome |
| `clients.form.labels.email` | Email | E-mail |
| `clients.form.labels.phone` | Phone | Telefone |
| `clients.form.labels.address` | Address | Endereço |
| `clients.form.placeholders.name` | Full name | Nome completo |
| `clients.form.placeholders.email` | name@example.com | nome@exemplo.com |
| `clients.form.placeholders.phone` | (11) 99999-0000 | (11) 99999-0000 |
| `clients.form.placeholders.address` | Street, number, city | Rua, número, cidade |
| `clients.form.validation.nameRequired` | Name is required | Nome é obrigatório |
| `clients.form.validation.emailInvalid` | Invalid email | E-mail inválido |
| `clients.form.save` | Save | Salvar |
| `clients.form.cancel` | Cancel | Cancelar |
| `clients.form.toasts.created` | Client created | Cliente criado |
| `clients.form.toasts.updated` | Client updated | Cliente atualizado |
| `clients.form.toasts.deleted` | Client deleted | Cliente excluído |
| `clients.form.toasts.error` | Could not save the client. | Não foi possível salvar o cliente. |
| `clients.page.eyebrow` | Sales | Vendas |

## API Contract

| Method | Path | Request Body | Response | Purpose |
|--------|------|-------------|----------|---------|
| GET | `/v1/clients` | — | `Page[ClientRead]` | List clients (filter `q=`, `page=`, `page_size=`) |
| GET | `/v1/clients/{id}` | — | `ClientRead` | Detail |
| POST | `/v1/clients` | `ClientCreate` | `ClientRead` (201) | Create |
| PATCH | `/v1/clients/{id}` | `ClientUpdate` | `ClientRead` | Update |
| DELETE | `/v1/clients/{id}` | — | 204 | Delete |

All endpoints require auth; reads require `clients.read`, mutations require
`clients.write`. Tenant scope is implied by `X-Orion-Company-Id` (or the
authenticated user's default).

## Seed Data Requirements

- A seeded company with a manager user (firebase_uid `qa-dev-user`).
- Five seeded clients with varying name/email/phone for search coverage.
- An operator user (no `clients.write`) for the permission-denied E2E test.
