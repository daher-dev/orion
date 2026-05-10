# Navigation & App Shell

## App shell layout

```
┌─────────────────────────────────────────────────────────────┐
│  [Company ▾]    🔍 Search (⌘K)         🔔   [Avatar ▾]     │ ← Top bar
├──────────────┬──────────────────────────────────────────────┤
│ ▸ Dashboard  │                                              │
│              │                                              │
│ SALES        │                                              │
│ ▸ Orders     │                                              │
│ ▸ Clients    │           Page content (RSC)                 │
│ ▸ Ads        │                                              │
│              │                                              │
│ CATALOG      │                                              │
│ ▸ Products   │                                              │
│ ▸ Specs      │                                              │
│ ▸ Prints     │                                              │
│              │                                              │
│ PRODUCTION   │                                              │
│ ▸ Cutting    │                                              │
│ ▸ Sewing     │                                              │
│ ▸ Bancas     │                                              │
│              │                                              │
│ INVENTORY    │                                              │
│ ▸ Fabric     │                                              │
│ ▸ Stock      │                                              │
│              │                                              │
│ ▸ Reports    │                                              │
│ ▸ Settings   │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

## Behavior

- Sidebar collapses to icons-only on `<lg`, drawer on `<md`.
- Section headings (SALES, CATALOG, …) are visual groupings, not nav links.
- "Bancas" is the Portuguese label by default; English shows "Contractors".
- Top bar: company switcher (left), command palette ⌘K (center), notifications + avatar (right).
- Hidden nav items: items the user lacks permission for don't render at all.

## Role visibility matrix

| Section | Admin | Manager | Operator |
|---|---|---|---|
| Dashboard | ✅ | ✅ | ✅ (operator-tuned widgets) |
| Sales › Orders | ✅ | ✅ | — |
| Sales › Clients | ✅ | ✅ | — |
| Sales › Ads | ✅ | ✅ | — |
| Catalog › Products | ✅ | ✅ | 👁 read |
| Catalog › Specs | ✅ | ✅ | 👁 read |
| Catalog › Prints | ✅ | ✅ | 👁 read |
| Production › Cutting | ✅ | ✅ | ✅ |
| Production › Sewing | ✅ | ✅ | ✅ |
| Production › Bancas | ✅ | ✅ | — |
| Inventory › Fabric | ✅ | ✅ | 👁 read |
| Inventory › Stock | ✅ | ✅ | ✅ |
| Reports | ✅ | ✅ | — |
| Settings › Company | ✅ | 👁 read | — |
| Settings › Members | ✅ | 👁 read | — |
| Settings › Roles | ✅ | 👁 read | — |
| Settings › Billing | ✅ | — | — |
| Settings › Audit Log | ✅ | 👁 read | — |
| Settings › Profile | ✅ | ✅ | ✅ |

Hidden items don't render in the nav (per locked decision). Backend still enforces — UI is just for clarity. Matrix matches the seeded permission migration ([3187f02cbc35_seed_roles_and_permissions.py](../../backend/alembic/versions/3187f02cbc35_seed_roles_and_permissions.py)).
