"""Celery application for scheduled background work.

The one job is ``delete_file_after_expiry``: when a file is uploaded we
enqueue a one-shot task at its expiry moment. Celery's ``eta`` (or
``countdown``) defers execution until that instant, so a quiet instance still
evicts on the dot without a periodic beat scan.

Configure with:
    CELERY_BROKER_URL     Redis (or RabbitMQ) broker, e.g. redis://redis:6379/0
    CELERY_RESULT_BACKEND Where to store task results (defaults to the broker)
"""

import os

from celery import Celery

celery_app = Celery(
    "chithi",
    broker=os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/0"),
    backend=os.environ.get("CELERY_RESULT_BACKEND", "redis://localhost:6379/1"),
    include=["apps.files.tasks"],
)

celery_app.conf.update(
    # In tests we set CELERY_TASK_ALWAYS_EAGER=true so .apply() runs inline
    # without a live broker; in production this stays False.
    task_always_eager=os.environ.get("CELERY_TASK_ALWAYS_EAGER", "False").lower() == "true",
    result_extended=True,
    timezone="UTC",
    enable_utc=True,
)
