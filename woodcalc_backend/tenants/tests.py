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
