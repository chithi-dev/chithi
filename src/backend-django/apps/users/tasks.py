from __future__ import annotations

import logging

from django.tasks import task


logger = logging.getLogger(__name__)


@task()
async def delete_user_files_task(user_id: str) -> None:
    """Scheduled task to clean up files belonging to a deleted user."""
    logger.info("Cleaning up files for deleted user %s", user_id)

    from apps.files.models import FileRecord

    deleted = await FileRecord.objects.filter(owner_id=user_id).adelete()
    logger.info("Deleted %d file(s) for user %s", deleted[0], user_id)
