from django.urls import path

from .views import stream_file

urlpatterns = [
    path("stream/<str:key>/", stream_file, name="stream_file"),
]
