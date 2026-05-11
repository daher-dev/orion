# Implementation Log — FEATURE-002: Members & Roles

## Files Created

### Backend
- `backend/src/schemas/member.py` — `MemberRead`, `MemberRoleUpdate`, `MemberPage`.
- `backend/src/schemas/role.py` — `PermissionRead`, `RoleRead`, `RoleList`.
- `backend/src/schemas/invite.py` — `InviteCreate`, `InviteRead`, `InvitedBySummary`, `InvitePage`.
- `backend/src/services/member.py` — list/get/update-role/remove with last-admin guard + audit.
- `backend/src/services/role.py` — global role lookup with eager-loaded permissions.
- `backend/src/services/invite.py` — admin-side list/get/revoke + re-export of `create_invite` from `services.auth`.
- `backend/src/routers/members.py` — `/v1/members` (read = `users.read`, write = `users.write`).
- `backend/src/routers/roles.py` — `/v1/roles` (`roles.read`).
- `backend/src/routers/invites.py` — `/v1/invites` (admin scope, distinct from the public `/v1/auth/invites/` flow).
- `backend/tests/test_services/test_member_service.py`
- `backend/tests/test_services/test_role_service.py`
- `backend/tests/test_services/test_invite_admin_service.py`
- `backend/tests/test_routers/test_member_router.py`
- `backend/tests/test_routers/test_role_router.py`
- `backend/tests/test_routers/test_invite_admin_router.py`

### Frontend
- `frontend/src/lib/schemas/{member,role,invite}.ts` — zod schemas + types; `role.ts` also exports `PERMISSION_DOMAINS` and a `rolePermits` helper used by the matrix.
- `frontend/src/hooks/use-members.ts`, `use-roles.ts`, `use-invites.ts` — TanStack Query hooks.
- `frontend/src/components/settings/members/{MembersTable,RoleSelect,InviteSheet,PendingInvitesList}.tsx`
- `frontend/src/components/settings/roles/PermissionMatrix.tsx`
- `frontend/src/components/settings/members/__tests__/{MembersTable,InviteSheet,PendingInvitesList}.test.tsx`
- `frontend/src/components/settings/roles/__tests__/PermissionMatrix.test.tsx`
- `frontend/src/app/[locale]/(app)/settings/members/page.tsx`
- `frontend/src/app/[locale]/(app)/settings/roles/page.tsx`
- `frontend/e2e/settings-members.spec.ts`
- `frontend/e2e/settings-roles.spec.ts`

## Files Modified
- `backend/src/routers/__init__.py` — registered `members`, `roles`, `invites` routers.
- `frontend/src/lib/query-keys.ts` — added the `invites` namespace (members/roles were already stubbed).
- `frontend/messages/en.json` and `frontend/messages/pt-BR.json` — fully populated the `members`, `invite`, and `roles` namespaces and added `forbidden.members` / `forbidden.roles`.

## Migration Notes
- No new Alembic migration needed — `User`, `Role`, `Invite` and the seeded admin/manager/operator roles already exist (see `3187f02cbc35_seed_roles_and_permissions.py`).

## Dev Notes

### Last-admin guard
- Lives in `services.member`. Both `update_member_role` (demote) and `remove_member` count the admins-other-than-the-target and raise `ConflictError("Cannot remove the last administrator")` when zero remain.
- Frontend toasts the *PT-BR* localized message (`members.lastAdminGuard`) when the backend detail contains "last administrator".

### Invite re-use
- `services.invite.create_invite` is a re-export of `services.auth.create_invite` to avoid double-implementing the duplicate-pending check. The new router translates the local `InviteCreate` schema into the existing `schemas.auth.InviteCreate` and delegates.
- `services.invite.list_invites` and `get_invite` return `(Invite, Role, User | None)` tuples — no relationship on the `Invite` model, so we join `Role` and outerjoin `User` (the inviter) at the query layer.

### Role refresh after update
- `User.role` is `lazy="joined"`. After `update_member_role` flips `role_id`, the in-session `member.role` is stale. We call `db.refresh(member, attribute_names=["role"])` after the commit so the returned `User` carries the new role + permissions.

### Frontend — `setState in effect` lint rule
- The InviteSheet form needs to reset its fields whenever it opens. Rather than fighting React Compiler's "no setState in effects" rule, the component splits into `InviteSheet` (the always-mounted `<Sheet>` shell) and `InviteSheetInner` (conditionally rendered when open). The inner picks up fresh defaults on every mount, so no effects are needed.

### Permission matrix domain list
- The list of domain codes lives in `frontend/src/lib/schemas/role.ts` (`PERMISSION_DOMAINS`). When new domains are added to `backend/alembic/versions/3187f02cbc35_seed_roles_and_permissions.py::DOMAINS`, the frontend list and the `roles.matrix.domains.*` i18n keys (EN + PT-BR) must be updated in lock-step.

### Test data — email validation
- Pydantic v2 `EmailStr` rejects `.test` TLDs (reserved per RFC 2606). Service and router tests use `.example.com` when they hit the validated `InviteCreate` schema; tests that build invites through `tests.factories.create_invite` can still use `@x.test` (factory bypasses validation by building the SQLModel directly).

### DB / settings sidebar
- The `SettingsSidebar` already routes `/settings/members` and `/settings/roles` to the new pages — no changes needed there.

### Coverage
- New service modules: 100% (`member.py` 68/68, `role.py` 17/17, `invite.py` 37/37).
- New router modules: 100% (`members.py` 30/30, `roles.py` 17/17, `invites.py` 30/30).
- New schema modules: 100% (`member.py` 10/10, `role.py` 8/8, `invite.py` 12/12).
- Comfortably beats the ≥90% target on net-new code.
