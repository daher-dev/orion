# Orion UI Design

Source of truth for the Orion product UI: who uses it, what pages exist, and how navigation works. Each page below should later become a `/pm` feature spec under [../features/](../features/).

## Why this exists

Orion's models are scaffolded ([backend/src/models/](../../backend/src/models/)) but the frontend has only a placeholder homepage. Before splitting the work into `/pm` features, we need agreement on the IA so each feature spec has a clear home.

## What Orion is

A multi-tenant SaaS for Brazilian apparel manufacturers. It tracks the full custom-garment lifecycle:

1. Customer orders arrive from ecommerce channels (Shopee, Mercado Livre, Shopify, Instagram, WhatsApp)
2. Manager plans cutting (CuttingOrder against fabric rolls)
3. Cut pieces ship to external sewing contractors (bancas)
4. Sewn pieces return as finished stock
5. Stock ships to customer

## Personas

- **Admin** — owner / IT. Full access. Runs once per week to add users, check audit log, change billing. Desktop.
- **Manager** — operations lead. Daily driver. Plans cutting, ships to bancas, watches stock, processes orders. Desktop.
- **Operator** — production floor. Records cutting output, receives shipments back, adjusts stock. Shared tablet or desktop terminal. Lives in Production + Inventory.

## Design decisions locked in

| Decision | Choice | Implication |
|---|---|---|
| Tenancy | Multi-tenant SaaS | Needs signup, company switcher, invite flow, future billing |
| Form factor | Responsive desktop-first | One UI, breaks down to tablet/phone — no separate operator app |
| Order origin | Webhooks + CSV + **PDF/LLM parsing** | Order list is read-mostly; manual entry secondary; smart import is first-class |
| Permission display | Hide disallowed nav items | Operators see only what they can act on |
| Locales | pt-BR (default), en | All copy in `messages/{en,pt-BR}.json`; Portuguese is primary |

## Index

- [navigation.md](navigation.md) — App shell, sidebar, role visibility matrix
- [pages/auth-and-onboarding.md](pages/auth-and-onboarding.md) — Public routes + onboarding wizard
- [pages/dashboard.md](pages/dashboard.md) — Daily landing
- [pages/sales.md](pages/sales.md) — Orders, Clients, Ads
- [pages/catalog.md](pages/catalog.md) — Products, Specs (fichas), Prints (estampas)
- [pages/production.md](pages/production.md) — Cutting, Sewing, Bancas
- [pages/inventory.md](pages/inventory.md) — Fabric (bobinas), Stock
- [pages/reports.md](pages/reports.md) — Sales/Production/Inventory/Costs analytics
- [pages/settings.md](pages/settings.md) — Company, Members, Roles, etc.
- [ui-primitives.md](ui-primitives.md) — Reusable components
- [feature-breakdown.md](feature-breakdown.md) — Suggested `/pm` order
