import secrets
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import selectinload
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from models import Company, Invite, Role, User
from schemas.auth import InviteCreate
from services._audit import write_audit
from shared.exceptions import AuthorizationError, ConflictError, NotFoundError, ValidationError

_TOKEN_BYTES = 32


async def get_user_companies(db: AsyncSession, firebase_uid: str) -> list[tuple[User, Company, Role]]:
    """All (user, company, role) tuples for a given Firebase identity, ordered by created_at ASC."""

    stmt = (
        select(User, Company, Role)
        .join(Company, Company.id == User.company_id)
        .join(Role, Role.id == User.role_id)
        .where(User.firebase_uid == firebase_uid)
        .order_by(User.created_at.asc())  # type: ignore[attr-defined]
        .options(selectinload(Role.permissions))  # type: ignore[attr-defined]
    )
    result = await db.exec(stmt)
    return list(result.all())


async def establish_session(db: AsyncSession, *, claims: dict) -> list[tuple[User, Company, Role]]:
    """Resolve — or provision — the memberships for an authenticated Firebase identity.

    This is the login gate. A sign-in only succeeds for someone who is already a
    member, or whose *verified* email has a pending invite (which we accept on the
    spot). Everyone else is rejected with a 403 — there is no self-signup.
    """

    firebase_uid = claims.get("uid")
    if not firebase_uid:
        raise ValidationError(detail="Missing Firebase UID in token claims")

    memberships = await get_user_companies(db, firebase_uid)
    if memberships:
        return memberships

    email = (claims.get("email") or "").strip().lower()
    email_verified = bool(claims.get("email_verified"))
    if (
        email
        and email_verified
        and await _accept_pending_invites_for_email(db, firebase_uid=firebase_uid, claims=claims, email=email)
    ):
        return await get_user_companies(db, firebase_uid)

    raise AuthorizationError(detail="not_invited")


async def _accept_pending_invites_for_email(
    db: AsyncSession,
    *,
    firebase_uid: str,
    claims: dict,
    email: str,
) -> bool:
    """Accept every unexpired pending invite matching `email`, provisioning a User
    per company. Returns True if at least one membership was created or confirmed."""

    result = await db.exec(
        select(Invite).where(
            func.lower(Invite.email) == email,
            Invite.accepted_at.is_(None),  # type: ignore[union-attr]
        )
    )
    now = datetime.now(UTC)
    accepted_any = False
    for invite in result.all():
        expires_at = invite.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=UTC)
        if expires_at <= now:
            continue

        existing = await db.exec(
            select(User).where(
                User.firebase_uid == firebase_uid,
                User.company_id == invite.company_id,
            )
        )
        user = existing.first()
        if user is None:
            user = User(
                company_id=invite.company_id,
                firebase_uid=firebase_uid,
                name=claims.get("name") or claims.get("email") or invite.email,
                email=claims.get("email") or invite.email,
                role_id=invite.role_id,
            )
            db.add(user)
            await db.flush()

        invite.accepted_at = now
        invite.accepted_by_id = user.id
        db.add(invite)

        await write_audit(
            db,
            company_id=invite.company_id,
            user_id=user.id,
            resource_type="invites",
            resource_id=invite.id,
            message=f"Invite auto-accepted at login by {user.email}",
        )
        accepted_any = True

    if accepted_any:
        await db.commit()
    return accepted_any


async def create_invite(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    invited_by_id: uuid.UUID,
    payload: InviteCreate,
) -> Invite:
    """Create a pending invite. Raises ConflictError if a pending one already exists."""

    role_result = await db.exec(select(Role).where(Role.id == payload.role_id))
    role = role_result.first()
    if role is None:
        raise NotFoundError(detail="Role not found")

    pending = await db.exec(
        select(Invite).where(
            Invite.company_id == company_id,
            Invite.email == payload.email,
            Invite.accepted_at.is_(None),  # type: ignore[union-attr]
        )
    )
    if pending.first() is not None:
        raise ConflictError(detail="A pending invite already exists for this email")

    token = secrets.token_urlsafe(_TOKEN_BYTES)
    expires_at = datetime.now(UTC) + timedelta(hours=payload.expires_in_hours)

    invite = Invite(
        company_id=company_id,
        token=token,
        email=str(payload.email),
        role_id=payload.role_id,
        invited_by_id=invited_by_id,
        expires_at=expires_at,
    )
    db.add(invite)
    await db.flush()

    await write_audit(
        db,
        company_id=company_id,
        user_id=invited_by_id,
        resource_type="invites",
        resource_id=invite.id,
        message=f"Invite created for {payload.email}",
    )

    await db.commit()
    await db.refresh(invite)
    return invite


async def get_invite_by_token(db: AsyncSession, token: str) -> Invite:
    """Fetch a non-expired, non-accepted invite by token. Raises NotFoundError otherwise."""

    result = await db.exec(select(Invite).where(Invite.token == token))
    invite = result.first()
    if invite is None:
        raise NotFoundError(detail="Invite not found")
    if invite.accepted_at is not None:
        raise NotFoundError(detail="Invite already accepted")
    expires_at = invite.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    if expires_at <= datetime.now(UTC):
        raise NotFoundError(detail="Invite has expired")
    return invite


async def accept_invite(
    db: AsyncSession,
    *,
    claims: dict,
    token: str,
    name_override: str | None = None,
) -> tuple[Company, User, Role]:
    """Accept an invite for the authenticated Firebase identity."""

    invite = await get_invite_by_token(db, token)

    firebase_uid = claims.get("uid")
    if not firebase_uid:
        raise ValidationError(detail="Missing Firebase UID in token claims")

    company_result = await db.exec(select(Company).where(Company.id == invite.company_id))
    company = company_result.first()
    if company is None:
        raise NotFoundError(detail="Company not found")

    role_result = await db.exec(select(Role).where(Role.id == invite.role_id))
    role = role_result.first()
    if role is None:
        raise NotFoundError(detail="Role not found")

    existing = await db.exec(
        select(User).where(
            User.firebase_uid == firebase_uid,
            User.company_id == invite.company_id,
        )
    )
    user = existing.first()
    if user is None:
        user = User(
            company_id=invite.company_id,
            firebase_uid=firebase_uid,
            name=name_override or claims.get("name") or claims.get("email") or invite.email,
            email=claims.get("email") or invite.email,
            role_id=invite.role_id,
        )
        db.add(user)
        await db.flush()

    invite.accepted_at = datetime.now(UTC)
    invite.accepted_by_id = user.id
    db.add(invite)

    await write_audit(
        db,
        company_id=invite.company_id,
        user_id=user.id,
        resource_type="invites",
        resource_id=invite.id,
        message=f"Invite accepted by {user.email}",
    )

    await db.commit()
    await db.refresh(company)
    await db.refresh(user)
    return company, user, role


async def get_user_in_company(
    db: AsyncSession,
    *,
    firebase_uid: str,
    company_id: uuid.UUID,
) -> User | None:
    result = await db.exec(
        select(User).where(
            User.firebase_uid == firebase_uid,
            User.company_id == company_id,
        )
    )
    return result.first()
