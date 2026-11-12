import re

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from crm.models import Client, Payment, Project, Quotation, Room
from tenants.models import Company, CompanyMembership

from .models import Installation, InstallationAssignment
from .snapshot import build_design_snapshot

User = get_user_model()
Role = CompanyMembership.Role
FORBIDDEN_FRAGMENTS = ("price", "cost", "margin", "payment", "quotation", "contract", "total", "amount",
                       "discount", "proposal", "invoice", "profit", "deposit")
FORBIDDEN_WORDS = {"vat", "tax", "quote", "paid", "balance", "cheque", "fee"}


def is_forbidden_key(key):
    lowered = str(key).lower()
    if any(fragment in lowered for fragment in FORBIDDEN_FRAGMENTS):
        return True
    words = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", str(key)).lower().replace("-", "_").split("_")
    return any(word in FORBIDDEN_WORDS for word in words)

PRICED_PLANNER_DATA = {
    "room": {"width": 4000, "depth": 3000, "ceilingHeight": 2800, "price": 5},
    "walls": [
        {"id": "w1", "x1": 0, "y1": 0, "x2": 4000, "y2": 0, "thickness": 120, "cost": 9},
        {"id": "w2", "x1": 0, "y1": 0, "x2": 0, "y2": 3000, "thickness": 120},
    ],
    "elements": [
        {"id": 10, "type": "water", "label": "Water Supply", "x": 1200, "y": 20, "w": 100, "h": 100, "elevation": 500},
    ],
    "cabinets": [
        {"id": 1, "label": "Sink 800", "category": "base", "subtype": "Sink", "width": 800, "height": 720,
         "depth": 560, "x": 1000, "y": 60, "rotation": 0, "doorStyle": "Gola", "golaColor": "#111",
         "frontMaterialCode": "U999", "frontMaterialName": "Black", "frontColor": "#000",
         "carcassMaterialCode": "W1000", "carcassMaterialName": "White", "carcassColor": "#fff",
         "sinkBrand": "Franke", "sinkModel": "Maris 610", "sinkCutoutWidthMm": 760, "sinkCutoutDepthMm": 480,
         "sinkPrice": 320, "price": 410, "unitCost": 200, "margin": 0.3,
         "zonePreset": {"id": "4_drawers", "zones": [{"type": "drawer", "h": 180, "price": 1}]}},
        {"id": 2, "label": "Fridge 600", "category": "tall", "subtype": "Freestanding Fridge", "width": 600,
         "height": 1800, "depth": 650, "x": 20, "y": 1500, "rotation": 90, "applianceFinish": "Stainless",
         "totalCost": 99},
        {"id": 3, "label": "Island 1200", "category": "base", "subtype": "Island", "width": 1200, "height": 720,
         "depth": 900, "x": 1800, "y": 1500},
    ],
    "countertopMat": {"id": "ct1", "code": "5100", "name": "Silestone White", "brand": "Silestone",
                      "color": "#eee", "price": 180, "pricePerM2": 180},
    "countertopThickness": 30,
    "grandTotal": 12500,
    "proposalSettings": {"margin": 30, "vat": 16, "laborCost": 50},
    "projectDefaults": {"doorStyle": "Gola", "priceList": "A"},
}


def forbidden_keys(value, path=""):
    found = []
    if isinstance(value, dict):
        for key, child in value.items():
            if is_forbidden_key(key):
                found.append(f"{path}.{key}")
            found.extend(forbidden_keys(child, f"{path}.{key}"))
    elif isinstance(value, list):
        for i, child in enumerate(value):
            found.extend(forbidden_keys(child, f"{path}[{i}]"))
    return found


def make_member(company, email, role, permissions=None):
    user = User.objects.create_user(username=email, email=email, password="pass12345", user_type="manufacturer",
                                    first_name=email.split("@")[0])
    CompanyMembership.objects.create(company=company, user=user, role=role, permissions=permissions or [])
    return user


def as_user(user):
    api = APIClient()
    api.force_authenticate(user)
    return api


def make_company(slug):
    return Company.objects.create(name=slug.upper(), slug=slug, status=Company.Status.ACTIVE, max_users=50)


def make_locked_room(company, name="Kitchen"):
    client = Client.objects.create(tenant=company, name=f"Customer {company.slug}", phone="0790000000",
                                   address="Amman, Khalda")
    project = Project.objects.create(client=client, name=f"Villa {company.slug}", total_value=12500)
    room = Room.objects.create(project=project, name=name, planner_data=PRICED_PLANNER_DATA, grand_total=12500,
                               is_locked=True, locked_at=timezone.now(),
                               revision_status=Room.RevisionStatus.APPROVED)
    return project, room


def make_installation(company, project, room, **extra):
    return Installation.objects.create(tenant=company, project=project, room=room,
                                       design_snapshot=build_design_snapshot(room), address="Khalda, street 5",
                                       lat=31.99, lng=35.85, **extra)


class FieldOpsSetup(TestCase):
    def setUp(self):
        self.a = make_company("a")
        self.b = make_company("b")
        self.owner = make_member(self.a, "owner@a.com", Role.OWNER)
        self.admin = make_member(self.a, "admin@a.com", Role.ADMIN)
        self.manager = make_member(self.a, "manager@a.com", Role.FIELD_MANAGER)
        self.staff = make_member(self.a, "staff@a.com", Role.STAFF)
        self.staff_fo = make_member(self.a, "staff-fo@a.com", Role.STAFF, ["field_ops.manage"])
        self.installer = make_member(self.a, "installer@a.com", Role.INSTALLER)
        self.other_installer = make_member(self.a, "installer2@a.com", Role.INSTALLER)
        self.driver = make_member(self.a, "driver@a.com", Role.DRIVER)
        self.installer_b = make_member(self.b, "installer@b.com", Role.INSTALLER)
        self.project, self.room = make_locked_room(self.a)
        self.project_b, self.room_b = make_locked_room(self.b)
        self.job = make_installation(self.a, self.project, self.room, scheduled_date="2026-11-10")
        self.unassigned_job = make_installation(self.a, self.project, self.room, scheduled_date="2026-11-11")
        self.job_b = make_installation(self.b, self.project_b, self.room_b, scheduled_date="2026-11-10")
        InstallationAssignment.objects.create(installation=self.job, user=self.installer, is_lead=True)
        InstallationAssignment.objects.create(installation=self.job_b, user=self.installer_b)


class InstallerScopeTests(FieldOpsSetup):
    def test_installer_cannot_see_other_company_jobs(self):
        api = as_user(self.installer)
        ids = [j["id"] for j in api.get("/api/field-ops/my-jobs/").json()["results"]]
        self.assertNotIn(self.job_b.id, ids)
        self.assertEqual(api.get(f"/api/field-ops/my-jobs/{self.job_b.id}/").status_code, 404)

    def test_installer_cannot_see_unassigned_jobs_in_own_company(self):
        api = as_user(self.installer)
        ids = [j["id"] for j in api.get("/api/field-ops/my-jobs/").json()["results"]]
        self.assertEqual(ids, [self.job.id])
        self.assertEqual(api.get(f"/api/field-ops/my-jobs/{self.unassigned_job.id}/").status_code, 404)
        self.assertEqual(as_user(self.other_installer).get("/api/field-ops/my-jobs/").json()["results"], [])

    def test_my_jobs_is_read_only(self):
        api = as_user(self.installer)
        url = f"/api/field-ops/my-jobs/{self.job.id}/"
        self.assertEqual(api.patch(url, {"status": "completed"}, format="json").status_code, 405)
        self.assertEqual(api.delete(url).status_code, 405)
        self.assertEqual(api.post("/api/field-ops/my-jobs/", {}, format="json").status_code, 405)

    def test_installer_cannot_use_management_endpoints(self):
        api = as_user(self.installer)
        for url in ("/api/field-ops/installations/", "/api/field-ops/assignments/",
                    "/api/field-ops/locked-rooms/", "/api/field-ops/crew/"):
            with self.subTest(url=url):
                self.assertEqual(api.get(url).status_code, 403)

    def test_object_permission_rejects_unassigned_job(self):
        from types import SimpleNamespace
        from .permissions import IsAssignedInstaller
        request = SimpleNamespace(user=self.other_installer, company=self.a)
        self.assertFalse(IsAssignedInstaller().has_object_permission(request, None, self.job))
        request = SimpleNamespace(user=self.installer, company=self.a)
        self.assertTrue(IsAssignedInstaller().has_object_permission(request, None, self.job))
        request = SimpleNamespace(user=self.installer, company=self.b)
        self.assertFalse(IsAssignedInstaller().has_object_permission(request, None, self.job))

    def test_driver_has_no_screens_yet(self):
        self.assertEqual(as_user(self.driver).get("/api/field-ops/my-jobs/").status_code, 403)


class InstallerPayloadTests(FieldOpsSetup):
    def detail(self):
        return as_user(self.installer).get(f"/api/field-ops/my-jobs/{self.job.id}/").json()

    def test_no_price_keys_in_installer_responses(self):
        api = as_user(self.installer)
        for body in (api.get("/api/field-ops/my-jobs/").json(), self.detail()):
            self.assertEqual(forbidden_keys(body), [])

    def test_detail_contains_what_installers_need(self):
        body = self.detail()
        self.assertEqual(body["customer_name"], "Customer a")
        self.assertEqual(body["customer_phone"], "0790000000")
        self.assertEqual(body["address"], "Khalda, street 5")
        self.assertIn("31.99,35.85", body["maps_url"])
        design = body["design"]
        self.assertEqual(design["room"], {"width_mm": 4000, "depth_mm": 3000, "ceiling_height_mm": 2800})
        self.assertEqual([w["length_mm"] for w in design["walls"]], [4000, 3000])
        cabinets = {c["id"]: c for c in design["cabinets"]}
        self.assertEqual(cabinets[1]["wall"], 0)
        self.assertEqual(cabinets[2]["wall"], 1)
        self.assertIsNone(cabinets[3]["wall"])
        self.assertEqual(cabinets[1]["frontMaterialCode"], "U999")
        self.assertEqual(design["countertop"]["material"]["name"], "Silestone White")
        self.assertEqual(design["countertop"]["sink_cutouts"][0]["cutout_width_mm"], 760)
        self.assertEqual(design["countertop"]["sink_cutouts"][0]["model"], "Maris 610")
        self.assertEqual(design["appliances"][0]["subtype"], "Freestanding Fridge")
        self.assertIn({"role": "front", "code": "U999", "name": "Black", "color": "#000"}, design["finishes"])
        self.assertEqual(design["elements"][0]["wall"], 0)
        self.assertEqual(body["crew"], [{"name": "installer", "is_lead": True}])

    def test_list_is_light(self):
        job = as_user(self.installer).get("/api/field-ops/my-jobs/").json()["results"][0]
        self.assertNotIn("design", job)
        self.assertEqual(job["customer_name"], "Customer a")

    def test_phone_and_address_hidden_on_completed_jobs(self):
        self.job.status = Installation.Status.COMPLETED
        self.job.save()
        api = as_user(self.installer)
        for body in (self.detail(), api.get("/api/field-ops/my-jobs/").json()["results"][0]):
            self.assertIsNone(body["customer_phone"])
            self.assertIsNone(body["address"])
            self.assertIsNone(body["lat"])
            self.assertIsNone(body["maps_url"])

    def test_forbidden_key_check_catches_price_fields(self):
        self.assertEqual(len(forbidden_keys(PRICED_PLANNER_DATA)), 16)
        self.assertEqual(forbidden_keys({"elevation": 1, "label": "x"}), [])

    def test_snapshot_never_stores_price_keys(self):
        self.assertEqual(forbidden_keys(self.job.design_snapshot), [])


class InstallerBlockedTests(FieldOpsSetup):
    def test_installer_gets_403_on_other_modules(self):
        api = as_user(self.installer)
        for url in ("/api/crm/clients/", "/api/crm/projects/", "/api/crm/rooms/", "/api/crm/payments/",
                    "/api/crm/quotations/", "/api/manufacturing/work-orders/", "/api/manufacturing/cutting-jobs/",
                    "/api/inventory/suppliers/", "/api/inventory/movements/", "/api/inventory/cabinet-templates/",
                    "/api/srm/purchase-orders/", "/api/hr/employees/", "/api/hr/payroll/"):
            with self.subTest(url=url):
                self.assertEqual(api.get(url).status_code, 403)


class FieldManagerTests(FieldOpsSetup):
    def create_job(self, user, **extra):
        return as_user(user).post("/api/field-ops/installations/", {
            "project": self.project.id, "room": self.room.id, "scheduled_date": "2026-12-01", **extra,
        }, format="json")

    def test_field_manager_gets_403_on_finance_and_other_modules(self):
        Payment.objects.create(project=self.project, label="Deposit", amount=5000)
        Quotation.objects.create(client=self.project.client, quote_number="Q-1", total_amount=12500)
        api = as_user(self.manager)
        for url in ("/api/crm/payments/", "/api/crm/transactions/", "/api/crm/quotations/",
                    "/api/crm/quotation-items/", "/api/crm/projects/", "/api/crm/clients/", "/api/crm/rooms/",
                    "/api/srm/purchase-orders/", "/api/srm/line-items/", "/api/hr/employees/", "/api/hr/payroll/",
                    "/api/inventory/suppliers/", "/api/inventory/movements/", "/api/inventory/alerts/",
                    "/api/inventory/cabinet-templates/"):
            with self.subTest(url=url):
                self.assertEqual(api.get(url).status_code, 403)

    def test_field_manager_can_create_update_and_delete_installations(self):
        res = self.create_job(self.manager, area="Khalda")
        self.assertEqual(res.status_code, 201, res.content)
        job = Installation.objects.get(id=res.json()["id"])
        self.assertEqual(job.tenant, self.a)
        self.assertEqual(job.address, "Amman, Khalda")
        self.assertEqual(job.design_snapshot["revision_number"], 1)
        api = as_user(self.manager)
        res = api.patch(f"/api/field-ops/installations/{job.id}/", {"status": "in_progress"}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(api.delete(f"/api/field-ops/installations/{job.id}/").status_code, 204)

    def test_field_manager_assigns_installers_and_drivers(self):
        api = as_user(self.manager)
        for user in (self.other_installer, self.driver):
            res = api.post("/api/field-ops/assignments/", {"installation": self.job.id, "user": user.id},
                           format="json")
            self.assertEqual(res.status_code, 201, res.content)
        for user in (self.staff, self.admin, self.installer_b):
            res = api.post("/api/field-ops/assignments/", {"installation": self.job.id, "user": user.id},
                           format="json")
            self.assertEqual(res.status_code, 400)

    def test_duplicate_assignment_rejected(self):
        res = as_user(self.manager).post("/api/field-ops/assignments/",
                                         {"installation": self.job.id, "user": self.installer.id}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_cannot_use_other_company_records(self):
        api = as_user(self.manager)
        res = api.post("/api/field-ops/installations/", {"project": self.project_b.id, "room": self.room_b.id},
                       format="json")
        self.assertEqual(res.status_code, 400)
        res = api.post("/api/field-ops/assignments/", {"installation": self.job_b.id, "user": self.installer.id},
                       format="json")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(api.get(f"/api/field-ops/installations/{self.job_b.id}/").status_code, 404)

    def test_only_locked_kitchens_can_be_installed(self):
        draft = Room.objects.create(project=self.project, name="Draft", planner_data={})
        res = self.create_job(self.manager, room=draft.id)
        self.assertEqual(res.status_code, 400)
        rooms = [r["id"] for r in as_user(self.manager).get("/api/field-ops/locked-rooms/").json()["results"]]
        self.assertEqual(rooms, [self.room.id])

    def test_list_filters(self):
        api = as_user(self.manager)
        ids = lambda q: [j["id"] for j in api.get(f"/api/field-ops/installations/?{q}").json()["results"]]
        self.assertEqual(ids(f"installer={self.installer.id}"), [self.job.id])
        self.assertEqual(ids("date_from=2026-11-11"), [self.unassigned_job.id])
        self.assertEqual(ids("status=completed"), [])

    def test_no_price_keys_in_field_manager_responses(self):
        api = as_user(self.manager)
        urls = ("/api/field-ops/installations/", f"/api/field-ops/installations/{self.job.id}/",
                "/api/field-ops/assignments/", "/api/field-ops/locked-rooms/", "/api/field-ops/crew/",
                "/api/field-ops/my-jobs/", "/api/tenants/members/", "/api/tenants/permissions/", "/api/auth/me/")
        for url in urls:
            with self.subTest(url=url):
                res = api.get(url)
                if res.status_code == 200:
                    self.assertEqual(forbidden_keys(res.json()), [])
        created = self.create_job(self.manager).json()
        self.assertEqual(forbidden_keys(created), [])


class ManagementAccessTests(FieldOpsSetup):
    def test_staff_without_flag_gets_403(self):
        api = as_user(self.staff)
        for url in ("/api/field-ops/installations/", "/api/field-ops/assignments/",
                    "/api/field-ops/locked-rooms/", "/api/field-ops/crew/"):
            with self.subTest(url=url):
                self.assertEqual(api.get(url).status_code, 403)
        res = api.post("/api/field-ops/installations/", {"project": self.project.id, "room": self.room.id},
                       format="json")
        self.assertEqual(res.status_code, 403)

    def test_staff_with_flag_succeeds(self):
        api = as_user(self.staff_fo)
        self.assertEqual(api.get("/api/field-ops/installations/").status_code, 200)
        res = api.post("/api/field-ops/installations/", {"project": self.project.id, "room": self.room.id},
                       format="json")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(api.get("/api/crm/clients/").status_code, 200)

    def test_owner_and_admin_manage_implicitly(self):
        for user in (self.owner, self.admin):
            with self.subTest(user=user.email):
                self.assertEqual(as_user(user).get("/api/field-ops/installations/").status_code, 200)

    def test_crew_lists_only_field_workers(self):
        names = {m["role"] for m in as_user(self.owner).get("/api/field-ops/crew/").json()}
        self.assertEqual(names, {"installer", "driver"})


class HardwareSummaryTests(FieldOpsSetup):
    SUMMARY = [{"key": "hinges", "qty": 12}, {"key": "drawer_runner_sets", "qty": 4, "spec": "LEGRABOX"}]

    def create_job(self, summary, user=None):
        return as_user(user or self.manager).post("/api/field-ops/installations/", {
            "project": self.project.id, "room": self.room.id, "hardware_summary": summary}, format="json")

    def test_summary_is_saved_in_design_copy_and_shown_to_installer(self):
        res = self.create_job(self.SUMMARY)
        self.assertEqual(res.status_code, 201, res.content)
        self.assertNotIn("hardware_summary", res.json())
        job = Installation.objects.get(id=res.json()["id"])
        self.assertEqual(job.design_snapshot["hardwareSummary"], self.SUMMARY)
        InstallationAssignment.objects.create(installation=job, user=self.other_installer)
        body = as_user(self.other_installer).get(f"/api/field-ops/my-jobs/{job.id}/").json()
        self.assertEqual(body["design"]["hardwareSummary"], self.SUMMARY)
        self.assertEqual(forbidden_keys(body), [])

    def test_extra_fields_in_summary_items_are_dropped(self):
        res = self.create_job([{"key": "hinges", "qty": 12, "unitCost": 3.5, "price": 40, "total": 42}])
        self.assertEqual(res.status_code, 201, res.content)
        job = Installation.objects.get(id=res.json()["id"])
        self.assertEqual(job.design_snapshot["hardwareSummary"], [{"key": "hinges", "qty": 12}])
        self.assertEqual(forbidden_keys(job.design_snapshot), [])

    def test_unknown_hardware_keys_are_rejected(self):
        for item in ({"key": "cost", "qty": 1}, {"key": "price", "qty": 1}, {"key": "hinges", "qty": -1},
                     {"key": "hinges", "qty": "many"}):
            with self.subTest(item=item):
                self.assertEqual(self.create_job([item]).status_code, 400)

    def test_summary_is_optional(self):
        res = self.create_job(None)
        self.assertEqual(res.status_code, 400)
        res = as_user(self.manager).post("/api/field-ops/installations/", {
            "project": self.project.id, "room": self.room.id}, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertIsNone(res.json()["design"]["hardwareSummary"])

    def test_summary_can_be_updated_without_changing_kitchen(self):
        job_id = self.create_job(self.SUMMARY).json()["id"]
        res = as_user(self.manager).patch(f"/api/field-ops/installations/{job_id}/", {
            "hardware_summary": [{"key": "legs", "qty": 8}]}, format="json")
        self.assertEqual(res.status_code, 200)
        snapshot = Installation.objects.get(id=job_id).design_snapshot
        self.assertEqual(snapshot["hardwareSummary"], [{"key": "legs", "qty": 8}])
        self.assertEqual(len(snapshot["cabinets"]), 3)

    def test_locked_room_cabinets_are_price_free(self):
        res = as_user(self.manager).get(f"/api/field-ops/locked-rooms/{self.room.id}/cabinets/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.json()["cabinets"]), 3)
        self.assertEqual(forbidden_keys(res.json()), [])
        self.assertEqual(as_user(self.installer).get(
            f"/api/field-ops/locked-rooms/{self.room.id}/cabinets/").status_code, 403)
        self.assertEqual(as_user(self.manager).get(
            f"/api/field-ops/locked-rooms/{self.room_b.id}/cabinets/").status_code, 404)


class HardwareInputsTests(TestCase):
    ENGINE_INPUTS = (
        "width", "height", "depth", "material", "doorStyle", "category", "doorCount", "subtype", "zonePreset",
        "drawerType", "drawerSystem", "drawerBoxConstruction", "baseHeight", "openBoxMaterialSource",
        "nicheLowerDoorH", "nicheUpperDoorH", "shelfCount", "glassShelfCount",
    )

    def test_saved_cabinets_keep_every_input_the_hardware_engine_reads(self):
        from .snapshot import CABINET_FIELDS
        missing = [f for f in self.ENGINE_INPUTS if f not in CABINET_FIELDS and f != "zonePreset"]
        self.assertEqual(missing, [])

    def test_zone_preset_keeps_door_count_and_zones(self):
        from .snapshot import _zone_preset
        preset = {"id": "2_small_1_door", "doorCount": 2, "price": 9,
                  "zones": [{"type": "drawer", "h": 180, "cost": 1}, {"type": "door", "h": 360}]}
        self.assertEqual(_zone_preset(preset), {"id": "2_small_1_door", "doorCount": 2,
                                                "zones": [{"type": "drawer", "h": 180}, {"type": "door", "h": 360}]})


class HardwareFrozenFlagTests(FieldOpsSetup):
    def test_flag_follows_saved_summary(self):
        api = as_user(self.manager)
        url = f"/api/field-ops/installations/{self.job.id}/"
        self.assertFalse(api.get(url).json()["hardware_frozen"])
        listed = {j["id"]: j for j in api.get("/api/field-ops/installations/").json()["results"]}
        self.assertFalse(listed[self.job.id]["hardware_frozen"])
        api.patch(url, {"hardware_summary": [{"key": "hinges", "qty": 4}]}, format="json")
        self.assertTrue(api.get(url).json()["hardware_frozen"])
        listed = {j["id"]: j for j in api.get("/api/field-ops/installations/").json()["results"]}
        self.assertTrue(listed[self.job.id]["hardware_frozen"])

    def test_empty_summary_counts_as_frozen(self):
        api = as_user(self.manager)
        url = f"/api/field-ops/installations/{self.job.id}/"
        api.patch(url, {"hardware_summary": []}, format="json")
        self.assertTrue(api.get(url).json()["hardware_frozen"])

    def test_changing_kitchen_without_summary_unfreezes(self):
        api = as_user(self.manager)
        url = f"/api/field-ops/installations/{self.job.id}/"
        api.patch(url, {"hardware_summary": [{"key": "hinges", "qty": 4}]}, format="json")
        _, other_room = make_locked_room(self.a, name="Second")
        other_room.project = self.project
        other_room.save()
        res = api.patch(url, {"room": other_room.id}, format="json")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertFalse(res.json()["hardware_frozen"])

    def test_installer_response_has_no_frozen_flag(self):
        body = as_user(self.installer).get(f"/api/field-ops/my-jobs/{self.job.id}/").json()
        self.assertNotIn("hardware_frozen", body)
