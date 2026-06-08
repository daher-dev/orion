"""Platform-admin (Console) services — cross-tenant reads for operators.

These run with operator privileges (see `dependencies.get_operator_user`) and are
NOT tenant-scoped: they intentionally read across every company. Only domains that
exist today are backed here; plans/billing/integration-health are not modeled.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from models import Company, Order, Role, User
from schemas.admin import (
    OperatorRow,
    OrgCreate,
    OrgRow,
)
from schemas.auth import InviteCreate
from services._audit import write_audit
from services.auth import create_invite
from shared.exceptions import ConflictError, NotFoundError


def _start_of_month() -> datetime:
    now = datetime.now(UTC)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


async def _member_counts(db: AsyncSession) -> dict[uuid.UUID, int]:
    rows = await db.exec(select(User.company_id, func.count()).group_by(User.company_id))
    return {company_id: int(count) for company_id, count in rows.all()}


async def _orders_month_counts(db: AsyncSession) -> dict[uuid.UUID, int]:
    stmt = (
        select(Order.company_id, func.count()).where(Order.ordered_at >= _start_of_month()).group_by(Order.company_id)
    )
    rows = await db.exec(stmt)
    return {company_id: int(count) for company_id, count in rows.all()}


def _org_row(company: Company, members: int, orders: int) -> OrgRow:
    return OrgRow(
        id=company.id,
        name=company.name,
        subdomain=company.subdomain,
        accent=company.main_color,
        member_count=members,
        orders_month=orders,
        created_at=company.created_at,
    )


async def overview_stats(db: AsyncSession) -> tuple[int, int, int, int]:
    """Return (total_organizations, total_operators, total_members, orders_month)."""
    total_orgs = int((await db.exec(select(func.count()).select_from(Company))).one())
    total_operators = int(
        (await db.exec(select(func.count()).select_from(User).where(User.is_operator.is_(True)))).one()
    )
    total_members = int((await db.exec(select(func.count()).select_from(User))).one())
    orders_month = int(
        (await db.exec(select(func.count()).select_from(Order).where(Order.ordered_at >= _start_of_month()))).one()
    )
    return total_orgs, total_operators, total_members, orders_month


async def list_organizations(db: AsyncSession) -> list[OrgRow]:
    """Every tenant organization with derived member + this-month order counts."""
    companies = (await db.exec(select(Company).order_by(Company.created_at.asc()))).all()  # type: ignore[attr-defined]
    members = await _member_counts(db)
    orders = await _orders_month_counts(db)
    return [_org_row(c, members.get(c.id, 0), orders.get(c.id, 0)) for c in companies]


async def get_organization(db: AsyncSession, company_id: uuid.UUID) -> OrgRow:
    company = (await db.exec(select(Company).where(Company.id == company_id))).first()
    if company is None:
        raise NotFoundError(detail="Organization not found")
    members = int((await db.exec(select(func.count()).select_from(User).where(User.company_id == company_id))).one())
    orders = int(
        (
            await db.exec(
                select(func.count())
                .select_from(Order)
                .where(Order.company_id == company_id, Order.ordered_at >= _start_of_month())
            )
        ).one()
    )
    return _org_row(company, members, orders)


async def create_organization(db: AsyncSession, payload: OrgCreate) -> tuple[OrgRow, str]:
    """Create a company and a founding admin invite for its owner.

    Returns the new org row and the invite token. Raises ConflictError if the
    subdomain is taken.
    """
    existing = (await db.exec(select(Company).where(Company.subdomain == payload.subdomain))).first()
    if existing is not None:
        raise ConflictError(detail="Subdomain already in use")

    admin_role = (await db.exec(select(Role).where(Role.code == "admin"))).first()
    if admin_role is None:  # pragma: no cover — seeded by migration
        raise NotFoundError(detail="Admin role not seeded")

    company = Company(name=payload.name, subdomain=payload.subdomain, main_color=payload.main_color)
    db.add(company)
    await db.flush()

    invite = await create_invite(
        db,
        company_id=company.id,
        invited_by_id=None,
        payload=InviteCreate(email=payload.owner_email, role_id=admin_role.id),
    )
    await db.commit()
    await db.refresh(company)
    return _org_row(company, members=0, orders=0), invite.token


async def start_impersonation(db: AsyncSession, operator: User, company_id: uuid.UUID) -> Company:
    """Audit and validate the start of an operator support session for a company."""
    company = (await db.exec(select(Company).where(Company.id == company_id))).first()
    if company is None:
        raise NotFoundError(detail="Organization not found")
    await write_audit(
        db,
        company_id=company_id,
        user_id=operator.id,
        resource_type="companies",
        resource_id=company_id,
        message=f"Operator {operator.email} started a support session",
    )
    await db.commit()
    return company


async def list_operators(db: AsyncSession) -> list[OperatorRow]:
    """Platform staff — every User flagged is_operator, with company + role."""
    stmt = (
        select(User, Company, Role)
        .join(Company, Company.id == User.company_id)  # type: ignore[arg-type]
        .join(Role, Role.id == User.role_id)  # type: ignore[arg-type]
        .where(User.is_operator.is_(True))
        .order_by(User.created_at.asc())  # type: ignore[attr-defined]
    )
    rows = await db.exec(stmt)
    return [
        OperatorRow(
            id=user.id,
            name=user.name,
            email=user.email,
            company_id=company.id,
            company_name=company.name,
            role_name=role.name,
            created_at=user.created_at,
        )
        for user, company, role in rows.all()
    ]
