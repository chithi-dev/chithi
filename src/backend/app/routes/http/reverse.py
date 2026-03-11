import json
import uuid
from datetime import datetime, timezone
from urllib.parse import quote

from botocore.exceptions import ClientError
from fastapi import APIRouter, Header, HTTPException, UploadFile, status, Request
from fastapi.responses import StreamingResponse
from sqlmodel import col, select
from types_aiobotocore_s3.type_defs import CompletedPartTypeDef

from app.converter.bytes import ByteSize
from app.deps import S3Dep, SessionDep
from app.models.files import File
from app.schemas.reverse import (
    AddHostOut,
    RoomCreate,
    RoomCreateOut,
    RoomFileEntry,
    RoomOut,
)
from app.settings import settings
from app.states.room import RoomState
from app.states.app import UploadProgress
from app.tasks.clean_file import delete_expired_file
from app.tasks.persist_file import persist_file_record

router = APIRouter(prefix="/reverse")

CHUNK_SIZE = ByteSize(mb=8).total_bytes()


@router.post("/rooms", status_code=status.HTTP_201_CREATED)
async def create_room(body: RoomCreate) -> RoomCreateOut:
    return await RoomState.create(name=body.name, expire_after=body.expire_after)


@router.get("/rooms/{room_id}")
async def get_room(room_id: str) -> RoomOut:
    room = await RoomState.get(room_id)
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found or expired")
    return room


@router.delete("/rooms/{room_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_room(
    room_id: str,
    session: SessionDep,
    x_host_token: str = Header(),
) -> None:
    if not await RoomState.verify_host(room_id, x_host_token):
        raise HTTPException(status_code=403, detail="Invalid host token")

    room = await RoomState.get(room_id)
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found or expired")

    # Schedule file cleanup (S3 + DB) via the existing file cleanup task
    if room.files:
        keys = [f.key for f in room.files]
        result = await session.exec(select(File).where(col(File.key).in_(keys)))
        for file_record in result.all():
            delete_expired_file.delay(str(file_record.id))

    await RoomState.publish_event(room_id, json.dumps({"type": "room_destroyed"}))
    await RoomState.delete(room_id)


@router.post("/rooms/{room_id}/hosts", status_code=status.HTTP_201_CREATED)
async def add_host(
    room_id: str,
    x_host_token: str = Header(),
) -> AddHostOut:
    """An existing host can invite a new host to the room."""
    if not await RoomState.verify_host(room_id, x_host_token):
        raise HTTPException(status_code=403, detail="Invalid host token")

    result = await RoomState.add_host(room_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Room not found or expired")
    return result


@router.post("/rooms/{room_id}/upload")
async def upload_file_to_room(
    room_id: str,
    file: UploadFile,
    file: UploadFile,
    request: Request,
    s3: S3Dep,
    x_host_token: str = Header(),
) -> RoomFileEntry:
    if not await RoomState.verify_host(room_id, x_host_token):
        raise HTTPException(status_code=403, detail="Invalid host token")

    room = await RoomState.get(room_id)
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found or expired")

    # Check room hasn't expired by time
    if datetime.now(timezone.utc) > room.expires_at:
        raise HTTPException(status_code=410, detail="Room has expired")

    # Namespace S3 key under the room
    file_key = f"rooms/{room_id}/{uuid.uuid7()}"
    filename = file.filename or str(uuid.uuid7())

    # Track upload progress in global AppState so websockets and other
    # observers can see in-flight uploads (mirrors upload.py behavior).
    await UploadProgress.start(upload_key=file_key, filename=filename)

    # Multipart upload to RustFS
    # Store filename in S3 metadata so the shareable download link works
    # even after the room expires.
    resp = await s3.create_multipart_upload(
        Bucket=settings.RUSTFS_BUCKET_NAME,
        Key=file_key,
        ContentType=file.content_type or "application/octet-stream",
        Metadata={"filename": filename},
    )
    upload_id = resp["UploadId"]
    # boto3 type defs expect a sequence of CompletedPartTypeDef
    parts: list[CompletedPartTypeDef] = []
    part_number = 1
    uploaded_size = 0

    try:
        while True:
            chunk = await file.read(CHUNK_SIZE)
            if not chunk:
                break

            part_resp = await s3.upload_part(
                Bucket=settings.RUSTFS_BUCKET_NAME,
                Key=file_key,
                UploadId=upload_id,
                PartNumber=part_number,
                Body=chunk,
            )
            part_entry: CompletedPartTypeDef = {
                "ETag": part_resp["ETag"],
                "PartNumber": part_number,
            }
            parts.append(part_entry)
            uploaded_size += len(chunk)
            part_number += 1

            # Update upload progress in global state
            await UploadProgress.update(
                upload_key=file_key, uploaded_bytes=uploaded_size
            )

            # If the client disconnected mid-upload, abort and evict
            if await request.is_disconnected():
                await s3.abort_multipart_upload(
                    Bucket=settings.RUSTFS_BUCKET_NAME,
                    Key=file_key,
                    UploadId=upload_id,
                )
                await UploadProgress.cancel(upload_key=file_key)
                raise HTTPException(status_code=499, detail="Client disconnected")

        if not parts:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Empty file",
            )

        await s3.complete_multipart_upload(
            Bucket=settings.RUSTFS_BUCKET_NAME,
            Key=file_key,
            UploadId=upload_id,
            MultipartUpload={"Parts": parts},
        )
        await UploadProgress.finish(upload_key=file_key, final_size=uploaded_size)
    except HTTPException:
        # Ensure failed uploads are removed from AppState
        await UploadProgress.cancel(upload_key=file_key)
        raise
    except Exception:
        await s3.abort_multipart_upload(
            Bucket=settings.RUSTFS_BUCKET_NAME,
            Key=file_key,
            UploadId=upload_id,
        )
        # Ensure failed uploads are removed from AppState
        await UploadProgress.cancel(upload_key=file_key)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Upload failed",
        )

    now = datetime.now(timezone.utc)

    # Persist File record + schedule cleanup in background (non-blocking)
    persist_file_record.delay(
        key=file_key,
        filename=filename,
        size=uploaded_size,
        created_at=now.isoformat(),
        expires_at=room.expires_at.isoformat(),
        content_type=file.content_type or "application/octet-stream",
    )

    entry = RoomFileEntry(
        key=file_key,
        filename=filename,
        size=uploaded_size,
        uploaded_at=now,
        download_url=f"{settings.ROOT_PATH}/download/{file_key}",
    )

    # Persist in room state + fan-out event via pub/sub (atomic append)
    added = await RoomState.add_file(room_id, entry)
    if not added:
        # Room vanished mid-upload — clean up the S3 object
        await s3.delete_object(Bucket=settings.RUSTFS_BUCKET_NAME, Key=file_key)
        # Remove in-flight upload from global state
        await UploadProgress.cancel(upload_key=file_key)
        raise HTTPException(status_code=404, detail="Room expired during upload")

    return entry


@router.get("/rooms/{room_id}/files")
async def list_room_files(room_id: str) -> list[RoomFileEntry]:
    """Late-joining clients call this to discover all files already in the room."""
    room = await RoomState.get(room_id)
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found or expired")
    return room.files


@router.get("/rooms/{room_id}/files/{file_key:path}/download")
async def download_room_file(
    room_id: str,
    file_key: str,
    s3: S3Dep,
) -> StreamingResponse:
    """Stream a room file from RustFS.  Designed for late or slow clients."""
    room = await RoomState.get(room_id)
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found or expired")

    # Verify the file belongs to this room
    entry = next((f for f in room.files if f.key == file_key), None)
    if entry is None:
        raise HTTPException(status_code=404, detail="File not found in room")

    try:
        s3_response = await s3.get_object(
            Bucket=settings.RUSTFS_BUCKET_NAME, Key=file_key
        )
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code")
        if code == "NoSuchKey":
            raise HTTPException(status_code=404, detail="File not found in storage")
        raise HTTPException(status_code=500, detail="Storage error")

    async def _stream():
        try:
            async for chunk in s3_response["Body"]:
                yield chunk
        finally:
            s3_response["Body"].close()

    safe_filename = quote(entry.filename)
    return StreamingResponse(
        _stream(),
        media_type=s3_response.get("ContentType", "application/octet-stream"),
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{safe_filename}",
        },
    )
