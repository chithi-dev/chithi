import os

import django
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

# Plain Django ASGI app — no WebSocket routing (the reverse-room and state
# channels features have been removed; uploads/downloads are plain HTTP).
django.setup()

application = get_asgi_application()
