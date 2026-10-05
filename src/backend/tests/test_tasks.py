"""Celery task tests -- the one-shot expired-file deletion task.

Exercises the raw callable and the ``apply()`` path against the real ORM +
chunked storage backend. Runs eager (``task_always_eager``), so ``apply()``
executes inline without a live broker.
"""

from unittest.mock import patch

from apps.files.models import File
from apps.files.services import file_chunks_exist
from apps.files.tasks import delete_file_after_expiry

from .base import IntegrationTestCase, make_file


class DeleteFileAfterExpiryTests(IntegrationTestCase):
    def test_run_attribute_is_the_raw_callable(self):
        self.assertTrue(callable(delete_file_after_expiry.run))

    def test_deletes_the_named_file(self):
        live = make_file(filename="live.bin")
        dead = make_file(filename="dead.bin")

        self.assertTrue(delete_file_after_expiry.run(dead.key))

        self.assertTrue(File.objects.filter(id=live.id).exists())
        self.assertFalse(File.objects.filter(id=dead.id).exists())
        self.assertFalse(self._chunks_exist(dead.key))
        self.assertTrue(self._chunks_exist(live.key))

    def test_noop_when_file_missing(self):
        # A key that never existed (or was already removed) is a safe no-op.
        self.assertFalse(delete_file_after_expiry.run("does-not-exist"))

    def test_apply_runs_inline_when_eager(self):
        dead = make_file(filename="dead.bin")
        delete_file_after_expiry.apply(args=[dead.key])
        self.assertFalse(File.objects.filter(id=dead.id).exists())

    def test_storage_failure_still_removes_row(self):
        dead = make_file(filename="dead.bin")

        def boom(prefix):
            raise RuntimeError("s3 exploded")

        with patch("apps.files.tasks._delete_by_prefix", boom):
            self.assertTrue(delete_file_after_expiry.run(dead.key))

        self.assertFalse(File.objects.filter(id=dead.id).exists())

    @staticmethod
    def _chunks_exist(key):
        from asgiref.sync import async_to_sync

        return async_to_sync(file_chunks_exist)(key, 1)
