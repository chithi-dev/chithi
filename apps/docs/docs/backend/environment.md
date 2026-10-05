---
icon: lucide/variable
---

## Backend environment variables

The backend supports the following environment variables:

### Core

| Variable              | Purpose                                                       | Notes                                |
| :-------------------- | :------------------------------------------------------------ | ------------------------------------- |
| `SECRET_KEY`          | Django secret key for signing sessions and JWTs               | **Sensitive** -- use a secrets manager |
| `DEBUG`               | Enable Django debug mode                                      | Default `True`                         |
| `ROOT_PATH`           | URL path prefix when app is behind a reverse proxy            | Ensure proxy and app agree on prefix   |

### Database

| Variable           | Purpose                                                    | Notes                                          |
| :----------------- | :--------------------------------------------------------- | ---------------------------------------------- |
| `DATABASE_URL`     | Database connection string (see [Database backends](./database.md)) | Default `sqlite:///db.sqlite3`              |
| `DB_CHARSET`       | Character set passed to MySQL/MariaDB via `OPTIONS`        | e.g. `utf8mb4`; ignored by Postgres and SQLite |
| `DB_COLLATION`     | Collation passed to MySQL/MariaDB via `OPTIONS`            | e.g. `utf8mb4_unicode_ci`                      |

### Storage

| Variable               | Purpose                                                            | Notes                                |
| :--------------------- | :----------------------------------------------------------------- | ------------------------------------- |
| `STORAGE_BACKEND`      | Storage driver to use (see [Storage backends](./storage.md))       | Default `local` (or S3 if credentials present) |
| `S3_ENDPOINT_URL`      | S3-compatible endpoint the backend writes to (B2, R2, MinIO, ...)  | Include scheme and port if needed     |
| `S3_ACCESS_KEY_ID`     | Object storage access key                                          | **Sensitive** -- use a secrets manager |
| `S3_SECRET_ACCESS_KEY` | Object storage secret key                                          | **Sensitive** -- use a secrets manager |
| `S3_BUCKET_NAME`       | Bucket that receives uploaded chunks                               | Must exist and be writable            |
| `S3_REGION_NAME`       | Region for the S3 endpoint                                         | Optional, provider dependent          |
| `S3_ADDRESSING_STYLE`  | `path` or `virtual` addressing                                     | Required by some providers            |
| `S3_QUERYSTRING_AUTH`  | Sign URLs with query strings                                       | Default `True`                        |
| `S3_QUERYSTRING_EXPIRE`| Lifetime of a signed URL in seconds                                | Default `3600`                        |
| `S3_CDN_URL`           | Public domain that serves chunk downloads                          | Disables query-string signing         |
| `GCS_PROJECT_ID`       | GCP project that owns the bucket                                   | Required for `STORAGE_BACKEND=gcs`     |
| `GCS_BUCKET_NAME`      | GCS bucket that receives chunks                                    | Must exist and be writable            |
| `GCS_CREDENTIALS_PATH` | Path to a service-account JSON key file                            | Empty for metadata server             |
| `GCS_CUSTOM_DOMAIN`    | Public domain that serves chunk downloads                          | Optional                              |
| `AZURE_STORAGE_ACCOUNT`| Azure storage account name                                         | Required for `STORAGE_BACKEND=azure`  |
| `AZURE_STORAGE_KEY`    | Azure account access key                                           | **Sensitive**                         |
| `AZURE_STORAGE_CONTAINER`| Azure Blob container that receives chunks                        | Must exist and be writable            |
| `OPENSTACK_CONTAINER`  | Swift container that receives chunks                               | Required for `STORAGE_BACKEND=openstack` |

### Task queue and channels

| Variable               | Purpose                                                       | Notes                                          |
| :--------------------- | :------------------------------------------------------------ | ---------------------------------------------- |
| `CELERY_BROKER_URL`    | Celery broker connection string (where tasks are queued)      | Also used for Redis cache and Channels layer   |
| `CELERY_RESULT_BACKEND`| Backend for Celery task results                               | Stores task results/status                     |

!!! Tip

    Keep secrets out of the repo (use Docker secrets, Vault, or CI secrets),
    rotate credentials, and restrict network access.
