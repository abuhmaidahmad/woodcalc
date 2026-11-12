from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from tenants.models import Company, CompanyMembership
from .models import Material


class MaterialStockEditTests(TestCase):
    def setUp(self):
        self.company = Company.objects.create(name='A', slug='a', status=Company.Status.ACTIVE)
        user = get_user_model().objects.create_user(username='u', email='u@x.com', password='pw')
        CompanyMembership.objects.create(user=user, company=self.company, role=CompanyMembership.Role.OWNER)
        self.api = APIClient()
        self.api.force_authenticate(user)
        self.mat = Material.objects.create(tenant=self.company, sku='HDF-03-WHT', name='HDF 3mm White',
                                           material_type='back', board_thickness=3)

    def test_editing_stock_logs_an_adjustment_and_checks_reorder_level(self):
        res = self.api.patch(f'/api/inventory/materials/{self.mat.id}/',
                             {'quantity_on_hand': '20', 'reorder_level': '25'}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        self.mat.refresh_from_db()
        mv = self.mat.movements.get()
        self.assertEqual((mv.movement_type, mv.quantity), ('ADJUST', Decimal('20')))
        self.assertTrue(self.mat.alerts.filter(resolved=False).exists())

    def test_editing_other_fields_logs_nothing(self):
        self.api.patch(f'/api/inventory/materials/{self.mat.id}/', {'reorder_level': '5'}, format='json')
        self.assertFalse(self.mat.movements.exists())

    def test_cannot_edit_another_companys_material(self):
        other = Company.objects.create(name='B', slug='b', status=Company.Status.ACTIVE)
        foreign = Material.objects.create(tenant=other, sku='X', name='X')
        res = self.api.patch(f'/api/inventory/materials/{foreign.id}/', {'quantity_on_hand': '99'}, format='json')
        self.assertIn(res.status_code, (403, 404))
        foreign.refresh_from_db()
        self.assertEqual(foreign.quantity_on_hand, 0)


class DrawerSystemBackSizeTests(TestCase):
    """A metal-sided drawer system can carry the size of its shop-cut wooden back."""

    def setUp(self):
        self.company = Company.objects.create(name='A', slug='a', status=Company.Status.ACTIVE)
        user = get_user_model().objects.create_user(username='u', email='u@x.com', password='pw')
        CompanyMembership.objects.create(user=user, company=self.company, role=CompanyMembership.Role.OWNER)
        self.api = APIClient()
        self.api.force_authenticate(user)

    def test_back_sizes_round_trip(self):
        res = self.api.post('/api/inventory/drawer-systems/', {
            'name': 'TANDEMBOX', 'box_construction': 'metal_sided', 'back_width_deduction': '87',
            'back_height_m': '68', 'back_height_c': '167', 'back_thickness': 16}, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        got = self.api.get(f"/api/inventory/drawer-systems/{res.json()['id']}/").json()
        self.assertEqual((got['back_width_deduction'], got['back_height_m'], got['back_height_c'], got['back_thickness']),
                         ('87.0', '68.0', '167.0', 16))

    def test_back_sizes_optional(self):
        res = self.api.post('/api/inventory/drawer-systems/', {'name': 'Plain', 'box_construction': 'metal_sided'}, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        self.assertIsNone(res.json()['back_width_deduction'])
