from django.contrib import admin
from .models import (
    AllowanceType, Attendance, Employee, EmployeeAllowance, EmployeeDocument, LeaveRequest, Payroll,
    PayrollSettings,
)

admin.site.register(Employee)
admin.site.register(EmployeeDocument)
admin.site.register(Attendance)
admin.site.register(LeaveRequest)
admin.site.register(Payroll)
admin.site.register(PayrollSettings)
admin.site.register(AllowanceType)
admin.site.register(EmployeeAllowance)
