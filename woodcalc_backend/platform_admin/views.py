from datetime import timedelta

from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from tenants.models import Company
from feedback.models import Feedback
from .serializers import AdminCompanySerializer, AdminFeedbackSerializer


class AdminCompanyViewSet(ModelViewSet):
    queryset = Company.objects.all().order_by('-created_at')
    serializer_class = AdminCompanySerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

    @action(detail=True, methods=['post'])
    def extend_trial(self, request, pk=None):
        company = self.get_object()
        now = timezone.now()
        extend_from = max(company.trial_ends_at or now, now)
        company.trial_ends_at = extend_from + timedelta(days=30)
        company.status = Company.Status.TRIALING
        company.save(update_fields=['trial_ends_at', 'status'])
        return Response(AdminCompanySerializer(company).data)


class AdminFeedbackViewSet(ModelViewSet):
    queryset = Feedback.objects.all().order_by('-created_at')
    serializer_class = AdminFeedbackSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
