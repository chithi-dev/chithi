from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from apps.files.views import download_file

urlpatterns = [
    path("admin/", admin.site.urls),
    path("graphql/", include("apps.graphql.urls")),
    path("file/<uuid:file_id>/", download_file, name="download_file"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
