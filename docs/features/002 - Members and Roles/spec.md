---
id: FEATURE-002
slug: members-and-roles
title: Settings — Members & Roles
status: in-progress
created: 2026-05-10
updated: 2026-05-10
branch: feature/002-members-roles
---

# FEATURE-002: Members & Roles

## Problem Statement

The company shell now exists (F-016) with a stub Settings sidebar. Admins still cannot:
- See the people who belong to their company.
- Change a member's role without poking the database.
- Invite new teammates from inside the app, then revoke pending invites.
- Inspect what each role can (or cannot) do.

This feature plugs those gaps. It does **not** introduce custom roles — the three
seeded roles (`admin`, `manager`, `operator`) remain the only roles a company can
assign — but it surfaces them and their permissions in a read-only matrix.

## User Stories

- As an admin, I want to see every member of my company so I know who has access.
- As an admin, I want to change a member's role from a select inline so I don't need a separate edit page.
- As an admin, I want to invite a new teammate by email and pick their role, then send the invite.
- As an admin, I want to revoke a pending invite if I made a mistake or the person no longer needs access.
- As an admin, I want to see which permissions each role grants so I can pick the right role for a new hire.
- As the system, I never want to leave a company with zero admins, even by accident.

## Acceptance Criteria

1. [x] Given I am an admin, when I open `/settings/members`, then the page lists every user in my company with avatar, name, email, role, and joined date.
2. [x] Given I change a member's role via the inline select, then the backend persists the new role and an audit-log entry is written.
3. [x] Given I open the invite sheet, fill in an email + role, and submit, then a pending invite is created and surfaces in the "Pending invites" section beneath the table.
4. [x] Given a pending invite exists, when I click "Revoke", then the invite row is removed and the entry is hard-deleted.
5. [x] Given I attempt to demote or remove the **last** admin of my company, then the backend responds with 409 and the UI surfaces the error toast `"Não é possível remover o último administrador."`.
6. [x] Given I navigate to `/settings/roles`, then a read-only matrix renders with admin/manager/operator as columns and one row per permission domain, with `read` / `write` ticks where applicable.
7. [x] Given I lack `users.read`, when I attempt to call `GET /v1/members`, then the backend responds with 403.
8. [x] Given I have only `users.read`, when I attempt to PATCH a member or POST an invite, then the backend responds with 403.

## User Flows

### Happy Path — invite + revoke

1. Admin clicks **Membros** in the Settings sidebar.
2. Page lists current members with role selects, plus a "Convidar membro" primary button (stone hue).
3. Admin clicks "Convidar membro" → side sheet opens with `email` + `role` fields.
4. Admin submits → toast "Convite enviado", invite appears in the **Pending invites** list under the members table.
5. Admin notices a typo → clicks the trash icon on the row → confirms → invite disappears.

### Happy Path — change role

1. Admin opens the row's role select and picks "Manager".
2. PATCH `/v1/members/{id}` fires with `{role_id}`.
3. Toast "Função atualizada", select stays on Manager.

### Edge Cases

- Demoting the last admin → 409 → error toast, select reverts.
- Removing the last admin → same.
- Inviting an email that already has a pending invite → 409 → toast "Já existe um convite pendente para este email."
- Inviting an email that already belongs to a member → still allowed (we don't dedupe against members).
- A non-admin (manager/operator) hits the Members page → they see the list (they have `users.read`) but the role select is disabled and the actions menu is hidden (they lack `users.write`).

## Scope

### In Scope

- Backend: list/get/update-role/delete on `Member`; list-all/get on `Role`; list/create/revoke on `Invite` (admin scope).
- Frontend: `/settings/members`, `/settings/roles`, invite sheet, role select, pending invites list, permission matrix.
- i18n for `members`, `invite`, and `roles` namespaces in EN + PT-BR.
- e2e Playwright specs for both pages.

### Out of Scope

- Creating custom roles (UI is read-only).
- Editing a member's name/email/job — that lives in `/settings/profile` for the active user.
- Resending an invite email — revoke and re-create is the workflow.
- Filtering or pagination beyond the first 50 members.

## UI/UX Notes

- Eyebrow color: `--brand-settings` (stone) for both pages.
- `MembersTable.tsx` — `.tbl` with avatar + name, email mono 12px, role select (shadcn `Select`), trash icon as last column.
- `InviteSheet.tsx` — shadcn `Sheet`, fields `email` + `role`, primary action `Send invite` styled with stone hue.
- `PendingInvitesList.tsx` — sits beneath the members table, small `.tbl`, columns email/role/sent/expires/revoke.
- `PermissionMatrix.tsx` — `.card` wrapping a `.tbl`. Columns: domain (left header), admin, manager, operator. Cell shows a teal `Check` icon for `read` and a stone `Check` icon for `write` (or both stacked when both granted). Empty cell = mute dash.

## i18n Keys

| Key | EN | PT-BR |
|-----|-----|-------|
| `members.list.title` | Members | Membros |
| `members.list.sub` | Everyone with access to this company. | Todos com acesso a esta empresa. |
| `members.list.empty.title` | No members yet | Nenhum membro ainda |
| `members.list.empty.body` | Send your first invite to onboard your team. | Envie seu primeiro convite para começar. |
| `members.list.empty.cta` | Invite member | Convidar membro |
| `members.table.columns.name` | Name | Nome |
| `members.table.columns.email` | Email | E-mail |
| `members.table.columns.role` | Role | Função |
| `members.table.columns.joinedAt` | Joined | Entrou em |
| `members.table.columns.actions` | Actions | Ações |
| `members.actions.invite` | Invite member | Convidar membro |
| `members.actions.changeRole` | Change role | Alterar função |
| `members.actions.remove` | Remove | Remover |
| `members.actions.confirmRemove` | Remove this member? They will lose access immediately. | Remover este membro? O acesso será revogado imediatamente. |
| `members.lastAdminGuard` | Cannot remove the last administrator. | Não é possível remover o último administrador. |
| `invite.form.labels.email` | Email | E-mail |
| `invite.form.labels.role` | Role | Função |
| `invite.form.placeholders.email` | name@example.com | nome@exemplo.com |
| `invite.form.placeholders.role` | Pick a role | Escolha uma função |
| `invite.form.validation.emailRequired` | Email is required | E-mail obrigatório |
| `invite.form.validation.emailInvalid` | Invalid email | E-mail inválido |
| `invite.form.validation.roleRequired` | Pick a role | Escolha uma função |
| `invite.form.save` | Send invite | Enviar convite |
| `invite.form.cancel` | Cancel | Cancelar |
| `invite.form.toasts.created` | Invite sent | Convite enviado |
| `invite.form.toasts.error` | Could not send the invite. | Não foi possível enviar o convite. |
| `invite.pending.title` | Pending invites | Convites pendentes |
| `invite.pending.empty` | No pending invites. | Nenhum convite pendente. |
| `invite.pending.table.columns.email` | Email | E-mail |
| `invite.pending.table.columns.role` | Role | Função |
| `invite.pending.table.columns.sentAt` | Sent | Enviado |
| `invite.pending.table.columns.expiresAt` | Expires | Expira |
| `invite.pending.table.columns.actions` | Actions | Ações |
| `invite.pending.revoke` | Revoke | Revogar |
| `invite.pending.confirmRevoke` | Revoke this invite? | Revogar este convite? |
| `roles.list.title` | Roles & permissions | Funções e permissões |
| `roles.list.sub` | What each role can read or write. | O que cada função pode ler ou escrever. |
| `roles.matrix.actions.read` | Read | Leitura |
| `roles.matrix.actions.write` | Write | Escrita |
| `roles.matrix.none` | — | — |
| `roles.matrix.domains.ads` | Ads | Anúncios |
| `roles.matrix.domains.clients` | Clients | Clientes |
| `roles.matrix.domains.companies` | Company | Empresa |
| `roles.matrix.domains.contractors` | Workshops | Bancas |
| `roles.matrix.domains.cutting` | Cutting | Corte |
| `roles.matrix.domains.fabric` | Fabric | Tecido |
| `roles.matrix.domains.orders` | Orders | Pedidos |
| `roles.matrix.domains.prints` | Prints | Estampas |
| `roles.matrix.domains.products` | Products | Produtos |
| `roles.matrix.domains.roles` | Roles | Funções |
| `roles.matrix.domains.sewing` | Sewing | Costura |
| `roles.matrix.domains.specs` | Tech specs | Fichas |
| `roles.matrix.domains.stock` | Stock | Estoque |
| `roles.matrix.domains.users` | Users | Usuários |

## API Contract

| Method | Path | Body | Response | Purpose |
|--------|------|------|----------|---------|
| GET    | `/v1/members` | — | `MemberPage` | List members of the active company. |
| GET    | `/v1/members/{id}` | — | `MemberRead` | Member detail. |
| PATCH  | `/v1/members/{id}` | `{ role_id }` | `MemberRead` | Change a member's role. |
| DELETE | `/v1/members/{id}` | — | `204` | Remove a member. |
| GET    | `/v1/roles` | — | `RoleList` | List all global roles with permissions. |
| GET    | `/v1/roles/{id}` | — | `RoleRead` | Detail. |
| GET    | `/v1/invites` | — | `InvitePage` | List invites for active company. |
| POST   | `/v1/invites` | `InviteCreate` | `InviteRead` | Create an invite. |
| DELETE | `/v1/invites/{id}` | — | `204` | Revoke an unaccepted invite. |

## Seed Data Requirements

- The three seeded roles (`admin`, `manager`, `operator`) must be present (already covered by `3187f02cbc35_seed_roles_and_permissions`).
- A demo company with one admin user — covered by the existing onboarding seed used by F-001.
- For e2e tests: a second user in the company (manager role) so the matrix has multi-row interactions, and at least one pending invite to revoke.
