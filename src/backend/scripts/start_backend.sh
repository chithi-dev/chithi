#!/bin/bash
# 'set -e' ensures the script exits immediately if any command fails
set -e

# Navigate to the project root (one level up from the script's directory)
cd "$(dirname "$0")/.." || exit 1

# Initialize UVICORN_ARGS as an empty array
UVICORN_ARGS=()

# Check if ROOT_PATH is set and not empty
if [ -n "${ROOT_PATH}" ]; then
    UVICORN_ARGS+=("--root-path" "${ROOT_PATH}")
fi

# Run database migrations
echo "Running migrations..."
alembic upgrade head

# Start the application
# Use "${UVICORN_ARGS[@]}" to properly handle spaces or empty elements
echo "Starting Uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 "${UVICORN_ARGS[@]}"