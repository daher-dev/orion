from enum import StrEnum


class ProductType(StrEnum):
    """Garment types (tipos de peça) — the base silhouette of a product.

    Mirrors the ``garmentTypes`` catalog config used across the shop floor.
    """

    CAMISETA = "camiseta"
    MOLETOM = "moletom"
    REGATA = "regata"
    BLUSA = "blusa"
    CALCA = "calca"
    BERMUDA = "bermuda"
    ECOBAG = "ecobag"
    CROPPED = "cropped"


class Size(StrEnum):
    P = "p"
    M = "m"
    G = "g"
    GG = "gg"
    U = "u"  # Único — one-size (shown as "U" in the UI)


class FabricType(StrEnum):
    JERSEY = "jersey"
    FLEECE = "fleece"
    FRENCH_TERRY = "french_terry"
    MESH = "mesh"
    RIB = "rib"


class FabricRollKind(StrEnum):
    """Role a roll plays in production: body fabric vs rib trim."""

    BODY = "body"
    RIB = "rib"


class TrimType(StrEnum):
    BUTTON = "button"
    ZIPPER = "zipper"
    LABEL = "label"
    DRAWSTRING = "drawstring"
    SNAP = "snap"
    HOOK = "hook"
    EYELET = "eyelet"
    ELASTIC = "elastic"


class Ecommerce(StrEnum):
    """Sales channel of a listing — marketplaces and owned channels alike.

    The marketplace members (``SHOPEE``, ``MERCADO_LIVRE``, ``SHEIN``,
    ``TIKTOK_SHOP``) are also the canonical values stored on every
    marketplace-import record (``ImportedOrder.marketplace`` and the
    ``SkuMapping`` De/Para key) — the raw export label is parsed to one of
    these once, at import time, so nothing downstream handles free text.
    """

    SHOPEE = "shopee"
    MERCADO_LIVRE = "mercado_livre"
    SHEIN = "shein"
    TIKTOK_SHOP = "tiktok_shop"
    SHOPIFY = "shopify"
    INSTAGRAM = "instagram"
    WHATSAPP = "whatsapp"
    OTHER = "other"


class ChannelStatus(StrEnum):
    """Lifecycle of a per-company marketplace/channel connection.

    AVAILABLE: a supported channel the tenant has not connected yet (the
        synthetic state surfaced for catalog channels without a persisted row).
    CONNECTED: tokens are stored and the channel is live.
    ERROR: a previously-connected channel whose last sync/auth failed; tokens
        may be stale and need re-authentication.
    """

    AVAILABLE = "available"
    CONNECTED = "connected"
    ERROR = "error"


class CuttingStatus(StrEnum):
    PENDING = "pending"
    CUTTING = "cutting"
    DONE = "done"


class ShipmentStatus(StrEnum):
    SENT = "sent"
    RECEIVED = "received"
    PARTIAL = "partial"
    CANCELLED = "cancelled"


class StockSource(StrEnum):
    SHIPMENT = "shipment"
    ADJUSTMENT = "adjustment"
    RETURN = "return"
    ASSEMBLY = "assembly"  # finished pieces credited by an Assembly (Montagem) run


class StockExitReason(StrEnum):
    SALE = "sale"
    ADJUSTMENT = "adjustment"
    LOSS = "loss"


class FabricMovementKind(StrEnum):
    """Direction of a fabric-roll (bobina) stock movement.

    ENTRY and ADJUSTMENT credit current_weight_kg; EXIT debits it
    (every row holds a strictly-positive quantity in kg). Like ``PaperRoll``,
    the authoritative on-hand for fabric is the roll's ``current_weight_kg``
    column — this ledger exists purely for traceable history.
    """

    ENTRY = "entry"
    EXIT = "exit"
    ADJUSTMENT = "adjustment"


class PaperType(StrEnum):
    """Kind of print-transfer paper/film roll (bobina de papel)."""

    DTF_FILM = "dtf_film"
    SUBLIMATION_PAPER = "sublimation_paper"
    TRANSFER_PAPER = "transfer_paper"


class PrintSide(StrEnum):
    """Which face of a garment an estampa is applied to."""

    FRONT = "front"
    BACK = "back"


class PrintOrderStatus(StrEnum):
    """Lifecycle of a print order (ordem de impressão)."""

    PENDING = "pending"
    PRINTING = "printing"
    DONE = "done"


class ArtworkStatus(StrEnum):
    """Whether a print-design variation's artwork (PNG) has been uploaded.

    Server-derived from the presence of the side's file URL — clients never
    set it directly.
    """

    OK = "ok"
    PENDING = "pending"


class BlankMovementKind(StrEnum):
    """Direction of a blank-piece (peça lisa) stock movement.

    ENTRY and ADJUSTMENT credit on-hand; EXIT debits it (every row holds a
    strictly-positive quantity).
    """

    ENTRY = "entry"
    EXIT = "exit"
    ADJUSTMENT = "adjustment"


class PaperMovementKind(StrEnum):
    """Direction of a paper/film-roll (bobina de papel) stock movement.

    ENTRY and ADJUSTMENT credit on-hand; EXIT debits it (every row holds a
    strictly-positive quantity).
    """

    ENTRY = "entry"
    EXIT = "exit"
    ADJUSTMENT = "adjustment"


class PrintedMovementKind(StrEnum):
    """Direction of a printed-transfer (estampado) stock movement.

    ENTRY and ADJUSTMENT credit on-hand; EXIT debits it (every row holds a
    strictly-positive quantity).
    """

    ENTRY = "entry"
    EXIT = "exit"
    ADJUSTMENT = "adjustment"


class OrderStatus(StrEnum):
    PENDING = "pending"
    PAID = "paid"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"
    RETURNED = "returned"


class PrintTechnique(StrEnum):
    """Application method for an estampa (print design)."""

    DTF = "dtf"
    SILKSCREEN = "silkscreen"
    SUBLIMATION = "sublimation"


class BatchStatus(StrEnum):
    """Lifecycle of a production/dispatch batch (lote).

    OPEN: just created, member orders being grouped.
    IN_PRODUCTION: pieces being assembled/picked for the batch.
    DISPATCHED: batch handed off to shipping.
    DONE: batch finished.
    CANCELLED: batch abandoned (member orders unlinked).
    """

    OPEN = "open"
    IN_PRODUCTION = "in_production"
    DISPATCHED = "dispatched"
    DONE = "done"
    CANCELLED = "cancelled"


class SeparationStatus(StrEnum):
    """Per-piece separation-label workflow status."""

    PENDING = "pending"  # no label printed yet
    LABEL_PRINTED = "label_printed"  # 100x50mm label printed, piece ready to pick
    CHECKED = "checked"  # scanned/verified at checkout


class SubscriptionStatus(StrEnum):
    """Lifecycle of a company's billing subscription.

    Payments are out of scope today, so most companies sit on FREE (the seeded
    default plan) and never transition. The remaining states exist so the model
    is forward-compatible with a real billing provider:

    ACTIVE: a paid subscription in good standing.
    TRIALING: inside a time-boxed trial of a paid plan.
    PAST_DUE: a paid subscription whose last charge failed (grace period).
    PAUSED: temporarily suspended by the owner; no charges, limited access.
    CANCELLED: ended; retained for history.
    FREE: on the no-cost default plan (the lazy default for new companies).
    """

    ACTIVE = "active"
    TRIALING = "trialing"
    PAST_DUE = "past_due"
    PAUSED = "paused"
    CANCELLED = "cancelled"
    FREE = "free"


class LoginOutcome(StrEnum):
    """Result of a login-gate (`establish_session`) attempt.

    Recorded for every sign-in so denied attempts are visible (the gate
    otherwise just raises a 403 and leaves no trace).
    """

    SUCCESS = "success"  # resolved an existing membership or accepted an invite
    NOT_INVITED = "not_invited"  # verified email, but no membership and no pending invite
    UNVERIFIED_EMAIL = "unverified_email"  # has a matching invite path blocked by unverified email
    MISSING_UID = "missing_uid"  # token carried no Firebase uid
