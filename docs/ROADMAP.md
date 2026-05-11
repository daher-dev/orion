# Orion Feature Roadmap

High-level view of project phases and their features. Detailed specs live in `docs/features/`.

## Status Legend

- done: All acceptance criteria passed QA
- in-progress: Spec exists, implementation or QA underway
- draft: Spec written, not yet approved
- planned: Idea captured, spec not yet written

---

## Feature Specs Index

Features created through the `/pm` workflow are tracked here. Add a line when a new spec is created.

| ID | Title | Status | Phase | Branch |
|----|-------|--------|-------|--------|
| F-000 | Foundation: app shell, auth, design tokens | done | 0 | `foundation/app-shell-and-auth` |
| F-001 | Auth & Onboarding (login, signup, accept-invite, onboarding wizard) | in-progress | 1 | `feature/001-auth` |
| F-002 | Members & Roles (invite flow, role assignment, permission matrix UI) | in-progress | 2 | `feature/002-members-roles` |
| F-003 | Catalog: Specs (fichas técnicas) | in-progress | 1 | `feature/003-specs` |
| F-004 | Catalog: Prints (estampas) | in-progress | 1 | `feature/004-prints` |
| F-005 | Catalog: Products + Variations | planned | 2 | `feature/005-products` |
| F-006 | Inventory: Fabric (bobinas) | in-progress | 1 | `feature/006-fabric` |
| F-007 | Production: Cutting | planned | 3 | `feature/007-cutting` |
| F-008 | Production: Bancas (contractors) | in-progress | 1 | `feature/008-contractors` |
| F-009 | Production: Sewing (shipments) | planned | 3 | `feature/009-sewing` |
| F-010 | Inventory: Stock | planned | 4 | `feature/010-stock` |
| F-011 | Sales: Clients | in-progress | 1 | `feature/011-clients` |
| F-012 | Sales: Ads | planned | 3 | `feature/012-ads` |
| F-013 | Sales: Orders (manual + view) | planned | 4 | `feature/013-orders` |
| F-014 | Sales: Orders import (LLM PDF + CSV + webhooks) | planned | 5 | `feature/014-orders-import` |
| F-015 | Dashboard + Reports | planned | 5 | `feature/015-dashboard-reports` |
| F-016 | Settings: Company + Profile | in-progress | 1 | `feature/016-settings-basics` |
| F-018 | Settings: Audit Log Viewer | in-progress | 2 | `feature/018-audit-log` |
| F-019 | Settings: Integrations (webhook tokens, channel auth) | planned | 6 | `feature/019-integrations` |
| F-020 | Settings: Notifications | planned | 6 | `feature/020-notifications` |
| F-021 | Settings: Billing (v2 stub) | planned | 6 | `feature/021-billing` |

<!-- PM agent: add new features to this table when creating specs -->

---

## Build Phases

| Phase | Goal | Features | Parallelism |
|---|---|---|---|
| 0 — Foundation | Auth dependencies, app shell, design tokens, API client, seed data | F-000 | 2–3 agents (single coordinated PR) |
| 1 — Independent leaves | Pages with no cross-feature dependencies | F-001, F-003, F-004, F-006, F-008, F-011, F-016 | up to 7 parallel agents |
| 2 — Settings deps + Catalog | Members/Roles, Audit, Products | F-002, F-005, F-018 | 3 parallel agents |
| 3 — Production + Ads | Cutting, Sewing, Ads | F-007, F-009, F-012 | 3 parallel agents |
| 4 — Sales orders | Orders + Stock | F-010, F-013 | 2 parallel agents |
| 5 — Cross-cutting | Orders import (LLM), Dashboard/Reports | F-014, F-015 | 2 parallel agents |
| 6 — Polish | Integrations, Notifications, Billing, i18n reconciliation | F-019, F-020, F-021 | 2–3 polish agents |

Critical path: F-000 → F-003 → F-005 → F-007 → F-009 → F-010 → F-015 (7 sequential steps).

---

## Planned Ideas

Ideas not yet promoted to a feature spec.

- _None yet — all 15 designed features are tracked above._
