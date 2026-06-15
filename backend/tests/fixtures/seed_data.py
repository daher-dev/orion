"""Demo seed data ported from `docs/design/source/data.js`.

Used by the dev seed script and any tests that want a realistic apparel scenario.
All values are pure Python dicts — no DB-specific types — so the consumer can
build/insert them however it likes.
"""

from datetime import UTC, datetime, timedelta
from decimal import Decimal

from models import (
    CuttingStatus,
    Ecommerce,
    FabricRollKind,
    FabricType,
    OrderStatus,
    ProductType,
    ShipmentStatus,
    Size,
    StockSource,
)

NOW = datetime.now(UTC)
TODAY = NOW.date()


COMPANY = {
    "name": "Underground",
    "subdomain": "underground",
    "main_color": "#2563eb",
}


# Three deterministic users covering each seeded role.
USERS = [
    {
        "key": "admin",
        "firebase_uid": "admin-alfa-uid",
        "name": "Alfa Admin",
        "email": "alfa@underground.test",
        "job": "Founder",
        "is_operator": False,
        "role_code": "admin",
    },
    {
        "key": "manager",
        "firebase_uid": "manager-beta-uid",
        "name": "Beta Manager",
        "email": "beta@underground.test",
        "job": "Operations Manager",
        "is_operator": False,
        "role_code": "manager",
    },
    {
        "key": "operator",
        "firebase_uid": "operator-gamma-uid",
        "name": "Gamma Operator",
        "email": "gamma@underground.test",
        "job": "Cutting Operator",
        "is_operator": True,
        "role_code": "operator",
    },
]


CLIENTS = [
    {
        "key": "c-301",
        "name": "Mariana Costa",
        "address": "São Paulo, SP",
        "phone": "+55 11 90000-0001",
        "email": "mariana@example.com",
    },
    {
        "key": "c-302",
        "name": "Felipe Andrade",
        "address": "Curitiba, PR",
        "phone": "+55 41 90000-0002",
        "email": "felipe@example.com",
    },
    {
        "key": "c-303",
        "name": "Beatriz Rocha",
        "address": "Rio de Janeiro, RJ",
        "phone": "+55 21 90000-0003",
        "email": "beatriz@example.com",
    },
    {
        "key": "c-304",
        "name": "Lucas Pereira",
        "address": "Belo Horizonte, MG",
        "phone": "+55 31 90000-0004",
        "email": "lucas@example.com",
    },
    {
        "key": "c-305",
        "name": "Aline Souza",
        "address": "Salvador, BA",
        "phone": "+55 71 90000-0005",
        "email": "aline@example.com",
    },
]


PRINT_DESIGNS = [
    {"key": "pd-flora", "code": "FLR03", "name": "Flora Tropical", "cost_per_unit": Decimal("4.20")},
    {"key": "pd-graf", "code": "GRF01", "name": "Grafite Básico", "cost_per_unit": Decimal("3.10")},
]


PRODUCT_SPECS = [
    {
        "key": "ft-cropped",
        "code": "FT001",
        "name": "Cropped Oversized",
        "fabric_type": FabricType.JERSEY,
        "fabric_grammage_gsm": 180,
        "fabric_weight_per_piece_g": Decimal("220.00"),
        "has_ribana": True,
        "ribana_weight_pct": Decimal("8.00"),
        "labor_cost": Decimal("18.00"),
        "sale_price": Decimal("99.00"),
    },
    {
        "key": "ft-tshirt",
        "code": "FT002",
        "name": "T-Shirt Box",
        "fabric_type": FabricType.JERSEY,
        "fabric_grammage_gsm": 160,
        "fabric_weight_per_piece_g": Decimal("190.00"),
        "has_ribana": False,
        "ribana_weight_pct": None,
        "labor_cost": Decimal("12.00"),
        "sale_price": Decimal("79.00"),
    },
    {
        "key": "ft-moletom",
        "code": "FT003",
        "name": "Moletom Vintage",
        "fabric_type": FabricType.FLEECE,
        "fabric_grammage_gsm": 320,
        "fabric_weight_per_piece_g": Decimal("520.00"),
        "has_ribana": True,
        "ribana_weight_pct": Decimal("6.00"),
        "labor_cost": Decimal("32.00"),
        "sale_price": Decimal("179.00"),
    },
]


PRODUCTS = [
    {
        "key": "p-cropped-flora",
        "name": "Cropped Oversized Flora",
        "product_type": ProductType.CAMISETA,
        "spec_key": "ft-cropped",
        "print_key": "pd-flora",
        "variations": [
            {"size": Size.P, "color": "Preto", "color_code": "BLK"},
            {"size": Size.M, "color": "Preto", "color_code": "BLK"},
            {"size": Size.M, "color": "Areia", "color_code": "SND"},
        ],
    },
    {
        "key": "p-cropped-plain",
        "name": "Cropped Oversized",
        "product_type": ProductType.CAMISETA,
        "spec_key": "ft-cropped",
        "print_key": None,
        "variations": [
            {"size": Size.M, "color": "Marrom", "color_code": "BRN"},
        ],
    },
    {
        "key": "p-tshirt-box",
        "name": "T-Shirt Box",
        "product_type": ProductType.CAMISETA,
        "spec_key": "ft-tshirt",
        "print_key": None,
        "variations": [
            {"size": Size.P, "color": "Branco", "color_code": "WHT"},
            {"size": Size.M, "color": "Branco", "color_code": "WHT"},
            {"size": Size.G, "color": "Preto", "color_code": "BLK"},
        ],
    },
    {
        "key": "p-moletom-graf",
        "name": "Moletom Vintage Grafite",
        "product_type": ProductType.MOLETOM,
        "spec_key": "ft-moletom",
        "print_key": "pd-graf",
        "variations": [
            {"size": Size.GG, "color": "Verde", "color_code": "GRN"},
        ],
    },
    {
        "key": "p-moletom-plain",
        "name": "Moletom Vintage",
        "product_type": ProductType.MOLETOM,
        "spec_key": "ft-moletom",
        "print_key": None,
        "variations": [
            {"size": Size.M, "color": "Cinza", "color_code": "GRY"},
        ],
    },
]


ADS = [
    {
        "key": "ad-shopee-cropped",
        "title": "Cropped Oversized Verão 2026",
        "ecommerce": Ecommerce.SHOPEE,
        "external_id": "SH-AD-12",
        "product_key": "p-cropped-flora",
    },
    {
        "key": "ad-ml-tshirt",
        "title": "T-Shirt Box Premium",
        "ecommerce": Ecommerce.MERCADO_LIVRE,
        "external_id": "ML-AD-13",
        "product_key": "p-tshirt-box",
    },
    {
        "key": "ad-ig-moletom",
        "title": "Moletom Vintage — Drop 2026",
        "ecommerce": Ecommerce.INSTAGRAM,
        "external_id": None,
        "product_key": "p-moletom-graf",
    },
]


FABRIC_ROLLS = [
    {
        "key": "fr-jersey-180-blk",
        "received_at": TODAY - timedelta(days=14),
        "supplier_name": "Têxtil Aurora",
        "kind": FabricRollKind.BODY,
        "fabric_type": FabricType.JERSEY,
        "initial_weight_kg": Decimal("28.500"),
        "current_weight_kg": Decimal("18.200"),
        "color": "Preto",
        "price_per_kg": Decimal("38.00"),
    },
    {
        "key": "fr-jersey-160-wht",
        "received_at": TODAY - timedelta(days=10),
        "supplier_name": "Têxtil Aurora",
        "kind": FabricRollKind.BODY,
        "fabric_type": FabricType.JERSEY,
        "initial_weight_kg": Decimal("32.000"),
        "current_weight_kg": Decimal("25.700"),
        "color": "Branco",
        "price_per_kg": Decimal("36.50"),
    },
    {
        "key": "fr-fleece-320",
        "received_at": TODAY - timedelta(days=21),
        "supplier_name": "Malharia Sul",
        "kind": FabricRollKind.BODY,
        "fabric_type": FabricType.FLEECE,
        "initial_weight_kg": Decimal("40.000"),
        "current_weight_kg": Decimal("4.800"),
        "color": "Verde Musgo",
        "price_per_kg": Decimal("52.00"),
    },
]


# Cutting is print-agnostic: keyed by the garment base (spec) + a colorway.
CUTTING_ORDERS = [
    {
        "key": "co-209",
        "spec_key": "ft-cropped",
        "color": "Preto",
        "color_code": "PRT",
        "body_roll_key": "fr-jersey-180-blk",
        "rib_roll_key": None,
        "status": CuttingStatus.DONE,
        "cut_at": NOW - timedelta(days=2),
        "outputs": [
            {"size": Size.P, "quantity": 12},
            {"size": Size.M, "quantity": 24},
        ],
    },
    {
        "key": "co-210",
        "spec_key": "ft-tshirt",
        "color": "Branco",
        "color_code": "BCO",
        "body_roll_key": "fr-jersey-160-wht",
        "rib_roll_key": None,
        "status": CuttingStatus.PENDING,
        "cut_at": None,
        "outputs": [],
    },
]


SEWING_CONTRACTORS = [
    {
        "key": "banca-lucia",
        "name": "Banca Dona Lúcia",
        "address": "São Paulo, SP",
        "phone": "+55 11 91111-1111",
    },
    {
        "key": "banca-esperanca",
        "name": "Banca Esperança",
        "address": "Guarulhos, SP",
        "phone": "+55 11 92222-2222",
    },
]


ORDERS = [
    {
        "key": "o-10487",
        "ad_key": "ad-shopee-cropped",
        "client_key": "c-301",
        "variation": ("p-cropped-flora", Size.M, "BLK"),
        "quantity": 2,
        "sale_price": Decimal("99.00"),
        "ordered_at": NOW - timedelta(days=2, hours=4),
        "status": OrderStatus.PENDING,
        "external_order_id": "SH-99812",
    },
    {
        "key": "o-10486",
        "ad_key": "ad-ml-tshirt",
        "client_key": "c-302",
        "variation": ("p-tshirt-box", Size.M, "WHT"),
        "quantity": 1,
        "sale_price": Decimal("79.00"),
        "ordered_at": NOW - timedelta(days=2, hours=8),
        "status": OrderStatus.PAID,
        "external_order_id": "ML-44120",
    },
    {
        "key": "o-10485",
        "ad_key": "ad-ig-moletom",
        "client_key": "c-303",
        "variation": ("p-moletom-graf", Size.GG, "GRN"),
        "quantity": 3,
        "sale_price": Decimal("179.00"),
        "ordered_at": NOW - timedelta(days=3, hours=2),
        "status": OrderStatus.SHIPPED,
        "external_order_id": "WA-002",
    },
    {
        "key": "o-10484",
        "ad_key": "ad-ml-tshirt",
        "client_key": "c-304",
        "variation": ("p-tshirt-box", Size.P, "WHT"),
        "quantity": 5,
        "sale_price": Decimal("79.00"),
        "ordered_at": NOW - timedelta(days=4),
        "status": OrderStatus.DELIVERED,
        "external_order_id": "SP-77231",
    },
    {
        "key": "o-10483",
        "ad_key": "ad-shopee-cropped",
        "client_key": "c-305",
        "variation": ("p-cropped-plain", Size.M, "BRN"),
        "quantity": 1,
        "sale_price": Decimal("99.00"),
        "ordered_at": NOW - timedelta(days=4, hours=6),
        "status": OrderStatus.PENDING,
        "external_order_id": "IG-DM-018",
    },
]


SEWING_SHIPMENTS = [
    {
        "key": "ship-118",
        "cutting_order_key": "co-209",
        "contractor_key": "banca-lucia",
        "sent_at": TODAY - timedelta(days=2),
        "received_at": None,
        "status": ShipmentStatus.SENT,
        "items": [
            {"size": Size.P, "requested_quantity": 12, "received_quantity": 0},
            {"size": Size.M, "requested_quantity": 24, "received_quantity": 0},
        ],
    },
]


STOCK_ENTRIES = [
    {
        "key": "se-1",
        "variation": ("p-tshirt-box", Size.M, "WHT"),
        "quantity": 30,
        "source": StockSource.ADJUSTMENT,
        "notes": "Ajuste inicial de estoque",
    },
    {
        "key": "se-2",
        "variation": ("p-cropped-flora", Size.M, "BLK"),
        "quantity": 20,
        "source": StockSource.ADJUSTMENT,
        "notes": "Ajuste inicial de estoque",
    },
]


__all__ = [
    "ADS",
    "CLIENTS",
    "COMPANY",
    "CUTTING_ORDERS",
    "FABRIC_ROLLS",
    "NOW",
    "ORDERS",
    "PRINT_DESIGNS",
    "PRODUCTS",
    "PRODUCT_SPECS",
    "SEWING_CONTRACTORS",
    "SEWING_SHIPMENTS",
    "STOCK_ENTRIES",
    "TODAY",
    "USERS",
]
