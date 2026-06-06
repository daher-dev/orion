from enum import StrEnum


class ProductType(StrEnum):
    TSHIRT = "tshirt"
    SWEATSHIRT = "sweatshirt"
    SHORTS = "shorts"
    TANKTOP = "tanktop"


class Size(StrEnum):
    P = "p"
    M = "m"
    G = "g"
    GG = "gg"


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
    SHOPEE = "shopee"
    MERCADO_LIVRE = "mercado_livre"
    SHOPIFY = "shopify"
    INSTAGRAM = "instagram"
    WHATSAPP = "whatsapp"
    OTHER = "other"


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


class StockExitReason(StrEnum):
    SALE = "sale"
    ADJUSTMENT = "adjustment"
    LOSS = "loss"


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

    OPEN: just created, print quantities not yet finalized.
    ADJUSTED: per-stamp print quantities reviewed and saved.
    PRINTED: separation labels generated/printed.
    DONE: batch finished.
    CANCELLED: batch abandoned (member orders unlinked).
    """

    OPEN = "open"
    ADJUSTED = "adjusted"
    PRINTED = "printed"
    DONE = "done"
    CANCELLED = "cancelled"


class SeparationStatus(StrEnum):
    """Per-piece separation-label workflow status."""

    PENDING = "pending"  # no label printed yet
    LABEL_PRINTED = "label_printed"  # 100x50mm label printed, piece ready to pick
    CHECKED = "checked"  # scanned/verified at checkout


class LoginOutcome(StrEnum):
    """Result of a login-gate (`establish_session`) attempt.

    Recorded for every sign-in so denied attempts are visible (the gate
    otherwise just raises a 403 and leaves no trace).
    """

    SUCCESS = "success"  # resolved an existing membership or accepted an invite
    NOT_INVITED = "not_invited"  # verified email, but no membership and no pending invite
    UNVERIFIED_EMAIL = "unverified_email"  # has a matching invite path blocked by unverified email
    MISSING_UID = "missing_uid"  # token carried no Firebase uid
