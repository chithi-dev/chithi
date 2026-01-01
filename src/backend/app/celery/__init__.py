from celery import Celery

from app.settings import settings

celery = Celery(__name__)
celery.conf.broker_url = settings.CELERY_BROKER_URL
celery.conf.result_backend = settings.CELERY_RESULT_BACKEND

celery.autodiscover_tasks(["app.tasks"])


@celery.on_after_configure.connect
def setup_periodic_tasks(sender: Celery, **kwargs):
    # from celery.schedules import crontab

    # https://docs.celeryq.dev/en/main/userguide/periodic-tasks.html#entries
    # Executes every Monday morning at 7:30 a.m.
    # sender.add_periodic_task(
    #     crontab(hour=7, minute=30, day_of_week=1),
    #     test.s("Happy Mondays!"),
    # )
    ...


__all__ = ["celery"]
