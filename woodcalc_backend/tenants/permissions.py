from rest_framework.permissions import BasePermission
from .utils import get_company_for_user


class HasActiveCompany(BasePermission):
    message = "No active company subscription."

    def has_permission(self, request, view):
        company = get_company_for_user(request.user)
        if company is None:
            return False
        request.company = company
        return company.is_in_good_standing
