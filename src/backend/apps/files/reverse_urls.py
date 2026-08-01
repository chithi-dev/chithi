from django.urls import path

from .reverse_views import create_room, room_detail, room_upload, add_room_host

urlpatterns = [
    path("rooms/", create_room, name="reverse_create_room"),
    path("rooms/<uuid:room_id>/", room_detail, name="reverse_room_detail"),
    path("rooms/<uuid:room_id>/upload/", room_upload, name="reverse_room_upload"),
    path("rooms/<uuid:room_id>/hosts/", add_room_host, name="reverse_add_host"),
]
