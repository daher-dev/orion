# Catalog

Three pages: [Products](#products), [Specs (fichas técnicas)](#specs-fichas-técnicas), [Prints (estampas)](#prints-estampas).

## Products

`/[locale]/products`

**Purpose:** Saleable items = ProductSpec + PrintDesign combo, with variations (size × color).

- **List:** card or table view, filter by spec, by print, by stock-status. Each row shows variation availability heatmap.
- **Detail** `/[locale]/products/[id]`:
  - Header: image, name, code, spec link, print link
  - Variations grid: size × color matrix with stock count per cell
  - Tabs: Variations · Stock movement · Orders · Ads using this product · Cost breakdown (rolled up from spec + print)
- **Create** `/[locale]/products/new`: pick spec, pick print, define variations (sizes/colors). Auto-generate SKU.

---

## Specs (Fichas Técnicas)

`/[locale]/specs`

**Purpose:** Production recipe — fabric type, weight, ribana %, labor cost, trims.

- **List:** table with code, name, fabric type, weight, last edited.
- **Detail / Edit** `/[locale]/specs/[id]`:
  - Fabric block: kind, gsm, composition, ribana %
  - Cost block: cmt cost, trim costs (buttons, zippers, labels — repeating row)
  - Sizing block: size chart (P/M/G/GG with measurements)
- **Versioning consideration:** changing a spec affects future cutting orders only.

---

## Prints (Estampas)

`/[locale]/prints`

**Purpose:** Print designs / artwork applied to products.

- **List:** image-first grid; filters by status, by tag.
- **Detail** `/[locale]/prints/[id]`:
  - Artwork preview (zoom)
  - Cost per unit, technique (DTF / silk / sublimation / etc.)
  - Products that use this print
  - Activity: when added, who created
- **Create:** upload artwork (image), name, code, technique, cost/unit. LFS handles the asset.
