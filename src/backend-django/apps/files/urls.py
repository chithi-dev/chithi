from django.urls import path

from .views import download_file, get_file_info

urlpatterns = [
    # Download by UUID (matches frontend slug = File.id)
    path("<uuid:file_id>/", download_file, name="download_file"),
    # File info by UUID (matches frontend slug = File.id)
    path("info/<uuid:file_id>/", get_file_info, name="get_file_info"),
]
