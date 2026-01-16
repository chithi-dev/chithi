#!/bin/sh
set -e

# Navigate to project root
cd "$(dirname "$0")/.." || exit 1

# Initialize as a simple string instead of an array
UVICORN_ARGS=""

if [ -n "$ROOT_PATH" ]; then
    UVICORN_ARGS="--root-path $ROOT_PATH"
fi

echo "Running migrations..."
alembic upgrade head

echo "Starting Uvicorn..."
# Do NOT put quotes around $UVICORN_ARGS here, 
# otherwise it will be passed as a single empty string if empty.
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 $UVICORN_ARGS