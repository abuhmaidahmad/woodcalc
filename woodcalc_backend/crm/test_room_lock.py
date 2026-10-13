from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from crm.models import Client, Project, Room
from manufacturing.models import WorkOrder, WorkOrderItem
from tenants.models import Company, CompanyMembership

User = get_user_model()

CABINET = {'id': 1, 'category': 'base', 'subtype': 'Base', 'width': 600, 'height': 720, 'depth': 560,
           'carcassMaterialName': 'White', 'frontMaterialName': 'Oak'}


class RoomLockTestBase(TestCase):
    def setUp(self):
        self.company = Company.objects.create(name='A', slug='a', status=Company.Status.ACTIVE)
        self.project = Project.objects.create(client=Client.objects.create(tenant=self.company, name='C'), name='P')
        self.room = Room.objects.create(project=self.project, name='Kitchen', planner_data={'cabinets': [CABINET]})
        self.users = {role: self.member(self.company, role) for role in ('owner', 'admin', 'staff', 'auditor')}

        self.other = Company.objects.create(name='B', slug='b', status=Company.Status.ACTIVE)
        self.other_project = Project.objects.create(client=Client.objects.create(tenant=self.other, name='X'), name='Q')
        self.other_room = Room.objects.create(project=self.other_project, name='Theirs')
        self.other_owner = self.member(self.other, 'owner')

    def member(self, company, role):
        email = f'{role}@{company.slug}.com'
        user = User.objects.create_user(username=email, email=email, password='pass12345', user_type='manufacturer')
        CompanyMembership.objects.create(company=company, user=user, role=role)
        return user

    def api(self, role='owner', user=None):
        client = APIClient()
        client.force_authenticate(user or self.users[role])
        return client

    def lock(self, room=None):
        res = self.api('owner').post(f'/api/crm/rooms/{(room or self.room).id}/confirm_lock/')
        self.assertEqual(res.status_code, 200, res.content)
        return res


class ConfirmLockTests(RoomLockTestBase):
    def test_existing_rooms_default_unlocked_rev1(self):
        self.assertFalse(self.room.is_locked)
        self.assertEqual(self.room.revision_number, 1)
        self.assertEqual(self.room.revision_status, Room.RevisionStatus.DRAFT)

    def test_staff_cannot_confirm_lock(self):
        res = self.api('staff').post(f'/api/crm/rooms/{self.room.id}/confirm_lock/')
        self.assertEqual(res.status_code, 403)

    def test_admin_can_confirm_lock(self):
        res = self.api('admin').post(f'/api/crm/rooms/{self.room.id}/confirm_lock/')
        self.assertEqual(res.status_code, 200)
        self.room.refresh_from_db()
        self.assertTrue(self.room.is_locked)
        self.assertEqual(self.room.locked_by, self.users['admin'])
        self.assertEqual(self.room.revision_status, Room.RevisionStatus.APPROVED)

    def test_lock_fields_not_writable_through_patch(self):
        res = self.api('owner').patch(f'/api/crm/rooms/{self.room.id}/', {'is_locked': True, 'revision_number': 9},
                                      format='json')
        self.assertEqual(res.status_code, 200)
        self.room.refresh_from_db()
        self.assertFalse(self.room.is_locked)
        self.assertEqual(self.room.revision_number, 1)


class LockedRoomRejectsWritesTests(RoomLockTestBase):
    def setUp(self):
        super().setUp()
        self.lock()

    def test_every_role_gets_403_on_patch_put_delete(self):
        url = f'/api/crm/rooms/{self.room.id}/'
        for role in ('owner', 'admin', 'staff', 'auditor'):
            client = self.api(role)
            for method, kwargs in (('patch', {'data': {'planner_data': {'cabinets': []}}}),
                                   ('put', {'data': {'project': self.project.id, 'name': 'X'}}),
                                   ('delete', {})):
                res = getattr(client, method)(url, format='json', **kwargs)
                self.assertEqual(res.status_code, 403, f'{role} {method}')
        self.room.refresh_from_db()
        self.assertEqual(self.room.planner_data['cabinets'], [CABINET])

    def test_lock_message_is_clear(self):
        res = self.api('owner').patch(f'/api/crm/rooms/{self.room.id}/', {'name': 'X'}, format='json')
        self.assertTrue(res.json()['detail'].startswith('Locked:'))
        self.assertIn('Rev 1', res.json()['detail'])

    def test_auditor_still_read_only(self):
        res = self.api('auditor').patch(f'/api/crm/rooms/{self.room.id}/', {'name': 'X'}, format='json')
        self.assertTrue(res.json()['detail'].startswith('Read-only access:'))
        self.assertEqual(self.api('auditor').get(f'/api/crm/rooms/{self.room.id}/').status_code, 200)

    def test_locked_room_still_readable_and_shareable(self):
        self.assertEqual(self.api('staff').get(f'/api/crm/rooms/{self.room.id}/').status_code, 200)
        self.assertEqual(self.api('staff').post(f'/api/crm/rooms/{self.room.id}/share_link/').status_code, 200)

    def test_only_owner_can_unlock_and_needs_reason(self):
        url = f'/api/crm/rooms/{self.room.id}/unlock/'
        self.assertEqual(self.api('admin').post(url, {'reason': 'x'}, format='json').status_code, 403)
        self.assertEqual(self.api('owner').post(url, {}, format='json').status_code, 400)
        res = self.api('owner').post(url, {'reason': 'Customer moved the window'}, format='json')
        self.assertEqual(res.status_code, 200)
        self.room.refresh_from_db()
        self.assertFalse(self.room.is_locked)
        self.assertEqual(self.room.unlock_reason, 'Customer moved the window')
        res = self.api('staff').patch(f'/api/crm/rooms/{self.room.id}/', {'name': 'Edited'}, format='json')
        self.assertEqual(res.status_code, 200)


class ManufacturingLockTests(RoomLockTestBase):
    def create_wo(self, room, role='owner'):
        return self.api(role).post('/api/manufacturing/work-orders/', {
            'order_number': f'WO-{room.id}-{role}', 'product_name': 'K', 'room_id_ref': room.id,
        }, format='json')

    def test_unlocked_room_cannot_be_sent(self):
        self.assertEqual(self.create_wo(self.room).status_code, 400)

    def test_other_tenants_room_cannot_be_sent(self):
        self.lock(self.room)
        self.other_room.is_locked = True
        self.other_room.revision_status = Room.RevisionStatus.APPROVED
        self.other_room.save()
        self.assertEqual(self.create_wo(self.other_room).status_code, 400)

    def test_locked_room_cut_list_sent_once_then_frozen(self):
        self.lock()
        res = self.create_wo(self.room, 'staff')
        self.assertEqual(res.status_code, 201)
        wo_id = res.json()['id']
        items_url = f'/api/manufacturing/work-orders/{wo_id}/items/'
        items = {'items': [{'description': 'Side 720x560x18', 'quantity': 2, 'unit': 'pcs'}]}
        self.assertEqual(self.api('staff').post(items_url, items, format='json').status_code, 201)
        self.assertEqual(self.api('owner').post(items_url, items, format='json').status_code, 403)

        item = WorkOrderItem.objects.get(work_order_id=wo_id)
        res = self.api('owner').patch(f'/api/manufacturing/work-order-items/{item.id}/', {'quantity': 5}, format='json')
        self.assertEqual(res.status_code, 403)
        res = self.api('owner').post('/api/manufacturing/work-order-items/', {
            'work_order': wo_id, 'description': 'Extra', 'quantity': 1, 'unit': 'pcs'}, format='json')
        self.assertEqual(res.status_code, 403)
        self.assertEqual(WorkOrderItem.objects.filter(work_order_id=wo_id).count(), 1)

    def test_work_order_status_still_editable_when_locked(self):
        self.lock()
        wo_id = self.create_wo(self.room).json()['id']
        res = self.api('staff').patch(f'/api/manufacturing/work-orders/{wo_id}/', {'status': 'IN_PROGRESS'},
                                      format='json')
        self.assertEqual(res.status_code, 200)


class TenantIsolationTests(RoomLockTestBase):
    def test_cannot_create_room_in_other_tenants_project(self):
        res = self.api('owner').post('/api/crm/rooms/', {'project': self.other_project.id, 'name': 'Sneaky'},
                                     format='json')
        self.assertEqual(res.status_code, 400)

    def test_cannot_lock_or_unlock_other_tenants_room(self):
        res = self.api('owner').post(f'/api/crm/rooms/{self.other_room.id}/confirm_lock/')
        self.assertEqual(res.status_code, 404)
        self.lock()
        res = self.api(user=self.other_owner).post(f'/api/crm/rooms/{self.room.id}/unlock/', {'reason': 'x'},
                                                   format='json')
        self.assertEqual(res.status_code, 404)
