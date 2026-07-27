from django.urls import path

from .views import download_file, stream_file

urlpatterns = [
    path("file/<uuid:file_id>/", download_file, name="download_file"),
    path("stream/<str:key>/", stream_file, name="stream_file"),
]
