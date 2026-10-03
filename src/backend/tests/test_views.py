"""HTTP view integration tests — file download/info, speedtest, reverse-share.

All requests go through Django's AsyncClient and the real ASGI stack, so
streaming behavior, content-disposition headers, 404/410 semantics, and
host-token auth are exercised exactly as a client would see them.
"""

import json
import uuid

from apps.files.models import File
from apps.files.reverse_models import Room, RoomFile, RoomHost

from .base import IntegrationTestCase, make_file


class DownloadViewTests(IntegrationTestCase):
    async def test_download_streams_full_content(self):
        payload = bytes(range(256)) * 4096  # 1 MiB, spans multiple chunks
        f = await self._q(make_file, filename="big.enc", data=payload)
        resp = await self.gql.client.get(f"/files/{f.id}/")
        self.assertEqual(resp.status_code, 200)
        body = b"".join([chunk async for chunk in resp.streaming_content])
        self.assertEqual(body, payload)
        self.assertEqual(resp["Content-Length"], str(len(payload)))
        self.assertIn("attachment", resp["Content-Disposition"])
        self.assertIn("big.enc", resp["Content-Disposition"])

    async def test_download_unknown_id_404(self):
        resp = await self.gql.client.get(f"/files/{uuid.uuid4()}/")
        self.assertEqual(resp.status_code, 404)

    async def test_download_expired_returns_410(self):
        f = await self._q(make_file, expires_in=-1)
        resp = await self.gql.client.get(f"/files/{f.id}/")
        self.assertEqual(resp.status_code, 410)

    async def test_download_limit_reached_returns_410(self):
        f = await self._q(make_file, expire_after_n_download=2)
        await self._q(File.objects.filter(id=f.id).update, download_count=2)
        resp = await self.gql.client.get(f"/files/{f.id}/")
        self.assertEqual(resp.status_code, 410)

    async def test_each_successful_download_increments_count(self):
        f = await self._q(make_file, expire_after_n_download=3)
        for expected in (1, 2):
            resp = await self.gql.client.get(f"/files/{f.id}/")
            self.assertEqual(resp.status_code, 200)
            b"".join([chunk async for chunk in resp.streaming_content])
            f = await self._q(File.objects.get, id=f.id)
            self.assertEqual(f.download_count, expected)

    async def test_download_stops_at_limit(self):
        f = await self._q(make_file, expire_after_n_download=1)
        first = await self.gql.client.get(f"/files/{f.id}/")
        self.assertEqual(first.status_code, 200)
        b"".join([chunk async for chunk in first.streaming_content])
        second = await self.gql.client.get(f"/files/{f.id}/")
        self.assertEqual(second.status_code, 410)

    async def test_post_not_allowed(self):
        f = await self._q(make_file)
        resp = await self.gql.client.post(f"/files/{f.id}/")
        self.assertEqual(resp.status_code, 405)


class FileInfoViewTests(IntegrationTestCase):
    async def test_info_returns_metadata(self):
        f = await self._q(make_file, filename="meta.bin", number_of_files=4)
        resp = await self.gql.client.get(f"/files/info/{f.id}/")
        self.assertEqual(resp.status_code, 200)
        body = json.loads(resp.content)
        self.assertEqual(body["id"], str(f.id))
        self.assertEqual(body["filename"], "meta.bin")
        self.assertEqual(body["size"], len(b"hello chithi"))
        self.assertEqual(body["download_count"], 0)
        self.assertEqual(body["number_of_files"], 4)
        self.assertFalse(body["is_expired"])

    async def test_info_missing_404(self):
        resp = await self.gql.client.get(f"/files/info/{uuid.uuid4()}/")
        self.assertEqual(resp.status_code, 404)


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


class ReverseShareApiTests(IntegrationTestCase):
    async def _create_room(self, **body):
        payload = dict(name="test room", expire_after=3600)
        payload.update(body)
        resp = await self.gql.client.post(
            "/reverse/rooms/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        return resp, json.loads(resp.content)

    async def test_create_room_returns_id_and_host_token(self):
        resp, out = await self._create_room(name="my room")
        self.assertEqual(resp.status_code, 200)
        room = await self._q(Room.objects.get, id=out["id"])
        self.assertEqual(room.name, "my room")
        self.assertTrue(room.host_token)
        self.assertEqual(out["host_token"], room.host_token)

    async def test_create_room_invalid_json_400(self):
        resp = await self.gql.client.post(
            "/reverse/rooms/", data=b"{broken", content_type="application/json"
        )
        self.assertEqual(resp.status_code, 400)

    async def test_create_room_get_not_allowed(self):
        resp = await self.gql.client.get("/reverse/rooms/")
        self.assertEqual(resp.status_code, 405)

    async def test_room_detail_with_files_and_host_count(self):
        _, created = await self._create_room()
        room = await self._q(Room.objects.get, id=created["id"])
        await self._q(
            RoomFile.objects.create,
            room=room, key=f"reverse/{room.id}/a.bin",
            filename="a.bin", size=5,
        )
        await self._q(RoomHost.objects.create, room=room, host_token="tok1")
        resp = await self.gql.client.get(f"/reverse/rooms/{room.id}/")
        body = json.loads(resp.content)
        self.assertEqual(body["name"], "test room")
        self.assertEqual(body["host_count"], 1)
        self.assertEqual(len(body["files"]), 1)
        self.assertEqual(body["files"][0]["filename"], "a.bin")
        self.assertEqual(
            body["files"][0]["download_url"],
            f"/files/reverse/{room.id}/a.bin",
        )

    async def test_room_detail_404_and_expired_410(self):
        self.assertEqual(
            (await self.gql.client.get(f"/reverse/rooms/{uuid.uuid4()}/")).status_code,
            404,
        )
        _, created = await self._create_room(expire_after=-5)
        room = await self._q(Room.objects.get, id=created["id"])
        self.assertEqual(
            (await self.gql.client.get(f"/reverse/rooms/{room.id}/")).status_code,
            410,
        )

    async def test_room_upload_requires_host_token(self):
        _, created = await self._create_room()
        room = await self._q(Room.objects.get, id=created["id"])
        no_token = await self.gql.client.post(
            f"/reverse/rooms/{room.id}/upload/", data={"file": b"data"}
        )
        self.assertEqual(no_token.status_code, 403)

    async def test_room_upload_roundtrip_via_primary_host_token(self):
        from django.core.files.uploadedfile import SimpleUploadedFile

        _, created = await self._create_room()
        room = await self._q(Room.objects.get, id=created["id"])
        uploaded = SimpleUploadedFile("room.bin", b"room-bytes")
        resp = await self.gql.client.post(
            f"/reverse/rooms/{room.id}/upload/",
            data={"file": uploaded},
            headers={"X-Host-Token": room.host_token},
        )
        self.assertEqual(resp.status_code, 200)
        body = json.loads(resp.content)
        rf = await self._q(RoomFile.objects.get, key=body["key"])
        self.assertEqual(rf.room_id, room.id)
        self.assertEqual(rf.size, 10)

    async def test_room_upload_via_delegated_host_token(self):
        from django.core.files.uploadedfile import SimpleUploadedFile

        _, created = await self._create_room()
        room = await self._q(Room.objects.get, id=created["id"])
        delegated = await self.gql.client.post(
            f"/reverse/rooms/{room.id}/hosts/",
            headers={"X-Host-Token": room.host_token},
        )
        new_token = json.loads(delegated.content)["host_token"]

        upload = await self.gql.client.post(
            f"/reverse/rooms/{room.id}/upload/",
            data={"file": SimpleUploadedFile("zz.bin", b"zz")},
            headers={"X-Host-Token": new_token},
        )
        self.assertEqual(upload.status_code, 200)

    async def test_add_host_requires_existing_host(self):
        _, created = await self._create_room()
        room = await self._q(Room.objects.get, id=created["id"])
        denied = await self.gql.client.post(
            f"/reverse/rooms/{room.id}/hosts/",
            headers={"X-Host-Token": "wrong-token"},
        )
        self.assertEqual(denied.status_code, 403)
        self.assertEqual(await self._q(RoomHost.objects.count), 0)

    async def test_expired_room_rejects_everything(self):
        _, created = await self._create_room(expire_after=-5)
        room = await self._q(Room.objects.get, id=created["id"])
        token = room.host_token
        upload = await self.gql.client.post(
            f"/reverse/rooms/{room.id}/upload/",
            data={"file": b"d"},
            headers={"X-Host-Token": token},
        )
        self.assertEqual(upload.status_code, 410)
        hosts = await self.gql.client.post(
            f"/reverse/rooms/{room.id}/hosts/",
            headers={"X-Host-Token": token},
        )
        self.assertEqual(hosts.status_code, 410)

    async def test_room_upload_missing_file_400(self):
        _, created = await self._create_room()
        room = await self._q(Room.objects.get, id=created["id"])
        resp = await self.gql.client.post(
            f"/reverse/rooms/{room.id}/upload/",
            data={},
            headers={"X-Host-Token": room.host_token},
        )
        self.assertEqual(resp.status_code, 400)
