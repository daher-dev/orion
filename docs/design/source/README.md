# Design Source

Source-of-truth design package from Claude Design. **Reference only — not bundled with frontend.**

## Files

| File | Purpose |
|---|---|
| `Orion.html` | Standalone HTML entry that loads the prototype |
| `styles.css` | Design tokens (warm palette, typography, sub-product brand colors) — port to `frontend/src/app/globals.css` |
| `data.js` | Seed data (companies, users, products, orders, etc.) — port to `backend/tests/fixtures/seed_data.py` and `backend/scripts/seed_dev.py` |
| `app.jsx`, `shell.jsx`, `ui.jsx`, `icons.jsx` | Top-level prototype components — reference for app shell, primitives, icons |
| `tweaks-panel.jsx` | Theme tweaking panel from the prototype (not productionized) |
| `pages/` | One JSX file per page group (catalog, dashboard, inventory, production, reports-settings, sales) |
| `screenshots/` | UI screenshots from the prototype |

## How to use

When implementing a feature:
1. Read the spec in `../pages/<feature>.md`
2. Read the corresponding JSX in `pages/<group>.jsx` for component patterns and copy
3. Reference screenshots for visual fidelity
4. Reuse design tokens already migrated to `frontend/src/app/globals.css`

The JSX files are not React-router based — they treat each page as a single function component. Translate the structure faithfully but use Next.js App Router conventions, shadcn primitives, react-hook-form for forms, and TanStack Query for data.
