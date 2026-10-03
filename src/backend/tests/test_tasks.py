"""django.tasks integration — the expired-file cleanup task.

Exercises the raw function and the ImmediateBackend enqueue path against the
real ORM + storage backend.
"""

import asyncio
from unittest.mock import patch

from apps.files.models import File
from apps.files.services import file_exists_in_storage
from apps.files.tasks import delete_expired_files

from .base import IntegrationTestCase, make_file


class DeleteExpiredFilesTests(IntegrationTestCase):
    def test_func_attribute_is_the_raw_callable(self):
        self.assertTrue(callable(delete_expired_files.func))

    def test_deletes_only_expired(self):
        live = make_file(filename="live.bin")
        dead = make_file(expires_in=-1, filename="dead.bin")

        count = asyncio.run(delete_expired_files.func())

        self.assertEqual(count, 1)
        self.assertTrue(File.objects.filter(id=live.id).exists())
        self.assertFalse(File.objects.filter(id=dead.id).exists())
        self.assertFalse(self._file_exists(dead.key))
        self.assertTrue(self._file_exists(live.key))

    def test_noop_when_nothing_expired(self):
        make_file()
        self.assertEqual(asyncio.run(delete_expired_files.func()), 0)

    def test_enqueue_runs_inline_via_immediate_backend(self):
        dead = make_file(expires_in=-1)
        result = delete_expired_files.enqueue()
        # ImmediateBackend executes synchronously; the result object exposes
        # the return value once resolved.
        self.assertIsNotNone(result)
        self.assertFalse(File.objects.filter(id=dead.id).exists())

    def test_storage_failure_still_removes_row(self):
        dead = make_file(expires_in=-1)

        async def boom(key):
            raise RuntimeError("s3 exploded")

        with patch("apps.files.tasks.delete_file_from_storage", boom):
            count = asyncio.run(delete_expired_files.func())

        self.assertEqual(count, 1)
        self.assertFalse(File.objects.filter(id=dead.id).exists())

    @staticmethod
    def _file_exists(key):
        # Run on its own event loop to avoid conflict with the Channels
        # in-memory layer when the suite is run together.
        return asyncio.run(file_exists_in_storage(key))
