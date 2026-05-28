"""Tests for reverse rooms service layer."""

import pytest


@pytest.mark.asyncio
async def test_create_room():
    """Rooms can be created with valid parameters."""
    from apps.reverse_rooms.services.room_service import RoomService

    svc = RoomService()
    room = await svc.create_room("test-room", 3600, number_of_downloads=5)  # type: ignore[arg-type]
    assert room is not None  # type: ignore[truthy-assert]


@pytest.mark.asyncio
async def test_list_room_files():
    """Room files can be listed."""
    from apps.reverse_rooms.models import Room
    from apps.reverse_rooms.services.room_service import RoomService

    room = await Room.objects.acreate(  # type: ignore[attr-defined]
        name="files-room", expire_after=7200
    )
    files = await RoomService().list_room_files(room.id)  # type: ignore[arg-type]
    assert isinstance(files, list)  # type: ignore[unreachable]
