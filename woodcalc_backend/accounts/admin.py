from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils import timezone
from .models import User, ArchitectProfile, ManufacturerProfile, SupplierProfile


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ['email', 'first_name', 'last_name', 'user_type', 'is_verified', 'date_joined']
    list_filter = ['user_type', 'is_verified']
    search_fields = ['email', 'first_name', 'last_name']
    fieldsets = BaseUserAdmin.fieldsets + (
        ('WoodCalc Info', {'fields': ('phone', 'city', 'user_type', 'is_verified')}),
    )


@admin.register(ManufacturerProfile)
class ManufacturerProfileAdmin(admin.ModelAdmin):
    list_display = ['factory_company_name', 'user', 'verification_status', 'submitted_at']
    list_filter = ['verification_status']
    actions = ['approve', 'reject']

    def approve(self, request, queryset):
        for profile in queryset:
            profile.verification_status = 'approved'
            profile.reviewed_at = timezone.now()
            profile.save()
            profile.user.is_verified = True
            profile.user.save()
        self.message_user(request, f"{queryset.count()} manufacturer(s) approved.")
    approve.short_description = "Approve selected manufacturers"

    def reject(self, request, queryset):
        for profile in queryset:
            profile.verification_status = 'rejected'
            profile.reviewed_at = timezone.now()
            profile.save()
        self.message_user(request, f"{queryset.count()} manufacturer(s) rejected.")
    reject.short_description = "Reject selected manufacturers"


@admin.register(SupplierProfile)
class SupplierProfileAdmin(admin.ModelAdmin):
    list_display = ['company_name', 'user', 'verification_status', 'submitted_at']
    list_filter = ['verification_status']
    actions = ['approve', 'reject']

    def approve(self, request, queryset):
        for profile in queryset:
            profile.verification_status = 'approved'
            profile.reviewed_at = timezone.now()
            profile.save()
            profile.user.is_verified = True
            profile.user.save()
        self.message_user(request, f"{queryset.count()} supplier(s) approved.")
    approve.short_description = "Approve selected suppliers"

    def reject(self, request, queryset):
        for profile in queryset:
            profile.verification_status = 'rejected'
            profile.reviewed_at = timezone.now()
            profile.save()
        self.message_user(request, f"{queryset.count()} supplier(s) rejected.")
    reject.short_description = "Reject selected suppliers"


@admin.register(ArchitectProfile)
class ArchitectProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'company_studio_name', 'specialization', 'years_of_experience']
