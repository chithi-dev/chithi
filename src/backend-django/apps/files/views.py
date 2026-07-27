import logging

from django.conf import settings
from django.http import Http404, StreamingHttpResponse
from django.views.decorators.http import require_http_methods
import aioboto3

from apps.files.models import File

logger = logging.getLogger(__name__)

CHUNK_SIZE = 64 * 1024  # 64KB


def _get_s3_resource():
    return aioboto3.resource(
        "s3",
        endpoint_url=settings.AWS_S3_ENDPOINT_URL,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name="us-east-1",
    )


async def _stream_chunks(key):
    """Async generator that yields raw binary chunks from S3."""
    resource = _get_s3_resource()
    async with resource as s3:
        obj = await s3.Object(settings.AWS_STORAGE_BUCKET_NAME, key).get()
        body = obj["Body"]
        try:
            while True:
                chunk = await body.read(CHUNK_SIZE)
                if not chunk:
                    break
                yield chunk
        finally:
            await body.close()


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
