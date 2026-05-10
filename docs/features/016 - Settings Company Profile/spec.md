---
id: FEATURE-016
slug: settings-company-profile
title: Settings — Company + Profile
status: in-progress
created: 2026-05-10
updated: 2026-05-10
branch: feature/016-settings-basics
---

# FEATURE-016: Settings — Company + Profile

## Problem Statement

Operators currently have no way to see or edit basic identity information once
onboarding is complete: a tenant's company name and brand color are frozen at
creation, and users can't update their own display name or job title. The
sidebar already exposes a "Ajustes" entry pointing at `/settings`, but the
route is empty. This feature lights up the first two Settings sub-pages —
Company info and User profile — so the existing settings link becomes useful
and so future settings sub-pages (Members, Roles, Billing, Audit,
Integrations, Notifications) inherit a clean navigation shell.

## User Stories

- As an admin, I want to update my company's display name and primary brand
  color so that I can rebrand without going back through onboarding.
- As any signed-in user, I want to update my display name and job title so
  that teammates see the right information in audit logs and member lists.
- As an operator, I want to be blocked from editing company info but still
  able to edit my own profile, matching the existing permission model.
- As a manager, I want company edits to be blocked (no `companies.write`)
  but my profile to remain editable — the design must hide write affordances
  I lack.

## Acceptance Criteria

1. [ ] Given an admin visits `/settings`, when the page loads, then the user
       is redirected to `/settings/company` (the default sub-route) and the
       Settings shell renders with a left sub-nav (Empresa, Membros, Funções,
       Cobrança, Auditoria, Integrações, Perfil, Notificações).
2. [ ] Given a user is on `/settings/company`, when they look at the sub-nav,
       then the "Empresa" item is highlighted (surface bg + stone left bar)
       and the right pane shows the Company form pre-filled with the active
       company's name, subdomain (read-only), and main color.
3. [ ] Given an admin edits the name and picks a new color, when they click
       Save, then the backend persists the change, a success toast fires,
       and the topbar's company switcher reflects the new name + color
       without a page reload.
4. [ ] Given a manager (no `companies.write`) visits `/settings/company`,
       when the form renders, then all inputs are disabled and the Save
       button is hidden; direct PATCH calls return 403.
5. [ ] Given an operator visits `/settings/profile`, when the form loads,
       then they see their own name (editable) + email (read-only) + job
       (editable) + role (read-only), and Save works.
6. [ ] Given a user submits the profile form with empty name, when
       validation runs, then an inline error appears and no request is sent.
7. [ ] Given a user submits invalid hex color (e.g. `red`), when the form
       is sent, then the backend returns 422 and the toast surfaces the
       error.
8. [ ] Given a user is signed-in to company A, when they PATCH `/v1/users/me`,
       then only the User row scoped to company A is updated (tenant
       isolation enforced via `CurrentDbUser`).
9. [ ] Given the Settings page renders, when measured via getComputedStyle,
       then the page eyebrow uses `var(--brand-settings)` (stone `#44403c`),
       the page-head matches `.page-head` rhythm (mb 22px, items-end, gap
       24px) and cards match `.card` (14px radius, line border, surface bg).
10. [ ] Given a user not authenticated calls PATCH `/v1/companies/me` or
       `/v1/users/me`, then the backend returns 401.

## User Flows

### Happy Path — Update company

1. Admin clicks "Ajustes" in the sidebar, lands on `/settings` and is
   redirected to `/settings/company`.
2. Right pane shows the "Identidade da empresa" card with name input,
   read-only subdomain, color picker (6 presets), and a Save button.
3. Admin changes name from "Atelier Roma" to "Atelier Romã", picks the
   terracotta swatch.
4. Clicks Save — toast "Empresa atualizada", topbar's brand mark color
   refreshes via `useMe` invalidation.

### Happy Path — Update profile

1. Any user navigates to `/settings/profile` (via sub-nav).
2. Form shows name, read-only email, job, read-only role pill.
3. User edits name to "Ana Souza" and job to "Estilista", clicks Save.
4. Toast "Perfil atualizado", `useMe` cache is invalidated, sidebar footer
   reflects the new display name.

### Permission Gating

- Admin → both pages writable.
- Manager → company is read-only (no Save), profile writable.
- Operator → company sub-nav entry remains visible but page renders
  disabled inputs (operators don't have `companies.read` either, so they
  see a "you don't have access" fallback); profile is writable.

### Edge Cases

- Invalid hex (e.g. server-side regex check fails) → toast surfaces error
  detail.
- Subdomain field is shown disabled with helper "Imutável nesta versão" to
  communicate that the subdomain is intentionally frozen for v1.
- API 5xx → toast error with detail.

## Scope

### In Scope

- `GET /v1/companies/me` and `PATCH /v1/companies/me` (name, main_color).
- `GET /v1/users/me` and `PATCH /v1/users/me` (name, job).
- Frontend Settings shell with left sub-nav + two functional sub-pages
  (Company, Profile). Remaining sub-nav entries (Members, Roles, Billing,
  Audit, Integrations, Notifications) are visual placeholders only —
  clicking them surfaces an "Em construção" empty state.
- Color picker with 6 brand presets (indigo, terracotta, teal, aubergine,
  amber, ink).
- E2E coverage of redirects, sub-nav activation, both forms, and
  permission gating on the company page.

### Out of Scope

- Editing subdomain (immutable in v1 — schema reserves space for a future
  rename flow).
- Members, Roles, Billing, Audit, Integrations, Notifications — these are
  separate features.
- Avatar upload — defer to a future feature.
- Custom color hex picker — only the 6 preset swatches are exposed in v1.

## UI/UX Notes

- Match `/docs/design/source/pages/reports-settings.jsx` Settings exactly:
  220px sub-nav column + 1fr content column, 18px gap between them.
- Sub-nav items: 8px 12px padding, 13.5px font, surface bg + line border
  on the active item.
- Page eyebrow uses `var(--brand-settings)` (stone `#44403c`).
- Color swatches: 36×36 rounded-8 buttons. Active swatch gets a 2px
  surface ring + 4px brand ring (per design source).
- Forms use the `.field` rhythm: label 11.5px uppercase tracking .08em ink-3
  weight 600; input 8 11 padding, bg=var(--orion-bg), 6px radius.
- Card head: 14 18 padding, 16px serif title + 12px ink-3 sub.

## i18n Keys

Settings is the host namespace. The existing stub at
`messages/{en,pt-BR}.json#/settings` is populated here.

| Key | EN | PT-BR |
|-----|-----|-------|
| `settings.page.eyebrow` | Settings | Ajustes |
| `settings.list.title` | Settings | Ajustes |
| `settings.list.sub` | Configure your account, team and integrations. | Configure sua conta, equipe e integrações. |
| `settings.nav.company` | Company | Empresa |
| `settings.nav.members` | Members | Membros |
| `settings.nav.roles` | Roles | Funções |
| `settings.nav.billing` | Billing | Cobrança |
| `settings.nav.audit` | Audit | Auditoria |
| `settings.nav.integrations` | Integrations | Integrações |
| `settings.nav.profile` | Profile | Perfil |
| `settings.nav.notifications` | Notifications | Notificações |
| `settings.company.title` | Company identity | Identidade da empresa |
| `settings.company.sub` | How your company appears for the team and on documents. | Como sua empresa aparece para a equipe e em documentos. |
| `settings.company.labels.name` | Company name | Nome da empresa |
| `settings.company.labels.subdomain` | Subdomain | Subdomínio |
| `settings.company.labels.mainColor` | Main color | Cor principal |
| `settings.company.helpers.subdomainImmutable` | Cannot be changed in this version. | Não pode ser alterado nesta versão. |
| `settings.company.save` | Save changes | Salvar alterações |
| `settings.company.savedToast` | Company updated | Empresa atualizada |
| `settings.company.errorToast` | Could not save the company. | Não foi possível salvar a empresa. |
| `settings.company.validation.nameRequired` | Name is required | Nome é obrigatório |
| `settings.company.validation.colorInvalid` | Invalid color | Cor inválida |
| `settings.profile.title` | Your profile | Seu perfil |
| `settings.profile.sub` | This information is visible to your teammates. | Estas informações ficam visíveis para seus colegas. |
| `settings.profile.labels.name` | Display name | Nome de exibição |
| `settings.profile.labels.email` | Email | E-mail |
| `settings.profile.labels.job` | Role / Job | Cargo |
| `settings.profile.labels.role` | Access role | Função de acesso |
| `settings.profile.helpers.emailImmutable` | Tied to your sign-in account. | Vinculado à sua conta de acesso. |
| `settings.profile.helpers.roleImmutable` | Ask an admin to change your role. | Peça a um administrador para alterar sua função. |
| `settings.profile.save` | Save changes | Salvar alterações |
| `settings.profile.savedToast` | Profile updated | Perfil atualizado |
| `settings.profile.errorToast` | Could not save the profile. | Não foi possível salvar o perfil. |
| `settings.profile.validation.nameRequired` | Name is required | Nome é obrigatório |
| `settings.colorPresets.indigo` | Indigo | Índigo |
| `settings.colorPresets.terracotta` | Terracotta | Terracota |
| `settings.colorPresets.teal` | Teal | Verde-petróleo |
| `settings.colorPresets.aubergine` | Aubergine | Berinjela |
| `settings.colorPresets.amber` | Amber | Âmbar |
| `settings.colorPresets.ink` | Ink | Tinta |
| `settings.placeholders.empty.title` | Coming soon | Em breve |
| `settings.placeholders.empty.body` | This section will launch in a future release. | Esta seção será lançada em uma versão futura. |
| `settings.forbidden.company` | You don't have access to company settings. | Você não tem acesso aos ajustes da empresa. |

## API Contract

| Method | Path | Request Body | Response | Purpose |
|--------|------|-------------|----------|---------|
| GET | `/v1/companies/me` | — | `CompanyRead` | Returns the active tenant's profile. Requires auth + `companies.read`. |
| PATCH | `/v1/companies/me` | `CompanyUpdate` | `CompanyRead` | Updates company name and/or main color. Requires `companies.write`. |
| GET | `/v1/users/me` | — | `UserRead` | Returns the active user's profile (including role). Requires auth only. |
| PATCH | `/v1/users/me` | `UserUpdate` | `UserRead` | Updates the active user's name and/or job. Requires auth only. |

Schemas:

```python
CompanyUpdate(name: str | None [1, 120], main_color: str | None [hex #RRGGBB])
CompanyRead(id, name, subdomain, main_color, created_at, updated_at)
UserUpdate(name: str | None [1, 120], job: str | None [<=120, may be empty])
UserRead(id, name, email, job, is_operator, role: RoleRead, created_at, updated_at)
```

`main_color` is validated against `^#[0-9A-Fa-f]{6}$` (same regex as
`OnboardingRequest`). `subdomain` is intentionally NOT in `CompanyUpdate`.

## Seed Data Requirements

- Existing onboarding seeds already create one company with the dev-bypass
  user as admin. No new seed data needed; QA/dev-bypass user (`qa-dev-user`)
  is sufficient.
- Permission test for company writes requires either a manager-seeded
  user (no `companies.write`) or a way to demote the dev-bypass user.
  Backend tests assert the 403 via direct factory-built users; e2e relies
  on the seed `qa-dev-user` having admin permissions.
