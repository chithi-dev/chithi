from channels.routing import URLRouter
from django.urls import re_path

from apps.graphql.consumers import StateConsumer
from apps.files.reverse_consumers import ReverseRoomConsumer

websocket_application = URLRouter(
    [
        re_path(r"^ws/state$", StateConsumer.as_asgi()),
        re_path(r"^ws/reverse/rooms/(?P<room_id>[^/]+)$", ReverseRoomConsumer.as_asgi()),
    ]
)
