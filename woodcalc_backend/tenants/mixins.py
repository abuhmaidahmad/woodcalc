class TenantScopedMixin:
    tenant_filter_field = 'tenant'

    def get_queryset(self):
        queryset = super().get_queryset()
        company = getattr(self.request, "company", None)
        if company is None:
            return queryset.none()
        return queryset.filter(**{self.tenant_filter_field: company})

    def perform_create(self, serializer):
        if self.tenant_filter_field == 'tenant':
            serializer.save(tenant=self.request.company)
        else:
            serializer.save()
