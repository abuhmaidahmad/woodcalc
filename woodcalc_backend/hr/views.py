from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated
from tenants.mixins import TenantScopedMixin
from tenants.permissions import HasActiveCompany
from .models import Employee, Attendance, LeaveRequest, Payroll
from .serializers import EmployeeSerializer, AttendanceSerializer, LeaveRequestSerializer, PayrollSerializer


class EmployeeViewSet(TenantScopedMixin, ModelViewSet):
    queryset = Employee.objects.all().order_by('first_name')
    serializer_class = EmployeeSerializer
    permission_classes = [IsAuthenticated, HasActiveCompany]


class AttendanceViewSet(TenantScopedMixin, ModelViewSet):
    tenant_filter_field = 'employee__tenant'
    queryset = Attendance.objects.all().order_by('-date')
    serializer_class = AttendanceSerializer
    permission_classes = [IsAuthenticated, HasActiveCompany]


class LeaveRequestViewSet(TenantScopedMixin, ModelViewSet):
    tenant_filter_field = 'employee__tenant'
    queryset = LeaveRequest.objects.all().order_by('-start_date')
    serializer_class = LeaveRequestSerializer
    permission_classes = [IsAuthenticated, HasActiveCompany]


class PayrollViewSet(TenantScopedMixin, ModelViewSet):
    tenant_filter_field = 'employee__tenant'
    queryset = Payroll.objects.all().order_by('-period')
    serializer_class = PayrollSerializer
    permission_classes = [IsAuthenticated, HasActiveCompany]
