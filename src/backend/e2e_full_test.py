"""End-to-end test against the full stack: Postgres + Redis + RustFS + Celery.

Steps:
1. POST /api/upload/register/  -> creates a Postgres row, returns key
2. POST /api/upload/chunk/     -> uploads bytes to RustFS
3. POST /api/upload/complete/  -> verifies chunk exists in RustFS
4. GET  /api/files/{key}/info/ -> metadata from Postgres
5. GET  /api/files/{key}/chunk/0/bytes/ -> streams bytes back from RustFS
6. Verify downloaded bytes match uploaded bytes
7. Run Celery task delete_file_after_expiry (eager)
8. Verify file is gone from both Postgres and RustFS
"""

import os
import sys

# Django must be set up before any model imports so that default_storage
# resolves to S3Storage.  Set env vars first, then bootstrap once.
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
os.environ["DATABASE_URL"] = "postgres://postgres:supersecretpassword@localhost:5433/chithi"
os.environ["STORAGE_BACKEND"] = "rustfs"
os.environ["S3_ENDPOINT_URL"] = "http://localhost:9000"
os.environ["S3_ACCESS_KEY_ID"] = "rustfsadmin"
os.environ["S3_SECRET_ACCESS_KEY"] = "rustfsadmin"
os.environ["S3_BUCKET_NAME"] = "chithi"
os.environ["S3_REGION_NAME"] = "us-east-1"
os.environ["S3_ADDRESSING_STYLE"] = "path"

import django

django.setup()

import boto3
import requests
from botocore.client import Config
from botocore.exceptions import ClientError

from apps.files.models import File
from apps.files.tasks import delete_file_after_expiry

BASE = "http://localhost:8002"
PAYLOAD = os.urandom(256 * 1024 + 12345)  # 256 KiB + 12345 bytes
S3_CONFIG = Config(signature_version="s3v4")
S3 = boto3.client(
    "s3",
    endpoint_url="http://localhost:9000",
    aws_access_key_id="rustfsadmin",
    aws_secret_access_key="rustfsadmin",
    region_name="us-east-1",
    config=S3_CONFIG,
)
PASS = 0
FAIL = 0


def check(name: str, ok: bool, detail: str = ""):
    global PASS, FAIL
    status = "PASS" if ok else "FAIL"
    if ok:
        PASS += 1
    else:
        FAIL += 1
    print(f"  [{status}] {name}" + (f" -- {detail}" if detail and not ok else ""))
    return ok


def main():
    print("=" * 60)
    print("E2E TEST: Postgres + Redis + RustFS + Celery")
    print("=" * 60)

    # -- Step 1: Register ---------------------------------------------------
    print("\n1. Register file (POST /api/upload/register/)")
    resp = requests.post(
        f"{BASE}/api/upload/register/",
        json={
            "filename": "e2e-probe.bin",
            "total_size": len(PAYLOAD),
            "chunk_count": 1,
            "expires_at": 3600,
            "expire_after_n_download": 5,
        },
        timeout=10,
    )
    check("register returns 200", resp.status_code == 200, f"got {resp.status_code}: {resp.text[:200]}")
    if resp.status_code != 200:
        sys.exit(1)
    reg = resp.json()
    file_key = reg["key"]
    print(f"  file_key={file_key} chunk_count={reg['chunk_count']}")

    # -- Step 2: Upload chunk -----------------------------------------------
    print("\n2. Upload chunk (POST /api/upload/chunk/)")
    resp = requests.post(
        f"{BASE}/api/upload/chunk/",
        data={"file_key": file_key, "chunk_index": "0"},
        files={"chunk": ("probe.bin", PAYLOAD, "application/octet-stream")},
        timeout=30,
    )
    check("chunk upload returns 200", resp.status_code == 200, f"got {resp.status_code}: {resp.text[:200]}")
    if resp.status_code == 200:
        chunk = resp.json()
        check("chunk bytes match", chunk.get("bytes") == len(PAYLOAD), f"expected {len(PAYLOAD)}, got {chunk.get('bytes')}")

    # -- Step 3: Complete upload --------------------------------------------
    print("\n3. Complete upload (POST /api/upload/complete/)")
    resp = requests.post(
        f"{BASE}/api/upload/complete/",
        data={"file_key": file_key},
        timeout=10,
    )
    check("complete returns 200", resp.status_code == 200, f"got {resp.status_code}: {resp.text[:200]}")

    # -- Step 4: Verify in RustFS -------------------------------------------
    print("\n4. Verify chunk in RustFS (S3 SDK)")
    try:
        obj = S3.get_object(Bucket="chithi", Key=f"{file_key}/chunk-0")
        stored = obj["Body"].read()
        check("RustFS has the chunk", True)
        check("RustFS bytes match payload", stored == PAYLOAD, f"stored {len(stored)} vs uploaded {len(PAYLOAD)}")
    except ClientError as e:
        check("RustFS has the chunk", False, str(e))

    # -- Step 5: Download back via backend ----------------------------------
    print("\n5. Download via backend proxy (GET /api/files/{key}/chunk/0/bytes/)")
    resp = requests.get(f"{BASE}/api/files/{file_key}/chunk/0/bytes/", timeout=30)
    check("download returns 200", resp.status_code == 200, f"got {resp.status_code}")
    if resp.status_code == 200:
        check("downloaded bytes match", resp.content == PAYLOAD, f"got {len(resp.content)} bytes")

    # -- Step 6: File info ---------------------------------------------------
    print("\n6. File info (GET /api/files/{key}/info/)")
    resp = requests.get(f"{BASE}/api/files/{file_key}/info/", timeout=10)
    check("info returns 200", resp.status_code == 200, f"got {resp.status_code}")
    if resp.status_code == 200:
        info = resp.json()
        check("info filename correct", info.get("filename") == "e2e-probe.bin", f"got {info.get('filename')}")
        check("info size correct", info.get("size") == len(PAYLOAD), f"got {info.get('size')}")

    # -- Step 7: Celery expiry task ------------------------------------------
    print("\n7. Celery task: delete_file_after_expiry (eager)")
    before_db = File.objects.filter(key=file_key).exists()
    print(f"  file in Postgres before: {before_db}")

    result = delete_file_after_expiry.apply(args=[file_key])
    check("task state is SUCCESS", result.state == "SUCCESS", f"state={result.state} result={result.result}")

    after_db = File.objects.filter(key=file_key).exists()
    check("file removed from Postgres", not after_db)

    try:
        S3.head_object(Bucket="chithi", Key=f"{file_key}/chunk-0")
        in_s3 = True
    except ClientError:
        in_s3 = False
    check("file removed from RustFS", not in_s3)

    # -- Summary -------------------------------------------------------------
    print("\n" + "=" * 60)
    print(f"E2E RESULT: {PASS} passed, {FAIL} failed")
    print("=" * 60)
    if FAIL:
        sys.exit(1)


if __name__ == "__main__":
    main()
