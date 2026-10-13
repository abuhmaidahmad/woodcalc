from decimal import Decimal

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


class CuttingJobStockTests(TestCase):
    """Optimizing a cutting job takes the sheets its layout uses out of stock."""

    def setUp(self):
        from inventory.models import Material
        self.company = Company.objects.create(name='A', slug='a')
        user = get_user_model().objects.create_user(username='u', email='u@example.com', password='pw')
        CompanyMembership.objects.create(user=user, company=self.company, role=CompanyMembership.Role.OWNER)
        self.client = APIClient()
        self.client.force_authenticate(user)
        self.wo = WorkOrder.objects.create(tenant=self.company, order_number='WO-1', product_name='K')
        self.hdf = Material.objects.create(tenant=self.company, sku='HDF3', name='HDF 3mm', unit='PCS',
                                           material_type='back', core_material='hdf',
                                           board_width=2440, board_height=1220, board_thickness=3,
                                           quantity_on_hand=10, reorder_level=5)

    def _job(self, qty, material=None):
        res = self.client.post('/api/manufacturing/cutting-jobs/', {
            'work_order': self.wo.id, 'material': (material or self.hdf).id, 'thickness': '3', 'kerf': '4',
            'parts': [{'label': 'Back', 'width': '1100', 'height': '1100', 'quantity': qty, 'grain_locked': False}],
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        return res.json()['id']

    def _optimize(self, job_id):
        res = self.client.post(f'/api/manufacturing/cutting-jobs/{job_id}/optimize/')
        self.assertEqual(res.status_code, 200, res.content)
        return res.json()

    def _set_qty(self, job_id, qty):
        from .models import CuttingPart
        CuttingPart.objects.filter(job_id=job_id).update(quantity=qty)

    def test_optimize_deducts_sheets_and_logs_movement(self):
        from inventory.models import StockMovement
        data = self._optimize(self._job(4))  # 2 backs per 2440x1220 sheet -> 2 sheets
        self.assertEqual(len(data['layouts']), 2)
        self.hdf.refresh_from_db()
        self.assertEqual(self.hdf.quantity_on_hand, 8)
        mv = StockMovement.objects.get(material=self.hdf)
        self.assertEqual((mv.movement_type, mv.quantity), ('OUT', 2))
        self.assertEqual(data['stock']['used_by_job'], '2.00')
        self.assertEqual(data['stock']['quantity_on_hand'], '8.00')

    def test_reoptimize_books_only_the_difference(self):
        job_id = self._job(4)
        self._optimize(job_id)
        self._optimize(job_id)
        self.hdf.refresh_from_db()
        self.assertEqual(self.hdf.quantity_on_hand, 8)
        self._set_qty(job_id, 6)  # 3 sheets
        self._optimize(job_id)
        self.hdf.refresh_from_db()
        self.assertEqual(self.hdf.quantity_on_hand, 7)
        self._set_qty(job_id, 2)  # 1 sheet -> 2 come back
        self._optimize(job_id)
        self.hdf.refresh_from_db()
        self.assertEqual(self.hdf.quantity_on_hand, 9)

    def test_deleting_job_returns_stock(self):
        job_id = self._job(4)
        self._optimize(job_id)
        self.assertEqual(self.client.delete(f'/api/manufacturing/cutting-jobs/{job_id}/').status_code, 204)
        self.hdf.refresh_from_db()
        self.assertEqual(self.hdf.quantity_on_hand, 10)

    def test_dropping_below_reorder_level_raises_alert(self):
        self.assertFalse(self.hdf.alerts.filter(resolved=False).exists())
        data = self._optimize(self._job(12))  # 6 sheets -> 4 left, reorder at 5
        self.assertTrue(data['stock']['below_reorder_level'])
        self.assertTrue(self.hdf.alerts.filter(resolved=False).exists())

    def test_m2_stock_is_deducted_by_sheet_area(self):
        self.hdf.unit = 'M2'
        self.hdf.quantity_on_hand = 30
        self.hdf.save()
        self._optimize(self._job(4))  # 2 sheets x 2.9768 m2
        self.hdf.refresh_from_db()
        self.assertEqual(self.hdf.quantity_on_hand, Decimal('24.05'))

    def test_non_sheet_unit_is_left_alone(self):
        self.hdf.unit = 'KG'
        self.hdf.save()
        self._optimize(self._job(4))
        self.hdf.refresh_from_db()
        self.assertEqual(self.hdf.quantity_on_hand, 10)

    def test_new_run_for_same_work_order_replaces_earlier_job(self):
        # The optimizer page creates a new job on every run.
        self._optimize(self._job(4))   # 2 sheets
        self._optimize(self._job(6))   # 3 sheets, replaces the first run
        self.hdf.refresh_from_db()
        self.assertEqual(self.hdf.quantity_on_hand, 7)

    def test_other_work_orders_are_not_affected(self):
        self._optimize(self._job(4))
        other_wo = WorkOrder.objects.create(tenant=self.company, order_number='WO-2', product_name='K2')
        self.wo = other_wo
        self._optimize(self._job(4))
        self.hdf.refresh_from_db()
        self.assertEqual(self.hdf.quantity_on_hand, 6)
