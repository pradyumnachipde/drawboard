from django.urls import path
from .views import (
    RoomListCreateView, RoomDetailView, JoinRoomView,
    LeaveRoomView, RoomMembersView, SaveSnapshotView
)

urlpatterns = [
    path('', RoomListCreateView.as_view(), name='room_list_create'),
    path('join/', JoinRoomView.as_view(), name='room_join'),
    path('<str:code>/', RoomDetailView.as_view(), name='room_detail'),
    path('<str:code>/leave/', LeaveRoomView.as_view(), name='room_leave'),
    path('<str:code>/members/', RoomMembersView.as_view(), name='room_members'),
    path('<str:code>/snapshot/', SaveSnapshotView.as_view(), name='room_snapshot'),
]
