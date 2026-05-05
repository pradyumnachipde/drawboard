from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'email', 'is_guest', 'avatar_color', 'date_joined')
    list_filter = ('is_guest', 'is_staff', 'is_active')
    fieldsets = UserAdmin.fieldsets + (
        ('Profile', {'fields': ('avatar_color', 'is_guest', 'bio')}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('Profile', {'fields': ('avatar_color',)}),
    )
