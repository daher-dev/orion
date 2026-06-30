import uuid

from sqlalchemy import Column, ForeignKey, UniqueConstraint, Uuid
from sqlmodel import Field

from models.base import CompanyModel
from models.enums import Ecommerce
from models.pg_enums import ECOMMERCE


class SkuMapping(CompanyModel, table=True):
    """Persistent De/Para keyed on the marketplace SKU (``(marketplace, sku)``).

    The Upseller export hands us one scrambled free-text ``Variação`` per line
    but a stable per-variation **SKU** (``188622046799``,
    ``18398298341-0391-BRANCO-M``). Rather than re-run a brittle fuzzy match on
    every import, a resolved SKU is remembered here: ``(company, marketplace,
    sku) → (ad_id, variation_id)``. The import consults this table first, so a
    once-resolved SKU lands deterministically forever after — never ambiguous,
    never re-guessed.

    Both sides of the resolution are stored: ``ad_id`` (the listing) AND
    ``variation_id`` (the internal SKU), so a single lookup resolves an order
    line end to end — covering the ``no matching ad`` cases as well as the
    ambiguous-variation ones. The invariant that the variation's product belongs
    to one of the ad's products is enforced at write time (mirroring
    ``services.mapping._assign_variation``), so a mapping can never decrement
    stock for a product the listing doesn't sell.
    """

    __tablename__ = "sku_mappings"
    __table_args__ = (
        # One resolution per marketplace SKU, per tenant — the De/Para key.
        UniqueConstraint(
            "company_id",
            "marketplace",
            "sku",
            name="uq_sku_mappings_company_id_marketplace_sku",
        ),
    )

    # Key: normalized marketplace (Ecommerce) + the marketplace SKU verbatim.
    marketplace: Ecommerce = Field(sa_type=ECOMMERCE)
    sku: str = Field(max_length=120)

    # Resolution target: the listing + the internal variation it sold.
    ad_id: uuid.UUID = Field(
        sa_column=Column(
            Uuid,
            ForeignKey("ads.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
    )
    variation_id: uuid.UUID = Field(
        sa_column=Column(
            Uuid,
            ForeignKey("product_variations.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
    )

    # Provenance: how the mapping was learned. "manual" = a human pinned it in
    # the import resolver (authoritative — never overwritten); "auto" = the
    # importer learned it from a successful fuzzy match; "backfill" = derived
    # from a historically-resolved order.
    source: str = Field(default="manual", max_length=40)
    created_by: uuid.UUID | None = Field(
        default=None,
        sa_column=Column(
            Uuid,
            ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
