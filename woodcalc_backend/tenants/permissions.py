from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission, SAFE_METHODS
from .models import FIELD_ROLES, CompanyMembership
from .utils import get_company_for_user, get_membership_for_user

# Prefix the frontend's authFetch keys on to tell "read-only account" apart from
# "trial expired" — only the latter should raise the billing banner.
READ_ONLY_MESSAGE = "Read-only access: auditors can view but not change data."
FIELD_ROLE_MESSAGE = "Field accounts can only use the field operations screens."
FIELD_OPS_MANAGE = "field_ops.manage"


def deny_auditor_writes(request, view):
    """AUDITOR members can read everything their company can, but never write.
    A view opts a harmless write back in with `allow_auditor_writes = True`
    (e.g. sending product feedback), or lists POST actions that only compute
    and return data in `auditor_safe_actions`."""
    if request.method in SAFE_METHODS or getattr(view, "allow_auditor_writes", False):
        return
    if getattr(view, "action", None) in getattr(view, "auditor_safe_actions", ()):
        return
    membership = getattr(request, "membership", None) or get_membership_for_user(request.user)
    if membership is not None and membership.role == membership.Role.AUDITOR:
        raise PermissionDenied(READ_ONLY_MESSAGE)


def deny_field_roles(request, view, allowed=()):
    membership = getattr(request, "membership", None) or get_membership_for_user(request.user)
    if membership is None or membership.role not in FIELD_ROLES:
        return
    allowed = tuple(allowed) + tuple(getattr(view, "field_roles_allowed", ()))
    if membership.role not in allowed:
        raise PermissionDenied(FIELD_ROLE_MESSAGE)


def can_manage_field_ops(user, company):
    if user is None or not user.is_authenticated or company is None:
        return False
    membership = CompanyMembership.objects.filter(user=user, company=company).first()
    if membership is None:
        return False
    Role = CompanyMembership.Role
    if membership.role in (Role.OWNER, Role.ADMIN, Role.FIELD_MANAGER):
        return True
    return membership.role == Role.STAFF and FIELD_OPS_MANAGE in (membership.permissions or [])


class CanManageFieldOps(BasePermission):
    message = "You don't have permission to manage installations."

    def has_permission(self, request, view):
        company = getattr(request, "company", None) or get_company_for_user(request.user)
        return can_manage_field_ops(request.user, company)


class HasActiveCompany(BasePermission):
    message = "No active company subscription."
    field_roles_allowed = ()

    def has_permission(self, request, view):
        membership = get_membership_for_user(request.user)
        if membership is None:
            return False
        request.company = membership.company
        request.membership = membership
        if not membership.company.is_in_good_standing:
            return False
        deny_auditor_writes(request, view)
        deny_field_roles(request, view, self.field_roles_allowed)
        return True


class HasActiveCompanyForFieldManager(HasActiveCompany):
    field_roles_allowed = (CompanyMembership.Role.FIELD_MANAGER,)


class BlocksAuditorWrites(BasePermission):
    """For views that don't run HasActiveCompany (public-catalog viewsets using
    IsAuthenticatedOrReadOnly, billing checkout) but must still be read-only
    for auditors."""

    def has_permission(self, request, view):
        deny_auditor_writes(request, view)
        if request.method not in SAFE_METHODS:
            deny_field_roles(request, view)
        return True


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
    if membership.role in FIELD_ROLES:
        return False
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
