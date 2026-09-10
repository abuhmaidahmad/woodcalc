from rest_framework import serializers
from tenants.permissions import user_has_permission
from .models import Employee, Attendance, LeaveRequest, Payroll, Department


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ['id', 'name_en', 'name_ar', 'is_active']
        extra_kwargs = {'tenant': {'read_only': True}}


class EmployeeSerializer(serializers.ModelSerializer):
    department_detail = DepartmentSerializer(source='department', read_only=True)

    class Meta:
        model = Employee
        fields = '__all__'
        extra_kwargs = {'tenant': {'read_only': True}}

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        if not (request and user_has_permission(request, 'hr.view_salary')):
            data.pop('salary', None)
        return data

    def validate_salary(self, value):
        request = self.context.get('request')
        if not (request and user_has_permission(request, 'hr.edit_salary')):
            raise serializers.ValidationError('You do not have permission to set salary.')
        return value


class AttendanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attendance
        fields = '__all__'


class LeaveRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeaveRequest
        fields = '__all__'
        extra_kwargs = {'reviewed_by': {'read_only': True}}


class PayrollSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payroll
        fields = '__all__'
        read_only_fields = ['net_pay']
