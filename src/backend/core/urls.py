from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("graphql/", include("apps.graphql.urls")),
    path("files/", include("apps.files.urls")),
    path("speedtest/", include("apps.files.speedtest_urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
