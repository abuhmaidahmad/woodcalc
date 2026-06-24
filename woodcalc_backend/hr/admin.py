from django.contrib import admin
from .models import Employee, Attendance, LeaveRequest, Payroll

admin.site.register(Employee)
admin.site.register(Attendance)
admin.site.register(LeaveRequest)
admin.site.register(Payroll)
