import json
import asyncio
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

logger = logging.getLogger(__name__)

VALID_TOOLS = {'pen', 'eraser', 'rect', 'circle', 'line', 'arrow', 'text'}
MAX_STROKE_POINTS = 5000
MAX_COLOR_LEN = 9
MAX_BRUSH_SIZE = 200


class WhiteboardConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for real-time whiteboard collaboration.

    Incoming message types:
      draw_stroke   - New stroke diff (never the full canvas)
      cursor_move   - Mouse/touch cursor position (throttled client-side)
      undo          - Soft-delete the user's last stroke
      redo          - Re-apply a previously undone stroke
      clear         - Clear all strokes (owner only)
      ping          - Heartbeat keepalive

    Outgoing message types:
      replay        - Full stroke history sent on connect
      draw_stroke   - Relayed to all other room members
      cursor_move   - Relayed cursor (not persisted)
      undo          - Notify all members of a stroke removal
      clear         - Notify all members canvas was cleared
      presence      - Current online user list
      error         - Validation or permission error
    """

    async def connect(self):
        self.user = self.scope.get('user')
        self.room_code = self.scope['url_route']['kwargs']['room_code']
        self.room_group = f'whiteboard_{self.room_code}'
        self.room_id = None

        if not self.user or not self.user.is_authenticated:
            await self.close(code=4001)
            return

        room = await self.get_room(self.room_code)
        if not room:
            await self.close(code=4004)
            return

        # Verify user is a member
        is_member = await self.check_membership(room)
        if not is_member:
            await self.close(code=4003)
            return

        self.room_id = str(room.id)
        self.is_owner = (str(room.owner_id) == str(self.user.id))

        await self.channel_layer.group_add(self.room_group, self.channel_name)
        await self.accept()

        # Mark online
        await self.set_online(True)

        # Send canvas replay to this user
        strokes = await self.get_strokes()
        await self.send(text_data=json.dumps({
            'type': 'replay',
            'strokes': strokes,
        }))

        # Broadcast updated presence to everyone
        await self.broadcast_presence()
        logger.info(f'User {self.user.username} joined whiteboard {self.room_code}')

    async def disconnect(self, close_code):
        if not self.room_id:
            return
        await self.set_online(False)
        await self.channel_layer.group_discard(self.room_group, self.channel_name)
        await self.broadcast_presence()
        logger.info(f'User {self.user.username} left whiteboard {self.room_code}')

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except (json.JSONDecodeError, ValueError):
            await self.send_error('Invalid JSON')
            return

        msg_type = data.get('type')
        handlers = {
            'draw_stroke': self.handle_draw,
            'cursor_move': self.handle_cursor,
            'undo':        self.handle_undo,
            'redo':        self.handle_redo,
            'clear':       self.handle_clear,
            'ping':        self.handle_ping,
        }
        handler = handlers.get(msg_type)
        if handler:
            await handler(data)
        else:
            await self.send_error(f'Unknown message type: {msg_type}')

    # ── Handlers ──────────────────────────────────────────────────────────────

    async def handle_draw(self, data):
        stroke = data.get('stroke')
        if not stroke or not self._validate_stroke(stroke):
            await self.send_error('Invalid stroke data')
            return

        # Persist in background — do not block the broadcast
        asyncio.ensure_future(self.save_stroke(stroke))

        await self.channel_layer.group_send(self.room_group, {
            'type': 'ws.stroke',
            'stroke': stroke,
            'user_id': str(self.user.id),
            'username': self.user.username,
            'color': self.user.avatar_color,
        })

    async def handle_cursor(self, data):
        x, y = data.get('x'), data.get('y')
        if x is None or y is None:
            return
        # Clamp to canvas bounds
        x = max(0, min(float(x), 10000))
        y = max(0, min(float(y), 10000))

        await self.channel_layer.group_send(self.room_group, {
            'type': 'ws.cursor',
            'x': x,
            'y': y,
            'user_id': str(self.user.id),
            'username': self.user.username,
            'color': self.user.avatar_color,
        })

    async def handle_undo(self, data):
        stroke_id = await self.soft_delete_last_stroke()
        if stroke_id:
            await self.channel_layer.group_send(self.room_group, {
                'type': 'ws.undo',
                'stroke_id': stroke_id,
                'user_id': str(self.user.id),
            })

    async def handle_redo(self, data):
        stroke = await self.restore_last_deleted_stroke()
        if stroke:
            await self.channel_layer.group_send(self.room_group, {
                'type': 'ws.redo',
                'stroke': stroke,
                'user_id': str(self.user.id),
            })

    async def handle_clear(self, data):
        if not self.is_owner:
            await self.send_error('Only the room owner can clear the board.')
            return
        await self.delete_all_strokes()
        await self.channel_layer.group_send(self.room_group, {
            'type': 'ws.clear',
            'user_id': str(self.user.id),
        })

    async def handle_ping(self, data):
        await self.send(text_data=json.dumps({'type': 'pong'}))

    # ── Group message receivers ───────────────────────────────────────────────
    # These are called by channel_layer.group_send for each connected client.

    async def ws_stroke(self, event):
        # Skip echo to sender
        if event['user_id'] == str(self.user.id):
            return
        await self.send(text_data=json.dumps({
            'type': 'draw_stroke',
            'stroke': event['stroke'],
            'user_id': event['user_id'],
            'username': event['username'],
        }))

    async def ws_cursor(self, event):
        if event['user_id'] == str(self.user.id):
            return
        await self.send(text_data=json.dumps({
            'type': 'cursor_move',
            'x': event['x'],
            'y': event['y'],
            'user_id': event['user_id'],
            'username': event['username'],
            'color': event['color'],
        }))

    async def ws_undo(self, event):
        await self.send(text_data=json.dumps({
            'type': 'undo',
            'stroke_id': event['stroke_id'],
            'user_id': event['user_id'],
        }))

    async def ws_redo(self, event):
        await self.send(text_data=json.dumps({
            'type': 'redo',
            'stroke': event['stroke'],
            'user_id': event['user_id'],
        }))

    async def ws_clear(self, event):
        await self.send(text_data=json.dumps({
            'type': 'clear',
            'user_id': event['user_id'],
        }))

    async def ws_presence(self, event):
        await self.send(text_data=json.dumps({
            'type': 'presence',
            'users': event['users'],
        }))

    # ── Presence ──────────────────────────────────────────────────────────────

    async def broadcast_presence(self):
        users = await self.get_online_users()
        await self.channel_layer.group_send(self.room_group, {
            'type': 'ws.presence',
            'users': users,
        })

    @database_sync_to_async
    def set_online(self, online: bool):
        from apps.rooms.models import RoomMember
        RoomMember.objects.filter(
            room_id=self.room_id, user=self.user
        ).update(is_online=online)

    @database_sync_to_async
    def get_online_users(self):
        from apps.rooms.models import RoomMember
        members = (
            RoomMember.objects
            .filter(room_id=self.room_id, is_online=True)
            .select_related('user')
        )
        return [
            {
                'id': str(m.user.id),
                'username': m.user.username,
                'color': m.user.avatar_color,
                'is_guest': m.user.is_guest,
            }
            for m in members
        ]

    # ── Database helpers ──────────────────────────────────────────────────────

    @database_sync_to_async
    def get_room(self, code):
        from apps.rooms.models import Room
        try:
            return Room.objects.select_related('owner').get(code=code, is_active=True)
        except Room.DoesNotExist:
            return None

    @database_sync_to_async
    def check_membership(self, room):
        from apps.rooms.models import RoomMember
        return RoomMember.objects.filter(room=room, user=self.user).exists()

    @database_sync_to_async
    def get_strokes(self):
        from .models import Stroke
        qs = Stroke.objects.filter(
            room_id=self.room_id, is_deleted=False
        ).select_related('user').order_by('seq', 'timestamp')
        return [
            {
                'id': str(s.id),
                'tool': s.tool,
                'color': s.color,
                'size': s.size,
                'points': s.points,
                'extra': s.extra,
                'seq': s.seq,
                'username': s.user.username if s.user else 'unknown',
                'user_color': s.user.avatar_color if s.user else '#888888',
            }
            for s in qs
        ]

    @database_sync_to_async
    def save_stroke(self, stroke):
        from .models import Stroke
        try:
            Stroke.objects.create(
                room_id=self.room_id,
                user=self.user,
                tool=stroke.get('tool', 'pen'),
                color=stroke.get('color', '#000000'),
                size=int(stroke.get('size', 4)),
                points=stroke.get('points', []),
                extra=stroke.get('extra', {}),
                seq=int(stroke.get('seq', 0)),
            )
        except Exception as e:
            logger.error(f'Error saving stroke: {e}')

    @database_sync_to_async
    def soft_delete_last_stroke(self):
        from .models import Stroke
        stroke = (
            Stroke.objects
            .filter(room_id=self.room_id, user=self.user, is_deleted=False)
            .order_by('-seq', '-timestamp')
            .first()
        )
        if stroke:
            stroke.is_deleted = True
            stroke.save(update_fields=['is_deleted'])
            return str(stroke.id)
        return None

    @database_sync_to_async
    def restore_last_deleted_stroke(self):
        from .models import Stroke
        stroke = (
            Stroke.objects
            .filter(room_id=self.room_id, user=self.user, is_deleted=True)
            .order_by('-seq', '-timestamp')
            .first()
        )
        if stroke:
            stroke.is_deleted = False
            stroke.save(update_fields=['is_deleted'])
            return {
                'id': str(stroke.id),
                'tool': stroke.tool,
                'color': stroke.color,
                'size': stroke.size,
                'points': stroke.points,
                'extra': stroke.extra,
                'seq': stroke.seq,
            }
        return None

    @database_sync_to_async
    def delete_all_strokes(self):
        from .models import Stroke
        Stroke.objects.filter(room_id=self.room_id).update(is_deleted=True)

    # ── Helpers ───────────────────────────────────────────────────────────────

    async def send_error(self, message):
        await self.send(text_data=json.dumps({'type': 'error', 'message': message}))

    @staticmethod
    def _validate_stroke(stroke):
        if not isinstance(stroke, dict):
            return False
        tool = stroke.get('tool')
        if tool not in VALID_TOOLS:
            return False
        color = stroke.get('color', '')
        if not isinstance(color, str) or len(color) > MAX_COLOR_LEN:
            return False
        size = stroke.get('size')
        if not isinstance(size, (int, float)) or not (1 <= size <= MAX_BRUSH_SIZE):
            return False
        points = stroke.get('points')
        if not isinstance(points, (list, dict)):
            return False
        if isinstance(points, list) and len(points) > MAX_STROKE_POINTS:
            return False
        seq = stroke.get('seq')
        if not isinstance(seq, int) or seq < 0:
            return False
        return True
