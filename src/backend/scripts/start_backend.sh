#!/bin/bash
set -e

cd "$(dirname "$0")/.." || exit 1

UVICORN_ARGS=()

if [ -n "$ROOT_PATH" ]; then
    UVICORN_ARGS+=("--root-path" "$ROOT_PATH")
fi

alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port 8000 "${UVICORN_ARGS[@]}"