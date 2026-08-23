import os

import django
from channels.routing import ProtocolTypeRouter
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

# Initialize Django so apps are loaded before importing routing
django.setup()

from core.routing import websocket_application  # noqa: E402

application = ProtocolTypeRouter(
    {
        "http": get_asgi_application(),
        "websocket": websocket_application,
    }
)
