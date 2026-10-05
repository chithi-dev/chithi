---
icon: lucide/database
---

# Storage backends

Chithi stores uploaded file chunks through Django's pluggable storage layer.
The active backend is selected by a single `STORAGES` setting, so you can
point the backend at any S3-compatible object store, a local disk, or a custom
driver without touching the application code.

## How the backend is chosen

The default backend is decided at boot in `core/settings.py` from the S3
credentials present in the environment:

- **S3** is used when `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and
  `S3_BUCKET_NAME` are all set. The driver is
  `storages.backends.s3.S3Storage`.
- **Local filesystem** is used otherwise. The driver is
  `django.core.files.storage.FileSystemStorage`, rooted at `MEDIA_ROOT`, so the
  app runs with zero configuration in development.

Both backends expose the same small surface that the storage service relies on:
`save`, `url`, `exists`, `listdir`, and `delete`.

## Configuration variables

| Variable               | Purpose                                                            | Notes                                |
| :--------------------- | :----------------------------------------------------------------- | ------------------------------------- |
| `S3_ENDPOINT_URL`      | S3-compatible endpoint the backend writes to (B2, R2, RUSTFS, ...) | Include scheme and port if needed     |
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

## Supporting multiple backends

Because the backend is a Django `STORAGES` entry, switching providers is a
purely configuration change:

```toml
# RustFS / MinIO
S3_ENDPOINT_URL = "http://rustfs:9000"
S3_ADDRESSING_STYLE = "path"
```

```toml
# Backblaze B2 (S3-compatible API + CDN domain)
S3_ENDPOINT_URL = "https://s3.us-west-004.backblazeb2.com"
S3_CDN_URL = "https://f004.backblazeb2.com"
```

To target a provider that is not S3, drop in a custom storage class and point
the `STORAGES["default"]` entry at it:

```python
# core/settings.py
STORAGES = {
    "default": {
        "BACKEND": "myproject.storage.GCSStorage",  # your custom driver
        "OPTIONS": { ... },
    },
}
```

As long as the driver implements `save`, `url`, `exists`, `listdir`, and
`delete`, the rest of Chithi is unaffected.

!!! Note

    The local filesystem backend raises `FileNotFoundError` when listing a
    path that does not exist (S3 returns an empty listing instead). The storage
    service already treats a missing prefix as an empty file, so both backends
    behave identically for deletes and existence checks.

<small>
    See the [backend environment variables](./environment.md) and the
    [backend architecture](./architecture.md).
</small>
