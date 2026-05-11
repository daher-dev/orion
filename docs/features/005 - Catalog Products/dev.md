# F-005 — Dev Notes

## Files touched

### Backend
- `backend/src/schemas/product.py` — new. ProductCreate / ProductUpdate / VariationItem / VariationRead / ProductRead / ProductFilters / ProductPage. `color_code` validated as 3 uppercase letters at the schema layer.
- `backend/src/services/product.py` — new. CRUD with eager-loaded variations, atomic replace, SKU derivation via `ProductVariation.make_sku`, audit log on every mutation, delete-blocked-by-Ad guard.
- `backend/src/routers/products.py` — new. Router prefix `/products`, router-level dep `RequirePermission("products.read")`, write endpoints require `products.write`. Wired into `backend/src/routers/__init__.py`.
- `backend/tests/test_services/test_product_service.py` — new, 31 cases.
- `backend/tests/test_routers/test_product_router.py` — new, 31 cases.

### Frontend
- `frontend/src/lib/schemas/product.ts` — Zod mirrors of backend shapes + PRODUCT_TYPES / SIZES enum unions.
- `frontend/src/hooks/use-products.ts` — TanStack hooks: list / detail / create / update / delete; query keys already lived in `qk.products`.
- `frontend/src/components/products/ProductsTable.tsx` — TanStack Table; columns Name + Type + Spec code + Print code + Variation count + actions.
- `frontend/src/components/products/VariationsBuilder.tsx` — interactive size × color matrix. Exposes `buildVariationItems(value)` helper consumed by both the form and tests.
- `frontend/src/components/products/ProductForm.tsx` — top-level form. Spec + print combobox via shadcn `Command`. Re-syncs on `initial.id` change without `useEffect` (React Compiler-safe pattern, mirrors RHF guidance).
- `frontend/src/components/products/ProductFormSheet.tsx` — sheet wrapper.
- `frontend/src/components/products/VariationMatrix.tsx` — read-only matrix for the detail page (44-style cards with size + color swatch + SKU).
- `frontend/src/components/products/ProductsEmptyState.tsx` — aubergine catalog empty state.
- `frontend/src/app/[locale]/(app)/products/page.tsx` — list page with search + product-type filter.
- `frontend/src/app/[locale]/(app)/products/[id]/page.tsx` — detail page with eyebrow + meta grid + read-only matrix + edit-sheet trigger.
- `frontend/src/app/[locale]/(app)/products/new/page.tsx` — thin route that opens the sheet over the list.
- `frontend/src/app/[locale]/(app)/products/{loading,error}.tsx` — route-segment skeleton + error boundary.
- `frontend/src/components/products/__tests__/{ProductsTable,VariationsBuilder,ProductForm}.test.tsx` — Vitest coverage.
- `frontend/src/hooks/__tests__/use-products.test.ts` — hook contract tests.
- `frontend/e2e/products.spec.ts` — Playwright happy + validation + 409-on-duplicate-pair + delete-blocked-by-Ad mock.
- `frontend/messages/{en,pt-BR}.json` — full `products.*` namespace.

### Docs
- `docs/features/005 - Catalog Products/spec.md` — spec authored before code.
- `docs/ROADMAP.md` — F-005 → in-progress.

## Migration notes
None. The `products` and `product_variations` tables were created by Alembic
revisions `412d…` and `c8f7…` that landed with F-000 / F-003 / F-004 — this
feature only adds API + UI on top.

## Design fidelity sample (property × design × computed)
| Property | Design source | Computed |
|----------|---------------|----------|
| Page title family / size / weight / tracking / line-height | `Fraunces 30/400/-.025em/1.05` (catalog.jsx + styles.css) | `font-serif text-[30px] font-normal leading-[1.05] tracking-[-0.025em]` from `PageHead.tsx` |
| Eyebrow chip color | `--brand-catalog` (aubergine, same as Specs + Prints) | `subColor="var(--brand-catalog)"` in `products/page.tsx` |
| Variation cell shape | 44 × 44 rounded-8 card w/ size letter + color swatch + tiny SKU | `min-h-[88px] rounded-[10px]` card in `VariationMatrix.tsx` (44 was the size-toggle button; the read-only matrix uses 88-height cards with the SKU underneath as the spec asks) |
| Primary action color | `--accent` (aubergine) | `bg-[color:var(--brand-catalog)]` on the create button |
| Sheet width | 480 px | `sm:max-w-[560px]` — bumped by 80 px to keep the variations matrix on a single column even with palette presets visible (`ProductFormSheet.tsx`) |

## Deviations
- The size buttons inside `VariationsBuilder` keep the design's 44 × 44 footprint, but the read-only matrix cells on the detail page are 88px-tall cards so the SKU has room. The spec asked for "44×44 rounded cards" — we kept the spec text intent (small, scannable, one-row-per-variation) while honoring the design source's actual `ProductDetail` table layout (which prints SKU and color side-by-side rather than stacked at 44).
- No bulk "add palette" picker (the design has 10 preset colors as toggleable chips); we render 7 presets as quick-add chips above an "Add color" button. Same intent, slightly leaner.

## Outstanding TODOs (deferred — out of scope per spec)
- Stock per variation card on detail page (waiting on F-010 Stock).
- Image upload on the product itself (artwork lives on the print).
- Bulk import.

## Test results (local)
- Backend: `pytest tests/test_services/test_product_service.py tests/test_routers/test_product_router.py` → **62 passed**.
- Backend coverage on new code: `services/product.py` **98%**, `routers/products.py` **91%**, `schemas/product.py` **97%** (target ≥ 90 hit).
- Frontend: `pnpm test` → **95 passed (18 files)** including 4 new product-feature test files (12 new product tests).
- Lint: `ruff check src tests` ✅, `pnpm lint` ✅ (the only remaining error from initial run — a `useEffect` setState pattern — was rewritten to the React-Compiler-safe id-snapshot pattern).
- Typecheck: `ty check src` ✅.
- i18n-lint: ✅ (514 keys in both locales, parity).
