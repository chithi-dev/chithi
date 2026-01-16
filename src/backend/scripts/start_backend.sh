#!/bin/sh
set -e

cd "$(dirname "$0")/.." || exit 1

alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port 8000