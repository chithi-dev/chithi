"""Integration tests for models, mixins, validators, and the JWT auth layer."""

import uuid
from datetime import timedelta

import jwt as pyjwt
from django.core.exceptions import ValidationError
from django.test import TransactionTestCase
from django.utils import timezone

from apps.config.models import Config
from apps.files.models import File
from apps.graphql.auth import get_jwt_tokens, get_user_from_jwt_token
from apps.users.models import User

from .base import make_config, make_user


class UserModelTests(TransactionTestCase):
    def setUp(self):
        User.objects.all().delete()

    def test_create_user_hashes_password(self):
        user = make_user(username="alice", password="super-secret")
        self.assertEqual(user.username, "alice")
        self.assertTrue(user.check_password("super-secret"))
        self.assertNotEqual(user.password, "super-secret")

    def test_create_user_requires_username(self):
        with self.assertRaisesMessage(ValueError, "Username is required"):
            User.objects.create_user(username="", password="x")

    def test_create_superuser_flags(self):
        admin = User.objects.create_superuser(
            username="root", email="root@example.com", password="pw"
        )
        self.assertTrue(admin.is_staff)
        self.assertTrue(admin.is_superuser)

    def test_uuid_primary_key_and_created_at(self):
        user = make_user()
        self.assertIsNotNone(user.id)
        self.assertEqual(user.id.version, 4)
        self.assertIsNotNone(user.created_at)

    def test_username_unique_constraint(self):
        make_user(username="dup", email=None)
        with self.assertRaises(Exception):
            User.objects.create_user(username="dup", password="x", email=None)

    def test_str(self):
        self.assertEqual(str(make_user(username="bob")), "bob")


class ConfigModelTests(TransactionTestCase):
    def setUp(self):
        Config.objects.all().delete()

    def test_load_creates_singleton_with_defaults(self):
        config = Config.load()
        self.assertEqual(config.pk, 1)
        self.assertEqual(config.total_storage_limit, 10 * 1024 * 1024 * 1024)
        self.assertEqual(config.max_file_size_limit, 100 * 1024 * 1024)
        self.assertEqual(config.default_expiry, 7 * 24 * 3600)
        self.assertEqual(config.default_number_of_downloads, 10)
        self.assertTrue(config.allow_uploads)

    def test_load_is_idempotent(self):
        first = Config.load()
        second = Config.load()
        self.assertEqual(first.pk, second.pk)
        self.assertEqual(Config.objects.count(), 1)

    def test_second_instance_rejected(self):
        Config.objects.create(pk=1)
        with self.assertRaises(ValidationError):
            Config.objects.create(pk=2)

    def test_update_or_create_works(self):
        Config.objects.update_or_create(pk=1, defaults={"allow_uploads": False})
        self.assertFalse(Config.load().allow_uploads)


class FileModelTests(TransactionTestCase):
    def setUp(self):
        File.objects.all().delete()
        make_config()

    def _file(self, *, expires_in=3600, downloads=5, used=0):
        return File.objects.create(
            key="k-" + str(timezone.now().timestamp()),
            filename="f.bin",
            size=1,
            expires_at=timezone.now() + timedelta(seconds=expires_in),
            expire_after_n_download=downloads,
            download_count=used,
        )

    def test_defaults(self):
        f = self._file()
        self.assertEqual(f.download_count, 0)
        self.assertIsNone(f.number_of_files)
        self.assertEqual(f.id.version, 4)
        self.assertIsNotNone(f.created_at)
        self.assertFalse(f.is_expired)

    def test_expired_by_time(self):
        self.assertTrue(self._file(expires_in=-10).is_expired)

    def test_expired_by_download_count(self):
        self.assertTrue(self._file(downloads=3, used=3).is_expired)
        self.assertFalse(self._file(downloads=3, used=2).is_expired)

    def test_ordering_newest_first(self):
        a = self._file()
        b = self._file()
        self.assertEqual(File.objects.first().pk, b.pk)
        self.assertEqual(File.objects.last().pk, a.pk)


class ValidatorTests(TransactionTestCase):
    def setUp(self):
        Config.objects.all().delete()
        make_config()

    def test_validate_max_file_size_ok(self):
        from apps.files.validators import validate_max_file_size

        validate_max_file_size(50 * 1024 * 1024)

    def test_validate_max_file_size_too_big(self):
        from apps.files.validators import validate_max_file_size

        with self.assertRaises(ValidationError):
            validate_max_file_size(200 * 1024 * 1024)

    def test_download_count_unrestricted_when_configs_empty(self):
        from apps.files.validators import validate_download_count

        validate_download_count(123456)

    def test_download_count_must_match_allowed_list(self):
        from apps.files.validators import validate_download_count

        make_config(download_configs=[1, 5, 10])
        validate_download_count(5)
        with self.assertRaises(ValidationError):
            validate_download_count(7)

    def test_expiry_duration_unrestricted_when_configs_empty(self):
        from apps.files.validators import validate_expiry_duration

        validate_expiry_duration(999999)

    def test_expiry_duration_must_match_allowed_list(self):
        from apps.files.validators import validate_expiry_duration

        make_config(time_configs=[60, 3600])
        validate_expiry_duration(3600)
        with self.assertRaises(ValidationError):
            validate_expiry_duration(61)


class JwtAuthTests(TransactionTestCase):
    def setUp(self):
        User.objects.all().delete()
        self.user = make_user()

    def test_tokens_roundtrip(self):
        access, refresh = get_jwt_tokens(self.user)
        for token in (access, refresh):
            payload = pyjwt.decode(token, "test-secret-key-do-not-use-in-production", algorithms=["HS512"])
            self.assertEqual(payload["user_id"], str(self.user.id))

    def test_access_shorter_lived_than_refresh(self):
        access, refresh = get_jwt_tokens(self.user)
        now = timezone.now()

        def exp(token):
            return pyjwt.decode(
                token,
                "test-secret-key-do-not-use-in-production",
                algorithms=["HS512"],
            )["exp"]

        self.assertLess(exp(access), exp(refresh))

    def test_resolve_valid_token(self):
        access, _ = get_jwt_tokens(self.user)
        resolved = get_user_from_jwt_token(access)
        self.assertEqual(resolved.pk, self.user.pk)

    def test_resolve_garbage_token_returns_none(self):
        self.assertIsNone(get_user_from_jwt_token("not-a-jwt"))

    def test_resolve_expired_token_returns_none(self):
        expired = pyjwt.encode(
            {"user_id": str(self.user.id), "exp": timezone.now() - timedelta(days=1)},
            "test-secret-key-do-not-use-in-production",
            algorithm="HS512",
        )
        self.assertIsNone(get_user_from_jwt_token(expired))

    def test_resolve_token_for_missing_user_returns_none(self):
        ghost = pyjwt.encode(
            {"user_id": str(uuid.uuid4()), "exp": timezone.now() + timedelta(days=1)},
            "test-secret-key-do-not-use-in-production",
            algorithm="HS512",
        )
        self.assertIsNone(get_user_from_jwt_token(ghost))
