from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from inventory.models import Material, Supplier
from tenants.models import Company, CompanyMembership
from .models import PurchaseOrder


class GlassPurchaseOrderTests(TestCase):
    """Drafting supplier POs for made-to-size glass from a room's cut list."""

    def setUp(self):
        self.company = Company.objects.create(name='A', slug='a', status=Company.Status.ACTIVE)
        user = get_user_model().objects.create_user(username='u', email='u@x.com', password='pw')
        CompanyMembership.objects.create(user=user, company=self.company, role=CompanyMembership.Role.OWNER)
        self.api = APIClient()
        self.api.force_authenticate(user)
        self.glazier = Supplier.objects.create(tenant=self.company, name='Glazier', email='g@x.com')
        self.alu = Supplier.objects.create(tenant=self.company, name='Alu Doors', email='a@x.com')
        self.glass = Material.objects.create(tenant=self.company, sku='GL8', name='Clear glass 8mm', unit='M2',
                                             material_type='glass', board_thickness=8, supplier=self.glazier,
                                             price_per_board=Decimal('20.00'), price_unit='m2')
        self.door = Material.objects.create(tenant=self.company, sku='ALU-BLK', name='Alu glass door black', unit='M2',
                                            material_type='glass_door', board_thickness=4, supplier=self.alu,
                                            price_per_board=Decimal('60.00'), price_unit='m2')

    def _order(self, **extra):
        return self.api.post('/api/srm/purchase-orders/from-cut-list/', {
            'source_ref': 'room:22:glass', 'notes': 'Kitchen 22',
            'items': [
                {'material_sku': 'GL8', 'description': 'Glass shelf 8mm', 'width': 760, 'height': 272, 'quantity': 2},
                {'material_sku': 'ALU-BLK', 'description': 'Aluminium glass door, black frame, clear glass', 'width': 397, 'height': 717, 'quantity': 2},
            ],
            **extra,
        }, format='json')

    def test_one_draft_po_per_supplier_priced_per_m2(self):
        res = self._order()
        self.assertEqual(res.status_code, 201, res.content)
        pos = {po['supplier_name']: po for po in res.json()}
        self.assertEqual(set(pos), {'Glazier', 'Alu Doors'})
        shelf = pos['Glazier']['line_items'][0]
        self.assertEqual((shelf['quantity_ordered'], shelf['unit_price']), ('0.41', '20.00'))
        self.assertIn('760 x 272 mm x 2 pcs', shelf['notes'])
        door = pos['Alu Doors']['line_items'][0]
        self.assertEqual((door['quantity_ordered'], door['unit_price']), ('0.57', '60.00'))
        self.assertTrue(door['made_to_order'])
        self.assertEqual(pos['Alu Doors']['status'], 'draft')

    def test_same_room_is_not_ordered_twice(self):
        self._order()
        res = self._order()
        self.assertEqual(res.status_code, 409)
        self.assertEqual(len(res.json()['purchase_orders']), 2)
        self.assertEqual(self._order(force=True).status_code, 201)

    def test_material_without_supplier_is_rejected(self):
        self.glass.supplier = None
        self.glass.save()
        res = self._order()
        self.assertEqual(res.status_code, 400)
        self.assertIn('GL8', res.json()['error'])
        self.assertFalse(PurchaseOrder.objects.exists())

    def test_receiving_made_to_order_line_leaves_stock_unchanged(self):
        po = self._order().json()[0]
        line = po['line_items'][0]
        res = self.api.post(f"/api/srm/line-items/{line['id']}/receive/", {'quantity': line['quantity_ordered']}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        mat = Material.objects.get(sku=line['material_sku'])
        self.assertEqual(mat.quantity_on_hand, 0)
        self.assertEqual(sorted(mat.movements.values_list('movement_type', flat=True)), ['IN', 'OUT'])
