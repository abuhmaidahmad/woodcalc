from rest_framework.permissions import BasePermission


class HasActiveCompany(BasePermission):
    message = "No active company subscription."

    def has_permission(self, request, view):
        company = getattr(request, "company", None)
        if company is None:
            return False
        return company.is_in_good_standing
