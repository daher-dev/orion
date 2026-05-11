# Implementation Log — FEATURE-014: Sales — Orders Import (LLM PDF + CSV)
<!-- Written by Dev only. PM and QA do not read this file. -->

## Backend (already merged into foundation)
The two endpoints `POST /v1/orders/import/parse` and
`POST /v1/orders/import/commit` shipped with `feature/014-orders-import`
and were merged into `foundation/app-shell-and-auth` at commit 23fe065.
See `backend/src/{schemas,services,routers}/orders_import.py` for the
contract — this log only covers the frontend wiring.

## Frontend wired up

### Files Created
- `frontend/src/lib/schemas/orders-import.ts` — zod schemas mirroring
  `backend/src/schemas/orders_import.py` (`ParsedOrderRow`,
  `ParseResponse`, `CommitOrdersBody`, `CommitOrdersResponse`,
  `CommitOrderError`). Also exposes `confidenceBucket()`,
  `formatConfidence()`, `isAcceptedUpload()`, and `MAX_IMPORT_BYTES`
  (5 MB — mirrors the backend cap).
- `frontend/src/hooks/use-orders-import.ts` — `useParseOrders()`
  (multipart `File` upload) and `useCommitOrders()` (invalidates
  `orders` + `clients` query caches when at least one row persists).
- `frontend/src/components/orders-import/ImportDropZone.tsx` — dashed
  drop area with file picker fallback. Accepts `.pdf`/`.csv` up to
  5 MB; rejects unsupported types client-side; shows file name + size +
  clear button after selection; primary `Analisar` / `Analyze` CTA
  swaps to a spinner while `useParseOrders` is in flight.
- `frontend/src/components/orders-import/ImportPreviewTable.tsx` —
  inline-editable table of parsed rows. Confidence pill on the far
  left, every other field (client name/email/phone, product hint,
  qty, sale price, ordered_at, raw_excerpt, actions) is an editable
  `<Input>` styled to disappear into the cell. Renders per-row commit
  errors as a red helper inside the same row.
- `frontend/src/components/orders-import/ConfidenceChip.tsx` — pill
  mirroring `.pill.{ok,warn,err,muted}` from `styles.css`:
  `≥0.8 → ok (green)`, `0.5–0.8 → warn (amber)`, `<0.5 → err (red)`,
  missing → muted ink-3. Shows the score as a percentage.
- `frontend/src/components/orders-import/ImportCommitDialog.tsx` —
  AlertDialog asking the operator to confirm persisting N rows.
  Primary action is terracotta (Sales brand color).
- `frontend/src/components/orders-import/ImportErrorList.tsx` —
  post-commit per-row error list rendered above the preview when
  /commit returns partial failures.
- `frontend/src/components/orders-import/__tests__/ConfidenceChip.test.tsx`
  + `ImportDropZone.test.tsx` — one Vitest test file each (5 + 2
  cases respectively) covering bucket/label mapping and file
  pick/reject behaviour.
- `frontend/src/app/[locale]/(app)/orders/import/page.tsx` — three-step
  wizard (drop → review → commit) with a `<StepIndicator>` chip strip
  in the Sales terracotta. Uses `PageHead` with
  `subColor="var(--brand-sales)"`.
- `frontend/src/app/[locale]/(app)/orders/import/loading.tsx`
  + `error.tsx` — skeleton + boundary, matching the orders pattern.

### Files Modified
- `frontend/src/lib/api-client.ts` — taught `request()` to recognise
  a `FormData` body, leave the `Content-Type` to the browser so the
  multipart boundary lands on the wire, and forward it as-is. All
  existing JSON callers are unchanged.
- `frontend/messages/en.json` + `frontend/messages/pt-BR.json` — new
  `ordersImport` namespace with the full key list spec'd in the brief
  (page/eyebrow, list, steps, dropzone, preview, confidence, commit,
  errors, toasts, fallback). Uses ICU plurals for row-count strings.
  pt-BR copy follows the design source: "Importar pedidos", "Soltar
  arquivo aqui", "Analisar", "Confirmar importação".

## Migration Notes
None — frontend-only change.

## Dev Notes
- **5 MB cap (not 10 MB)** — the brief mentioned 10 MB; I went with the
  backend's actual limit (`_MAX_UPLOAD_BYTES = 5 * 1024 * 1024` in
  `routers/orders_import.py`) so the client-side check never permits
  an upload the server will reject. Worth lifting both together in a
  follow-up if 10 MB is the real target.
- **Confidence display** — the pill renders the numeric percentage
  inside the chip so the operator can both eyeball the tone and read
  the score. Buckets: ≥80% high (green), 50–79% medium (amber),
  1–49% low (red), 0/missing none (muted).
- **Partial commit retry UX** — when `/commit` returns errors, the
  client filters the table down to only the failing rows, keeps the
  user's edits, and surfaces `ImportErrorList` above. Click "Save"
  again to retry just those rows.
- **`<input type="datetime-local">`** for `ordered_at` keeps editing
  cheap in jsdom and matches the design's inline-edit ergonomics.
  We re-serialise to ISO before sending back to /commit.
- **Multipart support in `api-client`** is intentionally minimal —
  no progress reporting, no abort UI — because the parse roundtrip
  is fast (<5 s on a 1 MB PDF). Add streaming if/when uploads grow.

## Verification
- `pnpm i18n:lint` → 1052 keys, both locales agree.
- `pnpm test` → 36 files / 169 tests pass (added two new files).
- `pnpm lint` → no new warnings/errors in `orders-import` or
  `lib/schemas/orders-import.ts`. Pre-existing
  `react-hooks/incompatible-library` warnings in unrelated tables
  remain.
- Manual smoke: `pnpm dev` on :3010, fetched `/pt-BR/orders/import`
  and `/en/orders/import` → both return 200 with the dropzone +
  eyebrow ("Vendas"/"Sales") + title ("Importar pedidos" / "Import
  orders") rendering as expected.
