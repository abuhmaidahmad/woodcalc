from django.conf import settings
from django.db import models
from tenants.models import Company


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
    tenant = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='employees')
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    job_title = models.CharField(max_length=100, blank=True)
    department = models.ForeignKey(Department, on_delete=models.PROTECT, null=True, blank=True, related_name='employees')
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=50, blank=True)
    hire_date = models.DateField(null=True, blank=True)
    salary = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    active = models.BooleanField(default=True)

    def __str__(self):
        return f'{self.first_name} {self.last_name}'


class Attendance(models.Model):
    STATUS_CHOICES = [('PRESENT', 'Present'), ('ABSENT', 'Absent'), ('LATE', 'Late')]
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='attendance_records')
    date = models.DateField()
    check_in = models.TimeField(null=True, blank=True)
    check_out = models.TimeField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='PRESENT')

    class Meta:
        unique_together = ('employee', 'date')

    def __str__(self):
        return f'{self.employee} - {self.date}'


class LeaveRequest(models.Model):
    STATUS_CHOICES = [('PENDING', 'Pending'), ('APPROVED', 'Approved'), ('REJECTED', 'Rejected')]
    LEAVE_TYPE_CHOICES = [('ANNUAL', 'Annual'), ('SICK', 'Sick'), ('UNPAID', 'Unpaid'), ('OTHER', 'Other')]
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

    def __str__(self):
        return f'{self.employee} {self.start_date} - {self.end_date}'


class Payroll(models.Model):
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='payrolls')
    period = models.CharField(max_length=20)
    base_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    bonuses = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    deductions = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    net_pay = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    notes = models.CharField(max_length=300, blank=True)
    paid = models.BooleanField(default=False)

    class Meta:
        unique_together = ('employee', 'period')

    def save(self, *args, **kwargs):
        self.net_pay = self.base_salary + self.bonuses - self.deductions
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.employee} - {self.period}'
