import uuid
from django.db import models
from django.conf import settings


class Stroke(models.Model):
    """
    Stores individual stroke events per room.
    Used for canvas replay on join, undo/redo, and drawing history.
    """
    TOOL_CHOICES = [
        ('pen', 'Pen'),
        ('eraser', 'Eraser'),
        ('rect', 'Rectangle'),
        ('circle', 'Circle'),
        ('line', 'Line'),
        ('arrow', 'Arrow'),
        ('text', 'Text'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    room = models.ForeignKey(
        'rooms.Room', on_delete=models.CASCADE, related_name='strokes'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='strokes'
    )
    tool = models.CharField(max_length=20, choices=TOOL_CHOICES, default='pen')
    color = models.CharField(max_length=9, default='#000000')
    size = models.PositiveSmallIntegerField(default=4)
    points = models.JSONField()         # [{x, y}, ...] for pen/eraser; {x1,y1,x2,y2} for shapes
    extra = models.JSONField(default=dict, blank=True)  # text content, arrow options, etc.
    timestamp = models.DateTimeField(auto_now_add=True)
    seq = models.PositiveBigIntegerField(default=0)     # client-side sequence for ordering
    is_deleted = models.BooleanField(default=False)     # soft-delete for undo

    class Meta:
        db_table = 'strokes'
        ordering = ['seq', 'timestamp']
        indexes = [
            models.Index(fields=['room', 'seq']),
            models.Index(fields=['room', 'is_deleted']),
            models.Index(fields=['room', 'user', 'seq']),
        ]

    def __str__(self):
        return f'{self.tool} stroke in room {self.room.code} seq={self.seq}'
