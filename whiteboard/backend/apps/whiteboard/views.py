from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from apps.rooms.models import Room, RoomMember
from .models import Stroke


class StrokeHistoryView(APIView):
    """Return all non-deleted strokes for a room (for replay/export)."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, code):
        room = get_object_or_404(Room, code=code, is_active=True)
        if not RoomMember.objects.filter(room=room, user=request.user).exists():
            return Response({'detail': 'Not a member of this room.'}, status=403)

        strokes = Stroke.objects.filter(
            room=room, is_deleted=False
        ).select_related('user').order_by('seq', 'timestamp')

        data = [
            {
                'id': str(s.id),
                'tool': s.tool,
                'color': s.color,
                'size': s.size,
                'points': s.points,
                'extra': s.extra,
                'seq': s.seq,
                'timestamp': s.timestamp.isoformat(),
                'username': s.user.username if s.user else 'unknown',
            }
            for s in strokes
        ]
        return Response({'strokes': data, 'count': len(data)})
