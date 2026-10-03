"""Shared integration-test plumbing.

Every async surface in this backend (async views, Strawberry mutations,
Channels consumers) hops threads via ``sync_to_async``, so tests must run on
``TransactionTestCase`` — plain ``TestCase`` wraps each test in a transaction
that other connections (and the thread pool) cannot see.

The GraphQL helper executes real HTTP POSTs through Django's AsyncClient so
the full ASGI stack (middleware → AsyncGraphQLView → resolvers → ORM →
storage → broadcast) is exercised exactly as in production.
"""

import asyncio
import json
import uuid
from datetime import timedelta

from asgiref.sync import async_to_sync
from django.test import AsyncClient, TransactionTestCase
from django.utils import timezone

from apps.config.models import Config
from apps.files.models import File
from apps.users.models import User


def make_user(username="user", password="pw123456789", **extra):
    return User.objects.create_user(username=username, password=password, **extra)


def make_config(**overrides):
    """Create or fetch the singleton Config with optional field overrides."""
    try:
        config = Config.objects.get(pk=1)
    except Config.DoesNotExist:
        config = Config(pk=1)
    for key, value in {
        "total_storage_limit": 10 * 1024 * 1024 * 1024,
        "max_file_size_limit": 100 * 1024 * 1024,
        "default_expiry": 7 * 24 * 3600,
        "default_number_of_downloads": 10,
        "site_description": "test instance",
        "download_configs": [],
        "time_configs": [],
        "allowed_file_types": [],
        "banned_file_types": [],
        "allow_uploads": True,
    }.items():
        setattr(config, key, value)
    for key, value in overrides.items():
        setattr(config, key, value)
    config.save()
    return config


def make_file(
    *,
    filename="hello.txt",
    data=b"hello chithi",
    size=None,
    expires_in=3600,
    expire_after_n_download=10,
    number_of_files=None,
    storage=None,
):
    """Create a File row AND put its bytes into the active storage backend.

    Safe to call from sync or async tests — uses async_to_sync so it works
    even when an event loop is already running on the calling thread.
    If ``size`` is given, the data is padded/truncated to that exact byte
    count and the row's size is set accordingly.
    """
    from apps.files.services import upload_file_data

    if size is not None:
        if len(data) >= size:
            data = data[:size]
        else:
            data = data + b"\x00" * (size - len(data))

    key = str(uuid.uuid4())

    def _do_upload():
        return upload_file_data(key=key, data=data)

    async_to_sync(_do_upload)()
    return File.objects.create(
        key=key,
        filename=filename,
        size=len(data),
        expires_at=timezone.now() + timedelta(seconds=expires_in),
        expire_after_n_download=expire_after_n_download,
        number_of_files=number_of_files,
    )


class GraphQLClient:
    """Async GraphQL-over-HTTP client backed by Django's AsyncClient.

    Drives the real ASGI stack: JWT middleware → CSRF-exempt
    AsyncGraphQLView → Strawberry schema → resolvers → ORM → storage →
    Channels broadcast. Speaks the strawberry-django multipart spec
    (operations + map), identical to what apollo-upload-client emits.
    """

    def __init__(self):
        self.client = AsyncClient()

    def _headers(self, token=None):
        if not token:
            return None
        return {"Authorization": f"Bearer {token}"}

    async def _post(self, path, body, content_type, token=None):
        return await self.client.post(
            path,
            data=body,
            content_type=content_type,
            headers=self._headers(token),
        )

    async def post(self, query, variables=None, token=None, operation_name=None):
        payload = {"query": query}
        if variables is not None:
            payload["variables"] = variables
        if operation_name is not None:
            payload["operationName"] = operation_name
        body = json.dumps(payload).encode()
        resp = await self._post("/graphql/", body, "application/json", token=token)
        return GraphQLResponse(
            resp.status_code, resp.json() if resp.content else None
        )

    async def post_multipart(self, query, variables, files, token=None):
        """files: dict mapping variable path -> filename, bytes.

        Builds a multipart/form-data request per the GraphQL multipart request
        spec (operations + map), exactly as apollo-upload-client does.
        """
        boundary = uuid.uuid4().hex

        operations = {"query": query, "variables": variables}
        file_map = {}
        file_parts = []
        for i, (path, (filename, content)) in enumerate(files.items()):
            file_map[str(i)] = [f"variables.{path}"]
            file_parts.append((f"{i}", filename, content))

        parts = [
            (
                f'Content-Disposition: form-data; name="operations"\r\n\r\n'
                f"{json.dumps(operations)}"
            ).encode(),
            (
                f'Content-Disposition: form-data; name="map"\r\n\r\n'
                f"{json.dumps(file_map)}"
            ).encode(),
        ]
        for field_name, filename, content in file_parts:
            parts.append(
                (
                    f'Content-Disposition: form-data; name="{field_name}"; '
                    f'filename="{filename}"\r\n'
                    f"Content-Type: application/octet-stream\r\n\r\n"
                ).encode()
                + content
                + b"\r\n"
            )

        body = b"".join(
            b"--" + boundary.encode() + b"\r\n" + part + b"\r\n" for part in parts
        ) + b"--" + boundary.encode() + b"--\r\n"

        resp = await self.client.post(
            "/graphql/",
            data=body,
            content_type=f"multipart/form-data; boundary={boundary}",
            headers=self._headers(token),
        )
        return GraphQLResponse(
            resp.status_code, resp.json() if resp.content else None
        )


class GraphQLResponse:
    def __init__(self, status, json_body):
        self.status = status
        self.json = json_body

    @property
    def data(self):
        return (self.json or {}).get("data")

    @property
    def errors(self):
        return (self.json or {}).get("errors")

    def assert_no_errors(self):
        assert self.errors is None, f"GraphQL errors: {self.errors}"
        return self.data


class IntegrationTestCase(TransactionTestCase):
    """TransactionTestCase + shared GraphQL client + clean state helpers."""

    serialized_rollback = False

    def setUp(self):
        super().setUp()
        self.gql = GraphQLClient()
        File.objects.all().delete()
        User.objects.all().delete()
        Config.objects.all().delete()
        make_config()

    @staticmethod
    async def _q(callable_, *args, **kwargs):
        """Run a sync or async callable from an async test, off the loop."""
        import asyncio as _asyncio
        import inspect

        from asgiref.sync import sync_to_async

        if inspect.iscoroutinefunction(callable_):
            # Run the coroutine in a fresh event loop inside a worker thread
            # so it doesn't fight the request's running loop.
            def _runner():
                return _asyncio.run(callable_(*args, **kwargs))

            return await sync_to_async(_runner)()
        return await sync_to_async(callable_)(*args, **kwargs)
