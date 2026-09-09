from .models import Company, CompanyMembership


def get_company_for_user(user):
    if user is None or not user.is_authenticated:
        return None
    membership = CompanyMembership.objects.select_related("company").filter(user=user).first()
    return membership.company if membership else None


def get_company_by_slug(slug):
    if not slug:
        return None
    return Company.objects.filter(slug=slug, status__in=[Company.Status.TRIALING, Company.Status.ACTIVE]).first()
