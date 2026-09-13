from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from .mixins import TenantScopedMixin
from .models import CompanyMembership, CompanySettings
from .permissions import HasActiveCompany, RequirePermission
from .permissions_registry import PERMISSIONS
from .serializers import MembershipSerializer, MembershipCreateSerializer
from .utils import get_company_settings


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated, HasActiveCompany])
def company_settings(request):
    if request.method == 'PATCH':
        settings, _ = CompanySettings.objects.get_or_create(company=request.company)
        settings.flags = {**settings.flags, **request.data}
        settings.save(update_fields=['flags', 'updated_at'])
        return Response(settings.flags)
    return Response(get_company_settings(request.company))


@api_view(['GET'])
@permission_classes([IsAuthenticated, HasActiveCompany])
def permissions_registry(request):
    return Response(PERMISSIONS)


class MembershipViewSet(TenantScopedMixin, ModelViewSet):
    tenant_filter_field = 'company'
    queryset = CompanyMembership.objects.select_related('user', 'company').order_by('created_at')
    serializer_class = MembershipSerializer
    permission_classes = [IsAuthenticated, HasActiveCompany, RequirePermission('team.manage_members')]

    def create(self, request, *args, **kwargs):
        company = request.company
        active_count = company.memberships.filter(user__is_active=True).count()
        if active_count >= company.max_users:
            return Response(
                {'detail': f'Seat limit reached ({active_count}/{company.max_users}).'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = MembershipCreateSerializer(data=request.data, context={'company': company})
        serializer.is_valid(raise_exception=True)
        membership = serializer.save()
        return Response(MembershipSerializer(membership).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.role == CompanyMembership.Role.OWNER:
            return Response({'detail': 'Cannot modify the owner membership.'}, status=status.HTTP_400_BAD_REQUEST)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.role == CompanyMembership.Role.OWNER:
            return Response({'detail': 'Cannot remove the owner.'}, status=status.HTTP_400_BAD_REQUEST)
        user = instance.user
        user.is_active = False
        user.save(update_fields=['is_active'])
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
