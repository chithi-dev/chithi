import os

import django
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

django.setup()

django_asgi_app = get_asgi_application()

from apps.reverse.routing import websocket_url_router  # noqa: E402

# Reverse-share rooms authenticate via the ``host_token`` query parameter
# (the room key is never sent to the server), so no JWT middleware is needed.
application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": AllowedHostsOriginValidator(websocket_url_router),
    }
)
