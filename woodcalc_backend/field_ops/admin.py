from django.contrib import admin

from .models import Installation, InstallationAssignment


class InstallationAssignmentInline(admin.TabularInline):
    model = InstallationAssignment
    extra = 0


@admin.register(Installation)
class InstallationAdmin(admin.ModelAdmin):
    list_display = ("id", "tenant", "project", "status", "scheduled_date")
    list_filter = ("status",)
    inlines = [InstallationAssignmentInline]
