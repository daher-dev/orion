import uuid

from sqlalchemy import CheckConstraint, Column, ForeignKey, UniqueConstraint, Uuid
from sqlmodel import Field

from models.base import CompanyModel
from models.enums import ProductType, Size
from models.pg_enums import PRODUCT_TYPE, SIZE


class Product(CompanyModel, table=True):
    __tablename__ = "products"
    # `print_id` is nullable (a product may have no print). NULLS NOT DISTINCT
    # makes Postgres treat NULLs as equal for uniqueness, so two no-print
    # products with the same spec still collide.
    __table_args__ = (
        UniqueConstraint(
            "company_id",
            "spec_id",
            "print_id",
            name="uq_products_spec_id_print_id",
            postgresql_nulls_not_distinct=True,
        ),
    )

    name: str = Field(max_length=120)
    product_type: ProductType = Field(sa_type=PRODUCT_TYPE)
    spec_id: uuid.UUID = Field(
        sa_column=Column(
            Uuid,
            ForeignKey("product_specs.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
    )
    print_id: uuid.UUID | None = Field(
        default=None,
        sa_column=Column(
            Uuid,
            ForeignKey("print_designs.id", ondelete="RESTRICT"),
            nullable=True,
            index=True,
        ),
    )


class ProductVariation(CompanyModel, table=True):
    __tablename__ = "product_variations"
    __table_args__ = (
        UniqueConstraint(
            "company_id",
            "product_id",
            "size",
            "color_code",
            name="uq_product_variations_product_id_size_color_code",
        ),
        UniqueConstraint("company_id", "sku", name="uq_product_variations_company_id_sku"),
        CheckConstraint(r"color_code ~ '^[A-Z]{3}$'", name="color_code_format"),
    )

    product_id: uuid.UUID = Field(
        sa_column=Column(
            Uuid,
            ForeignKey("products.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
    )
    size: Size = Field(sa_type=SIZE)
    color: str = Field(max_length=40)
    color_code: str = Field(max_length=3)
    sku: str = Field(max_length=64)

    @staticmethod
    def make_sku(
        spec_code: str,
        size: Size,
        color_code: str,
        print_code: str | None = None,
    ) -> str:
        """Predictable SKU format following the production order:

            <SPEC>-<SIZE>-<COLOR>[-<PRINT>]

        Print is appended only when the product has an estampa — products
        without a print stop at the color segment.

        Examples:
            make_sku("CAM01", Size.M, "BLK")             -> "CAM01-M-BLK"
            make_sku("CAM01", Size.M, "BLK", "FLR03")    -> "CAM01-M-BLK-FLR03"
        """
        base = f"{spec_code}-{size.value.upper()}-{color_code.upper()}"
        return f"{base}-{print_code}" if print_code else base
