"""Tests for reverse room service."""

from __future__ import annotations

import datetime
from uuid import uuid4

import pytest


class TestRoomService:
    """Test reverse room service operations."""

    async def test_create_room(self) -> None:
        from apps.reverse_rooms.services.room_service import RoomService
        
        result = await RoomService.create_room(
            name='Test Room',
            expire_after=3600,
            number_of_downloads=5,
        )
        
        assert 'id' in result
        assert result['name'] == 'Test Room'
        assert result['host_token'] is not None
        assert len(result['host_token']) > 0

    async def test_get_room_after_create(self) -> None:
        from apps.reverse_rooms.services.room_service import RoomService
        
        result = await RoomService.create_room(
            name='Get Test', expire_after=3600, number_of_downloads=3
        )
        
        room = await RoomService.get_room(result['id'])  # type: ignore[arg-type]
        assert room is not None
        assert room['name'] == 'Get Test'

    async def test_delete_room_invalid_token(self) -> None:
        from apps.reverse_rooms.services.room_service import RoomService
        
        result = await RoomService.create_room(
            name='Delete Test', expire_after=3600, number_of_downloads=1
        )
        
        deleted = await RoomService.delete_room(result['id'], 'wrong-token')  # type: ignore[arg-type]
        assert deleted is False

    async def test_add_host(self) -> None:
        from apps.reverse_rooms.services.room_service import RoomService
        
        result = await RoomService.create_room(
            name='Host Test', expire_after=3600, number_of_downloads=1
        )
        
        new_token_result = await RoomService.add_host(result['id'], 'new-host-token')  # type: ignore[arg-type]
        assert 'host_token' in new_token_result

    async def test_list_room_files_empty(self) -> None:
        from apps.reverse_rooms.services.room_service import RoomService
        
        result = await RoomService.create_room(
            name='Files Test', expire_after=3600, number_of_downloads=1
        )
        
        files = await RoomService.list_room_files(result['id'])  # type: ignore[arg-type]
        assert isinstance(files, list)
