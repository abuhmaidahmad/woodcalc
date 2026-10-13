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


# HDF back panel thicknesses (mm) the cut list formula supports without a stock
# material -- matches BACK_PANEL_THICKNESS_OPTIONS in the frontend's formulaEngine.js.
BACK_PANEL_THICKNESS_OPTIONS = (3, 4, 5, 6, 8)


def _back_panel_material(company, sku):
    from inventory.models import Material
    return Material.objects.filter(tenant=company, sku=sku).first()


def _with_back_panel_material(company, flags):
    """The back panel's thickness follows its stock material, so a board
    thickness edited in the Materials Catalog reaches every cut list."""
    sku = flags.get('back_panel_material_sku')
    if not sku:
        return flags
    mat = _back_panel_material(company, sku)
    if mat is None:
        return {k: v for k, v in flags.items() if k != 'back_panel_material_sku'}
    if mat.board_thickness:
        flags = {**flags, 'back_panel_thickness_mm': mat.board_thickness}
    return flags


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated, HasActiveCompany])
def company_settings(request):
    if request.method == 'PATCH':
        patch = dict(request.data)
        if patch.get('back_panel_material_sku'):
            mat = _back_panel_material(request.company, patch['back_panel_material_sku'])
            if mat is None:
                return Response({'back_panel_material_sku': ['Material not found.']}, status=status.HTTP_400_BAD_REQUEST)
            if not mat.board_thickness:
                return Response(
                    {'back_panel_material_sku': [f'{mat.sku} has no board thickness set -- add it in the Materials Catalog.']},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            patch['back_panel_thickness_mm'] = mat.board_thickness
        elif 'back_panel_material_sku' in patch or 'back_panel_thickness_mm' in patch:
            # No stock material: a plain HDF thickness, priced at the generic rate.
            patch['back_panel_material_sku'] = None
            if 'back_panel_thickness_mm' in patch:
                try:
                    mm = float(patch['back_panel_thickness_mm'])
                except (TypeError, ValueError):
                    mm = None
                if mm not in BACK_PANEL_THICKNESS_OPTIONS:
                    return Response(
                        {'back_panel_thickness_mm': [f'Must be one of {list(BACK_PANEL_THICKNESS_OPTIONS)} mm.']},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                patch['back_panel_thickness_mm'] = int(mm)
        settings, _ = CompanySettings.objects.get_or_create(company=request.company)
        settings.flags = {**settings.flags, **patch}
        settings.save(update_fields=['flags', 'updated_at'])
        return Response(_with_back_panel_material(request.company, settings.flags))
    return Response(_with_back_panel_material(request.company, get_company_settings(request.company)))


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
