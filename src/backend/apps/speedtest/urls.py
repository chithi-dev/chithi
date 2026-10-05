from django.urls import path

from apps.speedtest import views

urlpatterns = [
    path("speedtest/download/", views.speedtest_download, name="speedtest_download"),
    path("speedtest/upload/", views.speedtest_upload, name="speedtest_upload"),
    path("speedtest/latency/", views.speedtest_latency, name="speedtest_latency"),
]
