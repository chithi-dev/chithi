from django.contrib import admin

from .models import File


@admin.register(File)
class FileAdmin(admin.ModelAdmin):
    list_display = ("filename", "key", "size", "download_count", "expires_at", "created_at")
    list_filter = ("created_at", "expires_at")
    search_fields = ("filename", "key")
    readonly_fields = ("key", "size", "download_count", "created_at")
    ordering = ("-created_at",)
