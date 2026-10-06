#!/bin/sh
set -e

cd "$(dirname "$0")/.." || exit 1

# Apply any pending Django migrations before serving traffic.
python manage.py migrate

# Start the ASGI server (uvicorn).
exec uvicorn core.asgi:application \
    --host 0.0.0.0 \
    --port "${PORT:-8000}" \
    --timeout-keep-alive 0 \
    --limit-concurrency "${LIMIT_CONCURRENCY:-1000}"
