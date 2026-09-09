from django.contrib import admin
from .models import Feedback


@admin.register(Feedback)
class FeedbackAdmin(admin.ModelAdmin):
    list_display = ("tenant", "user", "page", "status", "created_at")
    list_filter = ("status", "tenant")
    search_fields = ("message", "page")
