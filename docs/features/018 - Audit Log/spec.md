---
id: FEATURE-018
slug: audit-log
title: Settings — Audit Log Viewer
status: in-progress
created: 2026-05-10
updated: 2026-05-10
branch: feature/018-audit-log
---

# FEATURE-018: Settings — Audit Log Viewer

## Problem Statement

The `AuditLog` table is already populated on every domain mutation (see
`services/_audit.py` + every service `create/update/delete`). Today managers
and admins have no UI to read those rows, so questions like "who deleted
this client?" or "when did the spec cost change?" have no answer without
direct database access. This feature surfaces the existing trail as a
filterable, paginated viewer inside Settings.

## User Stories

- As a manager, I want to view a chronological log of all changes in my
  company so that I can audit team activity and reconstruct what happened
  to a resource.
- As a manager, I want to search by message text, filter by resource type,
  filter by user, and bracket by date range so that I can isolate a
  specific incident.
- As a manager, I want each row to show when the change happened, who made
  it, and what was affected so that the entry stands alone without extra
  clicks.
- As an operator (no `users.read`), I want the Audit nav item to be either
  hidden or to deny me access politely so that I don't see other people's
  activity.

## Acceptance Criteria

1. [ ] Given an admin/manager visits `/settings/audit`, when the page loads,
       then the design's stone "Ajustes" eyebrow, "Log de auditoria"
       (`/ Audit log /`) card, and the `.tbl`-styled table render with the
       most recent entries first.
2. [ ] Given the user lacks `users.read` (operator role), when they hit
       `GET /v1/audit-logs`, then the backend returns 403.
3. [ ] Given the user is unauthenticated, when they hit `/v1/audit-logs`,
       then the backend returns 401.
4. [ ] Given a manager types in the search input, when the debounced value
       changes, then the list re-queries with `q=<text>` and only rows whose
       `message` or `resource_type` matches (case-insensitive) render.
5. [ ] Given a manager picks a `resource_type` from the select, when the
       value changes, then only rows of that resource type render.
6. [ ] Given a manager picks a user from the user select, when the value
       changes, then only rows authored by that user render.
7. [ ] Given a manager picks a date-from/date-to range, when both are set,
       then rows render only when `created_at` falls in that window
       (inclusive of `from`, exclusive of the day after `to`).
8. [ ] Given the result count exceeds the page size, when the user navigates
       between pages, then the next batch loads correctly and the current
       page indicator updates.
9. [ ] Given a row whose `user_id` is NULL (system event or deleted user),
       when it renders, then the Who column shows "—" without throwing.
10. [ ] Given a row's `resource_type` has a known color mapping, when the
       row renders, then the resource-type chip uses that brand color
       (orders → terracotta, ads → terracotta, products/specs/prints →
       aubergine, fabric/cutting/stock → amber, sewing → teal, settings
       resources → stone).
11. [ ] Given a user from Company A is signed in, when they hit
       `/v1/audit-logs`, then no rows from Company B are returned.

## User Flows

### Happy Path — Browse + Filter

1. Manager clicks "Auditoria" in the Settings sidebar.
2. Page renders with filter bar (search input, resource-type select, user
   select, date-from, date-to, Clear button) above the table.
3. Table lists the latest 50 entries, sorted by `created_at` desc.
4. Manager picks `clients` from the resource-type select — list narrows.
5. Manager picks a date-from — list narrows further.
6. Manager clicks Clear — all filters reset, full list returns.
7. Manager paginates with Previous/Next.

### Edge Cases

- `user_id` is NULL (system event or user deleted) → Who column shows "—".
- Resource type not in the seed color map → chip falls back to the muted
  stone color.
- Empty list (no entries match the filters) → empty state with the
  "history" icon and "Adjust your filters" copy.
- Backend 401/403 → standard error envelope rendered by the layout
  error boundary.

## Scope

### In Scope

- Read-only list endpoint `GET /v1/audit-logs` with filters: `q`,
  `resource_type`, `user_id`, `date_from`, `date_to`, plus pagination.
- Tenant-scoped via `scoped()` in the service.
- Joined load of the `user` relationship (LEFT JOIN since FK is `SET NULL`).
- Frontend page at `/settings/audit` with filters bar, table, pagination.
- `ResourceTypeChip` component with type-specific color mapping.
- pt-BR + EN translations under the `audit.*` namespace.
- Backend tests: service-layer sort/filter/tenant-isolation +
  router-layer 200/401/403/422.
- E2E: list renders seeded rows; search filter narrows the list;
  resource-type filter narrows; pagination works.

### Out of Scope

- Mutating audit entries (append-only by design — `services/_audit.py`
  already enforces this).
- Resource-deeplinking from a row (no `View resource` action this iteration).
- CSV / JSON export.
- A proper `audit.read` permission — for v1 we gate on `users.read` (every
  admin + manager has it). A future migration will add the dedicated code
  and flip the dependency.

## UI/UX Notes

Design source: `/docs/design/source/pages/reports-settings.jsx` (the
`AuditPane` component) defines the `.tbl` skeleton with When / Who /
Action / Target / Detail columns. We map those to our model's fields:

| Design column | Our column            | Source              |
|---------------|-----------------------|---------------------|
| Quando        | When                  | `created_at`        |
| Quem          | Who                   | `user.name` or "—"  |
| Ação          | Resource type chip    | `resource_type`     |
| Alvo          | Resource id (mono)    | `resource_id`       |
| Detalhe       | Message               | `message`           |

We add a filter bar above the card that is not in the original sketch but
matches the toolbar pattern from other list pages (`.toolbar`).

The "When" column shows relative time (e.g. "2h ago") with the absolute
ISO timestamp on hover via `title`.

## i18n Keys

All translations live under the `audit` namespace in both `en.json` and
`pt-BR.json`. Resource-type labels live under `audit.resourceTypes.<key>`.

| Key | EN | PT-BR |
|-----|-----|-------|
| `audit.page.eyebrow` | Settings | Ajustes |
| `audit.list.title` | Audit log | Log de auditoria |
| `audit.list.sub` | Every change to your data, with who, when, and what. | Cada alteração nos seus dados, com quem, quando e o quê. |
| `audit.list.empty.title` | No audit entries match | Nenhum evento corresponde |
| `audit.list.empty.body` | Try clearing the filters or expanding the date range. | Tente limpar os filtros ou expandir o intervalo de datas. |
| `audit.filters.searchPlaceholder` | Search message or resource… | Buscar mensagem ou recurso… |
| `audit.filters.resourceType` | Resource type | Tipo de recurso |
| `audit.filters.user` | User | Usuário |
| `audit.filters.dateFrom` | From | De |
| `audit.filters.dateTo` | To | Até |
| `audit.filters.clear` | Clear | Limpar |
| `audit.filters.allResources` | All resources | Todos os recursos |
| `audit.filters.allUsers` | All users | Todos os usuários |
| `audit.table.columns.when` | When | Quando |
| `audit.table.columns.who` | Who | Quem |
| `audit.table.columns.resourceType` | Resource | Recurso |
| `audit.table.columns.resourceId` | Target | Alvo |
| `audit.table.columns.message` | Detail | Detalhe |
| `audit.pagination.first` | First | Primeiro |
| `audit.pagination.previous` | Previous | Anterior |
| `audit.pagination.next` | Next | Próximo |
| `audit.pagination.last` | Last | Último |
| `audit.pagination.of` | Page {page} of {total} | Página {page} de {total} |
| `audit.resourceTypes.orders` | Orders | Pedidos |
| `audit.resourceTypes.clients` | Clients | Clientes |
| `audit.resourceTypes.ads` | Ads | Anúncios |
| `audit.resourceTypes.products` | Products | Produtos |
| `audit.resourceTypes.product_variations` | Product variations | Variações de produto |
| `audit.resourceTypes.product_specs` | Specs | Fichas técnicas |
| `audit.resourceTypes.spec_trims` | Spec trims | Aviamentos |
| `audit.resourceTypes.print_designs` | Prints | Estampas |
| `audit.resourceTypes.fabric_rolls` | Fabric rolls | Bobinas |
| `audit.resourceTypes.cutting_orders` | Cutting orders | OS de corte |
| `audit.resourceTypes.cutting_order_outputs` | Cutting outputs | Saídas de corte |
| `audit.resourceTypes.sewing_contractors` | Sewing contractors | Bancas |
| `audit.resourceTypes.sewing_shipments` | Sewing shipments | Remessas |
| `audit.resourceTypes.sewing_shipment_items` | Sewing items | Itens da remessa |
| `audit.resourceTypes.stock_entries` | Stock entries | Entradas |
| `audit.resourceTypes.stock_exits` | Stock exits | Saídas |
| `audit.resourceTypes.companies` | Companies | Empresas |
| `audit.resourceTypes.users` | Users | Usuários |
| `audit.resourceTypes.roles` | Roles | Funções |
| `audit.resourceTypes.permissions` | Permissions | Permissões |
| `audit.resourceTypes.invites` | Invites | Convites |

## API Contract

| Method | Path | Query | Response | Purpose |
|--------|------|-------|----------|---------|
| GET | `/v1/audit-logs` | `q`, `resource_type`, `user_id`, `date_from`, `date_to`, `page`, `page_size` | `Page[AuditLogRead]` | List entries, ordered by `created_at DESC`. |

`AuditLogRead` shape:

```jsonc
{
  "id": "uuid",
  "user": { "id": "uuid", "name": "Joana Pires" } | null,
  "resource_type": "clients",
  "resource_id": "uuid",
  "message": "Created client Mariana Costa",
  "created_at": "2026-05-10T12:00:00Z"
}
```

## Seed Data Requirements

- Every other service's create/update/delete already writes audit entries,
  so the table grows organically as you exercise the rest of the app in
  E2E. The audit spec creates seed data through `POST /v1/clients` so the
  test is self-contained.

## Permissions

The `audit.read` permission code is **not** seeded yet. For v1 we reuse
`users.read` (every admin + manager has it). A follow-up migration should
add `audit.read` and shift the dependency. Recorded in `dev.md`.
