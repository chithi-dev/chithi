import os
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get(
    "SECRET_KEY", "django-insecure-change-this-in-production-please"
)
DEBUG = os.environ.get("DEBUG", "True").lower() == "true"
ALLOWED_HOSTS = ["*"]
APPEND_SLASH = True
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "apps.users",
    "apps.files",
    "apps.api",
    "apps.config",
    "apps.speedtest",
    "apps.reverse",
    "channels",
    "strawberry_django",
    "apps.graphql",
]

# ExemptMiddleware must run first: it is the only middleware that can skip the
# rest of the chain for exempt views, so it has to see the request before any
# other middleware does.
MIDDLEWARE = [
    "core.middlewares.ExemptMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "core.middlewares.JwtAuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# Fail fast if ExemptMiddleware is ever removed or reordered below a middleware
# it must precede: it is the first entry in the chain by design.
if MIDDLEWARE[0] != "core.middlewares.ExemptMiddleware":
    raise RuntimeError(
        "core.middlewares.ExemptMiddleware must be the first entry in MIDDLEWARE. "
        f"Current first entry: {MIDDLEWARE[0]!r}."
    )

ROOT_URLCONF = "core.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

ASGI_APPLICATION = "core.asgi.application"

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "sqlite:///db.sqlite3",
)

# Optional DB driver options (charset/collation), applied to MySQL/MariaDB
# which otherwise defaults to a non-UTF8 collation on some setups. Postgres
# and SQLite ignore these keys.
_db_options: dict[str, str] = {}
if db_charset := os.environ.get("DB_CHARSET", "").strip():
    _db_options["charset"] = db_charset
if db_collation := os.environ.get("DB_COLLATION", "").strip():
    _db_options["collation"] = db_collation

DATABASES = {
    "default": dj_database_url.config(
        default=DATABASE_URL,
        conn_max_age=60,
        conn_health_checks=True,
        **(_db_options and {"OPTIONS": _db_options} or {}),
    )
}

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"
    },
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

PASSWORD_HASHERS = ["django.contrib.auth.hashers.Argon2PasswordHasher"]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# Object storage (S3 / B2 / R2). Two separate concerns:
#   S3_ENDPOINT_URL   – the S3-compatible endpoint the backend writes chunks
#                       to (B2, R2, RUSTFS, ...).
#   S3_CDN_URL        – the public domain that serves chunk downloads
#                       (Cloudflare Bandwidth Alliance domain, or
#                       backblazeb2.com for B2's free-egress CDN).
# When S3_CDN_URL is set, presigned_chunk_url returns a CDN URL instead of
# a signed S3 URL, so the CLI / frontend fetch directly from the CDN.
S3_ENDPOINT_URL = os.environ.get("S3_ENDPOINT_URL", "")
S3_ACCESS_KEY_ID = os.environ.get("S3_ACCESS_KEY_ID", "")
S3_SECRET_ACCESS_KEY = os.environ.get("S3_SECRET_ACCESS_KEY", "")
S3_BUCKET_NAME = os.environ.get("S3_BUCKET_NAME", "")
S3_CDN_URL = os.environ.get("S3_CDN_URL", "").rstrip("/")
S3_REGION_NAME = os.environ.get("S3_REGION_NAME", "")
S3_ADDRESSING_STYLE = os.environ.get("S3_ADDRESSING_STYLE", "")
S3_QUERYSTRING_AUTH = os.environ.get("S3_QUERYSTRING_AUTH", "True").lower() == "true"
S3_QUERYSTRING_EXPIRE = int(os.environ.get("S3_QUERYSTRING_EXPIRE", "3600"))

# The "default" storage backend is chosen by STORAGE_BACKEND. When unset it
# falls back to S3 if credentials are present, otherwise local filesystem so
# the app runs in dev with zero configuration. Any django-storages backend
# (S3, GCS, GDrive, Azure, OpenStack, ...) can be selected by name; the app
# only relies on the small storage surface (save/url/exists/listdir/delete).
STORAGE_BACKEND = os.environ.get("STORAGE_BACKEND", "").strip().lower()

# Map friendly names to (django-storages backend, options builder). The S3
# branch reuses the S3_* settings above; the others read their own settings.
_S3_OPTIONS: dict[str, str | int | bool | None] = {
    "bucket_name": S3_BUCKET_NAME,
    "access_key": S3_ACCESS_KEY_ID,
    "secret_key": S3_SECRET_ACCESS_KEY,
    "endpoint_url": S3_ENDPOINT_URL or None,
    "querystring_auth": S3_QUERYSTRING_AUTH,
    "querystring_expire": S3_QUERYSTRING_EXPIRE,
}
if S3_REGION_NAME:
    _S3_OPTIONS["region_name"] = S3_REGION_NAME
if S3_ADDRESSING_STYLE:
    _S3_OPTIONS["addressing_style"] = S3_ADDRESSING_STYLE
if S3_CDN_URL:
    _S3_OPTIONS["custom_domain"] = S3_CDN_URL.rstrip(".")
    _S3_OPTIONS["querystring_auth"] = False


def _resolve_default_storage() -> tuple[str, dict[str, str]]:
    """Return (BACKEND, OPTIONS) for the configured storage backend."""
    # Local filesystem is the zero-config default.
    if STORAGE_BACKEND in ("", "local", "filesystem"):
        if STORAGE_BACKEND in ("", "local") and bool(
            S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY and S3_BUCKET_NAME
        ):
            return "storages.backends.s3.S3Storage", dict(_S3_OPTIONS)
        return "django.core.files.storage.FileSystemStorage", {
            "location": str(MEDIA_ROOT),
        }

    if STORAGE_BACKEND in ("s3", "b2", "r2", "minio", "rustfs"):
        return "storages.backends.s3.S3Storage", dict(_S3_OPTIONS)

    if STORAGE_BACKEND in ("gcs", "google"):
        return (
            "storages.backends.gcloud.GoogleCloudStorage",
            {
                "project_id": os.environ.get("GCS_PROJECT_ID", ""),
                "bucket_name": os.environ.get("GCS_BUCKET_NAME", ""),
                "credentials_path": os.environ.get("GCS_CREDENTIALS_PATH", ""),
                "custom_domain": os.environ.get("GCS_CUSTOM_DOMAIN", "") or None,
            },
        )

    if STORAGE_BACKEND in ("azure", "azurite"):
        return (
            "storages.backends.azure_storage.AzureStorage",
            {
                "account_name": os.environ.get("AZURE_STORAGE_ACCOUNT", ""),
                "account_key": os.environ.get("AZURE_STORAGE_KEY", ""),
                "container": os.environ.get("AZURE_STORAGE_CONTAINER", ""),
            },
        )

    if STORAGE_BACKEND in ("openstack", "swift"):
        return (
            "storages.backends.apache_libcloud.Storage",
            {
                "libcloud_type": "openstack",
                "container": os.environ.get("OPENSTACK_CONTAINER", ""),
            },
        )

    # Unknown backend: fall back to local so the app still boots and the
    # operator sees a clear log line rather than a crash at import time.
    import logging

    logging.getLogger(__name__).warning(
        "Unknown STORAGE_BACKEND %r, falling back to local filesystem",
        STORAGE_BACKEND,
    )
    return "django.core.files.storage.FileSystemStorage", {
        "location": str(MEDIA_ROOT),
    }


_BACKEND, _OPTIONS = _resolve_default_storage()
STORAGES = {
    "default": {"BACKEND": _BACKEND, "OPTIONS": _OPTIONS},
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"
    },
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "users.User"

# Celery - periodic eviction is scheduled by beat (see core/celery.py).
# CELERY_BROKER_URL drives both the broker and the Redis cache location.
# Defaults to a local Redis so `celery worker` / `celery beat` run out of the box.
CELERY_BROKER_URL = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/0")
CELERY_RESULT_BACKEND = os.environ.get("CELERY_RESULT_BACKEND", "redis://localhost:6379/1")

# Channels - WebSocket transport for reverse-share rooms.
# Uses Redis (same broker as Celery) so groups work across workers;
# falls back to in-memory for local dev without a broker configured.
if os.environ.get("CELERY_BROKER_URL"):
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels_redis.core.RedisChannelLayer",
            "CONFIG": {
                "hosts": [os.environ["CELERY_BROKER_URL"]],
            },
        }
    }
else:
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels.layers.InMemoryChannelLayer",
        }
    }

# Cache - use locmem for local dev, Redis when a broker URL is configured.
if os.environ.get("CELERY_BROKER_URL"):
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": os.environ.get("CELERY_BROKER_URL"),
        }
    }
else:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        }
    }

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "loggers": {
        "django.request": {
            "handlers": ["console"],
            "level": "ERROR",
            "propagate": True,
        },
    },
}

STRAWBERRY = {"DJANGO": {"MUTATION_DEFAULT_ARGUMENTS": {}}}
