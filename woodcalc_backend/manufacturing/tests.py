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
