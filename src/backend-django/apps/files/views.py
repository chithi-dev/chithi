import logging
import mimetypes

from django.http import Http404, HttpResponse, JsonResponse, StreamingHttpResponse
from django.http import FileResponse
from django.views.decorators.http import require_http_methods

from apps.files.models import File
from apps.files.services import get_storage, is_s3_backend, download_file_path

logger = logging.getLogger(__name__)

CHUNK_SIZE = 256 * 1024  # 256KB for faster streaming


@require_http_methods(["GET"])
async def download_file(request, file_id):
    """Stream file download by UUID — GET /files/<uuid>/"""
    try:
        file_obj = await File.objects.aget(id=file_id)
    except File.DoesNotExist:
        raise Http404("File not found")

    if file_obj.is_expired:
        return HttpResponse("File expired or download limit reached", status=410)

    # Increment download count
    await File.objects.filter(pk=file_obj.pk).aupdate(
        download_count=file_obj.download_count + 1
    )

    content_type, _ = mimetypes.guess_type(file_obj.filename)
    content_type = content_type or "application/octet-stream"

    if is_s3_backend():
        # S3: async streaming
        async def _stream():
            body = await get_storage().download_stream(file_obj.key)
            try:
                while True:
                    chunk = await body.read(CHUNK_SIZE)
                    if not chunk:
                        break
                    yield chunk
            finally:
                await body.close()

        response = StreamingHttpResponse(
            _stream(),
            content_type=content_type,
        )
    else:
        # Local: FileResponse is memory-efficient and fast
        file_path = download_file_path(file_obj.key)
        response = FileResponse(
            open(file_path, "rb"),
            content_type=content_type,
        )

    response["Content-Disposition"] = (
        f'attachment; filename="{file_obj.filename}"'
    )
    response["Content-Length"] = str(file_obj.size)
    return response


@require_http_methods(["GET"])
async def get_file_info(request, file_id):
    """Return file metadata by UUID — GET /files/info/<uuid>/"""
    try:
        file_obj = await File.objects.aget(id=file_id)
    except File.DoesNotExist:
        raise Http404("File not found")

    return JsonResponse({
        "id": str(file_obj.id),
        "key": file_obj.key,
        "filename": file_obj.filename,
        "size": file_obj.size,
        "number_of_files": file_obj.number_of_files,
        "download_count": file_obj.download_count,
        "expires_at": file_obj.expires_at.isoformat(),
        "is_expired": file_obj.is_expired,
    })
