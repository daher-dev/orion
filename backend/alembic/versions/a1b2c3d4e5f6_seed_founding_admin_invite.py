"""seed founding admin invite for joao@daher.dev

Production login is invite-only with no self-signup, and we cannot know an
operator's Firebase UID until they first authenticate. To avoid a hard lockout
of a freshly-deployed environment, this migration seeds:

  * a founding "Orion" company (subdomain ``orion``), and
  * a far-future *pending* admin invite for ``joao@daher.dev``.

On that identity's first verified Google/Apple/email sign-in, the login gate
(``services.auth.establish_session``) matches the verified email to this pending
invite and auto-provisions an admin User — no UID needs to be known in advance.

Idempotent: re-running is a no-op if the company or a pending invite for the
email already exists, so it is safe across repeated deploys and environments.

Revision ID: a1b2c3d4e5f6
Revises: 49fde4947022
Create Date: 2026-06-01 20:00:00.000000
"""

import secrets
import uuid
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: str | Sequence[str] | None = "49fde4947022"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


FOUNDING_EMAIL = "joao@daher.dev"
FOUNDING_COMPANY_NAME = "Orion"
FOUNDING_SUBDOMAIN = "orion"
FOUNDING_MAIN_COLOR = "#a83227"  # Ember accent — the Orion brand color.
# ~100 years out: the founding invite must never silently expire and re-lock us.
_INVITE_TTL = timedelta(days=365 * 100)


def upgrade() -> None:
    bind = op.get_bind()

    # Resolve the seeded admin role (created by migration 3187f02cbc35).
    admin_role_id = bind.execute(sa.text("SELECT id FROM roles WHERE code = 'admin' LIMIT 1")).scalar()
    if admin_role_id is None:
        raise RuntimeError("Admin role not seeded — cannot create founding invite.")

    # Idempotent company upsert by unique subdomain.
    company_id = bind.execute(
        sa.text("SELECT id FROM companies WHERE subdomain = :sub"),
        {"sub": FOUNDING_SUBDOMAIN},
    ).scalar()
    if company_id is None:
        company_id = uuid.uuid4()
        bind.execute(
            sa.text("INSERT INTO companies (id, name, subdomain, main_color) VALUES (:id, :name, :sub, :color)"),
            {
                "id": company_id,
                "name": FOUNDING_COMPANY_NAME,
                "sub": FOUNDING_SUBDOMAIN,
                "color": FOUNDING_MAIN_COLOR,
            },
        )

    # Skip if this identity is already provisioned or already has a pending invite.
    already_member = bind.execute(
        sa.text("SELECT 1 FROM users WHERE company_id = :cid AND lower(email) = lower(:email) LIMIT 1"),
        {"cid": company_id, "email": FOUNDING_EMAIL},
    ).scalar()
    pending_invite = bind.execute(
        sa.text(
            "SELECT 1 FROM invites "
            "WHERE company_id = :cid AND lower(email) = lower(:email) AND accepted_at IS NULL "
            "LIMIT 1"
        ),
        {"cid": company_id, "email": FOUNDING_EMAIL},
    ).scalar()
    if already_member or pending_invite:
        return

    bind.execute(
        sa.text(
            "INSERT INTO invites (id, company_id, token, email, role_id, expires_at) "
            "VALUES (:id, :cid, :token, :email, :role_id, :expires_at)"
        ),
        {
            "id": uuid.uuid4(),
            "cid": company_id,
            "token": secrets.token_urlsafe(32),
            "email": FOUNDING_EMAIL,
            "role_id": admin_role_id,
            "expires_at": datetime.now(UTC) + _INVITE_TTL,
        },
    )


def downgrade() -> None:
    bind = op.get_bind()
    company_id = bind.execute(
        sa.text("SELECT id FROM companies WHERE subdomain = :sub"),
        {"sub": FOUNDING_SUBDOMAIN},
    ).scalar()
    if company_id is None:
        return
    # Only remove the *unaccepted* founding invite. If it was already accepted
    # (the user is now a real admin), leave the company + membership intact.
    bind.execute(
        sa.text("DELETE FROM invites WHERE company_id = :cid AND lower(email) = lower(:email) AND accepted_at IS NULL"),
        {"cid": company_id, "email": FOUNDING_EMAIL},
    )
    member_or_accepted = bind.execute(
        sa.text(
            "SELECT 1 FROM users WHERE company_id = :cid "
            "UNION ALL SELECT 1 FROM invites WHERE company_id = :cid AND accepted_at IS NOT NULL "
            "LIMIT 1"
        ),
        {"cid": company_id},
    ).scalar()
    if not member_or_accepted:
        bind.execute(sa.text("DELETE FROM companies WHERE id = :cid"), {"cid": company_id})
