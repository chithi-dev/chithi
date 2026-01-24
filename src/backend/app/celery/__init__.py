from celery import Celery
from celery.schedules import crontab

from app.settings import settings

celery = Celery(__name__)
celery.conf.broker_url = settings.CELERY_BROKER_URL
celery.conf.result_backend = settings.CELERY_RESULT_BACKEND

celery.autodiscover_tasks(["app.tasks"])


@celery.on_after_configure.connect
def setup_periodic_tasks(sender: Celery, **kwargs):
    # https://docs.celeryq.dev/en/main/userguide/periodic-tasks.html#entries
    from app.periodic_tasks import cleanup_expired_files, cleanup_stalled_uploads

    # Every 10 mins check for unused files
    sender.add_periodic_task(
        crontab(minute="*/10"),
        cleanup_expired_files.s(),
        name="cleanup_files_every_10_minutes",
    )

    # Every hour clean up stalled multipart uploads older than MAX_AGE
    sender.add_periodic_task(
        crontab(minute=0, hour="*"),
        cleanup_stalled_uploads.s(settings.RUSTFS_BUCKET_NAME),
        name="cleanup_stalled_uploads_hourly",
    )


__all__ = ["celery"]
