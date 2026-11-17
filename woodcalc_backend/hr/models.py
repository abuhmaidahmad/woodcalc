import uuid
from decimal import Decimal

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from tenants.models import Company

from .payroll.money import MONEY_DIGITS, MONEY_PLACES
from .payroll.rates import daily_rate, hourly_rate


def money_field(**kwargs):
    kwargs.setdefault('default', Decimal('0'))
    return models.DecimalField(max_digits=MONEY_DIGITS, decimal_places=MONEY_PLACES, **kwargs)


def percent_field(**kwargs):
    kwargs.setdefault('validators', [MinValueValidator(Decimal('0')), MaxValueValidator(Decimal('100'))])
    return models.DecimalField(max_digits=6, decimal_places=3, **kwargs)


class Department(models.Model):
    tenant = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='departments', null=True)
    name_en = models.CharField(max_length=100)
    name_ar = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ('tenant', 'name_en')
        ordering = ['name_en']

    def __str__(self):
        return self.name_en


DEFAULT_DEPARTMENTS = [
    ('Management', 'الإدارة'),
    ('Sales', 'المبيعات'),
    ('Design', 'التصميم'),
    ('Accounting & Finance', 'المحاسبة والمالية'),
    ('Procurement', 'المشتريات'),
    ('Warehouse & Store', 'المستودع والمخزن'),
    ('Production', 'الإنتاج'),
    ('Cutting Station', 'محطة القص'),
    ('Edge Banding', 'تغليف الحواف'),
    ('CNC', 'سي إن سي'),
    ('Assembly', 'التجميع'),
    ('Painting & Finishing', 'الدهان والتشطيب'),
    ('Quality Control', 'ضبط الجودة'),
    ('Installation', 'التركيب'),
    ('Delivery & Logistics', 'التوصيل واللوجستيات'),
    ('Customer Service', 'خدمة العملاء'),
    ('HR', 'الموارد البشرية'),
    ('IT', 'تقنية المعلومات'),
]


def seed_default_departments(company):
    """Create the standard department set for a company, skipping any that
    already exist (matched on name_en). Safe to call more than once."""
    existing = set(company.departments.values_list('name_en', flat=True))
    Department.objects.bulk_create([
        Department(tenant=company, name_en=name_en, name_ar=name_ar)
        for name_en, name_ar in DEFAULT_DEPARTMENTS
        if name_en not in existing
    ])


class Employee(models.Model):
    class PayType(models.TextChoices):
        MONTHLY = 'monthly', 'Monthly'
        DAILY = 'daily', 'Daily'
        PIECE_RATE = 'piece_rate', 'Piece rate'

    class PaymentMethod(models.TextChoices):
        BANK = 'bank', 'Bank transfer'
        CASH = 'cash', 'Cash'

    class ContractType(models.TextChoices):
        FULL_TIME = 'full_time', 'Full time'
        PART_TIME = 'part_time', 'Part time'
        FIXED_TERM = 'fixed_term', 'Fixed term'
        TEMPORARY = 'temporary', 'Temporary'

    tenant = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='employees')
    # The login this employee uses (mobile clock-in, self-service, installer jobs).
    # Optional: workshop staff without an account are still employees.
    user = models.OneToOneField(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
                                related_name='employee_profile')
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    job_title = models.CharField(max_length=100, blank=True)
    department = models.ForeignKey(Department, on_delete=models.PROTECT, null=True, blank=True, related_name='employees')
    station = models.ForeignKey('manufacturing.ProductionStation', null=True, blank=True, on_delete=models.SET_NULL,
                                related_name='employees')
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=50, blank=True)
    hire_date = models.DateField(null=True, blank=True)
    contract_type = models.CharField(max_length=20, choices=ContractType.choices, default=ContractType.FULL_TIME)
    active = models.BooleanField(default=True)

    # Pay. Hidden from users without hr.view_salary; editable only with hr.edit_salary.
    pay_type = models.CharField(max_length=20, choices=PayType.choices, default=PayType.MONTHLY)
    base_salary = money_field(help_text='Monthly salary in JOD (monthly pay type).')
    daily_rate = money_field(help_text='JOD per day worked (daily and piece-rate pay types).')
    commission_pct = percent_field(default=Decimal('0'),
                                   help_text='Sales commission, % of contract value before VAT, paid when a '
                                             'customer payment clears.')
    ssc_enrolled = models.BooleanField(default=True)
    ssc_number = models.CharField(max_length=30, blank=True)
    payment_method = models.CharField(max_length=10, choices=PaymentMethod.choices, default=PaymentMethod.CASH)
    iban = models.CharField(max_length=34, blank=True)

    def __str__(self):
        return f'{self.first_name} {self.last_name}'

    def daily_rate_with(self, payroll_settings):
        return daily_rate(self.pay_type, self.base_salary, self.daily_rate, payroll_settings.working_days_per_month)

    def hourly_rate_with(self, payroll_settings):
        return hourly_rate(self.daily_rate_with(payroll_settings), payroll_settings.hours_per_day)


def employee_document_path(instance, filename):
    # /media is publicly served, so the stored name must not be guessable.
    # Files are downloaded through the authenticated documents/<id>/download endpoint.
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    name = uuid.uuid4().hex + (f'.{ext}' if ext.isalnum() and len(ext) <= 8 else '')
    return f'hr_documents/{instance.tenant_id}/{name}'


class EmployeeDocument(models.Model):
    class DocType(models.TextChoices):
        NATIONAL_ID = 'national_id', 'National ID'
        PASSPORT = 'passport', 'Passport'
        WORK_PERMIT = 'work_permit', 'Work permit'
        CONTRACT = 'contract', 'Contract'
        CERTIFICATE = 'certificate', 'Certificate'
        OTHER = 'other', 'Other'

    tenant = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='employee_documents')
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='documents')
    doc_type = models.CharField(max_length=20, choices=DocType.choices, default=DocType.OTHER)
    title = models.CharField(max_length=200, blank=True)
    file = models.FileField(upload_to=employee_document_path)
    original_filename = models.CharField(max_length=255, blank=True)
    expiry_date = models.DateField(null=True, blank=True)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
                                    related_name='+')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-uploaded_at']

    def __str__(self):
        return f'{self.employee} - {self.get_doc_type_display()}'


class Attendance(models.Model):
    STATUS_CHOICES = [('PRESENT', 'Present'), ('ABSENT', 'Absent'), ('LATE', 'Late')]
    tenant = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='attendance_records')
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='attendance_records')
    date = models.DateField()
    check_in = models.TimeField(null=True, blank=True)
    check_out = models.TimeField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='PRESENT')

    class Meta:
        unique_together = ('employee', 'date')

    def save(self, *args, **kwargs):
        if self.tenant_id is None and self.employee_id is not None:
            self.tenant_id = self.employee.tenant_id
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.employee} - {self.date}'


class LeaveRequest(models.Model):
    STATUS_CHOICES = [('PENDING', 'Pending'), ('APPROVED', 'Approved'), ('REJECTED', 'Rejected')]
    LEAVE_TYPE_CHOICES = [('ANNUAL', 'Annual'), ('SICK', 'Sick'), ('UNPAID', 'Unpaid'), ('OTHER', 'Other')]
    tenant = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='leave_requests')
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='leave_requests')
    leave_type = models.CharField(max_length=10, choices=LEAVE_TYPE_CHOICES, default='ANNUAL')
    start_date = models.DateField()
    end_date = models.DateField()
    reason = models.CharField(max_length=300, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='PENDING')
    decision_note = models.CharField(max_length=300, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='leave_reviews',
    )

    def save(self, *args, **kwargs):
        if self.tenant_id is None and self.employee_id is not None:
            self.tenant_id = self.employee.tenant_id
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.employee} {self.start_date} - {self.end_date}'


class Payroll(models.Model):
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='payrolls')
    period = models.CharField(max_length=20)
    base_salary = money_field()
    bonuses = money_field()
    deductions = money_field()
    net_pay = money_field()
    notes = models.CharField(max_length=300, blank=True)
    paid = models.BooleanField(default=False)

    class Meta:
        unique_together = ('employee', 'period')

    def save(self, *args, **kwargs):
        self.net_pay = self.base_salary + self.bonuses - self.deductions
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.employee} - {self.period}'


# Jordan defaults. NOT VERIFIED: confirm with a Jordanian accountant before go-live.
# Every value is editable per company; rates_verified stays False until someone
# with hr.manage_settings confirms them.
JORDAN_TAX_BRACKETS = [
    {'up_to': '5000.000', 'rate': '5.000'},
    {'up_to': '10000.000', 'rate': '10.000'},
    {'up_to': '15000.000', 'rate': '15.000'},
    {'up_to': '20000.000', 'rate': '20.000'},
    {'up_to': '1000000.000', 'rate': '25.000'},
    {'up_to': None, 'rate': '30.000'},
]


def default_tax_brackets():
    return [dict(b) for b in JORDAN_TAX_BRACKETS]


class PayrollSettings(models.Model):
    """One row per company. Payroll is JOD only."""
    RATE_FIELDS = (
        'overtime_rate_normal', 'overtime_rate_holiday', 'ssc_employee_pct', 'ssc_employer_pct',
        'ssc_ceiling', 'tax_brackets', 'personal_exemptions',
    )

    tenant = models.OneToOneField(Company, on_delete=models.CASCADE, related_name='payroll_settings')
    country = models.CharField(max_length=2, default='JO')
    pay_day = models.PositiveSmallIntegerField(default=28, validators=[MinValueValidator(1), MaxValueValidator(28)],
                                               help_text='Day of the month salaries are paid (1-28).')
    working_days_per_month = models.PositiveSmallIntegerField(
        default=30, validators=[MinValueValidator(1), MaxValueValidator(31)],
        help_text='Daily rate = monthly salary / this. 30 = calendar days.')
    hours_per_day = models.DecimalField(
        max_digits=4, decimal_places=2, default=Decimal('8'),
        validators=[MinValueValidator(Decimal('1')), MaxValueValidator(Decimal('24'))],
        help_text='Hourly rate = daily rate / this. Used for overtime.')
    overtime_rate_normal = models.DecimalField(
        max_digits=5, decimal_places=3, default=Decimal('1.25'),
        validators=[MinValueValidator(Decimal('1')), MaxValueValidator(Decimal('5'))],
        help_text='Multiplier of the hourly rate for overtime on working days.')
    overtime_rate_holiday = models.DecimalField(
        max_digits=5, decimal_places=3, default=Decimal('1.5'),
        validators=[MinValueValidator(Decimal('1')), MaxValueValidator(Decimal('5'))],
        help_text='Multiplier of the hourly rate for work on rest days and public holidays.')
    ssc_employee_pct = percent_field(default=Decimal('7.5'))
    ssc_employer_pct = percent_field(default=Decimal('14.25'))
    ssc_ceiling = money_field(default=Decimal('3500'),
                              help_text='Maximum monthly wage subject to social security, JOD.')
    tax_brackets = models.JSONField(default=default_tax_brackets,
                                    help_text='Annual income-tax brackets, see hr/payroll/brackets.py.')
    personal_exemptions = money_field(default=Decimal('9000'), help_text='Annual personal exemption, JOD.')

    rates_verified = models.BooleanField(
        default=False, help_text='Set once an accountant has confirmed the rates. Cleared when any rate changes.')
    rates_verified_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                          on_delete=models.SET_NULL, related_name='+')
    rates_verified_at = models.DateTimeField(null=True, blank=True)
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                   on_delete=models.SET_NULL, related_name='+')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = 'payroll settings'

    def __str__(self):
        return f'Payroll settings for {self.tenant}'

    @classmethod
    def for_company(cls, company):
        settings_obj, _ = cls.objects.get_or_create(tenant=company)
        return settings_obj


class AllowanceType(models.Model):
    class Kind(models.TextChoices):
        FIXED = 'fixed', 'Fixed amount (JOD)'
        PERCENT = 'percent', '% of base salary'

    tenant = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='allowance_types')
    name_en = models.CharField(max_length=100)
    name_ar = models.CharField(max_length=100, blank=True)
    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.FIXED)
    default_amount = money_field(help_text='JOD for fixed allowances, percent for percent allowances.')
    taxable = models.BooleanField(default=True)
    ssc_subject = models.BooleanField(default=True, help_text='Counts toward the social security wage.')
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ('tenant', 'name_en')
        ordering = ['name_en']

    def __str__(self):
        return self.name_en


class EmployeeAllowance(models.Model):
    tenant = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='employee_allowances')
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='allowances')
    allowance_type = models.ForeignKey(AllowanceType, on_delete=models.PROTECT, related_name='employee_allowances')
    amount = models.DecimalField(max_digits=MONEY_DIGITS, decimal_places=MONEY_PLACES, null=True, blank=True,
                                 help_text="Override; empty uses the allowance type's default.")
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ('employee', 'allowance_type')

    def __str__(self):
        return f'{self.employee} - {self.allowance_type}'

    @property
    def effective_amount(self):
        """JOD for fixed allowances, percent for percent allowances."""
        return self.amount if self.amount is not None else self.allowance_type.default_amount
