#!/bin/bash
set -e

cd "$(dirname "$0")/.." || exit 1

# Run celery worker using (nproc - 1) concurrency, fallback to 1
CORES=$(nproc)
if [ "$CORES" -gt 1 ]; then
  CONCURRENCY=$((CORES - 1))
else
  CONCURRENCY=1
fi

exec celery -A core.celery worker \
    --concurrency "$CONCURRENCY" \
    --loglevel=info \
    --max-memory-per-child=131072
