"""Shared cloud storage abstraction for Django.

All file operations go through this layer via django-storages + S3-compatible backend.
GraphQL resolvers and services call core.storage.services.StorageService — never touch storages directly.
"""

from core.storage.services import StorageService

__all__ = ["StorageService"]
