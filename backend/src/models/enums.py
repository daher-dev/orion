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
