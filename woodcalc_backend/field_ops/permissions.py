from rest_framework.permissions import BasePermission


class IsAssignedInstaller(BasePermission):
    message = "This job isn't assigned to you."

    def has_object_permission(self, request, view, obj):
        company = getattr(request, "company", None)
        if company is None or obj.tenant_id != company.id:
            return False
        return obj.assignments.filter(user=request.user).exists()
