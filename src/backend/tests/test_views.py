"""HTTP view integration tests — file info + speedtest.

Download is handled by the frontend fetching chunks directly from S3 via
presigned URLs (obtained through the ``chunkUrl`` GraphQL mutation), so
there is no server-side download view. Only the metadata endpoint and
speedtest remain.
"""

import json
import uuid

from apps.files.models import File

from .base import IntegrationTestCase, make_file


class FileInfoViewTests(IntegrationTestCase):
    async def test_info_returns_metadata(self):
        f = await self._q(make_file, filename="meta.bin", number_of_files=4)
        resp = await self.gql.client.get(f"/files/info/{f.id}/")
        self.assertEqual(resp.status_code, 200)
        body = json.loads(resp.content)
        self.assertEqual(body["id"], str(f.id))
        self.assertEqual(body["filename"], "meta.bin")
        self.assertEqual(body["size"], len(b"hello chithi"))
        self.assertEqual(body["chunk_count"], 1)
        self.assertEqual(body["download_count"], 0)
        self.assertEqual(body["number_of_files"], 4)
        self.assertFalse(body["is_expired"])

    async def test_info_missing_404(self):
        resp = await self.gql.client.get(f"/files/info/{uuid.uuid4()}/")
        self.assertEqual(resp.status_code, 404)

    async def test_info_rejects_post(self):
        f = await self._q(make_file)
        resp = await self.gql.client.post(f"/files/info/{f.id}/")
        self.assertEqual(resp.status_code, 405)


class SpeedtestTests(IntegrationTestCase):
    async def test_latency_returns_timestamp(self):
        resp = await self.gql.client.get("/speedtest/latency/")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("timestamp", json.loads(resp.content))

    async def test_download_streams_requested_size(self):
        resp = await self.gql.client.get("/speedtest/download/?bytes=1024")
        self.assertEqual(resp.status_code, 200)
        body = b"".join(chunk for chunk in resp.streaming_content)
        self.assertEqual(len(body), 1024)
        self.assertEqual(resp["Content-Length"], "1024")

    async def test_upload_counts_bytes(self):
        payload = b"x" * 2048
        resp = await self.gql.client.post(
            "/speedtest/upload/",
            data=payload,
            content_type="application/octet-stream",
        )
        self.assertEqual(resp.status_code, 200)
        body = json.loads(resp.content)
        self.assertEqual(body["bytes_received"], 2048)

    async def test_wrong_methods_rejected(self):
        self.assertEqual(
            (await self.gql.client.post("/speedtest/latency/")).status_code, 405
        )
        self.assertEqual(
            (await self.gql.client.get("/speedtest/upload/")).status_code, 405
        )
