from django.contrib import admin
from .models import Message


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ('id', 'room', 'user', 'text_preview', 'timestamp')
    search_fields = ('room__code', 'user__username', 'text')
    readonly_fields = ('id', 'timestamp')
    list_per_page = 50

    def text_preview(self, obj):
        return obj.text[:60]
    text_preview.short_description = 'Text'
