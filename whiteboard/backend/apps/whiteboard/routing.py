from django.urls import re_path
from .consumers import WhiteboardConsumer

websocket_urlpatterns = [
    re_path(r'^ws/whiteboard/(?P<room_code>[A-Z0-9]{4,8})/$', WhiteboardConsumer.as_asgi()),
]
