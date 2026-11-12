from .models import Company, CompanyMembership, CompanySettings


def get_company_for_user(user):
    if user is None or not user.is_authenticated:
        return None
    membership = CompanyMembership.objects.select_related("company").filter(user=user).first()
    return membership.company if membership else None


def get_membership_for_user(user):
    if user is None or not user.is_authenticated:
        return None
    return CompanyMembership.objects.select_related("company").filter(user=user).first()


def get_company_by_slug(slug):
    if not slug:
        return None
    return Company.objects.filter(slug=slug, status__in=[Company.Status.TRIALING, Company.Status.ACTIVE]).first()


# Back panel defaults when a company never set them -- match formulaEngine.js.
DEFAULT_BACK_CONSTRUCTION = 'surface'
DEFAULT_BACK_PANEL_THICKNESS_MM = 8


def frozen_construction_settings(company):
    """The company's construction settings as they stand now, to save on a room
    when it's confirmed so its cut sizes stop following later changes."""
    from .views import _with_standard_materials
    flags = _with_standard_materials(company, get_company_settings(company))
    return {
        'back_construction': flags.get('back_construction') or DEFAULT_BACK_CONSTRUCTION,
        'back_panel_thickness_mm': flags.get('back_panel_thickness_mm') or DEFAULT_BACK_PANEL_THICKNESS_MM,
        'back_panel_material_sku': flags.get('back_panel_material_sku') or None,
    }


def get_company_settings(company):
    if company is None:
        return {}
    settings, _ = CompanySettings.objects.get_or_create(company=company)
    return settings.flags
