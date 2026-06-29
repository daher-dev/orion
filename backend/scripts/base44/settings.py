"""Per-app knobs + Portuguese→Orion translation for the base44 importer.

All values here were derived from the live discovery scan of the legacy
"Underground" app (see discovery/SCHEMA_REPORT.md). The legacy data is free-text
heavy, so most maps do **substring/keyword** matching with an explicit default;
unmapped categorical values are recorded in the run report, never silently
guessed past the default.
"""

from __future__ import annotations

from models import (
    BatchStatus,
    CuttingStatus,
    Ecommerce,
    FabricRollKind,
    FabricType,
    OrderStatus,
    ProductType,
    SeparationStatus,
    ShipmentStatus,
    Size,
    StockExitReason,
    StockSource,
    TrimType,
)

# Real base44 entity names (Portuguese), confirmed from the legacy repo +
# discovery. Discovery samples all of these; the import maps the business ones.
ENTITIES: list[str] = [
    "Company",
    "User",
    "UsuarioEmpresa",
    "Produto",
    "BobinaTecido",
    "OrdemCorte",
    "RemessaCostura",
    "BancaCostura",
    "EntradaEstoque",
    "SaidaEstoque",
    "PedidoImportado",
    "ItemPedido",
    # Sampled for reference but not imported as business data:
    "LoteProducao",
    "EstampaEstoque",
    "AjusteEstampa",
    "StampaMemory",
    "CustoProducao",
    "AlertaEstoque",
    "LogEntradaEstoque",
    "Licenca",
]

# Imported users get this firebase_uid prefix so re-runs delete only the
# imported cohort and the auth layer can rebind them on first real login.
IMPORTED_UID_PREFIX = "base44:"

# Some high-volume entities reference an orphan company_id (Underground's
# original id, before a platform migration). Alias it to the live company.
COMPANY_ID_ALIASES: dict[str, str] = {
    "69cbd76efa16f57e35d5d4dc": "69cc055cc8376449c3433e60",  # → Underground
}

DEFAULT_MAIN_COLOR = "#a83227"  # Orion "Ember"

# Synthesized values for Orion-required fields with no legacy source. They are
# valid (satisfy CHECK constraints) but obviously placeholder; every use is
# flagged in the report so they can be corrected at the source and re-imported.
DEFAULTS = {
    "fabric_grammage_gsm": 1,  # CHECK > 0
    "fabric_weight_per_piece_g": "1.00",  # CHECK > 0
    "sale_price": "0.00",  # CHECK >= 0
    "labor_cost": "0.00",  # CHECK >= 0
    "ribana_weight_pct": "15.00",  # legacy Produto default; CHECK 0 < v <= 100 when has_ribana
    "trim_quantity": 1,  # CHECK > 0
    "fabric_price_per_kg": "0.00",
    "fabric_initial_weight_kg": "0.001",  # CHECK > 0
    "order_sale_price": "0.00",
}

# ── Sizes ──────────────────────────────────────────────────────────────────
# Orion's domain (and its whole production UI) is adult P/M/G/GG only, so we map
# exactly those. Everything else — kids' numerics (2-16), PP/XG/XXG, dimensions
# ("100 X 60"), "Único", "N/A" — has no Orion size and the row is skipped and
# reported (see the run report's skip samples). Mapping them would either corrupt
# data or force kids/extra sizes into adult-only cutting/sewing forms.
SIZE_MAP: dict[str, Size] = {
    "p": Size.P,
    "m": Size.M,
    "g": Size.G,
    "gg": Size.GG,
}

# ── Product type (substring match on Produto.tipo / nome) ──────────────────
DEFAULT_PRODUCT_TYPE = ProductType.CAMISETA
PRODUCT_TYPE_KEYWORDS: list[tuple[str, ProductType]] = [
    ("calça moletom", ProductType.CALCA),
    ("calça", ProductType.CALCA),
    ("moletom", ProductType.MOLETOM),
    ("short", ProductType.BERMUDA),
    ("bermuda", ProductType.BERMUDA),
    ("regata", ProductType.REGATA),
    ("machão", ProductType.REGATA),
    ("cropped", ProductType.CROPPED),
    ("ecobag", ProductType.ECOBAG),
    ("camiseta", ProductType.CAMISETA),
    ("camisa", ProductType.CAMISETA),
    ("blusa", ProductType.BLUSA),
]

# ── Fabric type (substring match on tipo_tecido / nome_tecido) ─────────────
DEFAULT_FABRIC_TYPE = FabricType.JERSEY
FABRIC_TYPE_KEYWORDS: list[tuple[str, FabricType]] = [
    ("ribana", FabricType.RIB),
    ("moletom", FabricType.FLEECE),
    ("french", FabricType.FRENCH_TERRY),
    ("mesh", FabricType.MESH),
    ("poliamida", FabricType.MESH),
    ("dry", FabricType.MESH),
    ("algod", FabricType.JERSEY),
    ("camiseta", FabricType.JERSEY),
    ("malha", FabricType.JERSEY),
]

# BobinaTecido.tipo → roll kind (body vs rib).
FABRIC_ROLL_KIND_MAP: dict[str, FabricRollKind] = {
    "tecido": FabricRollKind.BODY,
    "ribana": FabricRollKind.RIB,
}

# ── Statuses ───────────────────────────────────────────────────────────────
# OrdemCorte.status — everything present has already been cut.
CUTTING_STATUS_MAP: dict[str, CuttingStatus] = {
    "pendente": CuttingStatus.PENDING,
    "em_corte": CuttingStatus.CUTTING,
    "cortando": CuttingStatus.CUTTING,
    "cortado": CuttingStatus.DONE,
    "concluido": CuttingStatus.DONE,
    "concluído": CuttingStatus.DONE,
    "enviado": CuttingStatus.DONE,
}
DEFAULT_CUTTING_STATUS = CuttingStatus.DONE

# RemessaCostura.status
SHIPMENT_STATUS_MAP: dict[str, ShipmentStatus] = {
    "enviada": ShipmentStatus.SENT,
    "enviado": ShipmentStatus.SENT,
    "parcial": ShipmentStatus.PARTIAL,
    "concluida": ShipmentStatus.RECEIVED,
    "concluída": ShipmentStatus.RECEIVED,
    "recebida": ShipmentStatus.RECEIVED,
    "cancelada": ShipmentStatus.CANCELLED,
}
DEFAULT_SHIPMENT_STATUS = ShipmentStatus.SENT

# SaidaEstoque.motivo → exit reason
STOCK_EXIT_REASON_MAP: dict[str, StockExitReason] = {
    "separacao": StockExitReason.SALE,
    "separação": StockExitReason.SALE,
    "venda": StockExitReason.SALE,
    "ajuste": StockExitReason.ADJUSTMENT,
    "outro": StockExitReason.ADJUSTMENT,
    "perda": StockExitReason.LOSS,
}
DEFAULT_STOCK_EXIT_REASON = StockExitReason.ADJUSTMENT

# EntradaEstoque has no source field; legacy entries are manual stock-in.
DEFAULT_STOCK_SOURCE = StockSource.ADJUSTMENT

# ── Ecommerce / marketplace (for ads) ──────────────────────────────────────
DEFAULT_ECOMMERCE = Ecommerce.OTHER
ECOMMERCE_KEYWORDS: list[tuple[str, Ecommerce]] = [
    ("shopee", Ecommerce.SHOPEE),
    ("mercado", Ecommerce.MERCADO_LIVRE),  # "Mercado Livre" / "Mercado Libre"
    ("shein", Ecommerce.SHEIN),
    ("tiktok", Ecommerce.TIKTOK_SHOP),
    ("shopify", Ecommerce.SHOPIFY),
    ("instagram", Ecommerce.INSTAGRAM),
    ("whats", Ecommerce.WHATSAPP),
]

# Marketplace orders carry no payment state in the source.
DEFAULT_ORDER_STATUS = OrderStatus.PENDING

# ── Roles (UsuarioEmpresa.funcao / User.role / User.role_level) ────────────
# Orion seeds exactly: admin, manager, operator.
DEFAULT_ROLE_CODE = "operator"
ROLE_MAP: dict[str, str] = {
    "admin": "admin",
    "owner": "admin",
    "master": "admin",
    "empresa_admin": "admin",
    "gerente": "manager",
    "manager": "manager",
    "operador": "operator",
    "operator": "operator",
    "producao": "operator",
    "produção": "operator",
    "colaborador": "operator",
    "user": "operator",
}

# ── Trims (aviamento.nome → TrimType) ──────────────────────────────────────
DEFAULT_TRIM_TYPE = TrimType.LABEL
TRIM_TYPE_KEYWORDS: list[tuple[str, TrimType]] = [
    ("botão", TrimType.BUTTON),
    ("botao", TrimType.BUTTON),
    ("zíper", TrimType.ZIPPER),
    ("ziper", TrimType.ZIPPER),
    ("zper", TrimType.ZIPPER),
    ("etiqueta", TrimType.LABEL),
    ("cordão", TrimType.DRAWSTRING),
    ("cordao", TrimType.DRAWSTRING),
    ("ilhós", TrimType.EYELET),
    ("ilhos", TrimType.EYELET),
    ("ilhó", TrimType.EYELET),
    ("elástico", TrimType.ELASTIC),
    ("elastico", TrimType.ELASTIC),
    ("botão de pressão", TrimType.SNAP),
    ("colchete", TrimType.HOOK),
]

# ── Lotes (LoteProducao.status → BatchStatus) ──────────────────────────────
DEFAULT_BATCH_STATUS = BatchStatus.OPEN
BATCH_STATUS_MAP: dict[str, BatchStatus] = {
    "aberto": BatchStatus.OPEN,
    "ajustado": BatchStatus.IN_PRODUCTION,
    "impresso": BatchStatus.DISPATCHED,
    "concluido": BatchStatus.DONE,
    "concluído": BatchStatus.DONE,
    "cancelado": BatchStatus.CANCELLED,
}

# ── Separação (ItemPedido.status_separacao → SeparationStatus) ─────────────
DEFAULT_SEPARATION_STATUS = SeparationStatus.PENDING
SEPARATION_STATUS_MAP: dict[str, SeparationStatus] = {
    "pendente": SeparationStatus.PENDING,
    "etiqueta_impressa": SeparationStatus.LABEL_PRINTED,
    "conferido": SeparationStatus.CHECKED,
}
