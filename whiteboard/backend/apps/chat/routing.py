from django.urls import re_path
from .consumers import ChatConsumer

websocket_urlpatterns = [
    re_path(r'^ws/chat/(?P<room_code>[A-Z0-9]{4,8})/$', ChatConsumer.as_asgi()),
]
