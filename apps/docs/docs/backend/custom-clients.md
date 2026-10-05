---
icon: lucide/plug
---

# Building a custom client

Chithi exposes a small, stateless HTTP contract for uploading and downloading
encrypted files. Any language can implement it: the CLI is one reference
implementation. This page describes the wire protocol so you can build your own
client (a TUI, a mobile app, a bot, a build pipeline, ...).

There are two transports that do the same job:

- **django-ninja REST** (`/api/...`) - simple request/response endpoints.
- **Strawberry GraphQL** (`/graphql/`) - the same operations as GraphQL
  queries and mutations.

Both write to and read from the same storage backend, so pick whichever is more
convenient for your stack.

## Core concepts

- **Client-side encryption.** The backend never sees plaintext. Your client
  encrypts each file, splits the ciphertext into **50 MB chunks**, and uploads
  those chunks. The backend only stores and streams opaque byte sequences.
- **Chunked, resumable upload.** Upload is a three-step protocol
  (register -> chunk xN -> complete) so a large transfer survives partial
  failures: you can retry only the missing chunks.
- **Time and count based expiry.** Each file carries an `expires_at` deadline
  and an optional `expire_after_n_download` limit. Either one triggers eviction.
- **Download by key.** Files are addressed by a `key` (a UUID) that is returned
  at registration time. Downloads fetch chunk URLs and stream the bytes.

## Upload protocol (REST)

### 1. Register

`POST /api/upload/register/` with a JSON body. Creates the file record and
returns its `key` and the server's chunk size.

```json
{
    "filename": "report.pdf",
    "total_size": 123456789,
    "chunk_count": 3,
    "expires_at": 86400,
    "expire_after_n_download": 5,
    "number_of_files": 1
}
```

Response:

```json
{ "id": "…", "key": "6f1e…", "chunk_count": 3, "chunk_size": 52428800 }
```

`chunk_count` is computed by you as `ceil(total_size / chunk_size)`. Use the
`chunk_size` the server returns rather than hard-coding 50 MB.

### 2. Upload each chunk

`POST /api/upload/chunk/` as `multipart/form-data`. Repeat once per chunk,
with `chunk_index` from `0` to `chunk_count - 1`.

Fields:

| Field         | Type   | Description                       |
| :------------ | :----- | :-------------------------------- |
| `file_key`    | string | The `key` from the register step  |
| `chunk_index` | int    | Zero-based chunk position         |
| `chunk`       | file   | The raw chunk bytes (the file)    |

Response:

```json
{ "ok": true, "chunk_index": 0, "bytes": 52428800 }
```

Chunk order does not matter; the backend keys chunks by index. Retry any chunk
that fails until it returns `ok: true`.

### 3. Complete

`POST /api/upload/complete/` as `multipart/form-data` (or form-encoded) with
`file_key`. The server verifies all `chunk_count` chunks are present and returns
the file identity.

```json
{ "ok": true, "id": "…", "key": "6f1e…" }
```

The share link is built from this `key`.

## Download protocol (REST)

1. `GET /api/files/{file_key}/info/` - metadata: `filename`, `size`,
   `chunk_count`, `expires_at`, `expire_after_n_download`, `is_expired`.
2. `GET /api/files/{file_key}/chunk/{chunk_index}/` - a single
   `{"url": "…"}` to stream one chunk. Loop `chunk_index` from `0` to
   `chunk_count - 1`, fetch each URL, and concatenate in order.

!!! Note

    The chunk URL may be a signed S3 URL or a CDN URL depending on the backend
    configuration. Treat it as an opaque, time-limited URL and fetch it as-is.

## Authentication

Upload and download endpoints are public by default. If the instance requires
authentication, obtain an access token (via the `login`/`register` GraphQL
mutations or a credential flow) and send it on every request:

```http
Authorization: Bearer <access-token>
```

The backend resolves the user from this header for both transports, so a token
works identically against REST and GraphQL.

## Minimal example (Python, REST)

```python
import math
import httpx

CHUNK_SIZE = 50 * 1024 * 1024
BASE = "https://your.instance"


def upload(path: str, expires_at: int = 86400) -> str:
    data = open(path, "rb").read()
    total_size = len(data)
    chunk_count = math.ceil(total_size / CHUNK_SIZE)

    # 1. Register
    reg = httpx.post(f"{BASE}/api/upload/register/", json={
        "filename": path,
        "total_size": total_size,
        "chunk_count": chunk_count,
        "expires_at": expires_at,
        "expire_after_n_download": 0,
    }).json()
    key, chunk_size = reg["key"], reg["chunk_size"]

    # 2. Upload chunks (independent, so parallelize if you like)
    for index in range(math.ceil(total_size / chunk_size)):
        chunk = data[index * chunk_size : (index + 1) * chunk_size]
        httpx.post(f"{BASE}/api/upload/chunk/", data={
            "file_key": key,
            "chunk_index": index,
        }, files={"chunk": (path, chunk, "application/octet-stream")})

    # 3. Complete
    httpx.post(f"{BASE}/api/upload/complete/", data={"file_key": key})
    return key
```

## Hosting the backend in Docker

A custom client talks to a running chithi backend, so here is a minimal
`docker-compose.yml` to host one. The backend is configurable along two axes,
and the compose file adapts to each combination:

| Axis       | Option A                          | Option B                              |
| :--------- | :-------------------------------- | :------------------------------------- |
| Storage    | S3-compatible (RustFS / B2 / R2)  | Local filesystem (no S3)               |
| Database   | PostgreSQL                        | SQLite (built in, zero config)         |

The backend auto-detects both: if `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` /
`S3_BUCKET_NAME` are present it uses `S3Storage`, otherwise it falls back to
`FileSystemStorage`. Likewise, if `DATABASE_URL` is set it uses that database,
otherwise it defaults to a local `db.sqlite3` file.

### Full stack (Postgres + S3/RustFS)

The production layout: Postgres for metadata, RustFS (or B2 / R2) for chunks.

```yaml
services:
  backend:
    image: ghcr.io/chithi-dev/chithi-backend:latest
    container_name: backend
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://postgres:supersecretpassword@postgres:5432/chithi
      S3_ENDPOINT_URL: http://rustfs:9000
      S3_ACCESS_KEY_ID: rustfsadmin
      S3_SECRET_ACCESS_KEY: rustfsadmin
      S3_BUCKET_NAME: chithi
      S3_ADDRESSING_STYLE: path
      # Optional: serve downloads via a CDN domain instead of signed URLs
      # S3_CDN_URL: https://cdn.yourdomain.com
    depends_on:
      postgres:
        condition: service_healthy
      rustfs:
        condition: service_healthy
    ports:
      - "8000:8000"

  postgres:
    image: postgres:18
    container_name: postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: supersecretpassword
      POSTGRES_DB: chithi
    volumes:
      - postgres_data:/var/lib/postgresql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  rustfs:
    image: rustfs/rustfs:1.0.0-alpha.85
    container_name: rustfs
    restart: unless-stopped
    volumes:
      - rustfs_data:/data
    environment:
      RUSTFS_ADDRESS: "0.0.0.0:9000"
      RUSTFS_ACCESS_KEY: rustfsadmin
      RUSTFS_SECRET_KEY: rustfsadmin
    healthcheck:
      test: ["CMD", "sh", "-c", "curl -f http://localhost:9000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  postgres_data:
  rustfs_data:
```

### Minimal (SQLite + local filesystem)

The zero-external-dependency layout: no Postgres, no S3. Everything lives in
two bind-mounted volumes. Great for a single-node self-host.

```yaml
services:
  backend:
    image: ghcr.io/chithi-dev/chithi-backend:latest
    container_name: backend
    restart: unless-stopped
    # No DATABASE_URL -> uses /app/db.sqlite3 (SQLite)
    # No S3_* vars    -> uses FileSystemStorage under /app/media
    volumes:
      - db_data:/app          # SQLite file
      - media_data:/app/media  # uploaded chunks
    ports:
      - "8000:8000"

volumes:
  db_data:
  media_data:
```

!!! Tip

    The two axes are independent, so you can mix them. For example, Postgres
    with local-filesystem storage (drop the `rustfs` service and the `S3_*`
    vars), or SQLite with S3 (drop the `postgres` service and `DATABASE_URL`).

<small>
    For reverse-proxy setups (Caddy, NGINX, Traefik) with the full frontend, see
    the [deployment guides](../deployments/docker/basic/caddy.md).
</small>

## GraphQL equivalent

The same operations exist as GraphQL, mirroring the REST endpoints:

```graphql
# 1. Register (returns the file record, including its key and chunkCount)
mutation RegisterFile {
    registerFile(
        filename: "report.pdf"
        totalSize: 123456789
        chunkCount: 3
        expiresAt: 86400
        expireAfterNDownload: 5
    ) { key chunkCount size }
}

# 2. Upload one chunk (multipart: file_key, chunk_index, chunk, is_last)
mutation UploadChunk {
    uploadFileChunk(
        fileKey: "6f1e…"
        chunkIndex: 0
        chunk: $chunk
        isLast: false
    )
}

# 3. Complete (verifies all chunks are present)
mutation CompleteUpload {
    completeUpload(fileId: "…")
}
```

`chunkUrl(fileId, chunkIndex)` returns a URL to stream a single chunk, and
`deleteFile(fileId)` removes a file and its chunks.

Use the `me` query to confirm a token is valid:

```graphql
{ me { username } }
```

<small>
    See the [storage backends](./storage.md) page for how chunks are stored, and
    the [cryptography architecture](../crypto-architecture.md) page for the
    encryption scheme your client must implement before uploading.
</small>
