from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    AllowanceTypeViewSet, AttendanceViewSet, DepartmentViewSet, EmployeeAllowanceViewSet, EmployeeDocumentViewSet,
    EmployeeViewSet, LeaveRequestViewSet, PayrollSettingsView, PayrollViewSet,
)
router = DefaultRouter()
router.register(r'employees', EmployeeViewSet, basename='employee')
router.register(r'employee-documents', EmployeeDocumentViewSet, basename='employeedocument')
router.register(r'employee-allowances', EmployeeAllowanceViewSet, basename='employeeallowance')
router.register(r'allowance-types', AllowanceTypeViewSet, basename='allowancetype')
router.register(r'attendance', AttendanceViewSet, basename='attendance')
router.register(r'leave-requests', LeaveRequestViewSet, basename='leaverequest')
router.register(r'payroll', PayrollViewSet, basename='payroll')
router.register(r'departments', DepartmentViewSet, basename='department')
urlpatterns = [
    path('payroll-settings/', PayrollSettingsView.as_view(), name='payroll-settings'),
] + router.urls
