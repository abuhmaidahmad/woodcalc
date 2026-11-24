import uuid
from io import BytesIO

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from PIL import Image, ImageOps, UnidentifiedImageError
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from .mixins import TenantScopedMixin
from .models import FIELD_WORKER_ROLES, CompanyMembership, CompanySettings
from .permissions import (HasActiveCompany, HasActiveCompanyForFieldManager, can_manage_field_ops,
                          user_has_permission)
from .utils import get_membership_for_user
from .permissions_registry import PERMISSIONS
from .serializers import ASSIGNABLE_ROLES, MembershipSerializer, MembershipCreateSerializer


# HDF back panel thicknesses (mm) the cut list formula supports without a stock
# material -- matches BACK_PANEL_THICKNESS_OPTIONS in the frontend's formulaEngine.js.
BACK_PANEL_THICKNESS_OPTIONS = (3, 4, 5, 6, 8)

# How the back panel is fixed -- matches BACK_CONSTRUCTIONS in formulaEngine.js.
# 'surface' (the default when unset) keeps the original cut sizes; 'groove' sets
# the back in a groove in the sides, top and bottom.
BACK_CONSTRUCTIONS = ('surface', 'groove')


# Company standards backed by a stock material: `<prefix>_material_sku` picks the
# material and `<prefix>_thickness_mm` mirrors its board thickness, so the cut
# list follows a thickness edited in the Materials Catalog.
# drawer_box is the board drawer box sides/fronts/backs are cut from,
# drawer_bottom the drawer bottoms' (usually HDF).
MATERIAL_STANDARDS = ('back_panel', 'glass_shelf', 'glass_door', 'drawer_box', 'drawer_bottom')
# The aluminium glass door is bought by its outer size, so it has no thickness.
THICKNESS_STANDARDS = ('back_panel', 'glass_shelf', 'drawer_box', 'drawer_bottom')
# Standards whose thickness can't be set on its own, only through the material.
MATERIAL_ONLY_THICKNESS = ('glass_shelf', 'drawer_box', 'drawer_bottom')


def _material(company, sku):
    from inventory.models import Material
    return Material.objects.filter(tenant=company, sku=sku).first()


def _with_standard_materials(company, flags):
    for prefix in MATERIAL_STANDARDS:
        sku = flags.get(f'{prefix}_material_sku')
        if not sku:
            continue
        mat = _material(company, sku)
        if mat is None:
            flags = {k: v for k, v in flags.items() if k != f'{prefix}_material_sku'}
        elif mat.board_thickness and prefix in THICKNESS_STANDARDS:
            flags = {**flags, f'{prefix}_thickness_mm': mat.board_thickness}
    return flags


SETTINGS_ADMIN_ROLES = (CompanyMembership.Role.OWNER, CompanyMembership.Role.ADMIN)

# Proposal production pricing: cutting & edge banding per board (by board size,
# with a per-m² rate for any other size), assembly per cabinet with a multiplier
# per cabinet category, and an overhead % before margin. The frontend's
# productionPricing.js holds the defaults used for anything not saved here.
ASSEMBLY_CATEGORIES = ('base', 'wall', 'tall', 'drawer')
PRODUCTION_PRICING_NUMBERS = ('fallback_rate_m2', 'waste_pct', 'assembly_cab', 'overhead_pct')


def _non_negative(value, field):
    try:
        number = float(value)
    except (TypeError, ValueError):
        raise ValueError(f'{field} must be a number.')
    if number != number or number < 0 or number in (float('inf'), float('-inf')):
        raise ValueError(f'{field} must be zero or more.')
    return number


def _clean_production_pricing(value):
    """The production_pricing settings with only known, non-negative numbers."""
    if not isinstance(value, dict):
        raise ValueError('Must be an object.')
    clean = {}
    for key in PRODUCTION_PRICING_NUMBERS:
        if key in value:
            clean[key] = _non_negative(value[key], key)
    if clean.get('waste_pct', 0) > 100:
        raise ValueError('waste_pct must be 100 or less.')
    if 'board_rates' in value:
        if not isinstance(value['board_rates'], list) or len(value['board_rates']) > 50:
            raise ValueError('board_rates must be a list of up to 50 board sizes.')
        clean['board_rates'] = []
        for row in value['board_rates']:
            if not isinstance(row, dict):
                raise ValueError('Each board rate needs width, height and rate.')
            clean['board_rates'].append({f: _non_negative(row.get(f), f'board_rates.{f}')
                                         for f in ('width', 'height', 'rate')})
    if 'category_multipliers' in value:
        multipliers = value['category_multipliers']
        if not isinstance(multipliers, dict):
            raise ValueError('category_multipliers must be an object.')
        clean['category_multipliers'] = {
            c: _non_negative(multipliers[c], f'category_multipliers.{c}')
            for c in ASSEMBLY_CATEGORIES if c in multipliers
        }
    return clean


COMPANY_PROFILE_FIELDS = {'name': 255, 'address': 300, 'phone': 50, 'email': 254, 'tax_number': 50}
LOGO_MAX_BYTES = 5 * 1024 * 1024
LOGO_MAX_SIDE = 800


def _require_settings_admin(request, what):
    membership = getattr(request, 'membership', None) or get_membership_for_user(request.user)
    if membership is None or membership.role not in SETTINGS_ADMIN_ROLES:
        raise PermissionDenied(f"You don't have permission to change the company {what}. Ask the owner or an admin.")


def _clean_company_profile(value):
    if not isinstance(value, dict):
        raise ValueError('company_profile must be an object.')
    clean = {}
    for field, max_len in COMPANY_PROFILE_FIELDS.items():
        if field not in value:
            continue
        text = '' if value[field] is None else str(value[field]).strip()
        if len(text) > max_len:
            raise ValueError(f'{field} must be at most {max_len} characters.')
        clean[field] = text
    return clean


def _company_profile(company, flags):
    profile = {field: '' for field in COMPANY_PROFILE_FIELDS}
    profile.update(flags.get('company_profile') or {})
    if not profile['name']:
        profile['name'] = company.name
    return profile


def _logo_url(request, company):
    return request.build_absolute_uri(company.logo.url) if company.logo else None


def _settings_payload(company, settings, request=None):
    payload = {**_with_standard_materials(company, settings.flags), 'delivery_method': settings.delivery_method}
    payload['company_profile'] = _company_profile(company, settings.flags)
    payload['logo_url'] = _logo_url(request, company) if request is not None else None
    return payload


def _apply_delivery_method(request, settings, value):
    if request.membership.role not in SETTINGS_ADMIN_ROLES:
        raise PermissionDenied("Only the owner or an admin can change the delivery method.")
    if value not in CompanySettings.DeliveryMethod.values:
        return Response({'delivery_method': [f'Must be one of {CompanySettings.DeliveryMethod.values}.']},
                        status=status.HTTP_400_BAD_REQUEST)
    settings.delivery_method = value
    return None


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated, HasActiveCompany])
def company_settings(request):
    settings, _ = CompanySettings.objects.get_or_create(company=request.company)
    if request.method == 'PATCH':
        patch = dict(request.data)
        if 'delivery_method' in patch:
            error = _apply_delivery_method(request, settings, patch.pop('delivery_method'))
            if error is not None:
                return error
        # Glass shelf and drawer board thicknesses only ever come from their stock material.
        for prefix in MATERIAL_ONLY_THICKNESS:
            patch.pop(f'{prefix}_thickness_mm', None)
        for prefix in MATERIAL_STANDARDS:
            key = f'{prefix}_material_sku'
            if patch.get(key):
                mat = _material(request.company, patch[key])
                if mat is None:
                    return Response({key: ['Material not found.']}, status=status.HTTP_400_BAD_REQUEST)
                if prefix not in THICKNESS_STANDARDS:
                    continue
                if not mat.board_thickness:
                    return Response(
                        {key: [f'{mat.sku} has no thickness set -- add it in the Materials Catalog.']},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                patch[f'{prefix}_thickness_mm'] = mat.board_thickness
            elif key in patch:
                patch[key] = None
                if prefix in MATERIAL_ONLY_THICKNESS:
                    patch[f'{prefix}_thickness_mm'] = None
        if not patch.get('back_panel_material_sku') and (
                'back_panel_material_sku' in patch or 'back_panel_thickness_mm' in patch):
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
        if 'company_profile' in patch:
            _require_settings_admin(request, 'profile')
            try:
                patch['company_profile'] = {**(settings.flags.get('company_profile') or {}),
                                            **_clean_company_profile(patch['company_profile'])}
            except ValueError as e:
                return Response({'company_profile': [str(e)]}, status=status.HTTP_400_BAD_REQUEST)
        if 'production_pricing' in patch:
            try:
                patch['production_pricing'] = _clean_production_pricing(patch['production_pricing'])
            except ValueError as e:
                return Response({'production_pricing': [str(e)]}, status=status.HTTP_400_BAD_REQUEST)
        if 'back_construction' in patch and patch['back_construction'] not in BACK_CONSTRUCTIONS:
            return Response(
                {'back_construction': [f'Must be one of {list(BACK_CONSTRUCTIONS)}.']},
                status=status.HTTP_400_BAD_REQUEST,
            )
        settings.flags = {**settings.flags, **patch}
        settings.save(update_fields=['flags', 'delivery_method', 'updated_at'])
    return Response(_settings_payload(request.company, settings, request))


@api_view(['POST', 'DELETE'])
@permission_classes([IsAuthenticated, HasActiveCompany])
@parser_classes([MultiPartParser, FormParser])
def company_logo(request):
    _require_settings_admin(request, 'logo')
    company = request.company
    old_name = company.logo.name if company.logo else None
    if request.method == 'DELETE':
        company.logo = None
        company.save(update_fields=['logo', 'updated_at'])
        if old_name:
            default_storage.delete(old_name)
        return Response({'logo_url': None})

    upload = request.FILES.get('logo')
    if upload is None:
        return Response({'logo': ['Choose an image file to upload.']}, status=status.HTTP_400_BAD_REQUEST)
    if upload.size > LOGO_MAX_BYTES:
        return Response({'logo': ['The logo must be smaller than 5 MB.']}, status=status.HTTP_400_BAD_REQUEST)
    try:
        img = Image.open(upload)
        img.load()
    except (UnidentifiedImageError, OSError, ValueError):
        return Response({'logo': ['Upload a PNG, JPG or WEBP image.']}, status=status.HTTP_400_BAD_REQUEST)

    img = ImageOps.exif_transpose(img)
    has_alpha = 'A' in img.getbands() or img.mode == 'P'
    img = img.convert('RGBA' if has_alpha else 'RGB')
    img.thumbnail((LOGO_MAX_SIDE, LOGO_MAX_SIDE), Image.LANCZOS)
    buffer = BytesIO()
    img.save(buffer, format='PNG', optimize=True)

    company.logo.save(f'{company.slug}-{uuid.uuid4().hex[:8]}.png', ContentFile(buffer.getvalue()), save=False)
    company.save(update_fields=['logo', 'updated_at'])
    if old_name and old_name != company.logo.name:
        default_storage.delete(old_name)
    return Response({'logo_url': _logo_url(request, company)})


@api_view(['GET'])
@permission_classes([IsAuthenticated, HasActiveCompanyForFieldManager])
def permissions_registry(request):
    return Response(PERMISSIONS)


def manages_full_team(request):
    return user_has_permission(request, 'team.manage_members')


class CanManageTeam(BasePermission):
    message = "Missing permission: team.manage_members"

    def has_permission(self, request, view):
        return manages_full_team(request) or can_manage_field_ops(request.user, request.company)


class MembershipViewSet(TenantScopedMixin, ModelViewSet):
    tenant_filter_field = 'company'
    queryset = CompanyMembership.objects.select_related('user', 'company').order_by('created_at')
    serializer_class = MembershipSerializer
    permission_classes = [IsAuthenticated, HasActiveCompanyForFieldManager, CanManageTeam]

    def allowed_roles(self):
        return ASSIGNABLE_ROLES if manages_full_team(self.request) else list(FIELD_WORKER_ROLES)

    def get_queryset(self):
        queryset = super().get_queryset()
        if manages_full_team(self.request):
            return queryset
        return queryset.filter(role__in=FIELD_WORKER_ROLES)

    def get_serializer_context(self):
        return {**super().get_serializer_context(), 'allowed_roles': self.allowed_roles()}

    def create(self, request, *args, **kwargs):
        company = request.company
        active_count = company.memberships.filter(user__is_active=True).count()
        if active_count >= company.max_users:
            return Response(
                {'detail': f'Seat limit reached ({active_count}/{company.max_users}).'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = MembershipCreateSerializer(
            data=request.data, context={'company': company, 'allowed_roles': self.allowed_roles()})
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
