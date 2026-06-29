import uuid

from sqlalchemy import Column, ForeignKey, UniqueConstraint, Uuid
from sqlmodel import Field

from models.base import CompanyModel
from models.enums import Ecommerce
from models.pg_enums import ECOMMERCE


class ImportedOrder(CompanyModel, table=True):
    """Marketplace-import provenance for an :class:`Order`.

    The Upseller export carries fulfillment data Orion's financial ``Order``
    does not model — channel, store, tracking, shipping label, NF-e key, the
    raw ad/SKU/variation text. Rather than pollute ``orders`` with those
    marketplace-specific columns, each imported row gets a companion
    ``ImportedOrder`` linked 1:1 to the ``Order`` it produced.

    Strict matching means a row only lands here once its ad + variation
    resolved against the tenant catalog; unmatched rows are reported as
    errors and never persisted.
    """

    __tablename__ = "imported_orders"
    __table_args__ = (
        # One import record per order.
        UniqueConstraint("company_id", "order_id", name="uq_imported_orders_company_id_order_id"),
        # Re-import idempotency: the same marketplace line (channel + platform
        # order id + sku) is ingested at most once per tenant.
        UniqueConstraint(
            "company_id",
            "marketplace",
            "platform_order_id",
            "sku",
            name="uq_imported_orders_marketplace_platform_order_id_sku",
        ),
    )

    order_id: uuid.UUID = Field(
        sa_column=Column(
            Uuid,
            ForeignKey("orders.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
    )

    # Provenance / channel. The raw export label ("Mercado Libre", "Shopee",
    # "Shein", …) is parsed to a single Ecommerce member at import time so the
    # re-import dedup key and the SkuMapping De/Para share one vocabulary.
    source: str = Field(default="upseller", max_length=40)
    marketplace: Ecommerce = Field(sa_type=ECOMMERCE)
    store_name: str | None = Field(default=None, max_length=120)
    platform_order_id: str = Field(max_length=120)
    upseller_order_no: str | None = Field(default=None, max_length=120)

    # Raw catalog snapshot from the source row (kept verbatim for audit/debug).
    ad_title: str = Field(max_length=300)
    sku: str = Field(max_length=120)
    variation_text: str | None = Field(default=None, max_length=200)
    color: str | None = Field(default=None, max_length=80)
    size: str | None = Field(default=None, max_length=40)
    quantity: int = Field(gt=0)

    # Fulfillment artifacts.
    image_url: str | None = Field(default=None, max_length=500)
    tracking_code: str | None = Field(default=None, max_length=120)
    shipping_label_url: str | None = Field(default=None, max_length=500)
    invoice_key: str | None = Field(default=None, max_length=64)
