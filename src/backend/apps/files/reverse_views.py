import json
import logging
import secrets

from asgiref.sync import sync_to_async
from django.http import JsonResponse, HttpResponseNotAllowed
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from apps.files.reverse_models import Room, RoomFile, RoomHost
from apps.files.services import upload_file_data
from apps.graphql.consumers import broadcast_state

logger = logging.getLogger(__name__)


def _serialize_room_file(room_file: RoomFile) -> dict:
    return {
        "key": room_file.key,
        "filename": room_file.filename,
        "size": room_file.size,
        "uploaded_at": int(room_file.uploaded_at.timestamp()),
        "download_url": f"/files/{room_file.key}",
    }


def _serialize_room(room: Room, room_files: list[RoomFile], host_count: int | None = None) -> dict:
    return {
        "id": str(room.id),
        "name": room.name,
        "expires_at": room.expires_at.isoformat(),
        "files": [_serialize_room_file(f) for f in room_files],
        "active_uploads": [],
        "host_count": host_count if host_count is not None else room.hosts.count(),
        "connected_hosts": 0,
        "connected_guests": 0,
    }


@csrf_exempt
async def create_room(request):
    """Create a new reverse-share room — POST /reverse/rooms/"""
    if request.method != "POST":
        return HttpResponseNotAllowed(["POST"])

    try:
        body = json.loads(request.body) if request.body else {}
    except json.JSONDecodeError:
        return JsonResponse({"detail": "Invalid JSON"}, status=400)

    name = body.get("name", "Untitled Room")
    expire_after = int(body.get("expire_after", 3600))
    number_of_downloads = body.get("number_of_downloads")

    room = await Room.objects.acreate(
        name=name,
        expires_at=timezone.now() + timezone.timedelta(seconds=expire_after),
        expire_after_n_download=number_of_downloads or 10,
    )

    return JsonResponse({"id": str(room.id), "host_token": room.host_token})


async def room_detail(request, room_id):
    """Return room detail — GET /reverse/rooms/<id>/"""
    if request.method != "GET":
        return HttpResponseNotAllowed(["GET"])

    try:
        room = await Room.objects.aget(id=room_id)
    except Room.DoesNotExist:
        return JsonResponse({"detail": "Room not found"}, status=404)

    if room.is_expired:
        return JsonResponse({"detail": "Room expired"}, status=410)

    files = await sync_to_async(list)(RoomFile.objects.filter(room=room))
    host_count = await sync_to_async(room.hosts.count)()
    data = _serialize_room(room, files, host_count=host_count)
    return JsonResponse(data)


@csrf_exempt
async def room_upload(request, room_id):
    """Upload a file to a room — POST /reverse/rooms/<id>/upload"""
    if request.method != "POST":
        return HttpResponseNotAllowed(["POST"])

    try:
        room = await Room.objects.aget(id=room_id)
    except Room.DoesNotExist:
        return JsonResponse({"detail": "Room not found"}, status=404)

    if room.is_expired:
        return JsonResponse({"detail": "Room expired"}, status=410)

    # Verify host token
    host_token = request.headers.get("X-Host-Token", "")
    is_valid_host = await sync_to_async(
        room.hosts.filter(host_token=host_token).exists
    )() if host_token else False
    if not is_valid_host:
        is_valid_host = room.host_token == host_token

    if not is_valid_host:
        return JsonResponse({"detail": "Invalid host token"}, status=403)

    # Parse multipart upload
    uploaded = request.FILES.get("file")
    if not uploaded:
        return JsonResponse({"detail": "No file provided"}, status=400)

    file_data = b"".join(uploaded.chunks())
    file_key = f"reverse/{room_id}/{uploaded.name}"

    # Store file data
    await upload_file_data(key=file_key, data=file_data)

    # Create DB record
    room_file = await RoomFile.objects.acreate(
        room=room,
        key=file_key,
        filename=uploaded.name,
        size=len(file_data),
    )

    # Broadcast state (storage) and room update
    await broadcast_state()

    from channels.layers import get_channel_layer
    from apps.files.reverse_consumers import ROOM_GROUP_PREFIX

    layer = get_channel_layer()
    group = f"{ROOM_GROUP_PREFIX}{room_id}"
    await layer.group_send(group, {
        "type": "file_added",
        "file": _serialize_room_file(room_file),
    })

    return JsonResponse(_serialize_room_file(room_file))


@csrf_exempt
async def add_room_host(request, room_id):
    """Add a new host to a room — POST /reverse/rooms/<id>/hosts"""
    if request.method != "POST":
        return HttpResponseNotAllowed(["POST"])

    try:
        room = await Room.objects.aget(id=room_id)
    except Room.DoesNotExist:
        return JsonResponse({"detail": "Room not found"}, status=404)

    if room.is_expired:
        return JsonResponse({"detail": "Room expired"}, status=410)

    # Verify the requester is an existing host
    host_token = request.headers.get("X-Host-Token", "")
    is_valid_host = await sync_to_async(
        room.hosts.filter(host_token=host_token).exists
    )() if host_token else False
    if not is_valid_host:
        is_valid_host = room.host_token == host_token

    if not is_valid_host:
        return JsonResponse({"detail": "Invalid host token"}, status=403)

    new_token = secrets.token_urlsafe(32)

    await RoomHost.objects.acreate(
        room=room,
        host_token=new_token,
    )

    return JsonResponse({"host_token": new_token})
