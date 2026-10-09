from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from tenants.models import Company, CompanyMembership
from .models import WorkOrder, WorkOrderItem


class WorkOrderBulkItemsTests(TestCase):
    def setUp(self):
        self.company = Company.objects.create(name='A', slug='a')
        user = get_user_model().objects.create_user(username='u', email='u@example.com', password='pw')
        CompanyMembership.objects.create(user=user, company=self.company, role=CompanyMembership.Role.OWNER)
        self.client = APIClient()
        self.client.force_authenticate(user)
        self.wo = WorkOrder.objects.create(tenant=self.company, order_number='WO-1', product_name='K')

    def test_creates_all_items_in_one_request(self):
        res = self.client.post(f'/api/manufacturing/work-orders/{self.wo.id}/items/', {'items': [
            {'description': 'Side 720x560x18mm', 'quantity': 4, 'unit': 'pcs'},
            {'description': 'Door 597x717x18mm', 'quantity': 2, 'unit': 'pcs'},
        ]}, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(res.json(), {'created': 2})
        self.assertEqual(list(self.wo.items.order_by('id').values_list('description', 'quantity')),
                         [('Side 720x560x18mm', 4), ('Door 597x717x18mm', 2)])

    def test_rejects_another_tenants_work_order(self):
        other = Company.objects.create(name='B', slug='b')
        wo = WorkOrder.objects.create(tenant=other, order_number='WO-2', product_name='K')
        res = self.client.post(f'/api/manufacturing/work-orders/{wo.id}/items/', {'items': [
            {'description': 'x', 'quantity': 1, 'unit': 'pcs'},
        ]}, format='json')
        self.assertEqual(res.status_code, 404)
        self.assertFalse(WorkOrderItem.objects.filter(work_order=wo).exists())

    def test_single_item_endpoint_rejects_another_tenants_work_order(self):
        other = Company.objects.create(name='B', slug='b')
        wo = WorkOrder.objects.create(tenant=other, order_number='WO-2', product_name='K')
        res = self.client.post('/api/manufacturing/work-order-items/', {
            'work_order': wo.id, 'description': 'x', 'quantity': 1, 'unit': 'pcs',
        }, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertFalse(WorkOrderItem.objects.filter(work_order=wo).exists())

    def test_single_item_endpoint_still_works_for_own_work_order(self):
        res = self.client.post('/api/manufacturing/work-order-items/', {
            'work_order': self.wo.id, 'description': 'x', 'quantity': 1, 'unit': 'pcs',
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)


class CuttingJobMaterialTests(TestCase):
    def setUp(self):
        from inventory.models import Material
        self.company = Company.objects.create(name='A', slug='a')
        user = get_user_model().objects.create_user(username='u', email='u@example.com', password='pw')
        CompanyMembership.objects.create(user=user, company=self.company, role=CompanyMembership.Role.OWNER)
        self.client = APIClient()
        self.client.force_authenticate(user)
        self.wo = WorkOrder.objects.create(tenant=self.company, order_number='WO-1', product_name='K')
        self.mat = Material.objects.create(tenant=self.company, sku='H1210_ST', name='Laminate',
                                           board_width=2800, board_height=2070, has_grain=True)

    def _job(self, material_id):
        return self.client.post('/api/manufacturing/cutting-jobs/', {
            'work_order': self.wo.id, 'material': material_id, 'thickness': '18', 'kerf': '4',
            'parts': [{'label': 'Door', 'width': '717', 'height': '447', 'quantity': 3, 'grain_locked': True}],
        }, format='json')

    def test_optimize_creates_stock_sheet_from_material_board(self):
        from .models import StockSheet
        job = self._job(self.mat.id)
        self.assertEqual(job.status_code, 201, job.content)
        res = self.client.post(f"/api/manufacturing/cutting-jobs/{job.json()['id']}/optimize/")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(len(res.json()['layouts']), 1)
        sheet = StockSheet.objects.get(material=self.mat)
        self.assertEqual((sheet.width, sheet.height, sheet.thickness, sheet.grain_direction, sheet.tenant),
                         (2800, 2070, 18, 'length', self.company))

    def test_optimize_reports_material_without_board_size(self):
        self.mat.board_width = None
        self.mat.save()
        job = self._job(self.mat.id)
        res = self.client.post(f"/api/manufacturing/cutting-jobs/{job.json()['id']}/optimize/")
        self.assertEqual(res.status_code, 400)
        self.assertIn('H1210_ST', res.json()['detail'])

    def test_rejects_another_tenants_material(self):
        from inventory.models import Material
        other = Company.objects.create(name='B', slug='b')
        foreign = Material.objects.create(tenant=other, sku='X', name='X')
        res = self._job(foreign.id)
        self.assertEqual(res.status_code, 400)
        self.assertIn('material', res.json())
