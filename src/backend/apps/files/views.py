import logging

from django.http import Http404, JsonResponse
from django.views.decorators.http import require_http_methods

from apps.files.models import File

logger = logging.getLogger(__name__)


@require_http_methods(["GET"])
def get_file_info(request, file_id):
    """Return file metadata by UUID — GET /files/info/<uuid>/"""
    try:
        file_obj = File.objects.get(id=file_id)
    except File.DoesNotExist:
        raise Http404("File not found")

    return JsonResponse(
        {
            "id": str(file_obj.id),
            "key": file_obj.key,
            "filename": file_obj.filename,
            "size": file_obj.size,
            "chunk_count": file_obj.chunk_count,
            "number_of_files": file_obj.number_of_files,
            "download_count": file_obj.download_count,
            "expires_at": file_obj.expires_at.isoformat(),
            "is_expired": file_obj.is_expired,
        }
    )
