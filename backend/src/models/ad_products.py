import uuid

from sqlalchemy import Column, ForeignKey, UniqueConstraint, Uuid
from sqlmodel import Field

from models.base import CompanyModel


class AdProduct(CompanyModel, table=True):
    """Join row linking a marketplace listing (Ad) to a Product it sells.

    An ad sells many products/SKUs, and a product can be listed in many ads, so
    this is a many-to-many bridge between ``ads`` and ``products``.
    """

    __tablename__ = "ad_products"
    __table_args__ = (UniqueConstraint("ad_id", "product_id", name="uq_ad_products_ad_id_product_id"),)

    ad_id: uuid.UUID = Field(
        sa_column=Column(Uuid, ForeignKey("ads.id", ondelete="CASCADE"), nullable=False, index=True),
    )
    product_id: uuid.UUID = Field(
        sa_column=Column(Uuid, ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True),
    )
