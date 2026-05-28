"""Django settings for core project - production-grade env-based config.

PostgreSQL database + Strawberry GraphQL + Redis pubsub + S3 storage.."""




from pathlib import Path



from pydantic_settings import BaseSettings, SettingsConfigDict





# ── Env-driven settings (pydantic-settings) ──────────────────────────

class AppSettings(BaseSettings):

    model_config = SettingsConfigDict(

        env_prefix="DJANGO_",

        case_sensitive=False,

        extra="ignore",

    )



    SECRET_KEY: str

    DEBUG: bool = False



    # PostgreSQL

    POSTGRES_SERVER: str = "localhost"

    POSTGRES_PORT: int = 5432

    POSTGRES_USER: str = "postgres"

    POSTGRES_PASSWORD: str = "supersecretpassword"

    POSTGRES_DB: str = "chithi"



    # Redis

    REDIS_ENDPOINT: str = "redis://localhost:6379/1"



    # S3 / RustFS storage

    RUSTFS_ENDPOINT_URL: str = "http://localhost:9000"

    RUSTFS_ACCESS_KEY: str = "rustfsadmin"

    RUSTFS_SECRET_ACCESS_KEY: str = "rustfsadmin"

    RUSTFS_BUCKET_NAME: str = "chithi"



    # Upload / download limits

    MAX_DOWNLOAD_SIZE: int = 30 * 1024 * 1024 * 1024  # 30 GB

    ACCESS_TOKEN_EXPIRE_MINUTES: int = 11520  # 8 days



    # Pubsub keys

    STATE_REDIS_KEY: str = "chithi:global_state"

    STATE_CHANNEL: str = "chithi:state_changed"



    # Pagination

    MAX_RESULTS_PER_PAGE: int = 50
    CORS_ORIGINS: str = "*"







# Load settings once at module import time

_settings = AppSettings()

BASE_DIR = Path(__file__).resolve().parent.parent



# ── Core Django settings ────────────────────────────────────────────

SECRET_KEY = _settings.SECRET_KEY

DEBUG = _settings.DEBUG

ALLOWED_HOSTS: list[str] = ["*"] if _settings.CORS_ORIGINS == "*" else [

    o.strip() for o in _settings.CORS_ORIGINS.split(",") if o.strip()

]



# ── Database (PostgreSQL) ───────────────────────────────────────────

DATABASES = {

    "default": {

        "ENGINE": "django.db.backends.postgresql",

        "HOST": _settings.POSTGRES_SERVER,

        "PORT": str(_settings.POSTGRES_PORT),

        "USER": _settings.POSTGRES_USER,

        "PASSWORD": _settings.POSTGRES_PASSWORD,

        "NAME": _settings.POSTGRES_DB,

    }

}



# ── Auth & apps ─────────────────────────────────────────────────────

AUTH_USER_MODEL = "users.User"



INSTALLED_APPS = [

    # Django contrib

    "django.contrib.admin",

    "django.contrib.auth",

    "django.contrib.contenttypes",

    "django.contrib.sessions",

    "django.contrib.messages",

    "django.contrib.staticfiles",

    # Third-party

    "strawberry.django",

    # Domain apps

    "apps.users",

    "apps.files",

    "apps.config",

    "apps.reverse_rooms",

    "apps.admin_domain",

    "apps.speedtest",

    "apps.instance",

]



MIDDLEWARE = [

    "django.middleware.security.SecurityMiddleware",

    "django.contrib.sessions.middleware.SessionMiddleware",

    "django.middleware.common.CommonMiddleware",

    "django.middleware.csrf.CsrfViewMiddleware",

    "django.contrib.auth.middleware.AuthenticationMiddleware",

    "django.contrib.messages.middleware.MessageMiddleware",

    "django.middleware.clickjacking.XFrameOptionsMiddleware",

]



ROOT_URLCONF = "core.urls"

WSGI_APPLICATION = "core.wsgi.application"

ASGI_APPLICATION = "core.asgi.application"



# ── Templates (minimal) ─────────────────────────────────────────────

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

    }

]



# ── Password validation ─────────────────────────────────────────────

AUTH_PASSWORD_VALIDATORS = [

    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},

    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},

    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},

    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},

]



# ── Internationalisation ────────────────────────────────────────────

LANGUAGE_CODE = "en-us"

TIME_ZONE = "UTC"

USE_I18N = True

USE_TZ = True



STATIC_URL = "static/"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"



# ── Strawberry GraphQL ──────────────────────────────────────────────

STRAWBERRY_API_PREFIX = "/graphql"



# ── Redis helpers (parsed from REDIS_ENDPOINT) ──────────────────────

_redis_url = _settings.REDIS_ENDPOINT

if "://" in _redis_url:

    _, _rest = _redis_url.split("://", 1)

else:

    _rest = _redis_url



# Handle redis://host:port/db or redis:///path/to/sock

if "/" in _rest and not _rest.startswith("//"):

    parts = _rest.rsplit("/", 1)

    host_port, db_str = parts[0], parts[1]

elif ":" in _rest:

    host, port = _rest.rsplit(":", 1)

    host_port, db_str = host + ":" + port, "0"

else:

    host_port = _rest

    db_str = "0"



REDIS_HOST = host_port.split(":")[0] if ":" in host_port else host_port

REDIS_PORT = int(host_port.rsplit(":", 1)[1]) if ":" in host_port else 6379

REDIS_DB = int(db_str.lstrip("/") or "0")



# ── Django built-in tasks (immediate backend, runs in-place) ───────────

TASKS = {

    "default": {

        "BACKEND": "django.tasks.backends.immediate.ImmediateBackend",

    },

}



# ── Cloud storage (django-storages + S3-compatible) ───────────────────

STORAGES = {

    "default": {

        "BACKEND": "storages.backends.s3boto3.S3Boto3Storage",

        "OPTIONS": {

            "access_key": _settings.RUSTFS_ACCESS_KEY,

            "secret_key": _settings.RUSTFS_SECRET_ACCESS_KEY,

            "endpoint_url": _settings.RUSTFS_ENDPOINT_URL,

            "bucket_name": _settings.RUSTFS_BUCKET_NAME,

            "region_name": "",

        },

    }

}


# --- Direct S3 access settings (for aioboto3 in chunked uploads) ----
RUSTFS_ENDPOINT_URL = _settings.RUSTFS_ENDPOINT_URL
RUSTFS_ACCESS_KEY = _settings.RUSTFS_ACCESS_KEY
RUSTFS_SECRET_ACCESS_KEY = _settings.RUSTFS_SECRET_ACCESS_KEY
RUSTFS_BUCKET_NAME = _settings.RUSTFS_BUCKET_NAME

# --- Rate limiting (Redis-based) ----
LOGIN_RATE_LIMIT_PER_SECOND = 3
LOGIN_RATE_LIMIT_PER_MINUTE = 60
UPLOAD_RATE_LIMIT_PER_MINUTE = 10


# --- Cache (Redis) ----
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCacheBackend",
        "LOCATION": _settings.REDIS_ENDPOINT,  # type: ignore[name-defined]
    },
}