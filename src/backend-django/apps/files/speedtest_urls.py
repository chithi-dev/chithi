from django.urls import path

from .speedtest import speedtest_download, speedtest_upload, speedtest_latency

urlpatterns = [
    path("download/", speedtest_download, name="speedtest_download"),
    path("upload/", speedtest_upload, name="speedtest_upload"),
    path("latency/", speedtest_latency, name="speedtest_latency"),
]
