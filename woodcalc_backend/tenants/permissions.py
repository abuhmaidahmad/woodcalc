from rest_framework.permissions import BasePermission
from .utils import get_membership_for_user


class HasActiveCompany(BasePermission):
    message = "No active company subscription."

    def has_permission(self, request, view):
        membership = get_membership_for_user(request.user)
        if membership is None:
            return False
        request.company = membership.company
        request.membership = membership
        return membership.company.is_in_good_standing


def user_has_permission(request, code):
    """OWNER always passes (bootstrap necessity — someone must be able to grant the
    first permission). ADMIN/STAFF need the code explicitly present in their
    membership's granted permissions. Call after HasActiveCompany has run so
    request.membership is set."""
    membership = getattr(request, "membership", None)
    if membership is None:
        return False
    if membership.role == membership.Role.OWNER:
        return True
    return code in (membership.permissions or [])


def RequirePermission(code):
    """Factory returning a fresh BasePermission subclass for `code`. DRF
    instantiates each entry in permission_classes itself, so this must return a
    class, not an instance: permission_classes = [..., RequirePermission('hr.edit_salary')]."""

    class _RequirePermission(BasePermission):
        message = f"Missing permission: {code}"

        def has_permission(self, request, view):
            return user_has_permission(request, code)

    return _RequirePermission
