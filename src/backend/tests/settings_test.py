"""Settings for the integration test suite.

Inherits everything from core.settings, then pins down the pieces that must
be deterministic and hermetic under the Django test runner:

- A throwaway SQLite database on disk (the async views/mutations hop threads
  via sync_to_async, so every connection must see committed rows - a plain
  TestCase transaction would hide them).
- A throwaway MEDIA_ROOT so local-storage tests never touch real uploads.
- MD5 password hashing (Argon2 is far too slow for hundreds of logins).
- The django.tasks ImmediateBackend so ``task.enqueue()`` runs inline.
- The in-memory Channels layer so WebSocket tests need no Redis.
"""

import tempfile
from pathlib import Path

from core.settings import *  # noqa: F401,F403
from core.settings import CACHES, DATABASES, MEDIA_ROOT, PASSWORD_HASHERS, SECRET_KEY, TASKS

_TEST_DIR = Path(tempfile.mkdtemp(prefix="chithi-tests-"))

SECRET_KEY = "test-secret-key-do-not-use-in-production"

MEDIA_ROOT = _TEST_DIR / "media"
MEDIA_ROOT.mkdir(parents=True, exist_ok=True)

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": _TEST_DIR / "db.sqlite3",
    }
}

PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

TASKS = {
    "default": {
        "BACKEND": "django.tasks.backends.immediate.ImmediateBackend",
    }
}

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "chithi-tests",
    }
}

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "loggers": {
        "apps.graphql": {"handlers": ["console"], "level": "DEBUG"},
        "core.middleware": {"handlers": ["console"], "level": "DEBUG"},
        "apps.files": {"handlers": ["console"], "level": "DEBUG"},
    },
}
