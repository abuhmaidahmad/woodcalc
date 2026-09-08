from .models import CompanyMembership


def get_company_for_user(user):
    if user is None or not user.is_authenticated:
        return None
    membership = CompanyMembership.objects.select_related("company").filter(user=user).first()
    return membership.company if membership else None
