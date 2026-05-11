---
id: FEATURE-014
slug: orders-import
title: Sales — Orders Import (LLM PDF + CSV)
status: in-progress
created: 2026-05-11
updated: 2026-05-11
branch: feature/014-orders-import
---

# FEATURE-014: Sales — Orders Import (LLM PDF + CSV)

## Problem Statement
Most channels do not push orders directly. Operators receive PDF receipts
(WhatsApp, marketplaces' "comprovante") or CSV exports from spreadsheets
and re-key them into the Orders surface. That data entry is slow,
error-prone and unable to scale.

This feature ships the **LLM-powered import flow** that complements the
manual CRUD from F-013:

- drop a PDF or a CSV in a dropzone,
- the backend extracts structured order rows (LLM for PDFs, header-based
  parser for CSVs),
- the user reviews and edits the rows with a confidence chip per row,
- a single commit creates the orders (and surfaces per-row errors so the
  operator can fix only the broken rows).

Webhooks remain deferred to Phase 6 — this iteration covers the two
ingestion paths the team uses today.

## User Stories
- As a manager, I want to paste a PDF order receipt and have the system
  pre-fill the order grid so I can confirm and save in a few clicks.
- As a manager, I want to upload a CSV that I exported from an old tool
  and have it parsed into the same review grid.
- As a manager, I want to see how confident the parser is for each row,
  so I can focus my review on the uncertain rows.
- As a manager, I want to edit any row before committing — fix names,
  swap variations, change quantities.
- As a manager, I want individual rows to fail without aborting the
  whole batch, so a single bad row doesn't waste the import work.
- As an operator without `orders.write`, I should not be able to reach
  the import page at all.

## Acceptance Criteria
1. [ ] Given a CSV with a header row that maps to one of the known
   English or pt-BR column synonyms, when I drop it on the dropzone,
   then the preview table renders one parsed row per CSV row with
   `confidence = 1.0` on every mapped column.
2. [ ] Given a CSV without recognisable headers, when I drop it, then
   the backend returns 422 and the UI surfaces a clear "could not
   detect columns" message.
3. [ ] Given I drop a PDF, when the LLM responds with valid JSON, then
   the preview table renders one row per extracted order with per-row
   `confidence` between 0 and 1.
4. [ ] Given the LLM returns malformed JSON on the first attempt, the
   service retries once with a corrective prompt. If the retry still
   fails, the API returns 422.
5. [ ] Given the preview is rendered, when I edit a cell (client name,
   quantity, sale price, product hint), then the edit is held in local
   state until I commit.
6. [ ] Given I click `Commit`, then the API creates one `Order` per row
   for which client/ad/variation resolution succeeded.
7. [ ] Given a row references a client that doesn't yet exist on the
   tenant, then the service creates the client (name + optional email
   + optional phone) before creating the order.
8. [ ] Given a row references an ad that cannot be resolved (no
   matching `external_id`), then the row fails with a clear error and
   the response carries that error keyed by `row_index`. Successful
   rows still commit.
9. [ ] Given a row's `product_hint` does not match any of the tenant's
   variations, the row fails the same way.
10. [ ] Given the commit succeeds, an audit-log entry is written for
    every created order; failed rows produce no audit entry.
11. [ ] Given I'm an operator without `orders.write`, opening
    `/orders/import` shows the forbidden fallback and the API returns
    403 on both endpoints.
12. [ ] Given an unauthenticated request hits either endpoint, then 401.

## User Flows

### Happy Path — CSV
1. Manager opens `/orders/import` (or clicks the `Import` button on
   the orders list).
2. Step 1 is the dropzone — accepts PDF + CSV. Manager drops a CSV.
3. The page jumps to step 2 ("Review") with the parsed rows. Each row
   shows a confidence chip (green when confidence ≥ 0.8).
4. Manager fixes a typo in one client name.
5. Manager clicks `Commit`. Confirm dialog summarises N rows.
6. API returns `created: N, errors: []`. Toast `N orders created` and
   the wizard exits to `/orders`.

### Happy Path — PDF
1. Manager opens `/orders/import` and drops a PDF receipt.
2. Step 2 renders with confidence chips (amber for rows the LLM is not
   sure about).
3. Manager edits the price on a row.
4. Commit succeeds. Toast.

### Edge Cases
- CSV with no recognisable headers → 422, dropzone stays in step 1
  with an error message.
- LLM returns malformed JSON → service retries once with a corrective
  message; if still malformed, 422 reaches the UI as a generic error.
- Mid-batch partial failure → success rows are persisted, failure
  rows surface in `ImportErrorList`, the user can fix and re-commit
  only the failed rows.
- Empty file (zero rows) → 422 with "no rows found".

## Scope

### In Scope
- `POST /v1/orders/import/parse` (multipart) — returns parsed rows +
  per-row confidence.
- `POST /v1/orders/import/commit` (JSON) — creates orders for parsed
  rows, returns created count + errors.
- CSV header heuristics for the most common English + pt-BR column
  names.
- LLM extraction via the Anthropic SDK with `claude-haiku-4-5` by
  default (override via env). Real HTTP is mocked in tests.
- Wizard page at `/orders/import` with dropzone, preview/edit table,
  commit dialog, post-commit error list.
- i18n keys in the `ordersImport` namespace.

### Out of Scope
- Webhooks (Shopee/ML/Shopify/Instagram push). Tracked separately.
- Mapping UI for arbitrary CSVs — only the predefined column synonyms
  are recognised. Anything else fails with "could not detect columns".
- Re-importing the failed-rows subset as a separate API. The UI
  surfaces failed rows; the operator manually edits and re-submits
  the commit.
- Bulk PDF (multi-file) drop in one call.

## UI/UX Notes
- Sales palette — terracotta `--brand-sales` for the primary actions
  and the dropzone hover ring.
- Three-step wizard rendered as a single page with a progress strip:
  1. `Drop` — large dashed-border drop zone, accepts `.pdf,.csv`,
     hover changes border to `--brand-sales` and adds a subtle
     `color-mix` fill. Two helper tiles below restate "Paste PDF"
     and "Upload CSV".
  2. `Review` — editable table; row index column, `ConfidenceChip`
     column, then client/email/phone/ad-id/product-hint/qty/price/
     ordered-at/raw-excerpt columns. Each editable cell is a small
     shadcn `Input`.
  3. `Commit` — final summary modal with N rows. Confirmation runs
     the commit; on failures, the `ImportErrorList` renders below
     the table.
- ConfidenceChip: small pill, ≥ 0.8 → `--status-ok` (green),
  0.5–0.8 → `--status-warn` (amber), < 0.5 → `--status-err` (red).
- DropZone in idle state shows a `FileUp` icon plus the description;
  in `dragOver` state, the border colour switches to `--brand-sales`
  and the background lightens.
- The whole flow lives inside the app shell — page eyebrow `Sales` /
  `Vendas`, title `Import orders` / `Importar pedidos`.

## i18n Keys
Both EN and PT-BR live in the `ordersImport` namespace.

| Key | EN | PT-BR |
|-----|----|-------|
| `ordersImport.page.eyebrow` | Sales | Vendas |
| `ordersImport.page.title` | Import orders | Importar pedidos |
| `ordersImport.page.sub` | Paste a PDF receipt or upload a CSV — the system pre-fills the order grid for you. | Cole um comprovante em PDF ou suba um CSV — o sistema preenche a grade para você revisar. |
| `ordersImport.steps.drop` | Drop | Soltar |
| `ordersImport.steps.review` | Review | Revisar |
| `ordersImport.steps.commit` | Commit | Confirmar |
| `ordersImport.dropzone.title` | Drop a PDF or a CSV | Solte um PDF ou um CSV |
| `ordersImport.dropzone.body` | Drag the file here, or click to pick from your computer. | Arraste o arquivo aqui ou clique para escolher do seu computador. |
| `ordersImport.dropzone.ctaPdf` | Paste a PDF | Colar PDF |
| `ordersImport.dropzone.ctaCsv` | Upload a CSV | Subir CSV |
| `ordersImport.dropzone.accepted` | Accepts .pdf and .csv up to 5MB. | Aceita .pdf e .csv até 5MB. |
| `ordersImport.dropzone.parsing` | Parsing… | Processando… |
| `ordersImport.preview.columns.rowIdx` | # | # |
| `ordersImport.preview.columns.confidence` | Confidence | Confiança |
| `ordersImport.preview.columns.clientName` | Client | Cliente |
| `ordersImport.preview.columns.clientEmail` | Email | E-mail |
| `ordersImport.preview.columns.clientPhone` | Phone | Telefone |
| `ordersImport.preview.columns.productHint` | Product hint | Produto |
| `ordersImport.preview.columns.qty` | Qty | Qtd |
| `ordersImport.preview.columns.salePrice` | Price | Preço |
| `ordersImport.preview.columns.orderedAt` | Date | Data |
| `ordersImport.preview.columns.rawExcerpt` | Source excerpt | Trecho original |
| `ordersImport.preview.edit` | Edit | Editar |
| `ordersImport.preview.removeRow` | Remove row | Remover linha |
| `ordersImport.confidence.high` | High | Alta |
| `ordersImport.confidence.medium` | Medium | Média |
| `ordersImport.confidence.low` | Low | Baixa |
| `ordersImport.commit.title` | Commit import | Confirmar importação |
| `ordersImport.commit.body` | Create {count} orders from the reviewed rows. | Criar {count} pedidos a partir das linhas revisadas. |
| `ordersImport.commit.count` | {count} rows | {count} linhas |
| `ordersImport.commit.save` | Create orders | Criar pedidos |
| `ordersImport.commit.cancel` | Cancel | Cancelar |
| `ordersImport.commit.toasts.success` | {count} orders created | {count} pedidos criados |
| `ordersImport.commit.toasts.error` | Could not commit the import. | Não foi possível confirmar a importação. |
| `ordersImport.errors.rowFailed` | Row #{rowIdx} — {message} | Linha #{rowIdx} — {message} |
| `ordersImport.errors.generic` | Could not parse the file. | Não foi possível processar o arquivo. |
| `ordersImport.fallback.forbidden` | You don't have access to orders import. | Você não tem acesso à importação de pedidos. |
| `ordersImport.actions.parseAgain` | Drop another file | Soltar outro arquivo |
| `ordersImport.actions.back` | Back | Voltar |
| `ordersImport.actions.continue` | Continue | Continuar |

## API Contract

| Method | Path | Request | Response | Purpose |
|--------|------|---------|----------|---------|
| POST | `/v1/orders/import/parse` | `multipart/form-data` (`file`, optional `format=pdf\|csv`) | `ParseResponse` | Returns parsed rows + per-row confidence. |
| POST | `/v1/orders/import/commit` | `CommitOrdersBody` (`{rows: ParsedOrderRow[]}`) | `CommitOrdersResponse` | Persists orders. Per-row errors surfaced. |

`ParsedOrderRow` shape:
```
{
  row_index, confidence (0..1),
  client_name?, client_email?, client_phone?,
  ad_external_id?, product_hint?,
  quantity?, sale_price?, ordered_at?,
  raw_excerpt?
}
```

`CommitOrdersResponse` shape: `{created: int, errors: [{row_index, message}]}`.

## Seed Data Requirements
- The same scaffold from F-013 (1 company, 1 client, 1 product with one
  variation, 1 ad). Per-test factories provision this; no permanent
  seed needed.
- The Anthropic SDK is **mocked** in tests (`respx` patches the HTTPS
  endpoint). The test suite never contacts the real API.
