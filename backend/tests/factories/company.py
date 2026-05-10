import uuid

from polyfactory import Use
from polyfactory.factories.pydantic_factory import ModelFactory
from sqlmodel.ext.asyncio.session import AsyncSession

from models import Company

_PALETTE = ("#2563eb", "#7c5cff", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444")


class CompanyFactory(ModelFactory[Company]):
    __model__ = Company
    __use_defaults__ = True
    __set_as_default_factory_for_type__ = True

    main_color = Use(lambda: _PALETTE[uuid.uuid4().int % len(_PALETTE)])
    subdomain = Use(lambda: f"co-{uuid.uuid4().hex[:8]}")


async def create_company(db: AsyncSession, **overrides) -> Company:
    company = CompanyFactory.build(**overrides)
    db.add(company)
    await db.commit()
    await db.refresh(company)
    return company
