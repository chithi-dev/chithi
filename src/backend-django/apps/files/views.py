import logging

from django.http import StreamingHttpResponse
from django.views.decorators.http import require_http_methods

from apps.files.models import File
from apps.files.services import download_file_stream

logger = logging.getLogger(__name__)

CHUNK_SIZE = 64 * 1024  # 64KB


@require_http_methods(["GET"])
async def stream_file(request, key):
    """Stream file data from S3 as raw binary chunks."""
    try:
        file_obj = await File.objects.aget(key=key)
    except File.DoesNotExist:
        from django.http import Http404

        raise Http404("File not found")

    stream = await download_file_stream(key)

    async def _chunks():
        try:
            while True:
                chunk = await stream.read(CHUNK_SIZE)
                if not chunk:
                    break
                yield chunk
        finally:
            await stream.aclose()

    response = StreamingHttpResponse(
        _chunks(),
        content_type="application/octet-stream",
    )
    response["Content-Disposition"] = (
        f'attachment; filename="{file_obj.filename}"'
    )
    return response
