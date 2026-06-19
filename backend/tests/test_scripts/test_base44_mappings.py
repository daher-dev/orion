"""Unit tests for the base44 importer's pure converter (``mappings.convert``).

The contract under test is the Phase 2 fix: an imported order recovers its
*design* (estampa) via the ``StampaMemory`` ad-title bridge and resolves to a
per-``(spec x design)`` product carrying the design as ``print_id`` — so the
Planning engine can suggest both cutting (spec+color) and printing (design).
Orders whose title has no design fall back to the spec's base no-print product
(cut-only). The converter is pure (no DB), so these tests need no fixtures.
"""

from models import ProductVariation
from scripts.base44.mappings import ConversionReport, convert


def _convert(raw: dict):
    report = ConversionReport()
    return convert(raw, report=report), report


def _rows(data, table):
    return data.rows[table]


# A garment + a StampaMemory bridge (title → design) + two orders: one whose
# title matches a design, one whose title doesn't.
RAW = {
    "Company": [{"id": "c1", "name": "Acme"}],
    "Produto": [
        {
            "id": "p1",
            "company_id": "c1",
            "nome": "Camiseta Basica",
            "tipo": "camiseta",
            "variacoes": [{"cor": "Preto", "tamanhos": ["M", "G"]}],
        }
    ],
    "StampaMemory": [
        {
            "company_id": "c1",
            "titulo_anuncio": "Camiseta Punisher Masculina",
            "estampa_nome": "Punisher",
            "tipo_produto": "Camiseta",
        }
    ],
    "PedidoImportado": [
        {
            "id": "o1",
            "company_id": "c1",
            "titulo_anuncio": "Camiseta Punisher Masculina",
            "cor": "Preto",
            "tamanho": "M",
            "quantidade": 3,
            "numero_pedido": "N1",
            "marketplace": "Shopee",
        },
        {
            "id": "o2",
            "company_id": "c1",
            "titulo_anuncio": "Camiseta Lisa Sem Estampa",
            "cor": "Branco",
            "tamanho": "G",
            "quantidade": 2,
            "numero_pedido": "N2",
            "marketplace": "Shopee",
        },
    ],
}


def test_order_with_matching_title_resolves_to_design_product():
    data, _ = _convert(RAW)

    design = next(d for d in _rows(data, "print_design") if d["name"] == "Punisher")
    spec = next(s for s in _rows(data, "product_spec") if s["name"] == "Camiseta Basica")

    # A (spec x design) product exists, carrying the design as print_id.
    design_product = next(
        (p for p in _rows(data, "product") if p["spec_id"] == spec["id"] and p["print_id"] == design["id"]),
        None,
    )
    assert design_product is not None

    # The order points at a variation of that design product…
    order = next(o for o in _rows(data, "order") if o["external_order_id"] == "N1")
    variation = next(v for v in _rows(data, "product_variation") if v["id"] == order["variation_id"])
    assert variation["product_id"] == design_product["id"]
    assert order["quantity"] == 3

    # …whose SKU carries the design's print code (kept unique across designs).
    assert variation["sku"].endswith(f"-{design['code']}")

    # The ad is linked to the design product (not the bare garment).
    ad = next(a for a in _rows(data, "ad") if order["ad_id"] == a["id"])
    link = next(lp for lp in _rows(data, "ad_products") if lp["ad_id"] == ad["id"])
    assert link["product_id"] == design_product["id"]


def test_order_without_design_falls_back_to_base_no_print_product():
    data, _ = _convert(RAW)

    spec = next(s for s in _rows(data, "product_spec") if s["name"] == "Camiseta Basica")
    order = next(o for o in _rows(data, "order") if o["external_order_id"] == "N2")
    variation = next(v for v in _rows(data, "product_variation") if v["id"] == order["variation_id"])
    product = next(p for p in _rows(data, "product") if p["id"] == variation["product_id"])

    # No design matched → the spec's base product (print_id is None), cut-only.
    assert product["spec_id"] == spec["id"]
    assert product["print_id"] is None
    # Base-product SKU equals the no-print make_sku (no print segment) — robust
    # against spec codes that themselves carry a "-<n>" dedup suffix.
    assert variation["sku"] == ProductVariation.make_sku(
        spec_code=spec["code"], size=variation["size"], color_code=variation["color_code"], print_code=None
    )


def test_same_design_across_orders_reuses_one_product():
    """Two orders of the same (spec, design) share one product (no duplicates)."""

    raw = {
        **RAW,
        "PedidoImportado": [
            RAW["PedidoImportado"][0],
            {**RAW["PedidoImportado"][0], "id": "o3", "tamanho": "G", "numero_pedido": "N3"},
        ],
    }
    data, _ = _convert(raw)
    design = next(d for d in _rows(data, "print_design") if d["name"] == "Punisher")
    design_products = [p for p in _rows(data, "product") if p["print_id"] == design["id"]]
    assert len(design_products) == 1
