#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend"

cd "${ROOT_DIR}"
echo "Stopping any running containers..."
docker compose down -v

echo "Starting fresh database..."
docker compose up -d
echo "Waiting for PostgreSQL to be ready..."
docker compose exec -T db pg_isready -U orion -d orion_dev --timeout=30

cd "${BACKEND_DIR}"
echo "Applying migrations..."
uv run alembic upgrade head

echo "Seeding demo data..."
uv run python scripts/seed_dev.py

echo "Test database reset completed."
