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
