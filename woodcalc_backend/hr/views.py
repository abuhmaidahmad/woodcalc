from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated
from .models import Employee, Attendance, LeaveRequest, Payroll
from .serializers import EmployeeSerializer, AttendanceSerializer, LeaveRequestSerializer, PayrollSerializer


class EmployeeViewSet(ModelViewSet):
    queryset = Employee.objects.all().order_by('first_name')
    serializer_class = EmployeeSerializer
    permission_classes = [IsAuthenticated]


class AttendanceViewSet(ModelViewSet):
    queryset = Attendance.objects.all().order_by('-date')
    serializer_class = AttendanceSerializer
    permission_classes = [IsAuthenticated]


class LeaveRequestViewSet(ModelViewSet):
    queryset = LeaveRequest.objects.all().order_by('-start_date')
    serializer_class = LeaveRequestSerializer
    permission_classes = [IsAuthenticated]


class PayrollViewSet(ModelViewSet):
    queryset = Payroll.objects.all().order_by('-period')
    serializer_class = PayrollSerializer
    permission_classes = [IsAuthenticated]
