import asyncio

from celery import Celery
from celery.signals import worker_process_init

from app.db import engine
from app.settings import settings

celery = Celery(__name__)
celery.conf.broker_url = settings.CELERY_BROKER_URL
celery.conf.result_backend = settings.CELERY_RESULT_BACKEND

celery.autodiscover_tasks(["app.tasks"])


@celery.on_after_configure.connect
def setup_periodic_tasks(sender: Celery, **kwargs):
    # from celery.schedules import crontab
    # https://docs.celeryq.dev/en/main/userguide/periodic-tasks.html#entries
    ...


@worker_process_init.connect
def reset_engine_on_fork(*args, **kwargs):
    asyncio.run(engine.dispose())


__all__ = ["celery"]
