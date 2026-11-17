import shutil
import tempfile
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import SimpleTestCase, TestCase, TransactionTestCase, override_settings
from rest_framework.test import APIClient

from manufacturing.models import ProductionStation
from tenants.models import Company, CompanyMembership

from .models import (
    AllowanceType, Attendance, Employee, EmployeeAllowance, EmployeeDocument, LeaveRequest, Payroll,
    PayrollSettings,
)
from .payroll.brackets import BracketError, normalize_brackets
from .payroll.money import quantize_jod
from .payroll.rates import daily_rate, hourly_rate, overtime_hourly_rate
from .serializers import iban_is_valid

User = get_user_model()
Role = CompanyMembership.Role
ALL_HR = ["hr.view_employees", "hr.manage_employees", "hr.view_salary", "hr.edit_salary",
          "hr.manage_attendance", "hr.manage_leave"]


def make_company(slug):
    return Company.objects.create(name=slug.upper(), slug=slug, status=Company.Status.ACTIVE, max_users=50)


def make_member(company, email, role=Role.STAFF, permissions=None):
    user = User.objects.create_user(username=email, email=email, password="pass12345", user_type="manufacturer")
    CompanyMembership.objects.create(company=company, user=user, role=role, permissions=permissions or [])
    return user


def as_user(user):
    api = APIClient()
    api.force_authenticate(user)
    return api


def make_iban(country, bban):
    """Build an IBAN with correct check digits."""
    digits = "".join(str(int(ch, 36)) for ch in bban + country + "00")
    return f"{country}{98 - int(digits) % 97:02d}{bban}"


JO_IBAN = make_iban("JO", "CBJO0010000000000131000302")


def results(response):
    data = response.json()
    return data["results"] if isinstance(data, dict) and "results" in data else data


class HRSetup(TestCase):
    def setUp(self):
        self.a = make_company("a")
        self.b = make_company("b")
        self.owner = make_member(self.a, "owner@a.com", Role.OWNER)
        self.hr = make_member(self.a, "hr@a.com", permissions=ALL_HR)
        self.viewer = make_member(self.a, "viewer@a.com", permissions=["hr.view_employees", "hr.manage_employees"])
        self.salary_viewer = make_member(self.a, "sv@a.com",
                                         permissions=["hr.view_employees", "hr.manage_employees", "hr.view_salary"])
        self.owner_b = make_member(self.b, "owner@b.com", Role.OWNER)
        self.emp = Employee.objects.create(tenant=self.a, first_name="Omar", last_name="Ali",
                                           base_salary=Decimal("600"))
        self.emp_b = Employee.objects.create(tenant=self.b, first_name="Sami", last_name="B",
                                             base_salary=Decimal("700"))


# ─── Phase 0: tenant scoping ────────────────────────────────────────────────

class TenantScopingTests(HRSetup):
    def test_attendance_and_leave_get_tenant_from_employee(self):
        att = Attendance.objects.create(employee=self.emp, date="2026-11-01")
        leave = LeaveRequest.objects.create(employee=self.emp, start_date="2026-11-02", end_date="2026-11-03")
        self.assertEqual(att.tenant, self.a)
        self.assertEqual(leave.tenant, self.a)

    def test_api_create_sets_tenant(self):
        res = as_user(self.hr).post("/api/hr/attendance/", {"employee": self.emp.id, "date": "2026-11-01"})
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(Attendance.objects.get(pk=res.json()["id"]).tenant, self.a)

    def test_cannot_create_records_for_another_companys_employee(self):
        api = as_user(self.hr)
        for url, body in [
            ("/api/hr/attendance/", {"employee": self.emp_b.id, "date": "2026-11-01"}),
            ("/api/hr/leave-requests/", {"employee": self.emp_b.id, "start_date": "2026-11-01",
                                         "end_date": "2026-11-02"}),
            ("/api/hr/payroll/", {"employee": self.emp_b.id, "period": "2026-11"}),
        ]:
            res = api.post(url, body)
            self.assertEqual(res.status_code, 400, url)
            self.assertIn("employee", res.json())
        self.assertFalse(Attendance.objects.filter(employee=self.emp_b).exists())
        self.assertFalse(LeaveRequest.objects.filter(employee=self.emp_b).exists())

    def test_lists_only_show_own_company(self):
        Attendance.objects.create(employee=self.emp, date="2026-11-01")
        Attendance.objects.create(employee=self.emp_b, date="2026-11-01")
        rows = results(as_user(self.hr).get("/api/hr/attendance/"))
        self.assertEqual([r["employee"] for r in rows], [self.emp.id])

    def test_employee_filter_is_applied(self):
        other = Employee.objects.create(tenant=self.a, first_name="Lina", last_name="K")
        Attendance.objects.create(employee=self.emp, date="2026-11-01")
        Attendance.objects.create(employee=other, date="2026-11-01")
        LeaveRequest.objects.create(employee=other, start_date="2026-11-02", end_date="2026-11-03")
        api = as_user(self.hr)
        self.assertEqual([r["employee"] for r in results(api.get(f"/api/hr/attendance/?employee={self.emp.id}"))],
                         [self.emp.id])
        self.assertEqual(results(api.get(f"/api/hr/leave-requests/?employee={self.emp.id}")), [])

    def test_link_employee_to_own_company_user(self):
        api = as_user(self.hr)
        res = api.patch(f"/api/hr/employees/{self.emp.id}/", {"user": self.viewer.id}, format="json")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.json()["user_detail"]["email"], "viewer@a.com")
        self.emp.refresh_from_db()
        self.assertEqual(self.emp.user, self.viewer)

    def test_linkable_users_lists_own_company_only(self):
        self.emp.user = self.viewer
        self.emp.save()
        rows = as_user(self.viewer).get("/api/hr/employees/linkable-users/").json()
        emails = {r["email"] for r in rows}
        self.assertIn("viewer@a.com", emails)
        self.assertNotIn("owner@b.com", emails)
        self.assertEqual(next(r for r in rows if r["email"] == "viewer@a.com")["employee"], self.emp.id)
        reader = make_member(self.a, "reader@a.com", permissions=["hr.view_employees"])
        self.assertEqual(as_user(reader).get("/api/hr/employees/linkable-users/").status_code, 403)

    def test_cannot_link_employee_to_other_company_user(self):
        res = as_user(self.hr).patch(f"/api/hr/employees/{self.emp.id}/", {"user": self.owner_b.id}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("user", res.json())

    def test_one_user_links_to_one_employee(self):
        self.emp.user = self.viewer
        self.emp.save()
        other = Employee.objects.create(tenant=self.a, first_name="Lina", last_name="K")
        res = as_user(self.hr).patch(f"/api/hr/employees/{other.id}/", {"user": self.viewer.id}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_cannot_assign_other_company_station_or_department(self):
        station_b = ProductionStation.objects.create(tenant=self.b, name="Cutting", code="B-CUT")
        res = as_user(self.hr).patch(f"/api/hr/employees/{self.emp.id}/", {"station": station_b.id}, format="json")
        self.assertEqual(res.status_code, 400)
        station_a = ProductionStation.objects.create(tenant=self.a, name="Cutting", code="A-CUT")
        res = as_user(self.hr).patch(f"/api/hr/employees/{self.emp.id}/", {"station": station_a.id}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["station_name"], "Cutting")


class TenantBackfillMigrationTests(TransactionTestCase):
    """0007 fills Attendance/LeaveRequest.tenant from the employee's company."""
    before = [("hr", "0006_employee_pay_and_payroll_settings")]
    after = [("hr", "0008_require_attendance_leave_tenant")]

    def test_backfill(self):
        executor = MigrationExecutor(connection)
        executor.migrate(self.before)
        apps = executor.loader.project_state(self.before).apps
        Company_ = apps.get_model("tenants", "Company")
        Employee_ = apps.get_model("hr", "Employee")
        company = Company_.objects.create(name="M", slug="m")
        employee = Employee_.objects.create(tenant=company, first_name="A", last_name="B")
        att = apps.get_model("hr", "Attendance").objects.create(employee=employee, date="2026-11-01")
        leave = apps.get_model("hr", "LeaveRequest").objects.create(
            employee=employee, start_date="2026-11-01", end_date="2026-11-02")

        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate(self.after)
        apps = executor.loader.project_state(self.after).apps
        self.assertEqual(apps.get_model("hr", "Attendance").objects.get(pk=att.pk).tenant_id, company.pk)
        self.assertEqual(apps.get_model("hr", "LeaveRequest").objects.get(pk=leave.pk).tenant_id, company.pk)

        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate(executor.loader.graph.leaf_nodes())


# ─── Phase 1: employee pay fields ───────────────────────────────────────────

class EmployeePayTests(HRSetup):
    def test_pay_fields_hidden_without_view_salary(self):
        data = as_user(self.viewer).get(f"/api/hr/employees/{self.emp.id}/").json()
        for field in ("base_salary", "daily_rate", "iban", "commission_pct", "pay_type", "effective_daily_rate"):
            self.assertNotIn(field, data)
        data = as_user(self.salary_viewer).get(f"/api/hr/employees/{self.emp.id}/").json()
        self.assertEqual(data["base_salary"], "600.000")

    def test_pay_fields_need_edit_salary(self):
        res = as_user(self.salary_viewer).patch(f"/api/hr/employees/{self.emp.id}/", {"base_salary": "900"},
                                                format="json")
        self.assertEqual(res.status_code, 400)
        self.emp.refresh_from_db()
        self.assertEqual(self.emp.base_salary, Decimal("600"))

    def test_saving_profile_with_unchanged_pay_fields_is_allowed(self):
        """The profile form sends back what it loaded; unchanged pay values must not be refused."""
        api = as_user(self.salary_viewer)
        body = api.get(f"/api/hr/employees/{self.emp.id}/").json()
        body["job_title"] = "Carpenter"
        body = {k: body[k] for k in ("job_title", "base_salary", "pay_type", "payment_method")}
        res = api.patch(f"/api/hr/employees/{self.emp.id}/", body, format="json")
        self.assertEqual(res.status_code, 200, res.content)

    def test_create_without_edit_salary_cannot_set_pay(self):
        api = as_user(self.viewer)
        res = api.post("/api/hr/employees/", {"first_name": "N", "last_name": "M", "base_salary": "500"},
                       format="json")
        self.assertEqual(res.status_code, 400)
        res = api.post("/api/hr/employees/", {"first_name": "N", "last_name": "M"}, format="json")
        self.assertEqual(res.status_code, 201)

    def test_money_has_three_decimals(self):
        res = as_user(self.hr).patch(f"/api/hr/employees/{self.emp.id}/", {"base_salary": "612.345"},
                                     format="json")
        self.assertEqual(res.json()["base_salary"], "612.345")

    def test_iban_validation(self):
        api = as_user(self.hr)
        url = f"/api/hr/employees/{self.emp.id}/"
        res = api.patch(url, {"payment_method": "bank"}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("iban", res.json())
        bad = JO_IBAN[:-1] + ("1" if JO_IBAN[-1] != "1" else "2")
        self.assertEqual(api.patch(url, {"payment_method": "bank", "iban": bad}, format="json").status_code, 400)
        spaced = " ".join(JO_IBAN[i:i + 4] for i in range(0, len(JO_IBAN), 4)).lower()
        res = api.patch(url, {"payment_method": "bank", "iban": spaced}, format="json")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.json()["iban"], JO_IBAN)

    def test_iban_checker(self):
        self.assertTrue(iban_is_valid(JO_IBAN))
        self.assertTrue(iban_is_valid(make_iban("DE", "370400440532013000")))
        self.assertFalse(iban_is_valid(make_iban("JO", "CBJO001000000000013100030")))  # 29 chars
        self.assertFalse(iban_is_valid("JO00CBJO0010000000000131000302"))

    def test_effective_rates_follow_settings(self):
        api = as_user(self.hr)
        data = api.get(f"/api/hr/employees/{self.emp.id}/").json()
        self.assertEqual(data["effective_daily_rate"], "20.000")   # 600 / 30
        self.assertEqual(data["effective_hourly_rate"], "2.500")   # 20 / 8
        daily = Employee.objects.create(tenant=self.a, first_name="D", last_name="W", pay_type="daily",
                                        daily_rate=Decimal("18.5"))
        data = api.get(f"/api/hr/employees/{daily.id}/").json()
        self.assertEqual(data["effective_daily_rate"], "18.500")
        PayrollSettings.objects.filter(tenant=self.a).update(working_days_per_month=26, hours_per_day=Decimal("9"))
        data = api.get(f"/api/hr/employees/{self.emp.id}/").json()
        self.assertEqual(data["effective_daily_rate"], "23.077")   # 600 / 26
        self.assertEqual(data["effective_hourly_rate"], "2.564")   # 23.0769 / 9

    def test_old_payroll_generate_uses_base_salary(self):
        res = as_user(self.hr).post("/api/hr/payroll/generate/", {"period": "2026-11"}, format="json")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(Payroll.objects.get(employee=self.emp, period="2026-11").base_salary, Decimal("600"))
        self.assertFalse(Payroll.objects.filter(employee=self.emp_b).exists())


# ─── Phase 1: payroll settings ──────────────────────────────────────────────

class PayrollSettingsTests(HRSetup):
    url = "/api/hr/payroll-settings/"

    def test_defaults_created_unverified(self):
        data = as_user(self.owner).get(self.url).json()
        self.assertEqual(data["country"], "JO")
        self.assertEqual(data["working_days_per_month"], 30)
        self.assertEqual(data["hours_per_day"], "8.00")
        self.assertEqual(data["ssc_employee_pct"], "7.500")
        self.assertEqual(data["ssc_employer_pct"], "14.250")
        self.assertFalse(data["rates_verified"])
        self.assertEqual(data["tax_brackets"][-1], {"up_to": None, "rate": "30.000"})
        self.assertEqual(PayrollSettings.objects.filter(tenant=self.a).count(), 1)

    def test_each_company_has_its_own_settings(self):
        as_user(self.owner).patch(self.url, {"pay_day": 25}, format="json")
        self.assertEqual(as_user(self.owner_b).get(self.url).json()["pay_day"], 28)

    def test_editing_needs_manage_settings(self):
        self.assertEqual(as_user(self.hr).get(self.url).status_code, 200)   # has view_salary
        self.assertEqual(as_user(self.viewer).get(self.url).status_code, 403)
        self.assertEqual(as_user(self.hr).patch(self.url, {"pay_day": 1}, format="json").status_code, 403)
        settings_admin = make_member(self.a, "set@a.com", permissions=["hr.manage_settings"])
        res = as_user(settings_admin).patch(self.url, {"pay_day": 1}, format="json")
        self.assertEqual(res.status_code, 200)

    def test_put_not_allowed(self):
        self.assertEqual(as_user(self.owner).put(self.url, {}, format="json").status_code, 405)

    def test_verify_then_rate_change_clears_verification(self):
        api = as_user(self.owner)
        data = api.patch(self.url, {"rates_verified": True}, format="json").json()
        self.assertTrue(data["rates_verified"])
        self.assertIsNotNone(data["rates_verified_at"])
        self.assertEqual(data["rates_verified_by"], self.owner.id)

        data = api.patch(self.url, {"pay_day": 27}, format="json").json()   # not a rate
        self.assertTrue(data["rates_verified"])

        data = api.patch(self.url, {"ssc_ceiling": "3600.000"}, format="json").json()
        self.assertFalse(data["rates_verified"])
        self.assertIsNone(data["rates_verified_by"])

        data = api.patch(self.url, {"ssc_ceiling": "3700", "rates_verified": True}, format="json").json()
        self.assertTrue(data["rates_verified"])
        self.assertEqual(data["ssc_ceiling"], "3700.000")

    def test_same_rate_value_keeps_verification(self):
        api = as_user(self.owner)
        api.patch(self.url, {"rates_verified": True}, format="json")
        data = api.patch(self.url, {"ssc_employee_pct": "7.500", "tax_brackets": [
            {"up_to": 5000, "rate": 5}, {"up_to": "10000", "rate": "10"}, {"up_to": "15000", "rate": "15"},
            {"up_to": "20000", "rate": "20"}, {"up_to": "1000000", "rate": "25"}, {"up_to": None, "rate": "30"},
        ]}, format="json").json()
        self.assertTrue(data["rates_verified"])

    def test_bracket_validation(self):
        api = as_user(self.owner)
        for brackets in (
            [],
            [{"up_to": "5000", "rate": "5"}],                                   # last must be open
            [{"up_to": None, "rate": "5"}, {"up_to": None, "rate": "10"}],       # open in the middle
            [{"up_to": "5000", "rate": "5"}, {"up_to": "4000", "rate": "10"}, {"up_to": None, "rate": "20"}],
            [{"up_to": None, "rate": "120"}],
            [{"up_to": None, "rate": "abc"}],
            [{"up_to": None, "rate": "5", "extra": 1}],
        ):
            res = api.patch(self.url, {"tax_brackets": brackets}, format="json")
            self.assertEqual(res.status_code, 400, brackets)
            self.assertIn("tax_brackets", res.json())

    def test_field_limits(self):
        api = as_user(self.owner)
        for body in ({"pay_day": 31}, {"working_days_per_month": 0}, {"hours_per_day": "0"},
                     {"ssc_employee_pct": "101"}, {"overtime_rate_normal": "0.5"}, {"country": "SA"}):
            self.assertEqual(api.patch(self.url, body, format="json").status_code, 400, body)


# ─── Phase 1: allowances ────────────────────────────────────────────────────

class AllowanceTests(HRSetup):
    def setUp(self):
        super().setUp()
        self.settings_admin = make_member(self.a, "set@a.com", permissions=["hr.manage_settings"])
        self.transport = AllowanceType.objects.create(tenant=self.a, name_en="Transport", default_amount=Decimal("30"))

    def test_allowance_type_crud_needs_manage_settings(self):
        body = {"name_en": "Housing", "name_ar": "سكن", "kind": "percent", "default_amount": "10"}
        self.assertEqual(as_user(self.hr).post("/api/hr/allowance-types/", body, format="json").status_code, 403)
        res = as_user(self.settings_admin).post("/api/hr/allowance-types/", body, format="json")
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(AllowanceType.objects.get(pk=res.json()["id"]).tenant, self.a)
        names = [r["name_en"] for r in results(as_user(self.owner_b).get("/api/hr/allowance-types/"))]
        self.assertEqual(names, [])

    def test_percent_over_100_rejected(self):
        res = as_user(self.owner).post("/api/hr/allowance-types/",
                                       {"name_en": "X", "kind": "percent", "default_amount": "150"}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_employee_allowance_uses_default_or_override(self):
        api = as_user(self.hr)
        res = api.post("/api/hr/employee-allowances/", {"employee": self.emp.id, "allowance_type": self.transport.id},
                       format="json")
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(res.json()["effective_amount"], "30.000")
        res = api.patch(f"/api/hr/employee-allowances/{res.json()['id']}/", {"amount": "45.5"}, format="json")
        self.assertEqual(res.json()["effective_amount"], "45.500")

    def test_employee_allowance_needs_edit_salary(self):
        res = as_user(self.salary_viewer).post(
            "/api/hr/employee-allowances/", {"employee": self.emp.id, "allowance_type": self.transport.id},
            format="json")
        self.assertEqual(res.status_code, 403)

    def test_cannot_use_other_company_allowance_or_employee(self):
        type_b = AllowanceType.objects.create(tenant=self.b, name_en="Transport")
        api = as_user(self.hr)
        res = api.post("/api/hr/employee-allowances/", {"employee": self.emp.id, "allowance_type": type_b.id},
                       format="json")
        self.assertEqual(res.status_code, 400)
        res = api.post("/api/hr/employee-allowances/", {"employee": self.emp_b.id, "allowance_type": self.transport.id},
                       format="json")
        self.assertEqual(res.status_code, 400)

    def test_same_allowance_twice_rejected(self):
        EmployeeAllowance.objects.create(tenant=self.a, employee=self.emp, allowance_type=self.transport)
        res = as_user(self.hr).post("/api/hr/employee-allowances/",
                                    {"employee": self.emp.id, "allowance_type": self.transport.id}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_deleting_allowance_in_use_is_refused(self):
        EmployeeAllowance.objects.create(tenant=self.a, employee=self.emp, allowance_type=self.transport)
        res = as_user(self.settings_admin).delete(f"/api/hr/allowance-types/{self.transport.id}/")
        self.assertEqual(res.status_code, 409)
        self.assertTrue(AllowanceType.objects.filter(pk=self.transport.pk).exists())


# ─── Phase 1: documents ─────────────────────────────────────────────────────

class EmployeeDocumentTests(HRSetup):
    def setUp(self):
        super().setUp()
        self.media = tempfile.mkdtemp()
        self.override = override_settings(MEDIA_ROOT=self.media)
        self.override.enable()

    def tearDown(self):
        self.override.disable()
        shutil.rmtree(self.media, ignore_errors=True)
        super().tearDown()

    def upload(self, user, employee, name="id card.pdf", content=b"%PDF-1.4 test"):
        return as_user(user).post("/api/hr/employee-documents/", {
            "employee": employee.id, "doc_type": "national_id",
            "file": SimpleUploadedFile(name, content, content_type="application/pdf"),
        }, format="multipart")

    def test_upload_and_download(self):
        res = self.upload(self.viewer, self.emp)
        self.assertEqual(res.status_code, 201, res.content)
        data = res.json()
        self.assertNotIn("file", data)
        self.assertEqual(data["original_filename"], "id card.pdf")
        doc = EmployeeDocument.objects.get(pk=data["id"])
        self.assertEqual(doc.tenant, self.a)
        self.assertNotIn("id card", doc.file.name)          # stored name is random
        self.assertTrue(doc.file.name.startswith(f"hr_documents/{self.a.id}/"))

        res = as_user(self.viewer).get(data["download_url"])
        self.assertEqual(res.status_code, 200)
        self.assertEqual(b"".join(res.streaming_content), b"%PDF-1.4 test")
        self.assertIn("id card.pdf", res["Content-Disposition"])

    def test_other_company_cannot_see_or_download(self):
        doc_id = self.upload(self.viewer, self.emp).json()["id"]
        api_b = as_user(self.owner_b)
        self.assertEqual(api_b.get(f"/api/hr/employee-documents/{doc_id}/download/").status_code, 404)
        self.assertEqual(results(api_b.get("/api/hr/employee-documents/")), [])

    def test_cannot_upload_for_other_company_employee(self):
        self.assertEqual(self.upload(self.viewer, self.emp_b).status_code, 400)

    def test_needs_manage_employees(self):
        reader = make_member(self.a, "reader@a.com", permissions=["hr.view_employees"])
        self.assertEqual(self.upload(reader, self.emp).status_code, 403)
        self.assertEqual(as_user(reader).get("/api/hr/employee-documents/").status_code, 403)

    def test_bad_file_type_rejected(self):
        self.assertEqual(self.upload(self.viewer, self.emp, name="run.exe").status_code, 400)

    def test_delete_removes_file(self):
        doc_id = self.upload(self.viewer, self.emp).json()["id"]
        storage_name = EmployeeDocument.objects.get(pk=doc_id).file.name
        storage = EmployeeDocument._meta.get_field("file").storage
        self.assertTrue(storage.exists(storage_name))
        self.assertEqual(as_user(self.viewer).delete(f"/api/hr/employee-documents/{doc_id}/").status_code, 204)
        self.assertFalse(storage.exists(storage_name))


# ─── Pure helpers ───────────────────────────────────────────────────────────

class PayrollHelperTests(SimpleTestCase):
    def test_quantize_jod_rounds_half_up_to_fils(self):
        self.assertEqual(quantize_jod("1.0005"), Decimal("1.001"))
        self.assertEqual(quantize_jod("1.0004"), Decimal("1.000"))
        self.assertEqual(quantize_jod(7), Decimal("7.000"))
        with self.assertRaises(TypeError):
            quantize_jod(1.5)

    def test_rates(self):
        self.assertEqual(daily_rate("monthly", Decimal("600"), Decimal("0"), 30), Decimal("20"))
        self.assertEqual(daily_rate("daily", Decimal("600"), Decimal("18"), 30), Decimal("18"))
        self.assertEqual(daily_rate("piece_rate", Decimal("0"), Decimal("15"), 30), Decimal("15"))
        self.assertEqual(hourly_rate(Decimal("20"), Decimal("8")), Decimal("2.5"))
        self.assertEqual(overtime_hourly_rate(Decimal("2.5"), Decimal("1.25")), Decimal("3.125"))
        with self.assertRaises(ValueError):
            daily_rate("monthly", Decimal("600"), Decimal("0"), 0)
        with self.assertRaises(ValueError):
            hourly_rate(Decimal("20"), 0)

    def test_overtime_amount_rounds_once(self):
        """10 overtime hours on 650/30/8: rounding the rate first would lose fils."""
        hourly = hourly_rate(daily_rate("monthly", Decimal("650"), 0, 30), 8)
        amount = quantize_jod(overtime_hourly_rate(hourly, Decimal("1.25")) * 10)
        self.assertEqual(amount, Decimal("33.854"))

    def test_normalize_brackets(self):
        self.assertEqual(normalize_brackets([{"up_to": 5000, "rate": "5"}, {"up_to": None, "rate": 10}]),
                         [{"up_to": "5000.000", "rate": "5.000"}, {"up_to": None, "rate": "10.000"}])
        with self.assertRaises(BracketError):
            normalize_brackets([{"up_to": None, "rate": 5.5}])   # floats refused
