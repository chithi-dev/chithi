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
    "core.middleware.GraphQLJwtMiddleware",
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

# Object storage (S3 / B2). Two separate concerns:
#   S3_PRIVATE_BUCKET_URL – the endpoint the backend writes chunks to
#                           (B2 S3-compatible endpoint, R2, RUSTFS, etc.)
#   S3_CDN_URL            – the public domain that serves chunk downloads
#                           (Cloudflare Bandwidth Alliance domain, or
#                           backblazeb2.com for B2's free-egress CDN)
# When S3_CDN_URL is set, presigned_chunk_url returns a CDN URL instead of
# a signed B2 URL, so the CLI / frontend fetch directly from the CDN.
S3_PRIVATE_BUCKET_URL = os.environ.get("S3_PRIVATE_BUCKET_URL", "")
S3_CDN_URL = os.environ.get("S3_CDN_URL", "").rstrip("/")

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "users.User"

# Django Tasks framework — uses ImmediateBackend by default (runs tasks
# synchronously in the same thread). In production, configure a proper
# backend via the TASKS setting or use a management command for periodic jobs.
TASKS = {
    "default": {
        "BACKEND": "django.tasks.backends.immediate.ImmediateBackend"
        if DEBUG
        else os.environ.get(
            "DJANGO_TASKS_BACKEND",
            "django.tasks.backends.database.DatabaseBackend",
        ),
    },
}

# Cache — use locmem for local dev, Redis in production
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
