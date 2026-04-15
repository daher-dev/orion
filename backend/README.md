# Orion Backend

FastAPI + SQLModel + Alembic. Managed with `uv`.

See the root `CLAUDE.md` and `Taskfile.yml` for commands.

## Local setup

```bash
uv sync
cp .env.example .env  # edit if needed
```

## Running

```bash
uv run uvicorn main:app --reload --app-dir src
# or from the repo root:
task dev:backend
```

## Migrations

```bash
task db:migrate                    # Apply
task db:migration -- "add foo"    # Generate (auto)
```

## Testing

```bash
task test:backend
```
