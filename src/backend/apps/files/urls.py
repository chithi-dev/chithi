from django.urls import path

from .views import get_file_info

urlpatterns = [
    # File info by UUID (matches frontend slug = File.id)
    path("info/<uuid:file_id>/", get_file_info, name="get_file_info"),
]
