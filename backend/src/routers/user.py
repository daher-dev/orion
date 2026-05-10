from fastapi import APIRouter

from dependencies import CurrentDbUser, DbSession
from schemas.auth import RoleSummary
from schemas.user import UserRead, UserUpdate
from services.user import update_user_self

router = APIRouter(prefix="/users", tags=["users"])


def _to_read(user) -> UserRead:
    role = user.role
    return UserRead(
        id=user.id,
        name=user.name,
        email=user.email,
        job=user.job,
        is_operator=user.is_operator,
        role=RoleSummary(
            id=role.id,
            code=role.code,
            name=role.name,
            description=role.description,
        ),
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


@router.get("/me", response_model=UserRead)
async def get_my_user(user: CurrentDbUser) -> UserRead:
    return _to_read(user)


@router.patch("/me", response_model=UserRead)
async def update_my_user(
    payload: UserUpdate,
    user: CurrentDbUser,
    db: DbSession,
) -> UserRead:
    updated = await update_user_self(
        db,
        company_id=user.company_id,
        user_id=user.id,
        payload=payload,
    )
    return _to_read(updated)
