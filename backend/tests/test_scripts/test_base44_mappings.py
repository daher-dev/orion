"""Unit tests for the base44 importer's pure converter (``mappings.convert``).

The contract under test is the Phase 2 fix: an imported order recovers its
*design* (estampa) via the ``StampaMemory`` ad-title bridge and resolves to a
per-``(spec x design)`` product carrying the design as ``print_id`` — so the
Planning engine can suggest both cutting (spec+color) and printing (design).
Orders whose title has no design fall back to the spec's base no-print product
(cut-only). The converter is pure (no DB), so these tests need no fixtures.
"""

import re

from models import ArtworkStatus, ProductVariation
from scripts.base44.mappings import ConversionReport, convert, ink_hex_for

_HEX_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")


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
            # Top-level artwork field is EMPTY in real exports — the converter must
            # ignore it and read the nested ``combinacoes[]`` instead.
            "foto_estampa_url": "",
            "combinacoes": [
                {
                    "sku": "PUN-BR",
                    "cor_produto": "Preto",
                    "cor_estampa": "Branco",
                    "arquivo_png_url": "https://base44.app/api/apps/x/files/pun-branco.png",
                    "arquivo_png_url_frente": "https://base44.app/api/apps/x/files/pun-branco-frente.png",
                    "arquivo_png_url_costas": "https://base44.app/api/apps/x/files/pun-branco-costas.png",
                },
                {
                    "sku": "PUN-PR",
                    "cor_produto": "Branco",
                    "cor_estampa": "Preto",
                    "arquivo_png_url": "https://base44.app/api/apps/x/files/pun-preto.png",
                    "arquivo_png_url_frente": "https://base44.app/api/apps/x/files/pun-preto-frente.png",
                    # No costas url for this ink → back_status must stay PENDING.
                },
            ],
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


def test_design_image_fields_filled_from_combinacoes():
    """The design thumbnail/front/back come from nested combos, not the empty
    top-level ``foto_estampa_url``."""

    data, _ = _convert(RAW)
    design = next(d for d in _rows(data, "print_design") if d["name"] == "Punisher")

    # image_url and image_url_front come from a frente/generic combo url (non-null).
    assert design["image_url"], "image_url should be populated from combinacoes"
    assert design["image_url_front"], "image_url_front should be populated from combinacoes"
    assert design["image_url"].startswith("https://base44.app/")
    assert "frente" in design["image_url_front"]

    # has_front reflects a present front url; has_back reflects the costas url
    # carried by the first ink (Branco) in the combos list.
    assert design["has_front"] is True
    assert design["has_back"] is True
    assert design["image_url_back"] and "costas" in design["image_url_back"]


def test_design_variation_rows_emitted_per_ink_color():
    """One print_design_variation per distinct cor_estampa, with valid ink_hex
    and front/back urls + statuses driven by url presence."""

    data, _ = _convert(RAW)
    design = next(d for d in _rows(data, "print_design") if d["name"] == "Punisher")
    variations = [v for v in _rows(data, "print_design_variation") if v["print_design_id"] == design["id"]]

    # Two distinct ink colors (Branco, Preto) → two variations.
    assert len(variations) == 2
    by_name = {v["name"]: v for v in variations}
    assert set(by_name) == {"Branco", "Preto"}

    for v in variations:
        assert _HEX_RE.match(v["ink_hex"]), f"invalid ink_hex: {v['ink_hex']!r}"

    # Branco carries front + back urls → both statuses OK.
    branco = by_name["Branco"]
    assert "branco-frente" in branco["front_file_url"]
    assert "branco-costas" in branco["back_file_url"]
    assert branco["front_status"] == ArtworkStatus.OK
    assert branco["back_status"] == ArtworkStatus.OK

    # Preto has a front url but no costas → front OK, back PENDING (url is None).
    preto = by_name["Preto"]
    assert "preto-frente" in preto["front_file_url"]
    assert preto["back_file_url"] is None
    assert preto["front_status"] == ArtworkStatus.OK
    assert preto["back_status"] == ArtworkStatus.PENDING


def test_same_estampa_name_aggregates_combos_across_records():
    """Two StampaMemory rows sharing an estampa_nome aggregate their combos into
    a single design — the second record's ink is not dropped."""

    raw = {
        **RAW,
        "StampaMemory": [
            {
                "company_id": "c1",
                "titulo_anuncio": "Camiseta Punisher Masculina",
                "estampa_nome": "Punisher",
                "tipo_produto": "Camiseta",
                "foto_estampa_url": "",
                "combinacoes": [
                    {
                        "cor_estampa": "Branco",
                        "arquivo_png_url_frente": "https://base44.app/api/apps/x/files/p-branco-frente.png",
                    }
                ],
            },
            {
                # Same design name, different record → its combo must merge in.
                "company_id": "c1",
                "titulo_anuncio": "Camiseta Punisher Feminina",
                "estampa_nome": "Punisher",
                "tipo_produto": "Camiseta",
                "foto_estampa_url": "",
                "combinacoes": [
                    {
                        "cor_estampa": "Vermelho",
                        "arquivo_png_url_frente": "https://base44.app/api/apps/x/files/p-vermelho-frente.png",
                    }
                ],
            },
        ],
    }
    data, _ = _convert(raw)

    designs = [d for d in _rows(data, "print_design") if d["name"] == "Punisher"]
    assert len(designs) == 1, "same estampa_nome must collapse into one design"
    design = designs[0]

    variations = [v for v in _rows(data, "print_design_variation") if v["print_design_id"] == design["id"]]
    # Union of inks from both records: Branco + Vermelho.
    assert {v["name"] for v in variations} == {"Branco", "Vermelho"}


def test_ink_hex_for_known_and_unknown_names():
    # Known palette name resolves to its ported hex.
    assert ink_hex_for("Preto") == "#1f1f1f"
    # Unknown name still yields a valid 6-hex-digit color (deterministic fallback).
    unknown = ink_hex_for("Turquesa Neon Fluorescente")
    assert _HEX_RE.match(unknown), f"invalid fallback ink_hex: {unknown!r}"
    # Determinism: same input → same output.
    assert ink_hex_for("Turquesa Neon Fluorescente") == unknown
