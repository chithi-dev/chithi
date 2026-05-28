from __future__ import annotations

import strawberry
from uuid import UUID

from apps.reverse_rooms.graphql.types import (
    HostTokenResult, RoomCreateInput, RoomCreateResult
)
from apps.reverse_rooms.services.room_service import RoomService


@strawberry.type
class ReverseRoomsMutations:
    @strawberry.mutation
    async def create_room(
        self, info: strawberry.types.Info, input: RoomCreateInput
    ) -> RoomCreateResult:
        """Create a new reverse room (no auth required)."""
        service = RoomService()

        # Resolve default_number_of_downloads from config if not explicitly provided
        number_of_downloads = input.number_of_downloads
        if number_of_downloads is None:
            try:
                cfg = await __import__("apps.config.models", fromlist=["Config"]).Config.get_config()  # type: ignore[attr-defined]
                number_of_downloads = getattr(cfg, "default_number_of_downloads", 10) or 10
            except Exception:
                number_of_downloads = 10

        result = await service.create_room(
            name=input.name,
            expire_after=input.expire_after,
            number_of_downloads=number_of_downloads,
        )

        return RoomCreateResult(
            id=result["id"],
            name=result["name"],
            created_at=result["created_at"],
            expires_at=result["expires_at"],
            expire_after=result["expire_after"],
            number_of_downloads=result.get("number_of_downloads"),
            files=[],
            active_uploads_count=0,
            host_token=result["host_token"],
        )

    @strawberry.mutation
    async def delete_room(
        self, info: strawberry.types.Info, id: strawberry.ID, host_token: str
    ) -> bool:
        """Delete a room by ID with host token verification (auth required)."""
        from core.auth.jwt_auth import get_current_user
        user = await get_current_user(info)
        if not user:
            raise PermissionError("Authentication required")

        service = RoomService()
        return await service.delete_room(UUID(id), host_token)  # type: ignore[arg-type]

    @strawberry.mutation
    async def add_host(
        self, info: strawberry.types.Info, id: strawberry.ID, host_token: str
    ) -> HostTokenResult:
        """Add a new host token to an existing room (header verification)."""
        service = RoomService()
        result = await service.add_host(UUID(id), host_token)  # type: ignore[arg-type]
        return HostTokenResult(host_token=result["host_token"])


@strawberry.type
class Mutation(ReverseRoomsMutations):
    pass
