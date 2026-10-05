# Django app initialisation: ensure the Celery app is loaded whenever the
# project package is imported, so ``celery worker``, ``celery beat`` and
# ``celery -A core worker`` all share the same configuration.
try:
    from core.celery import celery_app  # noqa: F401
except ImportError:
    # Celery may not be installed in minimal test environments.
    pass
