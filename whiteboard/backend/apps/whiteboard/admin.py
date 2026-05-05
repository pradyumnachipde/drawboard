from django.contrib import admin
from .models import Stroke


@admin.register(Stroke)
class StrokeAdmin(admin.ModelAdmin):
    list_display = ('id', 'room', 'user', 'tool', 'color', 'seq', 'is_deleted', 'timestamp')
    list_filter = ('tool', 'is_deleted')
    search_fields = ('room__code', 'user__username')
    readonly_fields = ('id', 'timestamp')
    list_per_page = 50
