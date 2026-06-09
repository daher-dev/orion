import uuid

from sqlalchemy import func, or_
from sqlalchemy.orm import selectinload
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from models import Permission, Role, User
from schemas.role import RESERVED_ROLE_CODES, RoleCreate, RoleUpdate
from services._audit import write_audit
from shared.exceptions import ConflictError, NotFoundError, ValidationError


async def list_roles(db: AsyncSession, company_id: uuid.UUID) -> list[Role]:
    """Roles visible to a tenant: the 3 global seeded roles (``company_id IS NULL``)
    plus any custom roles owned by this company.

    Permissions are eager-loaded with selectinload so the response shape is
    stable regardless of how many roles exist.
    """
    stmt = (
        select(Role)
        .where(or_(Role.company_id.is_(None), Role.company_id == company_id))  # type: ignore[union-attr]
        .options(selectinload(Role.permissions))
        .order_by(Role.code.asc())  # type: ignore[attr-defined]
    )
    result = await db.exec(stmt)
    return list(result.all())


async def get_role(db: AsyncSession, company_id: uuid.UUID, role_id: uuid.UUID) -> Role:
    """Single role by id, scoped to globals-or-this-tenant, permissions eager-loaded."""
    stmt = (
        select(Role)
        .where(
            Role.id == role_id,
            or_(Role.company_id.is_(None), Role.company_id == company_id),  # type: ignore[union-attr]
        )
        .options(selectinload(Role.permissions))
    )
    result = await db.exec(stmt)
    role = result.first()
    if role is None:
        raise NotFoundError(detail="Role not found")
    return role


async def _resolve_permissions(db: AsyncSession, codes: list[str]) -> list[Permission]:
    """Resolve permission codes to rows, rejecting any unknown code."""
    if not codes:
        return []
    stmt = select(Permission).where(Permission.code.in_(codes))  # type: ignore[attr-defined]
    rows = list((await db.exec(stmt)).all())
    found = {p.code for p in rows}
    missing = sorted(set(codes) - found)
    if missing:
        raise ValidationError(detail=f"Unknown permission codes: {', '.join(missing)}")
    return rows


def _require_custom_role(role: Role, company_id: uuid.UUID) -> None:
    """Guard: only a custom role owned by this tenant may be mutated/deleted."""
    if role.company_id is None:
        raise ConflictError(detail="Seeded roles are read-only and cannot be modified")
    if role.company_id != company_id:
        # Belongs to another tenant — hide its existence.
        raise NotFoundError(detail="Role not found")


async def _assert_code_available(db: AsyncSession, company_id: uuid.UUID, code: str) -> None:
    """Reject reserved codes and codes already taken by this tenant."""
    if code in RESERVED_ROLE_CODES:
        raise ConflictError(detail=f"Role code '{code}' is reserved")
    existing = (await db.exec(select(Role.id).where(Role.company_id == company_id, Role.code == code))).first()
    if existing is not None:
        raise ConflictError(detail=f"A role with code '{code}' already exists")


async def create_role(
    db: AsyncSession,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: RoleCreate,
) -> Role:
    await _assert_code_available(db, company_id, payload.code)
    permissions = await _resolve_permissions(db, payload.permission_codes)

    role = Role(
        company_id=company_id,
        code=payload.code,
        name=payload.name,
        description=payload.description,
    )
    # Assign through the relationship so SQLAlchemy manages the association rows
    # in `role_permissions` and the cached `role.permissions` stays consistent.
    role.permissions = permissions
    db.add(role)
    await db.flush()

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type="roles",
        resource_id=role.id,
        message=f"Created role {role.name}",
    )

    await db.commit()
    return await get_role(db, company_id, role.id)


async def update_role(
    db: AsyncSession,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    role_id: uuid.UUID,
    payload: RoleUpdate,
) -> Role:
    role = await get_role(db, company_id, role_id)
    _require_custom_role(role, company_id)

    if payload.name is not None:
        role.name = payload.name
    if payload.description is not None:
        role.description = payload.description

    if payload.permission_codes is not None:
        permissions = await _resolve_permissions(db, payload.permission_codes)
        # Replace the full set through the relationship — SQLAlchemy syncs the
        # `role_permissions` association rows and keeps `role.permissions` fresh.
        role.permissions = permissions

    db.add(role)
    await db.flush()

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type="roles",
        resource_id=role.id,
        message=f"Updated role {role.name}",
    )

    await db.commit()
    return await get_role(db, company_id, role.id)


async def delete_role(
    db: AsyncSession,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    role_id: uuid.UUID,
) -> None:
    role = await get_role(db, company_id, role_id)
    _require_custom_role(role, company_id)

    # User.role_id FK is ondelete=RESTRICT — pre-check so we surface a clean 409
    # instead of letting the DB raise an IntegrityError.
    refs = (await db.exec(select(func.count()).select_from(User).where(User.role_id == role.id))).one()
    if int(refs) > 0:
        raise ConflictError(detail="Role is still assigned to members and cannot be deleted")

    name = role.name
    await db.delete(role)
    await db.flush()

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type="roles",
        resource_id=role_id,
        message=f"Deleted role {name}",
    )

    await db.commit()
