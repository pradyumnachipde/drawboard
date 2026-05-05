import os
import django
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.whiteboard.middleware import JWTAuthMiddlewareStack  # noqa: E402
from apps.whiteboard import routing as whiteboard_routing      # noqa: E402
from apps.chat import routing as chat_routing                  # noqa: E402

websocket_urlpatterns = (
    whiteboard_routing.websocket_urlpatterns +
    chat_routing.websocket_urlpatterns
)

application = ProtocolTypeRouter({
    'http': get_asgi_application(),
    'websocket': AllowedHostsOriginValidator(
        JWTAuthMiddlewareStack(
            URLRouter(websocket_urlpatterns)
        )
    ),
})
