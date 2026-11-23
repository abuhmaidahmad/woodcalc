"""Customers archive + delete: docs/customer-archive-delete-spec.md."""
from datetime import date

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from crm.models import Client, Payment, PaymentTransaction, Project, Quotation, Room
from manufacturing.models import WorkOrder
from tenants.models import Company, CompanyMembership

User = get_user_model()


class ClientArchiveTestBase(TestCase):
    def setUp(self):
        self.company = Company.objects.create(name='A', slug='a', status=Company.Status.ACTIVE)
        self.users = {role: self.member(self.company, role) for role in ('owner', 'admin', 'staff', 'auditor')}
        self.other = Company.objects.create(name='B', slug='b', status=Company.Status.ACTIVE)
        self.other_owner = self.member(self.other, 'owner')
        self.other_client = Client.objects.create(tenant=self.other, name='Theirs')

    def member(self, company, role):
        email = f'{role}@{company.slug}.com'
        user = User.objects.create_user(username=email, email=email, password='pass12345', user_type='manufacturer')
        CompanyMembership.objects.create(company=company, user=user, role=role)
        return user

    def api(self, role='owner', user=None):
        client = APIClient()
        client.force_authenticate(user or self.users[role])
        return client

    def client_with_room(self, name='C'):
        client = Client.objects.create(tenant=self.company, name=name)
        project = Project.objects.create(client=client, name='P')
        room = Room.objects.create(project=project, name='Kitchen')
        return client, project, room

    @staticmethod
    def names(res):
        data = res.json()
        rows = data['results'] if isinstance(data, dict) else data
        return {c['name'] for c in rows}


class ArchiveTests(ClientArchiveTestBase):
    def test_archived_hidden_from_default_list_and_shown_with_status_archived(self):
        Client.objects.create(tenant=self.company, name='Live')
        gone = Client.objects.create(tenant=self.company, name='Done')
        res = self.api('staff').post(f'/api/crm/clients/{gone.id}/archive/')
        self.assertEqual(res.status_code, 200, res.content)

        gone.refresh_from_db()
        self.assertTrue(gone.is_archived)
        self.assertIsNotNone(gone.archived_at)
        self.assertEqual(gone.archived_by, self.users['staff'])

        api = self.api()
        self.assertEqual(self.names(api.get('/api/crm/clients/')), {'Live'})
        self.assertEqual(self.names(api.get('/api/crm/clients/?status=active')), {'Live'})
        self.assertEqual(self.names(api.get('/api/crm/clients/?status=archived')), {'Done'})
        self.assertEqual(self.names(api.get('/api/crm/clients/?status=all')), {'Live', 'Done'})
        self.assertEqual(api.get('/api/crm/clients/?status=bogus').status_code, 400)

    def test_detail_still_returns_archived_client(self):
        client = Client.objects.create(tenant=self.company, name='Done')
        self.api().post(f'/api/crm/clients/{client.id}/archive/')
        res = self.api().get(f'/api/crm/clients/{client.id}/')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()['is_archived'])
        self.assertEqual(res.json()['archived_by_name'], 'owner@a.com')

    def test_unarchive_clears_fields(self):
        client = Client.objects.create(tenant=self.company, name='Done')
        self.api().post(f'/api/crm/clients/{client.id}/archive/')
        res = self.api().post(f'/api/crm/clients/{client.id}/unarchive/')
        self.assertEqual(res.status_code, 200)
        client.refresh_from_db()
        self.assertFalse(client.is_archived)
        self.assertIsNone(client.archived_at)
        self.assertIsNone(client.archived_by)

    def test_archive_keeps_projects_and_payments(self):
        client, project, _ = self.client_with_room()
        Payment.objects.create(project=project, label='Deposit', amount=100)
        self.api().post(f'/api/crm/clients/{client.id}/archive/')
        self.assertEqual(Project.objects.filter(client=client).count(), 1)
        self.assertEqual(self.api().get(f'/api/crm/payments/').json()['count'], 1)

    def test_archive_fields_not_writable_through_patch(self):
        client = Client.objects.create(tenant=self.company, name='C')
        self.api().patch(f'/api/crm/clients/{client.id}/', {'is_archived': True}, format='json')
        client.refresh_from_db()
        self.assertFalse(client.is_archived)


class DeleteTests(ClientArchiveTestBase):
    def assert_blocked(self, client, code):
        check = self.api().get(f'/api/crm/clients/{client.id}/delete-check/').json()
        self.assertFalse(check['can_delete'])
        self.assertIn(code, check['blocked_by'])
        res = self.api().delete(f'/api/crm/clients/{client.id}/')
        self.assertEqual(res.status_code, 409)
        self.assertEqual(res.json()['blocked_by'], check['blocked_by'])
        self.assertTrue(Client.objects.filter(pk=client.pk).exists())

    def test_blocked_by_payment(self):
        client, project, _ = self.client_with_room()
        Payment.objects.create(project=project, label='Deposit', amount=100)
        self.assert_blocked(client, 'payments')

    def test_blocked_by_transaction(self):
        client, project, _ = self.client_with_room()
        PaymentTransaction.objects.create(project=project, amount=50, date_received=date(2026, 11, 1))
        self.assert_blocked(client, 'payments')

    def test_blocked_by_signed_contract(self):
        client, _, _ = self.client_with_room()
        Quotation.objects.create(client=client, quote_number='Q-1', status='ACCEPTED')
        self.assert_blocked(client, 'signed_contracts')

    def test_blocked_by_work_order(self):
        client, _, room = self.client_with_room()
        WorkOrder.objects.create(tenant=self.company, product_name='Kitchen', room_id_ref=room.id)
        self.assert_blocked(client, 'work_orders')

    def test_other_company_work_order_with_same_room_id_does_not_block(self):
        client, _, room = self.client_with_room()
        WorkOrder.objects.create(tenant=self.other, product_name='X', room_id_ref=room.id)
        self.assertTrue(self.api().get(f'/api/crm/clients/{client.id}/delete-check/').json()['can_delete'])

    def test_delete_cascades_empty_project_and_room(self):
        client, project, room = self.client_with_room()
        Quotation.objects.create(client=client, quote_number='Q-D', status='DRAFT')
        check = self.api().get(f'/api/crm/clients/{client.id}/delete-check/').json()
        self.assertTrue(check['can_delete'])
        self.assertEqual(check['counts']['projects'], 1)
        self.assertEqual(check['counts']['rooms'], 1)

        res = self.api('admin').delete(f'/api/crm/clients/{client.id}/')
        self.assertEqual(res.status_code, 204, res.content)
        self.assertFalse(Client.objects.filter(pk=client.pk).exists())
        self.assertFalse(Project.objects.filter(pk=project.pk).exists())
        self.assertFalse(Room.objects.filter(pk=room.pk).exists())
        self.assertFalse(Quotation.objects.filter(client_id=client.pk).exists())

    def test_staff_cannot_delete(self):
        client = Client.objects.create(tenant=self.company, name='C')
        self.assertEqual(self.api('staff').delete(f'/api/crm/clients/{client.id}/').status_code, 403)
        self.assertTrue(Client.objects.filter(pk=client.pk).exists())


class BulkTests(ClientArchiveTestBase):
    def test_bulk_delete_returns_mix_of_ok_and_blocked(self):
        junk, _, _ = self.client_with_room('Junk')
        real, project, _ = self.client_with_room('Real')
        Payment.objects.create(project=project, label='Deposit', amount=100)

        res = self.api().post('/api/crm/clients/bulk/',
                              {'action': 'delete', 'ids': [junk.id, real.id, self.other_client.id]}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        body = res.json()
        self.assertEqual(body['ok'], [junk.id])
        blocked = {b['id']: b for b in body['blocked']}
        self.assertEqual(set(blocked), {real.id, self.other_client.id})
        self.assertEqual(blocked[real.id]['name'], 'Real')
        self.assertIn('payment', blocked[real.id]['reason'])
        self.assertFalse(Client.objects.filter(pk=junk.pk).exists())
        self.assertTrue(Client.objects.filter(pk=real.pk).exists())
        self.assertTrue(Client.objects.filter(pk=self.other_client.pk).exists())

    def test_bulk_archive_and_unarchive(self):
        a = Client.objects.create(tenant=self.company, name='A1')
        b = Client.objects.create(tenant=self.company, name='B1')
        res = self.api('staff').post('/api/crm/clients/bulk/', {'action': 'archive', 'ids': [a.id, b.id]}, format='json')
        self.assertEqual(res.json(), {'ok': [a.id, b.id], 'blocked': []})
        self.assertEqual(Client.objects.filter(is_archived=True).count(), 2)
        self.api('staff').post('/api/crm/clients/bulk/', {'action': 'unarchive', 'ids': [a.id]}, format='json')
        self.assertEqual(list(Client.objects.filter(is_archived=True)), [b])

    def test_bulk_rejects_bad_input(self):
        api = self.api()
        self.assertEqual(api.post('/api/crm/clients/bulk/', {'action': 'nuke', 'ids': [1]}, format='json').status_code, 400)
        self.assertEqual(api.post('/api/crm/clients/bulk/', {'action': 'archive', 'ids': []}, format='json').status_code, 400)

    def test_staff_cannot_bulk_delete(self):
        client = Client.objects.create(tenant=self.company, name='C')
        res = self.api('staff').post('/api/crm/clients/bulk/', {'action': 'delete', 'ids': [client.id]}, format='json')
        self.assertEqual(res.status_code, 403)


class TenantIsolationTests(ClientArchiveTestBase):
    def test_cannot_archive_or_delete_another_companys_client(self):
        cid = self.other_client.id
        api = self.api()
        self.assertEqual(api.post(f'/api/crm/clients/{cid}/archive/').status_code, 404)
        self.assertEqual(api.post(f'/api/crm/clients/{cid}/unarchive/').status_code, 404)
        self.assertEqual(api.get(f'/api/crm/clients/{cid}/delete-check/').status_code, 404)
        self.assertEqual(api.delete(f'/api/crm/clients/{cid}/').status_code, 404)
        res = api.post('/api/crm/clients/bulk/', {'action': 'archive', 'ids': [cid]}, format='json')
        self.assertEqual(res.json()['ok'], [])
        self.other_client.refresh_from_db()
        self.assertFalse(self.other_client.is_archived)

    def test_archived_list_is_tenant_scoped(self):
        self.other_client.is_archived = True
        self.other_client.save()
        self.assertEqual(self.names(self.api().get('/api/crm/clients/?status=archived')), set())


class AuditorTests(ClientArchiveTestBase):
    def test_auditor_gets_403_on_every_write(self):
        client = Client.objects.create(tenant=self.company, name='C')
        api = self.api('auditor')
        self.assertEqual(api.post(f'/api/crm/clients/{client.id}/archive/').status_code, 403)
        self.assertEqual(api.post(f'/api/crm/clients/{client.id}/unarchive/').status_code, 403)
        self.assertEqual(api.delete(f'/api/crm/clients/{client.id}/').status_code, 403)
        for action in ('archive', 'unarchive', 'delete'):
            res = api.post('/api/crm/clients/bulk/', {'action': action, 'ids': [client.id]}, format='json')
            self.assertEqual(res.status_code, 403, action)
        client.refresh_from_db()
        self.assertFalse(client.is_archived)

    def test_auditor_can_still_read_archived_and_delete_check(self):
        client = Client.objects.create(tenant=self.company, name='C', is_archived=True)
        api = self.api('auditor')
        self.assertEqual(api.get(f'/api/crm/clients/?status=archived').status_code, 200)
        self.assertEqual(api.get(f'/api/crm/clients/{client.id}/delete-check/').status_code, 200)
