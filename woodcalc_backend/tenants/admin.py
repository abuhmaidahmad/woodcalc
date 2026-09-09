from django.contrib import admin
from .models import Company, CompanyMembership, CompanySettings


class CompanyMembershipInline(admin.TabularInline):
    model = CompanyMembership
    extra = 0


class CompanySettingsInline(admin.StackedInline):
    model = CompanySettings
    extra = 0


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "plan", "status", "trial_ends_at", "created_at")
    list_filter = ("plan", "status")
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}
    inlines = [CompanyMembershipInline, CompanySettingsInline]


@admin.register(CompanyMembership)
class CompanyMembershipAdmin(admin.ModelAdmin):
    list_display = ("user", "company", "role", "created_at")
    list_filter = ("role",)
    search_fields = ("user__username", "user__email", "company__name")
