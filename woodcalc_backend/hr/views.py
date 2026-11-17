from django.db.models import ProtectedError
from django.http import FileResponse
from rest_framework.decorators import action
from rest_framework.generics import RetrieveUpdateAPIView
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet
from tenants.mixins import TenantScopedMixin
from tenants.models import CompanyMembership
from tenants.permissions import HasActiveCompany, RequirePermission, user_has_permission
from .models import (
    AllowanceType, Attendance, Department, Employee, EmployeeAllowance, EmployeeDocument, LeaveRequest,
    Payroll, PayrollSettings,
)
from .serializers import (
    AllowanceTypeSerializer, AttendanceSerializer, DepartmentSerializer, EmployeeAllowanceSerializer,
    EmployeeDocumentSerializer, EmployeeSerializer, LeaveRequestSerializer, PayrollSerializer,
    PayrollSettingsSerializer,
)

READ_METHODS = ('GET', 'HEAD', 'OPTIONS')


def RequireAnyPermission(*codes):
    class _RequireAnyPermission(BasePermission):
        message = f"Missing permission: {' or '.join(codes)}"

        def has_permission(self, request, view):
            return any(user_has_permission(request, code) for code in codes)

    return _RequireAnyPermission


class HRPermissionsMixin:
    """Reads need read_permissions (any one of them), writes need write_permission."""
    read_permissions = ()
    write_permission = None

    def get_permissions(self):
        base = [IsAuthenticated(), HasActiveCompany()]
        if self.request.method in READ_METHODS:
            base.append(RequireAnyPermission(*self.read_permissions)())
        else:
            base.append(RequirePermission(self.write_permission)())
        return base


class DepartmentViewSet(TenantScopedMixin, ModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer

    def get_permissions(self):
        base = [IsAuthenticated(), HasActiveCompany()]
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            base.append(RequirePermission('hr.manage_employees')())
        else:
            base.append(RequirePermission('hr.view_employees')())
        return base


class EmployeeViewSet(TenantScopedMixin, ModelViewSet):
    queryset = Employee.objects.select_related('department', 'station', 'user').order_by('first_name')
    serializer_class = EmployeeSerializer

    def get_permissions(self):
        base = [IsAuthenticated(), HasActiveCompany()]
        if self.action in ('create', 'update', 'partial_update', 'destroy', 'linkable_users'):
            base.append(RequirePermission('hr.manage_employees')())
        else:
            base.append(RequirePermission('hr.view_employees')())
        return base

    @action(detail=False, methods=['get'], url_path='linkable-users')
    def linkable_users(self, request):
        """Company logins an employee can be linked to, with the employee each is
        already linked to (if any). Lets HR link accounts without team-management rights."""
        memberships = (CompanyMembership.objects.filter(company=request.company, user__is_active=True)
                       .select_related('user', 'user__employee_profile').order_by('user__email'))
        rows = []
        for membership in memberships:
            user = membership.user
            linked = getattr(user, 'employee_profile', None)
            rows.append({
                'id': user.id,
                'email': user.email,
                'name': f'{user.first_name} {user.last_name}'.strip() or user.email,
                'role': membership.role,
                'employee': linked.id if linked else None,
            })
        return Response(rows)


class AttendanceViewSet(TenantScopedMixin, ModelViewSet):
    queryset = Attendance.objects.all().order_by('-date')
    filterset_fields = ['employee', 'date', 'status']
    serializer_class = AttendanceSerializer

    def get_permissions(self):
        base = [IsAuthenticated(), HasActiveCompany()]
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            base.append(RequirePermission('hr.manage_attendance')())
        else:
            base.append(RequirePermission('hr.view_employees')())
        return base


class LeaveRequestViewSet(TenantScopedMixin, ModelViewSet):
    queryset = LeaveRequest.objects.all().order_by('-start_date')
    filterset_fields = ['employee', 'status', 'leave_type']
    serializer_class = LeaveRequestSerializer

    def get_permissions(self):
        base = [IsAuthenticated(), HasActiveCompany()]
        if self.action in ('create', 'update', 'partial_update', 'destroy', 'approve', 'reject'):
            base.append(RequirePermission('hr.manage_leave')())
        else:
            base.append(RequirePermission('hr.view_employees')())
        return base

    def _decide(self, request, new_status):
        leave = self.get_object()
        leave.status = new_status
        leave.decision_note = request.data.get('decision_note', '')
        leave.reviewed_by = request.user
        leave.save()
        return Response(self.get_serializer(leave).data)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        return self._decide(request, 'APPROVED')

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        return self._decide(request, 'REJECTED')


class PayrollViewSet(TenantScopedMixin, ModelViewSet):
    tenant_filter_field = 'employee__tenant'
    queryset = Payroll.objects.all().order_by('-period')
    serializer_class = PayrollSerializer
    filterset_fields = ['employee', 'period']

    def get_permissions(self):
        base = [IsAuthenticated(), HasActiveCompany()]
        if self.action in ('create', 'update', 'partial_update', 'destroy', 'generate'):
            base.append(RequirePermission('hr.edit_salary')())
        else:
            base.append(RequirePermission('hr.view_salary')())
        return base

    @action(detail=False, methods=['post'])
    def generate(self, request):
        period = request.data.get('period')
        if not period:
            return Response({'error': 'period is required'}, status=400)
        company = request.company
        created_ids, skipped_ids = [], []
        for emp in Employee.objects.filter(tenant=company, active=True):
            payroll, was_created = Payroll.objects.get_or_create(
                employee=emp, period=period,
                defaults={'base_salary': emp.base_salary, 'bonuses': 0, 'deductions': 0},
            )
            (created_ids if was_created else skipped_ids).append(payroll.id)
        results = Payroll.objects.filter(id__in=created_ids + skipped_ids)
        serializer = self.get_serializer(results, many=True)
        return Response({'created': len(created_ids), 'skipped': len(skipped_ids), 'results': serializer.data})


class EmployeeDocumentViewSet(TenantScopedMixin, HRPermissionsMixin, ModelViewSet):
    """ID copies, contracts and permits. Files are only reachable through
    download/, never by their /media path (which is randomised)."""
    queryset = EmployeeDocument.objects.select_related('employee').all()
    serializer_class = EmployeeDocumentSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filterset_fields = ['employee', 'doc_type']
    read_permissions = ('hr.manage_employees',)
    write_permission = 'hr.manage_employees'
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def perform_create(self, serializer):
        upload = serializer.validated_data['file']
        serializer.save(tenant=self.request.company, uploaded_by=self.request.user,
                        original_filename=upload.name[:255])

    def perform_update(self, serializer):
        upload = serializer.validated_data.get('file')
        if upload is not None:
            serializer.instance.file.delete(save=False)
            serializer.save(original_filename=upload.name[:255])
        else:
            serializer.save()

    def perform_destroy(self, instance):
        instance.file.delete(save=False)
        instance.delete()

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        document = self.get_object()
        return FileResponse(document.file.open('rb'), as_attachment=True,
                            filename=document.original_filename or document.file.name.rsplit('/', 1)[-1])


class PayrollSettingsView(HRPermissionsMixin, RetrieveUpdateAPIView):
    """The company's single payroll settings row, created with Jordan defaults
    (flagged unverified) the first time it's read."""
    serializer_class = PayrollSettingsSerializer
    read_permissions = ('hr.view_salary', 'hr.manage_settings')
    write_permission = 'hr.manage_settings'
    http_method_names = ['get', 'patch', 'head', 'options']

    def get_object(self):
        return PayrollSettings.for_company(self.request.company)


class AllowanceTypeViewSet(TenantScopedMixin, HRPermissionsMixin, ModelViewSet):
    queryset = AllowanceType.objects.all()
    serializer_class = AllowanceTypeSerializer
    filterset_fields = ['is_active']
    read_permissions = ('hr.view_salary', 'hr.manage_settings')
    write_permission = 'hr.manage_settings'

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response({'detail': 'This allowance is given to employees. Deactivate it instead.'}, status=409)


class EmployeeAllowanceViewSet(TenantScopedMixin, HRPermissionsMixin, ModelViewSet):
    queryset = EmployeeAllowance.objects.select_related('allowance_type').all()
    serializer_class = EmployeeAllowanceSerializer
    filterset_fields = ['employee', 'allowance_type', 'is_active']
    read_permissions = ('hr.view_salary',)
    write_permission = 'hr.edit_salary'
