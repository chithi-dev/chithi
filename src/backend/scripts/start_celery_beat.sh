#!/bin/bash

export CELERY_CUSTOM_WORKER_POOL='celery_aio_pool.pool:AsyncIOPool'
exec celery -A app.celery beat --loglevel=info