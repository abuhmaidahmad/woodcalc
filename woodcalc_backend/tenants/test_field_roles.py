import importlib

from django.apps import apps as django_apps
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from tenants.models import Company, CompanyMembership, CompanySettings

User = get_user_model()
Role = CompanyMembership.Role
FIELD_ROLES = (Role.FIELD_MANAGER, Role.INSTALLER, Role.DRIVER)

BLOCKED_ENDPOINTS = (
    '/api/crm/clients/',
    '/api/crm/projects/',
    '/api/crm/rooms/',
    '/api/crm/payments/',
    '/api/crm/transactions/',
    '/api/crm/quotations/',
    '/api/crm/leads/',
    '/api/srm/purchase-orders/',
    '/api/hr/employees/',
    '/api/hr/payroll/',
    '/api/inventory/suppliers/',
    '/api/inventory/movements/',
    '/api/inventory/alerts/',
    '/api/inventory/cabinet-templates/',
    '/api/manufacturing/work-orders/',
    '/api/cadcam/import-jobs/',
    '/api/tenants/settings/',
)


def make_member(company, email, role, permissions=None):
    user = User.objects.create_user(username=email, email=email, password='pass12345', user_type='manufacturer')
    CompanyMembership.objects.create(company=company, user=user, role=role, permissions=permissions or [])
    return user


def as_user(user):
    api = APIClient()
    api.force_authenticate(user)
    return api


class FieldRoleSetup(TestCase):
    def setUp(self):
        self.company = Company.objects.create(name='A', slug='a', status=Company.Status.ACTIVE)
        self.owner = make_member(self.company, 'owner@a.com', Role.OWNER)
        self.admin = make_member(self.company, 'admin@a.com', Role.ADMIN)
        self.staff = make_member(self.company, 'staff@a.com', Role.STAFF)
        self.staff_fo = make_member(self.company, 'staff-fo@a.com', Role.STAFF, ['field_ops.manage'])
        self.auditor = make_member(self.company, 'auditor@a.com', Role.AUDITOR)
        self.manager = make_member(self.company, 'manager@a.com', Role.FIELD_MANAGER)
        self.installer = make_member(self.company, 'installer@a.com', Role.INSTALLER)
        self.driver = make_member(self.company, 'driver@a.com', Role.DRIVER)
        self.company.max_users = 50
        self.company.save(update_fields=['max_users'])

    def field_users(self):
        return {'field_manager': self.manager, 'installer': self.installer, 'driver': self.driver}


class CompanySettingsTests(FieldRoleSetup):
    def test_settings_created_for_new_company(self):
        company = Company.objects.create(name='New', slug='new')
        self.assertEqual(company.settings.delivery_method, CompanySettings.DeliveryMethod.THIRD_PARTY_LINK)

    def test_backfill_creates_missing_settings_and_sets_arabian_build(self):
        backfill = importlib.import_module('tenants.migrations.0007_backfill_company_settings').backfill
        bare = Company.objects.create(name='Bare', slug='bare')
        bare.settings.delete()
        arabian = Company.objects.create(name='Arabian Build Cabinetry', slug='arabian-build')
        CompanySettings.objects.filter(company=arabian).update(delivery_method='in_house')
        backfill(django_apps, None)
        self.assertTrue(CompanySettings.objects.filter(company=bare).exists())
        self.assertEqual(CompanySettings.objects.get(company=arabian).delivery_method, 'third_party_link')

    def test_settings_endpoint_returns_and_updates_delivery_method(self):
        api = as_user(self.owner)
        self.assertEqual(api.get('/api/tenants/settings/').json()['delivery_method'], 'third_party_link')
        res = api.patch('/api/tenants/settings/', {'delivery_method': 'installer'}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['delivery_method'], 'installer')
        self.assertEqual(CompanySettings.objects.get(company=self.company).delivery_method, 'installer')
        self.assertNotIn('delivery_method', CompanySettings.objects.get(company=self.company).flags)

    def test_rejects_unknown_delivery_method(self):
        res = as_user(self.owner).patch('/api/tenants/settings/', {'delivery_method': 'drone'}, format='json')
        self.assertEqual(res.status_code, 400)

    def test_staff_cannot_change_delivery_method(self):
        res = as_user(self.staff).patch('/api/tenants/settings/', {'delivery_method': 'in_house'}, format='json')
        self.assertEqual(res.status_code, 403)


class FieldRoleBlockingTests(FieldRoleSetup):
    def test_field_roles_get_403_on_other_modules(self):
        for name, user in self.field_users().items():
            api = as_user(user)
            for url in BLOCKED_ENDPOINTS:
                with self.subTest(role=name, url=url):
                    self.assertEqual(api.get(url).status_code, 403)

    def test_field_roles_cannot_write_public_catalog(self):
        for name, user in self.field_users().items():
            with self.subTest(role=name):
                res = as_user(user).post('/api/inventory/materials/', {'name': 'X'}, format='json')
                self.assertEqual(res.status_code, 403)

    def test_public_catalog_stays_readable(self):
        self.assertEqual(as_user(self.installer).get('/api/inventory/materials/').status_code, 200)

    def test_other_roles_keep_access(self):
        for user in (self.owner, self.staff, self.staff_fo, self.auditor):
            with self.subTest(user=user.email):
                self.assertEqual(as_user(user).get('/api/crm/clients/').status_code, 200)

    def test_field_role_permission_codes_are_ignored(self):
        CompanyMembership.objects.filter(user=self.manager).update(permissions=['team.manage_members'])
        res = as_user(self.manager).post('/api/tenants/members/', {
            'email': 'x@a.com', 'first_name': 'X', 'password': 'pass12345', 'role': 'admin'}, format='json')
        self.assertEqual(res.status_code, 400)


class FieldOpsPermissionFlagTests(FieldRoleSetup):
    def test_me_reports_field_ops_access(self):
        expected = {
            self.owner: True, self.admin: True, self.manager: True, self.staff_fo: True,
            self.staff: False, self.auditor: False, self.installer: False, self.driver: False,
        }
        for user, allowed in expected.items():
            with self.subTest(user=user.email):
                company = as_user(user).get('/api/auth/me/').json()['company']
                self.assertEqual(company['can_manage_field_ops'], allowed)

    def test_field_ops_manage_is_a_known_permission(self):
        codes = [p['code'] for p in as_user(self.owner).get('/api/tenants/permissions/').json()]
        self.assertIn('field_ops.manage', codes)

    def test_owner_can_tick_field_ops_manage_for_staff(self):
        member = CompanyMembership.objects.get(user=self.staff)
        res = as_user(self.owner).patch(f'/api/tenants/members/{member.id}/',
                                        {'permissions': ['field_ops.manage']}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['permissions'], ['field_ops.manage'])


class FieldTeamManagementTests(FieldRoleSetup):
    def create(self, user, role, email='new@a.com', **extra):
        return as_user(user).post('/api/tenants/members/', {
            'email': email, 'first_name': 'N', 'password': 'pass12345', 'role': role, **extra}, format='json')

    def test_owner_can_add_field_roles(self):
        for i, role in enumerate(('installer', 'driver', 'field_manager')):
            with self.subTest(role=role):
                res = self.create(self.owner, role, email=f'n{i}@a.com', permissions=['hr.view_employees'])
                self.assertEqual(res.status_code, 201)
                self.assertEqual(res.json()['role'], role)
                self.assertEqual(res.json()['permissions'], [])

    def test_field_manager_can_add_installers_and_drivers(self):
        self.assertEqual(self.create(self.manager, 'installer', email='i2@a.com').status_code, 201)
        self.assertEqual(self.create(self.manager, 'driver', email='d2@a.com').status_code, 201)

    def test_field_manager_cannot_add_other_roles(self):
        for role in ('admin', 'staff', 'auditor', 'field_manager', 'owner'):
            with self.subTest(role=role):
                self.assertEqual(self.create(self.manager, role).status_code, 400)
        self.assertFalse(User.objects.filter(email='new@a.com').exists())

    def test_field_manager_sees_only_field_workers(self):
        roles = {m['role'] for m in as_user(self.manager).get('/api/tenants/members/').json()['results']}
        self.assertEqual(roles, {'installer', 'driver'})

    def test_field_manager_cannot_edit_or_remove_office_members(self):
        api = as_user(self.manager)
        for user in (self.owner, self.admin, self.staff, self.auditor):
            member = CompanyMembership.objects.get(user=user)
            with self.subTest(user=user.email):
                self.assertEqual(api.patch(f'/api/tenants/members/{member.id}/', {'role': 'installer'},
                                           format='json').status_code, 404)
                self.assertEqual(api.delete(f'/api/tenants/members/{member.id}/').status_code, 404)
        self.assertEqual(CompanyMembership.objects.get(user=self.admin).role, Role.ADMIN)

    def test_field_manager_cannot_promote_installer(self):
        member = CompanyMembership.objects.get(user=self.installer)
        res = as_user(self.manager).patch(f'/api/tenants/members/{member.id}/', {'role': 'admin'}, format='json')
        self.assertEqual(res.status_code, 400)
        member.refresh_from_db()
        self.assertEqual(member.role, Role.INSTALLER)

    def test_field_manager_can_switch_and_remove_field_workers(self):
        api = as_user(self.manager)
        member = CompanyMembership.objects.get(user=self.installer)
        self.assertEqual(api.patch(f'/api/tenants/members/{member.id}/', {'role': 'driver'},
                                   format='json').status_code, 200)
        self.assertEqual(api.delete(f'/api/tenants/members/{member.id}/').status_code, 204)

    def test_staff_with_flag_manages_field_workers_only(self):
        self.assertEqual(self.create(self.staff_fo, 'installer', email='i3@a.com').status_code, 201)
        self.assertEqual(self.create(self.staff_fo, 'staff').status_code, 400)

    def test_staff_without_flag_cannot_manage_team(self):
        self.assertEqual(self.create(self.staff, 'installer').status_code, 403)

    def test_installer_and_driver_cannot_manage_team(self):
        for user in (self.installer, self.driver):
            with self.subTest(user=user.email):
                self.assertEqual(as_user(user).get('/api/tenants/members/').status_code, 403)
