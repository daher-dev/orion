# Feature breakdown

The IA maps roughly to ~15 feature specs. Each becomes one `/pm` cycle.

## Suggested order

| # | Feature | Depends on |
|---|---|---|
| 1 | **Auth & onboarding** — login, signup, accept-invite, app shell, company switcher | — |
| 2 | **Members & Roles** — invite flow, role assignment, permission UI | 1 |
| 3 | **Catalog: Specs** — first manageable entity | 1 |
| 4 | **Catalog: Prints** — like specs, includes file upload | 1 |
| 5 | **Catalog: Products + Variations** | 3, 4 |
| 6 | **Inventory: Fabric** | 1 |
| 7 | **Production: Cutting** | 5, 6 |
| 8 | **Production: Bancas** — directory | 1 |
| 9 | **Production: Sewing** | 7, 8 |
| 10 | **Inventory: Stock** | 9 |
| 11 | **Sales: Clients** | 1 |
| 12 | **Sales: Ads** | 5 |
| 13 | **Sales: Orders (manual + view)** | 5, 11, 12 |
| 14 | **Sales: Orders import (PDF/LLM + CSV + webhooks)** | 13 |
| 15 | **Dashboard + Reports** | most data populated |

Settings sub-pages (audit log, integrations, billing, profile, notifications) slot in alongside related features.

## Critical files / paths

Concrete paths follow the runway sibling's conventions.

**Shell + auth:**

- `frontend/src/app/[locale]/layout.tsx` — wrap app shell vs. public routes (group routes via `(app)` and `(public)` segments)
- `frontend/src/app/[locale]/(app)/layout.tsx` — sidebar + topbar shell, auth guard
- `frontend/src/components/app-shell/` — `Sidebar`, `Topbar`, `CompanySwitcher`, `CommandPalette`
- `frontend/src/providers/` — `AuthProvider`, `CompanyProvider`
- `frontend/src/hooks/use-auth.ts`, `use-company.ts`, `use-permissions.ts`

**Pages** — one folder per top-level nav item under `frontend/src/app/[locale]/(app)/`.

**i18n keys** — every page namespace needs entries in both `frontend/messages/en.json` and `frontend/messages/pt-BR.json`. Suggested namespaces: `nav.*`, `dashboard.*`, `orders.*`, `clients.*`, `ads.*`, `products.*`, `specs.*`, `prints.*`, `cutting.*`, `sewing.*`, `contractors.*`, `fabric.*`, `stock.*`, `reports.*`, `settings.*`, `auth.*`, `common.*`.
