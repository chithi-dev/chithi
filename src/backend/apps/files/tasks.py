"""Scheduled background tasks.

``delete_file_after_expiry`` is a one-shot job: when a file is registered we
enqueue it with a ``countdown`` equal to the file's expiry duration. Celery
defers execution until that instant and then purges the file's chunks from
object storage and its row from the database. This removes the need for a
periodic beat scan -- a file is deleted exactly when it expires, and only
then.

A file may also expire by download count (``expire_after_n_download``), which
cannot be scheduled in advance; that path still refuses access at request
time (see ``services.presigned_chunk_url``), so the storage is cleaned up on
the next registration of that file or by an explicit delete.
"""

import logging

from celery import shared_task
from django.utils import timezone

from apps.files.models import File
from apps.files.services import _delete_by_prefix

logger = logging.getLogger(__name__)


@shared_task
def delete_file_after_expiry(file_key: str) -> bool:
    """Delete one file (storage chunks + DB row) when its expiry instant hits.

    Synchronous on purpose: a Celery worker runs in its own process without an
    event loop, so the storage call is made directly via the sync
    ``_delete_by_prefix`` helper rather than the async ``delete_file_chunks``
    wrapper (which relies on ``sync_to_async`` and only works inside Django's
    async request path).
    """
    try:
        file_obj = File.objects.get(key=file_key)
    except File.DoesNotExist:
        # Already gone (deleted manually, or the download-count path removed
        # it first) -- nothing left to do.
        logger.debug("Scheduled delete: file %s no longer exists", file_key)
        return False

    try:
        _delete_by_prefix(f"{file_obj.key}/")
    except Exception as e:
        # A storage hiccup must not block the row removal; the row is the
        # source of truth for "this file is gone".
        logger.error("Failed to delete chunks for %s: %s", file_key, e)
    file_obj.delete()
    logger.info("Evicted expired file %s", file_key)
    return True
