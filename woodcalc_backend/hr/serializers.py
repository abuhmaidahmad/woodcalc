import re
from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers

from tenants.permissions import user_has_permission

from .models import (
    AllowanceType, Attendance, Department, Employee, EmployeeAllowance, EmployeeDocument, LeaveRequest,
    Payroll, PayrollSettings,
)
from .payroll.brackets import BracketError, normalize_brackets


# Fields only users with hr.view_salary may see, and hr.edit_salary may change.
PAY_FIELDS = (
    'pay_type', 'base_salary', 'daily_rate', 'commission_pct', 'ssc_enrolled', 'ssc_number',
    'payment_method', 'iban',
)
PAY_RATE_PLACES = Decimal('0.001')
DOCUMENT_EXTENSIONS = {'pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic', 'doc', 'docx'}
DOCUMENT_MAX_BYTES = 10 * 1024 * 1024


def request_company(context):
    request = context.get('request')
    return getattr(request, 'company', None) if request else None


def has_perm(context, code):
    request = context.get('request')
    return bool(request and user_has_permission(request, code))


class TenantScopedRelatedFieldsMixin:
    """Limit related-object choices to the request's company, so another
    company's employee/station/etc. can't be attached by id. Maps a field
    name to the lookup from that field's model to its company."""
    tenant_scoped_fields = {'employee': 'tenant'}

    def get_fields(self):
        fields = super().get_fields()
        company = request_company(self.context)
        for name, lookup in self.tenant_scoped_fields.items():
            field = fields.get(name)
            if field is None or field.read_only:
                continue
            queryset = field.queryset
            field.queryset = queryset.filter(**{lookup: company}) if company else queryset.none()
        return fields


def normalize_iban(value):
    return re.sub(r'\s+', '', value or '').upper()


def iban_is_valid(iban):
    if not re.fullmatch(r'[A-Z]{2}\d{2}[A-Z0-9]{11,30}', iban):
        return False
    if iban.startswith('JO') and len(iban) != 30:
        return False
    rearranged = iban[4:] + iban[:4]
    digits = ''.join(str(int(ch, 36)) for ch in rearranged)
    return int(digits) % 97 == 1


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ['id', 'name_en', 'name_ar', 'is_active']
        extra_kwargs = {'tenant': {'read_only': True}}


class EmployeeSerializer(TenantScopedRelatedFieldsMixin, serializers.ModelSerializer):
    tenant_scoped_fields = {
        'department': 'tenant',
        'station': 'tenant',
        'user': 'company_membership__company',
    }
    department_detail = DepartmentSerializer(source='department', read_only=True)
    station_name = serializers.CharField(source='station.name', read_only=True, default=None)
    user_detail = serializers.SerializerMethodField()
    # Longer than the stored 34 so IBANs typed in groups with spaces are accepted;
    # validate() strips the spaces and iban_is_valid() enforces the real length.
    iban = serializers.CharField(max_length=50, allow_blank=True, required=False)

    class Meta:
        model = Employee
        fields = '__all__'
        extra_kwargs = {'tenant': {'read_only': True}}

    def get_user_detail(self, obj):
        if obj.user is None:
            return None
        name = f'{obj.user.first_name} {obj.user.last_name}'.strip()
        return {'id': obj.user.id, 'email': obj.user.email, 'name': name or obj.user.email}

    def _payroll_settings(self):
        cache = self.context.setdefault('_hr_cache', {})
        if 'payroll_settings' not in cache:
            company = request_company(self.context)
            cache['payroll_settings'] = PayrollSettings.for_company(company) if company else None
        return cache['payroll_settings']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if not has_perm(self.context, 'hr.view_salary'):
            for field in PAY_FIELDS:
                data.pop(field, None)
            return data
        payroll_settings = self._payroll_settings()
        if payroll_settings is not None:
            daily = instance.daily_rate_with(payroll_settings)
            data['effective_daily_rate'] = str(daily.quantize(PAY_RATE_PLACES))
            data['effective_hourly_rate'] = str(instance.hourly_rate_with(payroll_settings).quantize(PAY_RATE_PLACES))
        return data

    def validate(self, attrs):
        if not has_perm(self.context, 'hr.edit_salary'):
            for field in PAY_FIELDS:
                if field not in attrs:
                    continue
                current = (getattr(self.instance, field) if self.instance is not None
                           else Employee._meta.get_field(field).get_default())
                if attrs[field] != current:
                    raise serializers.ValidationError({field: 'You do not have permission to change pay details.'})

        if 'iban' in attrs:
            attrs['iban'] = normalize_iban(attrs['iban'])
            if attrs['iban'] and not iban_is_valid(attrs['iban']):
                raise serializers.ValidationError({'iban': 'This is not a valid IBAN.'})
        method = attrs.get('payment_method', getattr(self.instance, 'payment_method', None))
        iban = attrs.get('iban', getattr(self.instance, 'iban', ''))
        if method == Employee.PaymentMethod.BANK and not iban:
            raise serializers.ValidationError({'iban': 'An IBAN is required for bank transfer.'})
        return attrs


class EmployeeDocumentSerializer(TenantScopedRelatedFieldsMixin, serializers.ModelSerializer):
    file = serializers.FileField(write_only=True)
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = EmployeeDocument
        fields = ['id', 'employee', 'doc_type', 'title', 'file', 'original_filename', 'expiry_date',
                  'uploaded_by', 'uploaded_at', 'download_url']
        read_only_fields = ['original_filename', 'uploaded_by', 'uploaded_at']

    def get_download_url(self, obj):
        return f'/api/hr/employee-documents/{obj.id}/download/'

    def validate_file(self, value):
        ext = value.name.rsplit('.', 1)[-1].lower() if '.' in value.name else ''
        if ext not in DOCUMENT_EXTENSIONS:
            raise serializers.ValidationError(
                f'Allowed file types: {", ".join(sorted(DOCUMENT_EXTENSIONS))}.')
        if value.size > DOCUMENT_MAX_BYTES:
            raise serializers.ValidationError('Files must be 10 MB or smaller.')
        return value


class AttendanceSerializer(TenantScopedRelatedFieldsMixin, serializers.ModelSerializer):
    class Meta:
        model = Attendance
        fields = '__all__'
        extra_kwargs = {'tenant': {'read_only': True}}


class LeaveRequestSerializer(TenantScopedRelatedFieldsMixin, serializers.ModelSerializer):
    class Meta:
        model = LeaveRequest
        fields = '__all__'
        extra_kwargs = {'tenant': {'read_only': True}, 'reviewed_by': {'read_only': True}}


class PayrollSerializer(TenantScopedRelatedFieldsMixin, serializers.ModelSerializer):
    class Meta:
        model = Payroll
        fields = '__all__'
        read_only_fields = ['net_pay']


class PayrollSettingsSerializer(serializers.ModelSerializer):
    rates_verified_by_name = serializers.SerializerMethodField()

    class Meta:
        model = PayrollSettings
        exclude = ['tenant']
        read_only_fields = ['rates_verified_by', 'rates_verified_at', 'updated_by', 'updated_at']

    def get_rates_verified_by_name(self, obj):
        user = obj.rates_verified_by
        if user is None:
            return None
        return f'{user.first_name} {user.last_name}'.strip() or user.email

    def validate_tax_brackets(self, value):
        try:
            return normalize_brackets(value)
        except BracketError as exc:
            raise serializers.ValidationError(str(exc))

    def validate_country(self, value):
        value = value.upper()
        if value != 'JO':
            raise serializers.ValidationError('Only Jordan (JO) payroll is supported for now.')
        return value

    def update(self, instance, validated_data):
        user = self.context['request'].user
        rates_changed = any(
            field in validated_data and validated_data[field] != getattr(instance, field)
            for field in PayrollSettings.RATE_FIELDS
        )
        verified = validated_data.pop('rates_verified', None)
        if verified is True and (not instance.rates_verified or rates_changed):
            # Confirming the rates, possibly while entering the accountant's numbers.
            instance.rates_verified, instance.rates_verified_by, instance.rates_verified_at = True, user, timezone.now()
        elif verified is False or rates_changed:
            # A confirmation applies to specific numbers; changing any rate clears it.
            instance.rates_verified, instance.rates_verified_by, instance.rates_verified_at = False, None, None
        instance.updated_by = user
        return super().update(instance, validated_data)


class AllowanceTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = AllowanceType
        exclude = ['tenant']

    def validate(self, attrs):
        kind = attrs.get('kind', getattr(self.instance, 'kind', AllowanceType.Kind.FIXED))
        amount = attrs.get('default_amount', getattr(self.instance, 'default_amount', 0))
        if amount < 0:
            raise serializers.ValidationError({'default_amount': 'Must not be negative.'})
        if kind == AllowanceType.Kind.PERCENT and amount > 100:
            raise serializers.ValidationError({'default_amount': 'A percentage must be 100 or less.'})
        return attrs


class EmployeeAllowanceSerializer(TenantScopedRelatedFieldsMixin, serializers.ModelSerializer):
    tenant_scoped_fields = {'employee': 'tenant', 'allowance_type': 'tenant'}
    allowance_type_detail = AllowanceTypeSerializer(source='allowance_type', read_only=True)
    effective_amount = serializers.DecimalField(max_digits=14, decimal_places=3, read_only=True)

    class Meta:
        model = EmployeeAllowance
        exclude = ['tenant']

    def validate(self, attrs):
        allowance_type = attrs.get('allowance_type', getattr(self.instance, 'allowance_type', None))
        amount = attrs.get('amount', getattr(self.instance, 'amount', None))
        if amount is not None:
            if amount < 0:
                raise serializers.ValidationError({'amount': 'Must not be negative.'})
            if allowance_type and allowance_type.kind == AllowanceType.Kind.PERCENT and amount > 100:
                raise serializers.ValidationError({'amount': 'A percentage must be 100 or less.'})
        return attrs
