import uuid

from sqlalchemy import CheckConstraint, Column, ForeignKey, UniqueConstraint, Uuid
from sqlmodel import Field

from models.base import CompanyModel
from models.enums import BlankMovementKind, Size
from models.pg_enums import BLANK_MOVEMENT_KIND, SIZE


class BlankPiece(CompanyModel, table=True):
    """Peça lisa — a sewn, print-agnostic blank piece (garment body) in stock.

    The catalog row keyed by ``(spec, size, color_code)``. The on-hand quantity
    is NOT stored here; it is derived live from the append-only
    ``blank_piece_movements`` ledger (see ``services.blank_stock``), mirroring
    the finished-piece Stock and Supply features.
    """

    __tablename__ = "blank_pieces"
    __table_args__ = (
        UniqueConstraint(
            "company_id",
            "spec_id",
            "size",
            "color_code",
            name="uq_blank_pieces_company_id_spec_id_size_color_code",
        ),
        CheckConstraint(r"color_code ~ '^[A-Z]{3}$'", name="color_code_format"),
        CheckConstraint("min_stock IS NULL OR min_stock >= 0", name="min_stock_non_negative"),
    )

    spec_id: uuid.UUID = Field(
        sa_column=Column(
            Uuid,
            ForeignKey("product_specs.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
    )
    size: Size = Field(sa_type=SIZE)
    color: str = Field(max_length=40)
    color_code: str = Field(max_length=3)
    # Optional reorder threshold; when set, on-hand at or below it flags low stock.
    min_stock: int | None = Field(default=None, ge=0)


class BlankPieceMovement(CompanyModel, table=True):
    """Append-only ledger row for a blank piece.

    A single table carries a ``kind`` enum; ENTRY and ADJUSTMENT credit stock,
    EXIT debits it (every row holds a strictly-positive ``quantity``). On-hand
    is the signed sum of these rows per blank piece — no materialised balance
    column.
    """

    __tablename__ = "blank_piece_movements"
    __table_args__ = (CheckConstraint("quantity > 0", name="quantity_positive"),)

    blank_piece_id: uuid.UUID = Field(
        sa_column=Column(
            Uuid,
            ForeignKey("blank_pieces.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
    )
    kind: BlankMovementKind = Field(sa_type=BLANK_MOVEMENT_KIND)
    quantity: int = Field(gt=0)
    # Provenance: a movement crediting blank stock may originate from a received
    # sewing remessa (T3). Set only by the sewing-receipt transition (Phase 3),
    # null on manual movements.
    sewing_shipment_id: uuid.UUID | None = Field(
        default=None,
        sa_column=Column(
            Uuid,
            ForeignKey("sewing_shipments.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
    )
    # Provenance: a blank debit may originate from an assembly run (T5). Set only
    # by the assemble transition (Phase 4), null on manual movements.
    assembly_run_id: uuid.UUID | None = Field(
        default=None,
        sa_column=Column(
            Uuid,
            ForeignKey("assembly_runs.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
    )
    notes: str | None = Field(default=None, max_length=500)
