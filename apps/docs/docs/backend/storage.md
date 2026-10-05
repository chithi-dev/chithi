---
icon: lucide/database
---

# Storage backends

Chithi stores uploaded file chunks through Django's pluggable storage layer.
The active backend is chosen by the `STORAGE_BACKEND` environment variable, so
you can point the backend at any object store supported by
[django-storages](https://django-storages.readthedocs.io/) -- S3, Google Cloud
Storage, Google Drive, Azure, OpenStack, or a plain local disk -- without
touching the application code.

## How the backend is chosen

`core/settings.py` resolves the default storage at boot:

1. If `STORAGE_BACKEND` is set to a recognized name (see the table below), the
   matching django-storages driver is used.
2. If `STORAGE_BACKEND` is empty or `local`, the backend falls back to S3 when
   S3 credentials are present, otherwise to the local filesystem rooted at
   `MEDIA_ROOT`, so the app runs with zero configuration in development.
3. An unrecognized value logs a warning and falls back to the local filesystem
   so the process still boots.

Every backend exposes the same small surface the storage service relies on:
`save`, `url`, `exists`, `listdir`, `open`, and `delete`.

## Available backends

| `STORAGE_BACKEND` value        | Driver                                         | Notes                              |
| :----------------------------- | :--------------------------------------------- | ---------------------------------- |
| *(empty)*, `local`, `filesystem` | `django.core.files.storage.FileSystemStorage` | Zero-config default                |
| `s3`, `b2`, `r2`, `minio`, `rustfs` | `storages.backends.s3.S3Storage`         | S3-compatible object stores        |
| `gcs`, `google`               | `storages.backends.gcs.GoogleCloudStorage`     | Google Cloud Storage buckets       |
| `gdrive`, `google_drive`      | `storages.backends.gdrive.GDriveStorage`       | Google Drive folders               |
| `azure`, `azurite`            | `storages.backends.azure_storage.AzureStorage` | Azure Blob Storage                 |
| `openstack`, `swift`          | `storages.backends.openstack.OpenStackStorage` | OpenStack / Swift object storage   |

## S3 / S3-compatible backends

Works with AWS S3, Backblaze B2, Cloudflare R2, MinIO, RustFS, and any other
S3-compatible endpoint.

| Variable               | Purpose                                                            | Notes                                |
| :--------------------- | :----------------------------------------------------------------- | ------------------------------------- |
| `S3_ENDPOINT_URL`      | S3-compatible endpoint the backend writes to (B2, R2, MinIO, ...)  | Include scheme and port if needed     |
| `S3_ACCESS_KEY_ID`     | Object storage access key                                          | **Sensitive** - use a secrets manager |
| `S3_SECRET_ACCESS_KEY` | Object storage secret key                                          | **Sensitive** - use a secrets manager |
| `S3_BUCKET_NAME`       | Bucket that receives uploaded chunks                               | Must exist and be writable            |
| `S3_REGION_NAME`       | Region for the S3 endpoint                                         | Optional, provider dependent          |
| `S3_ADDRESSING_STYLE`  | `path` or `virtual` addressing                                     | Required by some providers            |
| `S3_QUERYSTRING_AUTH`  | Sign URLs with query strings                                       | Default `True`                        |
| `S3_QUERYSTRING_EXPIRE`| Lifetime of a signed URL in seconds                                | Default `3600`                        |
| `S3_CDN_URL`           | Public domain that serves chunk downloads                          | Disables query-string signing         |

`S3_ENDPOINT_URL` and `S3_CDN_URL` serve two different roles:

- `S3_ENDPOINT_URL` is where the **backend writes** chunks (the private S3 API).
- `S3_CDN_URL` is where **clients read** chunks from (a public or CDN domain).
  When set, `presigned_chunk_url` returns a CDN URL instead of a signed S3 URL,
  so downloads go straight to the CDN.

!!! Tip

    For Backblaze B2, set `S3_CDN_URL` to your Cloudflare Bandwidth Alliance
    domain to get free egress. The endpoint URL stays the B2 S3 API endpoint.

## Google Cloud Storage

Install the GCS extra before deploying: `pip install django-storages[gcs]`.

| Variable                | Purpose                                        | Notes                        |
| :---------------------- | :--------------------------------------------- | ---------------------------- |
| `GCS_PROJECT_ID`        | GCP project that owns the bucket               | Required                     |
| `GCS_BUCKET_NAME`       | Bucket that receives uploaded chunks           | Must exist and be writable   |
| `GCS_CREDENTIALS_PATH`  | Path to a service-account JSON key file        | Leave empty for metadata server |
| `GCS_CUSTOM_DOMAIN`     | Public domain that serves chunk downloads      | Optional, disables signing   |

## Google Drive

Install the GDrive extra: `pip install django-storages[gdrive]`.

| Variable             | Purpose                                    | Notes                          |
| :------------------- | :----------------------------------------- | ------------------------------ |
| `GDRIVE_CLIENT_ID`    | OAuth2 client ID                           | From Google Cloud Console      |
| `GDRIVE_CLIENT_SECRET`| OAuth2 client secret                       | **Sensitive**                  |
| `GDRIVE_REFRESH_TOKEN`| Long-lived refresh token for the app       | **Sensitive** - see below      |
| `GDRIVE_ROOT_ID`      | Drive folder ID that receives chunks       | Optional, defaults to root     |

To obtain a refresh token, run an OAuth2 authorization flow once with a
`drive.file` scope and store the returned `refresh_token` in
`GDRIVE_REFRESH_TOKEN`. django-storages exchanges it for access tokens
automatically.

## Azure Blob Storage

Install the Azure extra: `pip install django-storages[azure]`.

| Variable                  | Purpose                                      | Notes                  |
| :------------------------ | :------------------------------------------- | ---------------------- |
| `AZURE_STORAGE_ACCOUNT`   | Azure storage account name                   | Required               |
| `AZURE_STORAGE_KEY`       | Account access key                           | **Sensitive**          |
| `AZURE_STORAGE_CONTAINER` | Blob container that receives chunks          | Must exist and be writable |

## OpenStack / Swift

Install the OpenStack extra: `pip install django-storages[openstack]`.

| Variable                | Purpose                                      | Notes                  |
| :---------------------- | :------------------------------------------- | ---------------------- |
| `OPENSTACK_CONTAINER`   | Swift container that receives chunks         | Must exist and be writable |

Authentication variables (`OPENSTACK_AUTH_URL`, `OPENSTACK_USER`,
`OPENSTACK_KEY`, `OPENSTACK_TENANT_NAME`, etc.) are read directly from the
environment by django-storages.

## Local filesystem

The zero-config default. Chunks are written to `MEDIA_ROOT` (default:
`<backend>/media`). Suitable for development and single-node deployments where
object storage is not needed.

!!! Note

    The local filesystem backend raises `FileNotFoundError` when listing a
    path that does not exist (S3 returns an empty listing instead). The storage
    service already treats a missing prefix as an empty file, so both backends
    behave identically for deletes and existence checks.

## Switching backends

Switching providers is a purely configuration change. No code edits are needed
as long as the driver implements the storage surface listed above.

```bash
# S3-compatible (RustFS / MinIO / B2 / R2)
export STORAGE_BACKEND=s3
export S3_ENDPOINT_URL="http://rustfs:9000"
export S3_ACCESS_KEY_ID="..."
export S3_SECRET_ACCESS_KEY="..."
export S3_BUCKET_NAME="chithi"
export S3_ADDRESSING_STYLE="path"

# Google Cloud Storage
export STORAGE_BACKEND=gcs
export GCS_PROJECT_ID="my-project"
export GCS_BUCKET_NAME="chithi"
export GCS_CREDENTIALS_PATH="/secrets/gsa.json"

# Google Drive
export STORAGE_BACKEND=gdrive
export GDRIVE_CLIENT_ID="..."
export GDRIVE_CLIENT_SECRET="..."
export GDRIVE_REFRESH_TOKEN="..."
export GDRIVE_ROOT_ID="1AbC..."

# Azure Blob
export STORAGE_BACKEND=azure
export AZURE_STORAGE_ACCOUNT="myaccount"
export AZURE_STORAGE_KEY="..."
export AZURE_STORAGE_CONTAINER="chithi"

# Local filesystem (zero-config default)
export STORAGE_BACKEND=local
```

<small>
    See the [backend environment variables](./environment.md) and the
    [backend architecture](./architecture.md).
</small>
