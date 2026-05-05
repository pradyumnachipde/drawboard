from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    avatar_color = models.CharField(max_length=7, default='#6366f1')
    is_guest = models.BooleanField(default=False)
    bio = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'users'

    def __str__(self):
        return self.username
