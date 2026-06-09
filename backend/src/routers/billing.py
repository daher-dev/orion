from typing import Annotated

from fastapi import APIRouter, Depends

from dependencies import DbSession, RequirePermission
from models import User
from schemas.billing import BillingSummary
from services.billing import get_billing_summary

router = APIRouter(
    prefix="/billing",
    tags=["Billing"],
    dependencies=[Depends(RequirePermission("billing.read"))],
)


@router.get("/summary", response_model=BillingSummary)
async def get_summary_endpoint(
    db: DbSession,
    user: Annotated[User, Depends(RequirePermission("billing.read"))],
) -> BillingSummary:
    """The signed-in tenant's plan, live usage vs. plan limits, and invoice stub."""
    return await get_billing_summary(db, company_id=user.company_id)
