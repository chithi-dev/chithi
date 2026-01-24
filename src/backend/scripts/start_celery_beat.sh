#!/bin/bash

exec celery -A app.celery beat --loglevel=info --max-memory-per-child=131072