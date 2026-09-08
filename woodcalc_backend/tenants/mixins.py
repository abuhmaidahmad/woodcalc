class TenantScopedMixin:
    def get_queryset(self):
        queryset = super().get_queryset()
        company = getattr(self.request, "company", None)
        if company is None:
            return queryset.none()
        return queryset.filter(tenant=company)

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.company)
