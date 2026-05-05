from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404

from .models import Room, RoomMember
from .serializers import (
    RoomSerializer, RoomCreateSerializer, RoomDetailSerializer, RoomMemberSerializer
)


class RoomListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return RoomCreateSerializer
        return RoomSerializer

    def get_queryset(self):
        user = self.request.user
        # Return rooms the user owns OR is a member of
        return Room.objects.filter(
            members__user=user, is_active=True
        ).select_related('owner').distinct().order_by('-created_at')

    def create(self, request, *args, **kwargs):
        serializer = RoomCreateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        room = serializer.save()
        # Auto-join the creator
        RoomMember.objects.create(room=room, user=request.user)
        return Response(
            RoomSerializer(room, context={'request': request}).data,
            status=status.HTTP_201_CREATED
        )


class RoomDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = RoomDetailSerializer
    lookup_field = 'code'

    def get_queryset(self):
        return Room.objects.filter(is_active=True).select_related('owner')

    def destroy(self, request, *args, **kwargs):
        room = self.get_object()
        if room.owner != request.user:
            return Response(
                {'detail': 'Only the room owner can delete this room.'},
                status=status.HTTP_403_FORBIDDEN
            )
        room.is_active = False
        room.save()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def update(self, request, *args, **kwargs):
        room = self.get_object()
        if room.owner != request.user:
            return Response(
                {'detail': 'Only the room owner can edit this room.'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().update(request, *args, **kwargs)


class JoinRoomView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        code = request.data.get('code', '').strip().upper()
        if not code:
            return Response({'detail': 'Room code is required.'}, status=status.HTTP_400_BAD_REQUEST)

        room = get_object_or_404(Room, code=code, is_active=True)
        member, created = RoomMember.objects.get_or_create(room=room, user=request.user)
        return Response(
            RoomSerializer(room, context={'request': request}).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )


class LeaveRoomView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, code):
        room = get_object_or_404(Room, code=code, is_active=True)
        if room.owner == request.user:
            return Response(
                {'detail': 'Owner cannot leave. Transfer ownership or delete the room.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        RoomMember.objects.filter(room=room, user=request.user).delete()
        return Response({'detail': 'Left room successfully.'}, status=status.HTTP_200_OK)


class RoomMembersView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = RoomMemberSerializer

    def get_queryset(self):
        code = self.kwargs['code']
        room = get_object_or_404(Room, code=code, is_active=True)
        return RoomMember.objects.filter(room=room).select_related('user')


class SaveSnapshotView(APIView):
    """Save current canvas state as a snapshot for the room."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, code):
        room = get_object_or_404(Room, code=code, is_active=True)
        # Only members can save snapshots
        if not RoomMember.objects.filter(room=room, user=request.user).exists():
            return Response({'detail': 'Not a member of this room.'}, status=status.HTTP_403_FORBIDDEN)
        snapshot = request.data.get('snapshot', [])
        if not isinstance(snapshot, list):
            return Response({'detail': 'Invalid snapshot format.'}, status=status.HTTP_400_BAD_REQUEST)
        room.snapshot = snapshot
        room.save(update_fields=['snapshot'])
        return Response({'detail': 'Snapshot saved.'})
