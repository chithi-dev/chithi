"""End-to-end GraphQL integration tests.

Executes real HTTP requests against /graphql/ through the full ASGI stack:
JWT middleware → CSRF-exempt AsyncGraphQLView → Strawberry schema → resolvers
→ Django ORM → storage backend → Channels broadcast.
"""

import asyncio
from datetime import timedelta
from uuid import uuid4

from django.utils import timezone

from apps.config.models import Config
from apps.files.models import File
from apps.files.services import file_chunks_exist
from apps.graphql.auth import get_jwt_tokens
from apps.users.models import User

from .base import IntegrationTestCase, make_config, make_file, make_user

CONFIG_FIELDS = """
    totalStorageLimit maxFileSizeLimit defaultExpiry defaultNumberOfDownloads
    siteDescription allowUploads downloadConfigs timeConfigs
    allowedFileTypes bannedFileTypes
"""


class SchemaIntrospectionTests(IntegrationTestCase):
    async def test_schema_introspects(self):
        resp = await self.gql.post(
            "{ __schema { queryType { name } mutationType { name } } }"
        )
        data = resp.assert_no_errors()
        self.assertEqual(data["__schema"]["queryType"]["name"], "Query")
        self.assertEqual(data["__schema"]["mutationType"]["name"], "Mutation")

    async def test_auto_camel_case_active(self):
        resp = await self.gql.post(f"{{ config {{ {CONFIG_FIELDS} }} }}")
        self.assertIsNone(resp.errors)


class ConfigQueryTests(IntegrationTestCase):
    async def test_config_returns_values(self):
        await self._q(make_config, site_description="my instance")
        resp = await self.gql.post(f"{{ config {{ {CONFIG_FIELDS} }} }}")
        data = resp.assert_no_errors()["config"]
        self.assertEqual(data["siteDescription"], "my instance")
        self.assertTrue(data["allowUploads"])
        self.assertEqual(data["defaultNumberOfDownloads"], 10)

    async def test_config_creates_row_if_missing(self):
        await self._q(Config.objects.all().delete)
        resp = await self.gql.post("{ config { totalStorageLimit } }")
        data = resp.assert_no_errors()
        self.assertIsNotNone(data["config"])
        self.assertEqual(await self._q(Config.objects.count), 1)


class OnboardingQueryTests(IntegrationTestCase):
    async def test_not_onboarded_when_no_users(self):
        await self._q(User.objects.all().delete)
        resp = await self.gql.post("{ onboarding { isConfigured hasUsers } }")
        data = resp.assert_no_errors()["onboarding"]
        self.assertFalse(data["hasUsers"])

    async def test_onboarded_when_users_exist(self):
        await self._q(make_user)
        resp = await self.gql.post("{ onboarding { isConfigured hasUsers } }")
        data = resp.assert_no_errors()["onboarding"]
        self.assertTrue(data["hasUsers"])


class InstanceQueryTests(IntegrationTestCase):
    async def test_instance_information_shape(self):
        resp = await self.gql.post(
            "{ instanceInformation { backendVersion pythonVersion platform } }"
        )
        data = resp.assert_no_errors()["instanceInformation"]
        self.assertEqual(data["backendVersion"], "0.1.0")
        self.assertTrue(data["pythonVersion"])
        self.assertTrue(data["platform"])

    async def test_instance_statistics_aggregates(self):
        await self._q(make_file, size=100)
        await self._q(make_file, size=250)
        await self._q(
            File.objects.create,
            key="expired",
            filename="old.bin",
            size=50,
            expires_at=timezone.now() - timedelta(hours=1),
            expire_after_n_download=5,
        )
        await self._q(make_user)
        resp = await self.gql.post(
            """
            {
                instanceStatistics {
                    totalFiles activeFiles expiredFiles totalStorageUsed totalUsers
                }
            }
            """
        )
        stats = resp.assert_no_errors()["instanceStatistics"]
        self.assertEqual(stats["totalFiles"], 3)
        self.assertEqual(stats["activeFiles"], 2)
        self.assertEqual(stats["expiredFiles"], 1)
        self.assertEqual(stats["totalStorageUsed"], 400)
        self.assertEqual(stats["totalUsers"], 1)


class AuthMutationTests(IntegrationTestCase):
    async def test_login_success_returns_tokens(self):
        await self._q(make_user, username="neo", password="red-pill-123")
        resp = await self.gql.post(
            'mutation { login(username: "neo", password: "red-pill-123") '
            "{ access refresh } }"
        )
        tokens = resp.assert_no_errors()["login"]
        self.assertTrue(tokens["access"])
        self.assertTrue(tokens["refresh"])

    async def test_login_bad_password_raises_graphql_error(self):
        await self._q(make_user, username="trinity", password="correct-horse")
        resp = await self.gql.post(
            'mutation { login(username: "trinity", password: "wrong") '
            "{ access refresh } }"
        )
        self.assertIsNotNone(resp.errors)

    async def test_login_unknown_user_raises(self):
        resp = await self.gql.post(
            'mutation { login(username: "ghost", password: "x") { access refresh } }'
        )
        self.assertIsNotNone(resp.errors)

    async def test_logout_returns_true(self):
        resp = await self.gql.post("mutation { logout }")
        data = resp.assert_no_errors()
        self.assertTrue(data["logout"])

    async def test_complete_onboarding_creates_admin_and_config(self):
        resp = await self.gql.post(
            """
            mutation {
                completeOnboarding(
                    username: "founder"
                    email: "founder@example.com"
                    password: "first-pw-123"
                    siteDescription: "fresh box"
                ) { access refresh onboarded }
            }
            """
        )
        out = resp.assert_no_errors()["completeOnboarding"]
        self.assertTrue(out["onboarded"])
        user = await self._q(User.objects.get, username="founder")
        self.assertTrue(user.is_staff)
        config = await self._q(Config.objects.get, pk=1)
        self.assertEqual(config.site_description, "fresh box")
        self.assertEqual(config.max_file_size_limit, 1073741824)
        self.assertEqual(config.default_expiry, 86400)

    async def test_complete_onboarding_tokens_authenticate(self):
        resp = await self.gql.post(
            """
            mutation {
                completeOnboarding(
                    username: "boot"
                    email: "b@x.com"
                    password: "pw-abc-123"
                    siteDescription: "d"
                ) { access }
            }
            """
        )
        access = resp.assert_no_errors()["completeOnboarding"]["access"]
        me = await self.gql.post("{ me { username } }", token=access)
        self.assertEqual(me.assert_no_errors()["me"]["username"], "boot")


class JwtMiddlewareTests(IntegrationTestCase):
    QUERY = "{ me { id username } }"

    async def test_no_token_gives_anonymous_me_null(self):
        await self._q(make_user, username="whoami")
        resp = await self.gql.post(self.QUERY)
        data = resp.assert_no_errors()
        self.assertIsNone(data["me"])

    async def test_valid_token_resolves_me(self):
        user = await self._q(make_user, username="tokened")
        access, _ = get_jwt_tokens(user)
        resp = await self.gql.post(self.QUERY, token=access)
        data = resp.assert_no_errors()
        self.assertEqual(data["me"]["username"], "tokened")

    async def test_invalid_token_behaves_like_anonymous(self):
        resp = await self.gql.post(self.QUERY, token="garbage.token.here")
        data = resp.assert_no_errors()
        self.assertIsNone(data["me"])

    async def test_middleware_ignores_non_graphql_paths(self):
        f = await self._q(make_file)
        resp = await self.gql.client.get(f"/api/files/{f.id}/info/")
        self.assertEqual(resp.status_code, 200)


class UserMutationTests(IntegrationTestCase):
    async def test_create_user_and_login_roundtrip(self):
        resp = await self.gql.post(
            'mutation { createUser(username: "made", password: "pw-123456") '
            "{ id username } }"
        )
        created = resp.assert_no_errors()["createUser"]
        self.assertIsNotNone(created["id"])
        login = await self.gql.post(
            'mutation { login(username: "made", password: "pw-123456") { access } }'
        )
        self.assertTrue(login.assert_no_errors()["login"]["access"])

    async def test_update_user_fields(self):
        u = await self._q(make_user, username="before")
        resp = await self.gql.post(
            f"""
            mutation {{
                updateUser(userId: "{u.id}", username: "after", isStaff: true) {{
                    id username
                }}
            }}
            """
        )
        data = resp.assert_no_errors()["updateUser"]
        self.assertEqual(data["username"], "after")
        await self._q(u.refresh_from_db)
        self.assertTrue(u.is_staff)

    async def test_delete_user_true_then_false(self):
        u = await self._q(make_user, username="goner")
        ok = await self.gql.post(f'mutation {{ deleteUser(userId: "{u.id}") }}')
        self.assertTrue(ok.assert_no_errors()["deleteUser"])
        again = await self.gql.post(f'mutation {{ deleteUser(userId: "{u.id}") }}')
        self.assertFalse(again.assert_no_errors()["deleteUser"])

    async def test_users_query_lists_all(self):
        await self._q(make_user, username="a")
        await self._q(make_user, username="b")
        resp = await self.gql.post("{ users { username } }")
        names = {u["username"] for u in resp.assert_no_errors()["users"]}
        self.assertEqual(names, {"a", "b"})


class ConfigMutationTests(IntegrationTestCase):
    async def test_update_single_field_only(self):
        before = (await self._q(Config.objects.get, pk=1)).total_storage_limit
        resp = await self.gql.post(
            "mutation { updateConfig(allowUploads: false) "
            f"{{ {CONFIG_FIELDS} }} }}"
        )
        data = resp.assert_no_errors()["updateConfig"]
        self.assertFalse(data["allowUploads"])
        self.assertEqual(data["totalStorageLimit"], before)

    async def test_updates_persist_to_db(self):
        await self.gql.post(
            "mutation { updateConfig(maxFileSizeLimit: 2048, "
            "defaultExpiry: 600) { maxFileSizeLimit } }"
        )
        config = await self._q(Config.objects.get, pk=1)
        self.assertEqual(config.max_file_size_limit, 2048)
        self.assertEqual(config.default_expiry, 600)

    async def test_updated_config_feeds_validators(self):
        from apps.files.validators import validate_download_count

        await self.gql.post(
            "mutation { updateConfig(downloadConfigs: [1, 3]) { downloadConfigs } }"
        )
        await self._q(validate_download_count, 3)
        with self.assertRaises(Exception):
            await self._q(validate_download_count, 2)


class FileQueryTests(IntegrationTestCase):
    async def test_files_list_empty_then_populated(self):
        empty = await self.gql.post("{ files { id filename size downloadCount } }")
        self.assertEqual(empty.assert_no_errors()["files"], [])

        await self._q(make_file, filename="one.bin", size=11)
        listed = await self.gql.post("{ files { id filename size downloadCount } }")
        files = listed.assert_no_errors()["files"]
        self.assertEqual(len(files), 1)
        self.assertEqual(files[0]["filename"], "one.bin")
        self.assertEqual(files[0]["size"], 11)

    async def test_file_info_by_uuid_string(self):
        f = await self._q(make_file, filename="findme.txt")
        resp = await self.gql.post(
            f'{{ fileInfo(key: "{f.id}") {{ id filename key }} }}'
        )
        data = resp.assert_no_errors()["fileInfo"]
        self.assertEqual(data["id"], str(f.id))
        self.assertEqual(data["key"], f.key)

    async def test_file_info_by_storage_key(self):
        f = await self._q(make_file, filename="bykey.txt")
        resp = await self.gql.post(
            f'{{ fileInfo(key: "{f.key}") {{ id filename }} }}'
        )
        self.assertEqual(resp.assert_no_errors()["fileInfo"]["id"], str(f.id))

    async def test_file_info_unknown_returns_null(self):
        resp = await self.gql.post(
            '{ fileInfo(key: "does-not-exist") { id } }'
        )
        self.assertIsNone(resp.assert_no_errors()["fileInfo"])

    async def test_admin_files_pagination(self):
        for i in range(15):
            await self._q(make_file, filename=f"page-{i:02d}.bin")
        page_one = await self.gql.post(
            "{ adminFiles(page: 1, size: 10) "
            "{ items { filename } total page size pages } }"
        )
        p1 = page_one.assert_no_errors()["adminFiles"]
        self.assertEqual(p1["total"], 15)
        self.assertEqual(p1["pages"], 2)
        self.assertEqual(len(p1["items"]), 10)
        page_two = await self.gql.post(
            "{ adminFiles(page: 2, size: 10) { items { filename } } }"
        )
        p2 = page_two.assert_no_errors()["adminFiles"]
        self.assertEqual(len(p2["items"]), 5)

    async def test_admin_files_search_filters(self):
        await self._q(make_file, filename="alpha-report.pdf")
        await self._q(make_file, filename="beta-notes.txt")
        resp = await self.gql.post(
            '{ adminFiles(search: "alpha") { items { filename } total } }'
        )
        found = resp.assert_no_errors()["adminFiles"]
        self.assertEqual(found["total"], 1)
        self.assertEqual(found["items"][0]["filename"], "alpha-report.pdf")


class FileMutationTests(IntegrationTestCase):
    REGISTER_MUTATION = """
        mutation RegisterFile($filename: String!, $totalSize: Int!,
                              $chunkCount: Int!, $expiresAt: Int!,
                              $expireAfterNDownload: Int!, $numberOfFiles: Int) {
            registerFile(filename: $filename, totalSize: $totalSize,
                         chunkCount: $chunkCount, expiresAt: $expiresAt,
                         expireAfterNDownload: $expireAfterNDownload,
                         numberOfFiles: $numberOfFiles) {
                id key filename size chunkCount numberOfFiles downloadCount expiresAt
            }
        }
    """

    async def _register(self, *, filename="bundle.enc", total_size=1024,
                        chunk_count=1, expires_at=3600, expire_after=3,
                        number_of_files=7, **overrides):
        vars_ = {
            "filename": filename,
            "totalSize": total_size,
            "chunkCount": chunk_count,
            "expiresAt": expires_at,
            "expireAfterNDownload": expire_after,
            "numberOfFiles": number_of_files,
        }
        vars_.update(overrides)
        return await self.gql.post(self.REGISTER_MUTATION, vars_)

    async def _upload_chunk(self, file_key, chunk_index, data, is_last=True):
        mutation = """
            mutation UploadChunk($fileKey: String!, $chunkIndex: Int!,
                                 $chunk: Upload!, $isLast: Boolean!) {
                uploadFileChunk(fileKey: $fileKey, chunkIndex: $chunkIndex,
                                chunk: $chunk, isLast: $isLast)
            }
        """
        return await self.gql.post_multipart(
            mutation,
            {"fileKey": file_key, "chunkIndex": chunk_index, "isLast": is_last},
            {"chunk": (f"chunk-{chunk_index}.part", data)},
        )

    async def test_register_and_upload_chunk_roundtrip(self):
        resp = await self._register(filename="bundle.enc", total_size=1024,
                                    chunk_count=1, number_of_files=7)
        registered = resp.assert_no_errors()["registerFile"]
        self.assertEqual(registered["filename"], "bundle.enc")
        self.assertEqual(registered["size"], 1024)
        self.assertEqual(registered["chunkCount"], 1)

        payload = b"A" * 1024
        chunk_resp = await self._upload_chunk(registered["key"], 0, payload)
        self.assertTrue(chunk_resp.assert_no_errors()["uploadFileChunk"])

        row = await self._q(File.objects.get, id=registered["id"])
        self.assertEqual(row.size, 1024)
        self.assertEqual(row.expire_after_n_download, 3)
        self.assertTrue(await self._q(file_chunks_exist, row.key, 1))

    async def test_register_rejects_when_disabled(self):
        await self._q(make_config, allow_uploads=False)
        resp = await self._register(filename="x.bin")
        self.assertIsNotNone(resp.errors)
        self.assertIn("disabled", resp.errors[0]["message"].lower())
        self.assertEqual(await self._q(File.objects.count), 0)

    async def test_register_rejects_oversize(self):
        await self._q(make_config, max_file_size_limit=8)
        resp = await self._register(filename="big.bin", total_size=9)
        self.assertIsNotNone(resp.errors)
        self.assertIn("exceeds", resp.errors[0]["message"])
        self.assertEqual(await self._q(File.objects.count), 0)

    async def test_register_exactly_at_size_limit_succeeds(self):
        await self._q(make_config, max_file_size_limit=8)
        resp = await self._register(filename="edge.bin", total_size=8)
        self.assertIsNone(resp.errors)

    async def test_register_rejects_over_max_expiry(self):
        await self._q(make_config, default_expiry=100)
        resp = await self._register(filename="late.bin", expires_at=101)
        self.assertIsNotNone(resp.errors)
        self.assertIn("expiry duration", resp.errors[0]["message"].lower())

    async def test_register_rejects_zero_chunks(self):
        resp = await self._register(chunk_count=0)
        self.assertIsNotNone(resp.errors)

    async def test_complete_upload_verifies_chunks(self):
        resp = await self._register(filename="multi.enc", total_size=2048,
                                    chunk_count=2)
        registered = resp.assert_no_errors()["registerFile"]
        await self._upload_chunk(registered["key"], 0, b"x" * 1024, is_last=False)
        await self._upload_chunk(registered["key"], 1, b"y" * 1024, is_last=True)

        done = await self.gql.post(
            f'mutation {{ completeUpload(fileId: "{registered["id"]}") }}'
        )
        self.assertTrue(done.assert_no_errors()["completeUpload"])

    async def test_complete_upload_fails_when_chunks_missing(self):
        resp = await self._register(filename="incomplete.enc", total_size=2048,
                                    chunk_count=3)
        registered = resp.assert_no_errors()["registerFile"]
        await self._upload_chunk(registered["key"], 0, b"only-first")

        done = await self.gql.post(
            f'mutation {{ completeUpload(fileId: "{registered["id"]}") }}'
        )
        self.assertIsNotNone(done.errors)

    async def test_chunk_url_returns_presigned_url(self):
        resp = await self._register(filename="urls.enc", total_size=1024,
                                    chunk_count=1)
        registered = resp.assert_no_errors()["registerFile"]
        await self._upload_chunk(registered["key"], 0, b"url-data")

        url_resp = await self.gql.post(
            f'mutation {{ chunkUrl(fileId: "{registered["id"]}", chunkIndex: 0) }}'
        )
        url = url_resp.assert_no_errors()["chunkUrl"]
        self.assertIsInstance(url, str)
        self.assertTrue(len(url) > 0)

    async def test_chunk_url_rejects_out_of_range(self):
        resp = await self._register(filename="range.enc", total_size=1024,
                                    chunk_count=1)
        registered = resp.assert_no_errors()["registerFile"]
        url_resp = await self.gql.post(
            f'mutation {{ chunkUrl(fileId: "{registered["id"]}", chunkIndex: 5) }}'
        )
        self.assertIsNotNone(url_resp.errors)

    async def test_delete_file_removes_row_and_chunks(self):
        f = await self._q(make_file, filename="deleteme.enc")
        key = f.key
        self.assertTrue(await self._q(file_chunks_exist, key, 1))
        resp = await self.gql.post(f'mutation {{ deleteFile(fileId: "{f.id}") }}')
        self.assertTrue(resp.assert_no_errors()["deleteFile"])
        self.assertFalse(await self._q(File.objects.filter(id=f.id).exists))
        self.assertFalse(await self._q(file_chunks_exist, key, 1))

    async def test_delete_missing_file_returns_false(self):
        resp = await self.gql.post(
            f'mutation {{ deleteFile(fileId: "{uuid4()}") }}'
        )
        self.assertFalse(resp.assert_no_errors()["deleteFile"])
