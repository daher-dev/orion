# Sales

Three pages: [Orders](#orders), [Clients](#clients), [Ads](#ads).

## Orders

`/[locale]/orders`

**Purpose:** Track every customer order across all channels, drive fulfillment.

**Audience:** Admin, Manager.

### List page

- **Table:** `external_order_id`, channel (Shopee / ML / Shopify / IG / WA badge), client, product variation, qty, status (pending → paid → shipped → delivered), placed_at, value
- **Filters:** status, channel, date range, client, has-cutting-order, ad
- **Bulk actions:** mark paid, assign to cutting batch
- **Empty:** "No orders yet — connect a channel or import a PDF/CSV"
- **Primary CTAs:** Import (PDF / CSV / webhook setup), + New order (manual)

### Detail — `/[locale]/orders/[id]`

- Header: status timeline (pending → paid → shipped → delivered), customer block, channel, ad source
- Body: line items (variation + qty), attached cutting orders, attached stock exits, payment + shipping info
- Actions: change status, attach to cutting order, register payment, mark shipped, cancel
- Right rail: comments / activity log for the order

### Create — `/[locale]/orders/new`

Tabbed:

- **Manual** — client (search/create), channel, line items (variation picker), expected dates
- **Paste from PDF** — LLM parser
- **Upload CSV**

### Import — `/[locale]/orders/import`

- PDF drop zone → LLM extract preview → confirm → bulk create
- CSV upload with column mapper
- Webhook setup status per channel

**Critical UX:** confidence score per parsed field, side-by-side PDF preview vs. extracted JSON, manual edit before commit.

---

## Clients

`/[locale]/clients`

**Purpose:** Customer directory across channels.

- **List:** search, filters (channel of first contact, total spent), tag column. Quick-create modal.
- **Detail** `/[locale]/clients/[id]`: profile, full order history, lifetime value, contact log, address(es).
- **Create / Edit:** side-sheet with name, contacts, default address, notes.

---

## Ads

`/[locale]/ads`

**Purpose:** Manage ecommerce listings (Shopee / Mercado Livre / Shopify / IG / WA) that point at a Product.

- **List:** card grid by channel, status (active / paused), product link, last-30d order count.
- **Detail** `/[locale]/ads/[id]`: external link, attached product, performance stats, list of orders sourced from this ad.
- **Create:** pick channel, paste external URL/SKU, link to internal product. Future: auto-sync via channel API.
