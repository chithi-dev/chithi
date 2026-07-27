import logging

from django.http import Http404, StreamingHttpResponse
from django.views.decorators.http import require_http_methods

from apps.files.models import File
from apps.files.services import download_file_stream

logger = logging.getLogger(__name__)

CHUNK_SIZE = 64 * 1024  # 64KB


async def _stream_chunks(key):
    """Async generator that yields raw binary chunks from S3."""
    stream = await download_file_stream(key)
    try:
        while True:
            chunk = await stream.read(CHUNK_SIZE)
            if not chunk:
                break
            yield chunk
    finally:
        await stream.aclose()


@require_http_methods(["GET"])
async def download_file(request, file_id):
    """Stream file download by UUID — GET /files/file/<uuid>/"""
    try:
        file_obj = await File.objects.aget(id=file_id)
    except File.DoesNotExist:
        raise Http404("File not found")

    response = StreamingHttpResponse(
        _stream_chunks(file_obj.key),
        content_type="application/octet-stream",
    )
    response["Content-Disposition"] = (
        f'attachment; filename="{file_obj.filename}"'
    )
    return response
