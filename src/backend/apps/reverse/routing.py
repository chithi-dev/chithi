"""Channels routing for reverse-share rooms."""

from django.urls import path
from channels.routing import URLRouter

from apps.reverse.consumers import RoomConsumer

websocket_urlpatterns = [
    path("ws/reverse/rooms/<str:room_id>/", RoomConsumer.as_asgi()),
]

websocket_url_router = URLRouter(websocket_urlpatterns)
