from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from crm.models import Client, Project, Room
from tenants.models import Company, CompanyMembership
from tenants.permissions import READ_ONLY_MESSAGE

User = get_user_model()


def make_member(company, email, role):
    user = User.objects.create_user(username=email, email=email, password='pass12345',
                                    user_type='manufacturer')
    CompanyMembership.objects.create(company=company, user=user, role=role)
    return user


class AuditorRoleTests(TestCase):
    def setUp(self):
        self.company = Company.objects.create(name='A', slug='a', status=Company.Status.ACTIVE)
        client = Client.objects.create(tenant=self.company, name='C')
        project = Project.objects.create(client=client, name='P')
        self.room = Room.objects.create(project=project, name='Kitchen', planner_data={'cabinets': []})
        self.auditor = make_member(self.company, 'auditor@x.com', CompanyMembership.Role.AUDITOR)
        self.staff = make_member(self.company, 'staff@x.com', CompanyMembership.Role.STAFF)
        self.owner = make_member(self.company, 'owner@x.com', CompanyMembership.Role.OWNER)
        self.api = APIClient()

    def test_auditor_can_read_rooms(self):
        self.api.force_authenticate(self.auditor)
        self.assertEqual(self.api.get('/api/crm/rooms/').status_code, 200)
        res = self.api.get(f'/api/crm/rooms/{self.room.id}/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['name'], 'Kitchen')

    def test_auditor_cannot_save_room(self):
        self.api.force_authenticate(self.auditor)
        res = self.api.patch(f'/api/crm/rooms/{self.room.id}/', {'name': 'Changed'}, format='json')
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.json()['detail'], READ_ONLY_MESSAGE)
        self.room.refresh_from_db()
        self.assertEqual(self.room.name, 'Kitchen')

    def test_auditor_cannot_create_share_link_or_work_order(self):
        self.api.force_authenticate(self.auditor)
        self.assertEqual(self.api.post(f'/api/crm/rooms/{self.room.id}/share_link/').status_code, 403)
        res = self.api.post('/api/manufacturing/work-orders/', {'order_number': 'WO-1'}, format='json')
        self.assertEqual(res.status_code, 403)

    def test_auditor_cannot_write_catalog(self):
        self.api.force_authenticate(self.auditor)
        res = self.api.post('/api/inventory/materials/', {'name': 'X'}, format='json')
        self.assertEqual(res.status_code, 403)

    def test_auditor_can_send_feedback(self):
        self.api.force_authenticate(self.auditor)
        res = self.api.post('/api/feedback/', {'message': 'hi'}, format='json')
        self.assertNotEqual(res.status_code, 403)

    def test_auditor_can_use_read_only_post_action(self):
        from cadcam.models import CadCamImportJob
        job = CadCamImportJob.objects.create(tenant=self.company, platform='bsolid', method='csv', status='done')
        self.api.force_authenticate(self.auditor)
        res = self.api.post(f'/api/cadcam/import-jobs/{job.id}/send-to-optimizer/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['groups'], [])

    def test_staff_can_still_save_room(self):
        self.api.force_authenticate(self.staff)
        res = self.api.patch(f'/api/crm/rooms/{self.room.id}/', {'name': 'Changed'}, format='json')
        self.assertEqual(res.status_code, 200)

    def test_owner_can_create_auditor(self):
        self.api.force_authenticate(self.owner)
        res = self.api.post('/api/tenants/members/', {
            'email': 'new@x.com', 'first_name': 'N', 'password': 'pass12345', 'role': 'auditor',
        }, format='json')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.json()['role'], 'auditor')

    def test_teammate_email_duplicate_check_ignores_case(self):
        self.api.force_authenticate(self.owner)
        res = self.api.post('/api/tenants/members/', {
            'email': 'STAFF@x.com', 'first_name': 'N', 'password': 'pass12345',
        }, format='json')
        self.assertEqual(res.status_code, 400)


class CaseInsensitiveLoginTests(TestCase):
    def setUp(self):
        User.objects.create_user(username='Omar@Gmail.com', email='Omar@Gmail.com', password='pass12345',
                                 user_type='manufacturer')

    def login(self, email):
        return APIClient().post('/api/auth/login/', {'email': email, 'password': 'pass12345'}, format='json')

    def test_exact_case(self):
        self.assertEqual(self.login('Omar@Gmail.com').status_code, 200)

    def test_different_case(self):
        res = self.login('omar@gmail.com')
        self.assertEqual(res.status_code, 200)
        self.assertIn('access', res.json())

    def test_wrong_password_still_rejected(self):
        res = APIClient().post('/api/auth/login/', {'email': 'omar@gmail.com', 'password': 'nope'}, format='json')
        self.assertEqual(res.status_code, 401)


class BackPanelThicknessSettingTests(TestCase):
    def setUp(self):
        self.company = Company.objects.create(name='B', slug='b', status=Company.Status.ACTIVE)
        self.owner = make_member(self.company, 'owner-b@x.com', CompanyMembership.Role.OWNER)
        self.api = APIClient()
        self.api.force_authenticate(self.owner)

    def test_set_back_panel_thickness(self):
        res = self.api.patch('/api/tenants/settings/', {'back_panel_thickness_mm': 3}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['back_panel_thickness_mm'], 3)
        self.assertEqual(self.api.get('/api/tenants/settings/').json()['back_panel_thickness_mm'], 3)

    def test_rejects_unsupported_thickness(self):
        for bad in (0, 7, -3, 'thin', None):
            res = self.api.patch('/api/tenants/settings/', {'back_panel_thickness_mm': bad}, format='json')
            self.assertEqual(res.status_code, 400, bad)
        self.assertNotIn('back_panel_thickness_mm', self.api.get('/api/tenants/settings/').json())

    def test_other_flags_are_kept(self):
        self.api.patch('/api/tenants/settings/', {'cadcam_min_offcut_width_mm': 200}, format='json')
        self.api.patch('/api/tenants/settings/', {'back_panel_thickness_mm': 5}, format='json')
        flags = self.api.get('/api/tenants/settings/').json()
        self.assertEqual(flags['cadcam_min_offcut_width_mm'], 200)
        self.assertEqual(flags['back_panel_thickness_mm'], 5)

    def test_back_panel_material_sets_thickness(self):
        from inventory.models import Material
        mat = Material.objects.create(tenant=self.company, sku='HDF3', name='HDF 3mm', material_type='back',
                                      core_material='hdf', board_thickness=3)
        res = self.api.patch('/api/tenants/settings/', {'back_panel_material_sku': 'HDF3'}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.json()['back_panel_thickness_mm'], 3)
        # The thickness follows the material when it's edited in the catalog.
        mat.board_thickness = 4
        mat.save()
        flags = self.api.get('/api/tenants/settings/').json()
        self.assertEqual((flags['back_panel_material_sku'], flags['back_panel_thickness_mm']), ('HDF3', 4))

    def test_back_panel_material_must_belong_to_company(self):
        from inventory.models import Material
        other = Company.objects.create(name='O', slug='o', status=Company.Status.ACTIVE)
        Material.objects.create(tenant=other, sku='HDF3', name='HDF', board_thickness=3)
        res = self.api.patch('/api/tenants/settings/', {'back_panel_material_sku': 'HDF3'}, format='json')
        self.assertEqual(res.status_code, 400)

    def test_plain_thickness_clears_material(self):
        from inventory.models import Material
        Material.objects.create(tenant=self.company, sku='HDF3', name='HDF', board_thickness=3)
        self.api.patch('/api/tenants/settings/', {'back_panel_material_sku': 'HDF3'}, format='json')
        res = self.api.patch('/api/tenants/settings/', {'back_panel_material_sku': None, 'back_panel_thickness_mm': 8}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual((res.json()['back_panel_material_sku'], res.json()['back_panel_thickness_mm']), (None, 8))
