from django.contrib import admin
from .models import Room, RoomMember


class RoomMemberInline(admin.TabularInline):
    model = RoomMember
    extra = 0
    readonly_fields = ('joined_at', 'last_seen')


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'owner', 'is_active', 'is_public', 'online_count', 'created_at')
    list_filter = ('is_active', 'is_public')
    search_fields = ('name', 'code', 'owner__username')
    readonly_fields = ('id', 'code', 'created_at', 'updated_at')
    inlines = [RoomMemberInline]


@admin.register(RoomMember)
class RoomMemberAdmin(admin.ModelAdmin):
    list_display = ('user', 'room', 'is_online', 'joined_at')
    list_filter = ('is_online',)
    search_fields = ('user__username', 'room__code')
