from django.test import TestCase
from rest_framework.test import APIClient

from tenants.models import Company, CompanyMembership, SlidingDoorSettings
from tenants.tests import make_member

URL = '/api/tenants/sliding-door-settings/'


class SlidingDoorSettingsTests(TestCase):
    def setUp(self):
        self.company = Company.objects.create(name='A', slug='a', status=Company.Status.ACTIVE)
        self.other = Company.objects.create(name='B', slug='b', status=Company.Status.ACTIVE)
        self.owner = make_member(self.company, 'owner@a.com', CompanyMembership.Role.OWNER)
        self.admin = make_member(self.company, 'admin@a.com', CompanyMembership.Role.ADMIN)
        self.staff = make_member(self.company, 'staff@a.com', CompanyMembership.Role.STAFF)
        self.other_owner = make_member(self.other, 'owner@b.com', CompanyMembership.Role.OWNER)

    def api(self, user):
        client = APIClient()
        client.force_authenticate(user)
        return client

    def test_defaults(self):
        data = self.api(self.staff).get(URL).json()
        self.assertEqual({k: float(v) for k, v in data.items() if k != 'updated_at'}, {
            'max_door_width_mm': 1000, 'max_door_height_mm': 2750, 'standard_door_price': 60, 'wide_door_price': 70,
            'mirror_price_m2': 15, 'channel_width_mm': 80, 'cover_panel_thickness_mm': 18, 'cover_panel_height_mm': 100,
            'partition_tolerance_mm': 1, 'door_overlap_mm': 45,
        })

    def test_owner_and_admin_can_change_staff_cannot(self):
        res = self.api(self.owner).patch(URL, {'standard_door_price': '65.50', 'door_overlap_mm': 40}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(float(res.json()['standard_door_price']), 65.5)
        self.assertEqual(self.api(self.admin).patch(URL, {'mirror_price_m2': 18}, format='json').status_code, 200)
        self.assertEqual(self.api(self.staff).patch(URL, {'mirror_price_m2': 1}, format='json').status_code, 403)
        s = SlidingDoorSettings.objects.get(company=self.company)
        self.assertEqual((float(s.standard_door_price), float(s.door_overlap_mm), float(s.mirror_price_m2)), (65.5, 40, 18))

    def test_settings_are_per_company(self):
        self.api(self.owner).patch(URL, {'wide_door_price': 99}, format='json')
        self.assertEqual(float(self.api(self.other_owner).get(URL).json()['wide_door_price']), 70)

    def test_rejects_bad_values(self):
        api = self.api(self.owner)
        self.assertEqual(api.patch(URL, {'max_door_width_mm': 0}, format='json').status_code, 400)
        self.assertEqual(api.patch(URL, {'standard_door_price': -1}, format='json').status_code, 400)
        self.assertEqual(api.patch(URL, {'door_overlap_mm': 1000}, format='json').status_code, 400)
        self.assertEqual(api.patch(URL, {'partition_tolerance_mm': 0}, format='json').status_code, 200)
