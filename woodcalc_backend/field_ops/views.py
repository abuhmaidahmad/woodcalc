from django.db.models import F
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet

from crm.models import Room
from tenants.mixins import TenantScopedMixin
from tenants.models import FIELD_WORKER_ROLES, CompanyMembership
from tenants.permissions import CanManageFieldOps, HasActiveCompany, HasActiveCompanyForFieldManager

from .models import Installation, InstallationAssignment
from .permissions import IsAssignedInstaller
from .serializers import (AssignmentSerializer, CrewMemberSerializer, InstallationSerializer,
                          InstallerJobListSerializer, InstallerJobSerializer, LockedRoomSerializer)

MANAGER_PERMISSIONS = [IsAuthenticated, HasActiveCompanyForFieldManager, CanManageFieldOps]
INSTALLATION_RELATED = ("project__client",)


def ordered(queryset):
    return queryset.order_by(F("scheduled_date").asc(nulls_last=True), "id")


def managed_installations(request):
    company = request.company
    return Installation.objects.filter(tenant=company).for_manager(request.user)


class InstallationViewSet(TenantScopedMixin, ModelViewSet):
    queryset = Installation.objects.select_related(*INSTALLATION_RELATED).prefetch_related(
        "assignments__user__company_membership")
    serializer_class = InstallationSerializer
    permission_classes = MANAGER_PERMISSIONS

    def get_queryset(self):
        queryset = super().get_queryset().for_manager(self.request.user)
        params = self.request.query_params
        if params.get("status"):
            queryset = queryset.filter(status=params["status"])
        if params.get("project"):
            queryset = queryset.filter(project_id=params["project"])
        if params.get("installer"):
            queryset = queryset.filter(assignments__user_id=params["installer"])
        if params.get("date_from"):
            queryset = queryset.filter(scheduled_date__gte=params["date_from"])
        if params.get("date_to"):
            queryset = queryset.filter(scheduled_date__lte=params["date_to"])
        return ordered(queryset.distinct())


class AssignmentViewSet(TenantScopedMixin, ModelViewSet):
    tenant_filter_field = "installation__tenant"
    queryset = InstallationAssignment.objects.select_related("user__company_membership", "installation")
    serializer_class = AssignmentSerializer
    permission_classes = MANAGER_PERMISSIONS

    def get_queryset(self):
        queryset = super().get_queryset().filter(installation__in=managed_installations(self.request))
        if self.request.query_params.get("installation"):
            queryset = queryset.filter(installation_id=self.request.query_params["installation"])
        return queryset.order_by("installation_id", "-is_lead", "id")


class LockedRoomViewSet(TenantScopedMixin, ReadOnlyModelViewSet):
    tenant_filter_field = "project__client__tenant"
    queryset = Room.objects.select_related("project__client").filter(
        is_locked=True, revision_status=Room.RevisionStatus.APPROVED).order_by("-locked_at", "-id")
    serializer_class = LockedRoomSerializer
    permission_classes = MANAGER_PERMISSIONS

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.request.query_params.get("project"):
            queryset = queryset.filter(project_id=self.request.query_params["project"])
        return queryset


class CrewViewSet(TenantScopedMixin, ReadOnlyModelViewSet):
    tenant_filter_field = "company"
    queryset = CompanyMembership.objects.select_related("user").filter(
        role__in=FIELD_WORKER_ROLES, user__is_active=True).order_by("user__first_name", "id")
    serializer_class = CrewMemberSerializer
    permission_classes = MANAGER_PERMISSIONS
    pagination_class = None


class MyJobsViewSet(TenantScopedMixin, ReadOnlyModelViewSet):
    queryset = Installation.objects.select_related(*INSTALLATION_RELATED).prefetch_related("assignments__user")
    permission_classes = [IsAuthenticated, HasActiveCompany, IsAssignedInstaller]
    field_roles_allowed = (CompanyMembership.Role.INSTALLER,)

    def get_queryset(self):
        return ordered(super().get_queryset().for_assignee(self.request.user))

    def get_serializer_class(self):
        return InstallerJobListSerializer if self.action == "list" else InstallerJobSerializer
