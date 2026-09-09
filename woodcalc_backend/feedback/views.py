from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated
from tenants.mixins import TenantScopedMixin
from tenants.permissions import HasActiveCompany
from tenants.utils import get_company_for_user
from .models import Feedback
from .serializers import FeedbackSerializer


class FeedbackViewSet(TenantScopedMixin, ModelViewSet):
    queryset = Feedback.objects.all().order_by('-created_at')
    serializer_class = FeedbackSerializer
    permission_classes = [IsAuthenticated, HasActiveCompany]

    def perform_create(self, serializer):
        company = getattr(self.request, "company", None) or get_company_for_user(self.request.user)
        serializer.save(tenant=company, user=self.request.user)
