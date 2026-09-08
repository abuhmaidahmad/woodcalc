from .utils import get_company_for_user


class TenantScopedMixin:
    tenant_filter_field = "tenant"

    def get_queryset(self):
        queryset = super().get_queryset()
        company = getattr(self.request, "company", None) or get_company_for_user(self.request.user)
        if company is None:
            return queryset.none()
        return queryset.filter(**{self.tenant_filter_field: company})

    def perform_create(self, serializer):
        company = getattr(self.request, "company", None) or get_company_for_user(self.request.user)
        if self.tenant_filter_field == "tenant":
            serializer.save(tenant=company)
        else:
            serializer.save()


class PublicOrTenantScopedMixin(TenantScopedMixin):
    """Like TenantScopedMixin, but for safe (GET) requests with no logged-in
    company, falls back to a ?company=<slug> query param so anonymous
    customers can browse one manufacturer's public catalog without an account.
    Writes (create/update/delete) always require a real authenticated company."""

    def get_queryset(self):
        queryset = super(TenantScopedMixin, self).get_queryset()
        company = getattr(self.request, "company", None) or get_company_for_user(self.request.user)
        if company is None and self.request.method in ("GET", "HEAD", "OPTIONS"):
            from .models import Company
            slug = self.request.query_params.get("company")
            if not slug:
                return queryset.none()
            company = Company.objects.filter(slug=slug, status__in=[Company.Status.TRIALING, Company.Status.ACTIVE]).first()
        if company is None:
            return queryset.none()
        return queryset.filter(**{self.tenant_filter_field: company})
