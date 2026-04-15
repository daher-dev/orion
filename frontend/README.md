# Orion Frontend

Next.js 16 App Router, React 19, Tailwind v4, shadcn/ui, TanStack Query, next-intl.

See the root `CLAUDE.md` and `Taskfile.yml` for commands.

## Local setup

```bash
pnpm install
cp .env.local.example .env.local  # edit as needed
```

## Development

```bash
pnpm dev       # or `task dev:frontend` from the repo root
```

## Testing

```bash
pnpm test           # Vitest (unit)
pnpm test:e2e       # Playwright (e2e)
```

## i18n

- Locales: `en`, `pt-BR` (default `pt-BR`)
- Messages in `messages/<locale>.json`
- Every user-facing string must have an entry in BOTH `en.json` and `pt-BR.json`

## Directories

- `src/app/[locale]/` — pages (App Router)
- `src/components/` — React components
- `src/hooks/` — TanStack Query hooks (`use-<feature>.ts`)
- `src/lib/` — utilities
- `src/providers/` — context providers
- `src/i18n/` — next-intl config
- `e2e/` — Playwright tests
