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
    "strawberry_django",
    "apps.graphql",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "core.middlewares.JwtAuthenticationMiddleware",
    "core.middlewares.MyMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

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

DATABASES = {
    "default": dj_database_url.config(
        default=DATABASE_URL,
        conn_max_age=60,
        conn_health_checks=True,
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

# The "default" storage backend. S3 when credentials are present, otherwise
# local filesystem so the app runs in dev with zero configuration.
_HAS_S3 = bool(S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY and S3_BUCKET_NAME)

if _HAS_S3:
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

    STORAGES = {
        "default": {
            "BACKEND": "storages.backends.s3.S3Storage",
            "OPTIONS": _S3_OPTIONS,
        },
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
        },
    }
else:
    STORAGES = {
        "default": {
            "BACKEND": "django.core.files.storage.FileSystemStorage",
            "OPTIONS": {"location": str(MEDIA_ROOT)},
        },
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
        },
    }

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "users.User"

# Celery — periodic eviction is scheduled by beat (see core/celery.py).
# CELERY_BROKER_URL drives both the broker and the Redis cache location.
# Defaults to a local Redis so `celery worker` / `celery beat` run out of the box.
CELERY_BROKER_URL = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/0")
CELERY_RESULT_BACKEND = os.environ.get("CELERY_RESULT_BACKEND", "redis://localhost:6379/1")

# Cache — use locmem for local dev, Redis when a broker URL is configured.
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
