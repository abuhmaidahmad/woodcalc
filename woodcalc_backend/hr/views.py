from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated
from tenants.mixins import TenantScopedMixin
from tenants.permissions import HasActiveCompany, RequirePermission
from .models import Employee, Attendance, LeaveRequest, Payroll
from .serializers import EmployeeSerializer, AttendanceSerializer, LeaveRequestSerializer, PayrollSerializer


class EmployeeViewSet(TenantScopedMixin, ModelViewSet):
    queryset = Employee.objects.all().order_by('first_name')
    serializer_class = EmployeeSerializer

    def get_permissions(self):
        base = [IsAuthenticated(), HasActiveCompany()]
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            base.append(RequirePermission('hr.manage_employees')())
        else:
            base.append(RequirePermission('hr.view_employees')())
        return base


class AttendanceViewSet(TenantScopedMixin, ModelViewSet):
    tenant_filter_field = 'employee__tenant'
    queryset = Attendance.objects.all().order_by('-date')
    serializer_class = AttendanceSerializer

    def get_permissions(self):
        base = [IsAuthenticated(), HasActiveCompany()]
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            base.append(RequirePermission('hr.manage_attendance')())
        else:
            base.append(RequirePermission('hr.view_employees')())
        return base


class LeaveRequestViewSet(TenantScopedMixin, ModelViewSet):
    tenant_filter_field = 'employee__tenant'
    queryset = LeaveRequest.objects.all().order_by('-start_date')
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
                defaults={'base_salary': emp.salary, 'bonuses': 0, 'deductions': 0},
            )
            (created_ids if was_created else skipped_ids).append(payroll.id)
        results = Payroll.objects.filter(id__in=created_ids + skipped_ids)
        serializer = self.get_serializer(results, many=True)
        return Response({'created': len(created_ids), 'skipped': len(skipped_ids), 'results': serializer.data})
