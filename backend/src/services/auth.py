import secrets
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import selectinload
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from logger import get_logger
from models import Company, Invite, LoginAttempt, LoginOutcome, Role, User
from schemas.auth import InviteCreate
from services._audit import write_audit
from shared.exceptions import AuthorizationError, ConflictError, NotFoundError, ValidationError

logger = get_logger(__name__)

_TOKEN_BYTES = 32


async def _record_login_attempt(
    db: AsyncSession,
    *,
    email: str,
    firebase_uid: str | None,
    email_verified: bool,
    outcome: LoginOutcome,
    company_id: uuid.UUID | None = None,
    detail: str | None = None,
) -> None:
    """Append a `login_attempts` row and commit it in its own right.

    The login gate raises on failure (which would roll back the request
    transaction), so the attempt is committed immediately and independently —
    a denied login must leave a trace even though nothing else is persisted.
    Recording must never mask the real auth result, so any failure here is
    swallowed after logging.
    """
    try:
        db.add(
            LoginAttempt(
                email=email,
                firebase_uid=firebase_uid,
                email_verified=email_verified,
                outcome=outcome,
                company_id=company_id,
                detail=detail,
            )
        )
        await db.commit()
    except Exception:  # pragma: no cover - defensive; never break login on logging
        logger.exception("Failed to record login attempt", extra={"email": email, "outcome": outcome.value})
        await db.rollback()
    else:
        logger.info(
            "login_attempt",
            extra={
                "email": email,
                "outcome": outcome.value,
                "email_verified": email_verified,
                "company_id": str(company_id) if company_id else None,
            },
        )


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


async def list_login_attempts(
    db: AsyncSession,
    *,
    email: str | None = None,
    limit: int = 100,
) -> tuple[list[LoginAttempt], int]:
    """Recent login-gate attempts, newest first. Optional case-insensitive email filter.

    Not tenant-scoped on purpose: denied attempts have no company, and this is an
    admin-only troubleshooting view (gated at the router by `users.read`).
    """

    where = []
    if email:
        where.append(func.lower(LoginAttempt.email) == email.strip().lower())

    count_stmt = select(func.count()).select_from(LoginAttempt)
    for clause in where:
        count_stmt = count_stmt.where(clause)
    total = int((await db.exec(count_stmt)).first() or 0)

    stmt = select(LoginAttempt)
    for clause in where:
        stmt = stmt.where(clause)
    stmt = stmt.order_by(LoginAttempt.created_at.desc()).limit(limit)  # type: ignore[attr-defined]
    rows = list((await db.exec(stmt)).all())
    return rows, total


async def establish_session(db: AsyncSession, *, claims: dict) -> list[tuple[User, Company, Role]]:
    """Resolve — or provision — the memberships for an authenticated Firebase identity.

    This is the login gate. A sign-in only succeeds for someone who is already a
    member, or whose *verified* email has a pending invite (which we accept on the
    spot). Everyone else is rejected with a 403 — there is no self-signup.
    """

    firebase_uid = claims.get("uid")
    email = (claims.get("email") or "").strip().lower()
    email_verified = bool(claims.get("email_verified"))

    if not firebase_uid:
        await _record_login_attempt(
            db,
            email=email,
            firebase_uid=None,
            email_verified=email_verified,
            outcome=LoginOutcome.MISSING_UID,
            detail="token carried no uid",
        )
        raise ValidationError(detail="Missing Firebase UID in token claims")

    memberships = await get_user_companies(db, firebase_uid)
    if memberships:
        await _record_login_attempt(
            db,
            email=email,
            firebase_uid=firebase_uid,
            email_verified=email_verified,
            outcome=LoginOutcome.SUCCESS,
            company_id=memberships[0][1].id,
            detail=f"resolved {len(memberships)} membership(s)",
        )
        return memberships

    if (
        email
        and email_verified
        and await _accept_pending_invites_for_email(db, firebase_uid=firebase_uid, claims=claims, email=email)
    ):
        memberships = await get_user_companies(db, firebase_uid)
        await _record_login_attempt(
            db,
            email=email,
            firebase_uid=firebase_uid,
            email_verified=email_verified,
            outcome=LoginOutcome.SUCCESS,
            company_id=memberships[0][1].id if memberships else None,
            detail="accepted pending invite at login",
        )
        return memberships

    # Denied. Distinguish "had a matching invite but email wasn't verified"
    # (actionable for the user) from a plain "not invited".
    has_pending = bool(email) and await _has_pending_invite_for_email(db, email=email)
    if has_pending and not email_verified:
        outcome, detail = LoginOutcome.UNVERIFIED_EMAIL, "matching invite exists but email is unverified"
    else:
        outcome, detail = LoginOutcome.NOT_INVITED, "no membership and no pending invite"
    await _record_login_attempt(
        db,
        email=email,
        firebase_uid=firebase_uid,
        email_verified=email_verified,
        outcome=outcome,
        detail=detail,
    )
    raise AuthorizationError(detail="not_invited")


async def _has_pending_invite_for_email(db: AsyncSession, *, email: str) -> bool:
    """True if any unexpired, unaccepted invite matches `email` (case-insensitive)."""

    result = await db.exec(
        select(Invite.expires_at).where(
            func.lower(Invite.email) == email,
            Invite.accepted_at.is_(None),  # type: ignore[union-attr]
        )
    )
    now = datetime.now(UTC)
    for expires_at in result.all():
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=UTC)
        if expires_at > now:
            return True
    return False


async def _provision_or_rebind_user(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    firebase_uid: str,
    name: str,
    email: str,
    role_id: uuid.UUID,
) -> User:
    """Resolve the User for a Firebase identity joining a company, creating it if needed.

    Three cases, in order:
    1. A membership already exists for this ``firebase_uid`` — return it (idempotent).
    2. A row with the same email exists but a different uid — this is an *imported*
       user (placeholder ``base44:`` uid) being claimed by its real owner. Rebind
       its ``firebase_uid`` instead of inserting, which would otherwise violate the
       ``(company_id, email)`` unique constraint. Curated fields (name/role) are kept.
    3. Nobody matches — create a fresh user.
    """

    by_uid = (
        await db.exec(select(User).where(User.firebase_uid == firebase_uid, User.company_id == company_id))
    ).first()
    if by_uid is not None:
        return by_uid

    if email:
        by_email = (
            await db.exec(
                select(User).where(
                    User.company_id == company_id,
                    func.lower(User.email) == email.strip().lower(),
                )
            )
        ).first()
        if by_email is not None:
            by_email.firebase_uid = firebase_uid
            db.add(by_email)
            await db.flush()
            return by_email

    user = User(
        company_id=company_id,
        firebase_uid=firebase_uid,
        name=name,
        email=email,
        role_id=role_id,
    )
    db.add(user)
    await db.flush()
    return user


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

        user = await _provision_or_rebind_user(
            db,
            company_id=invite.company_id,
            firebase_uid=firebase_uid,
            name=claims.get("name") or claims.get("email") or invite.email,
            email=claims.get("email") or invite.email,
            role_id=invite.role_id,
        )

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

    user = await _provision_or_rebind_user(
        db,
        company_id=invite.company_id,
        firebase_uid=firebase_uid,
        name=name_override or claims.get("name") or claims.get("email") or invite.email,
        email=claims.get("email") or invite.email,
        role_id=invite.role_id,
    )

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
