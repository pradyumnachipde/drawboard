import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

logger = logging.getLogger(__name__)
MAX_MESSAGE_LEN = 2000
HISTORY_LIMIT = 100


class ChatConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for in-room chat.

    Incoming message types:
      chat_message  - New chat message from user
      typing        - Typing indicator (is_typing: bool)
      ping          - Keepalive

    Outgoing message types:
      history       - Last N messages on connect
      chat_message  - Relayed message to all room members
      typing        - Typing indicator (not echoed to sender)
      pong          - Ping response
    """

    async def connect(self):
        self.user = self.scope.get('user')
        self.room_code = self.scope['url_route']['kwargs']['room_code']
        self.room_group = f'chat_{self.room_code}'

        if not self.user or not self.user.is_authenticated:
            await self.close(code=4001)
            return

        # Ensure room exists and user is a member
        room = await self.get_room(self.room_code)
        if not room:
            await self.close(code=4004)
            return

        is_member = await self.check_membership(room)
        if not is_member:
            await self.close(code=4003)
            return

        self.room_id = str(room.id)
        await self.channel_layer.group_add(self.room_group, self.channel_name)
        await self.accept()

        # Send recent history to new joiner
        history = await self.get_history()
        await self.send(text_data=json.dumps({
            'type': 'history',
            'messages': history,
        }))
        logger.info(f'User {self.user.username} joined chat {self.room_code}')

    async def disconnect(self, close_code):
        if hasattr(self, 'room_group'):
            await self.channel_layer.group_discard(self.room_group, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except (json.JSONDecodeError, ValueError):
            return

        msg_type = data.get('type')

        if msg_type == 'chat_message':
            await self.handle_message(data)
        elif msg_type == 'typing':
            await self.handle_typing(data)
        elif msg_type == 'ping':
            await self.send(text_data=json.dumps({'type': 'pong'}))

    async def handle_message(self, data):
        text = str(data.get('text', '')).strip()
        if not text:
            return
        # Truncate to limit
        text = text[:MAX_MESSAGE_LEN]

        msg = await self.save_message(text)
        await self.channel_layer.group_send(self.room_group, {
            'type': 'ws.message',
            **msg,
        })

    async def handle_typing(self, data):
        is_typing = bool(data.get('is_typing', False))
        await self.channel_layer.group_send(self.room_group, {
            'type': 'ws.typing',
            'user_id': str(self.user.id),
            'username': self.user.username,
            'color': self.user.avatar_color,
            'is_typing': is_typing,
        })

    # ── Group message receivers ───────────────────────────────────────────────

    async def ws_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'id': event['id'],
            'text': event['text'],
            'username': event['username'],
            'user_id': event['user_id'],
            'color': event['color'],
            'timestamp': event['timestamp'],
        }))

    async def ws_typing(self, event):
        # Don't echo typing indicator back to sender
        if event['user_id'] == str(self.user.id):
            return
        await self.send(text_data=json.dumps({
            'type': 'typing',
            'user_id': event['user_id'],
            'username': event['username'],
            'color': event['color'],
            'is_typing': event['is_typing'],
        }))

    # ── Database helpers ──────────────────────────────────────────────────────

    @database_sync_to_async
    def get_room(self, code):
        from apps.rooms.models import Room
        try:
            return Room.objects.get(code=code, is_active=True)
        except Room.DoesNotExist:
            return None

    @database_sync_to_async
    def check_membership(self, room):
        from apps.rooms.models import RoomMember
        return RoomMember.objects.filter(room=room, user=self.user).exists()

    @database_sync_to_async
    def get_history(self):
        from .models import Message
        msgs = (
            Message.objects
            .filter(room_id=self.room_id)
            .select_related('user')
            .order_by('-timestamp')[:HISTORY_LIMIT]
        )
        return [
            {
                'id': str(m.id),
                'text': m.text,
                'username': m.user.username if m.user else 'deleted',
                'user_id': str(m.user.id) if m.user else None,
                'color': m.user.avatar_color if m.user else '#888888',
                'timestamp': m.timestamp.isoformat(),
            }
            for m in reversed(list(msgs))
        ]

    @database_sync_to_async
    def save_message(self, text):
        from .models import Message
        msg = Message.objects.create(
            room_id=self.room_id,
            user=self.user,
            text=text,
        )
        return {
            'id': str(msg.id),
            'text': msg.text,
            'username': self.user.username,
            'user_id': str(self.user.id),
            'color': self.user.avatar_color,
            'timestamp': msg.timestamp.isoformat(),
        }
