from django.db import migrations
from django.db.models import OuterRef, Subquery


def backfill(apps, schema_editor):
    Employee = apps.get_model("hr", "Employee")
    employee_tenant = Subquery(Employee.objects.filter(pk=OuterRef("employee_id")).values("tenant_id")[:1])
    for model_name in ("Attendance", "LeaveRequest"):
        apps.get_model("hr", model_name).objects.filter(tenant__isnull=True).update(tenant_id=employee_tenant)


class Migration(migrations.Migration):

    dependencies = [
        ("hr", "0006_employee_pay_and_payroll_settings"),
    ]

    operations = [
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
