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


class RevisionFlowTests(RoomLockTestBase):
    def setUp(self):
        super().setUp()
        self.room.grand_total = 100
        self.room.save()
        self.lock()

    def post(self, role, room_id, action, data=None):
        return self.api(role).post(f'/api/crm/rooms/{room_id}/{action}/', data or {}, format='json')

    def request_change(self, role='staff'):
        res = self.post(role, self.room.id, 'request_change')
        self.assertEqual(res.status_code, 201, res.content)
        return Room.objects.get(id=res.json()['id'])

    def test_end_to_end(self):
        rev2 = self.request_change()
        self.assertEqual((rev2.revision_number, rev2.parent_revision_id), (2, self.room.id))
        self.assertEqual(rev2.revision_status, Room.RevisionStatus.DRAFT)
        self.assertFalse(rev2.is_locked)
        self.assertEqual(self.post('staff', self.room.id, 'request_change').status_code, 400)

        res = self.api('staff').patch(f'/api/crm/rooms/{rev2.id}/', {
            'planner_data': {'cabinets': [{**CABINET, 'width': 900}]}, 'grand_total': '150.00'}, format='json')
        self.assertEqual(res.status_code, 200)
        self.room.refresh_from_db()
        self.assertTrue(self.room.is_locked)
        self.assertEqual(self.room.planner_data['cabinets'][0]['width'], 600)

        self.assertEqual(self.post('staff', rev2.id, 'submit_revision').status_code, 200)
        rev2.refresh_from_db()
        self.assertEqual(rev2.revision_status, Room.RevisionStatus.PENDING_APPROVAL)
        self.assertEqual(self.api('staff').patch(f'/api/crm/rooms/{rev2.id}/', {'name': 'X'},
                                                 format='json').status_code, 403)

        self.assertEqual(self.post('admin', rev2.id, 'approve_revision').status_code, 403)
        self.assertEqual(self.post('owner', rev2.id, 'reject_revision').status_code, 400)
        self.assertEqual(self.post('owner', rev2.id, 'reject_revision', {'reason': 'Wrong handle'}).status_code, 200)
        rev2.refresh_from_db()
        self.assertEqual((rev2.revision_status, rev2.is_locked, rev2.rejection_reason),
                         (Room.RevisionStatus.REJECTED, False, 'Wrong handle'))

        self.assertEqual(self.post('staff', rev2.id, 'submit_revision').status_code, 200)
        self.assertEqual(self.post('owner', rev2.id, 'approve_revision').status_code, 200)
        rev2.refresh_from_db()
        self.room.refresh_from_db()
        self.assertEqual((rev2.revision_status, rev2.is_locked), (Room.RevisionStatus.APPROVED, True))
        self.assertEqual((self.room.revision_status, self.room.is_locked), (Room.RevisionStatus.SUPERSEDED, True))
        self.project.refresh_from_db()
        self.assertEqual(self.project.total_value, 150)

        self.assertEqual(self.post('staff', self.room.id, 'request_change').status_code, 400)
        self.assertEqual(self.post('owner', self.room.id, 'unlock', {'reason': 'x'}).status_code, 400)
        self.assertEqual(self.api('owner').patch(f'/api/crm/rooms/{self.room.id}/', {'name': 'X'},
                                                 format='json').status_code, 403)
        rev3 = Room.objects.get(id=self.post('staff', rev2.id, 'request_change').json()['id'])
        self.assertEqual((rev3.revision_number, rev3.parent_revision_id), (3, rev2.id))

    def test_root_revision_cannot_be_submitted(self):
        self.assertEqual(self.post('owner', self.other_room.id, 'submit_revision').status_code, 404)
        self.post('owner', self.room.id, 'unlock', {'reason': 'x'})
        self.assertEqual(self.post('owner', self.room.id, 'submit_revision').status_code, 400)

    def test_revision_cannot_bypass_approval_with_confirm_lock(self):
        rev2 = self.request_change()
        self.assertEqual(self.post('owner', rev2.id, 'confirm_lock').status_code, 400)

    def test_approval_blocked_when_work_order_started_unless_override(self):
        wo = WorkOrder.objects.create(tenant=self.company, order_number='WO-1', product_name='K',
                                      room_id_ref=self.room.id, status='IN_PROGRESS')
        rev2 = self.request_change()
        self.post('staff', rev2.id, 'submit_revision')
        res = self.post('owner', rev2.id, 'approve_revision')
        self.assertEqual(res.status_code, 409)
        self.assertEqual(res.json()['started_work_orders'], [wo.order_number])
        res = self.post('owner', rev2.id, 'approve_revision', {'override_reason': 'Cabinets not cut yet'})
        self.assertEqual(res.status_code, 200)
        rev2.refresh_from_db()
        self.assertEqual(rev2.approval_override_reason, 'Cabinets not cut yet')

    def test_station_start_counts_as_started(self):
        from manufacturing.models import ProductionStation, StationLog
        from django.utils import timezone
        wo = WorkOrder.objects.create(tenant=self.company, order_number='WO-1', product_name='K',
                                      room_id_ref=self.room.id)
        station = ProductionStation.objects.create(tenant=self.company, name='Saw', code='SAW')
        StationLog.objects.create(work_order=wo, station=station, started_at=timezone.now())
        rev2 = self.request_change()
        self.post('staff', rev2.id, 'submit_revision')
        self.assertEqual(self.post('owner', rev2.id, 'approve_revision').status_code, 409)

    def test_new_work_order_not_started_does_not_block(self):
        WorkOrder.objects.create(tenant=self.company, order_number='WO-1', product_name='K', room_id_ref=self.room.id)
        rev2 = self.request_change()
        self.post('staff', rev2.id, 'submit_revision')
        self.assertEqual(self.post('owner', rev2.id, 'approve_revision').status_code, 200)

    def test_work_orders_listed_across_revision_chain(self):
        WorkOrder.objects.create(tenant=self.company, order_number='WO-1', product_name='K', room_id_ref=self.room.id)
        rev2 = self.request_change()
        res = self.api('staff').get(f'/api/manufacturing/work-orders/?room_chain={rev2.id}')
        self.assertEqual([w['order_number'] for w in res.json()['results']], ['WO-1'])
        res = self.api(user=self.other_owner).get(f'/api/manufacturing/work-orders/?room_chain={rev2.id}')
        self.assertEqual(res.json()['results'], [])

    def test_room_with_revisions_cannot_be_deleted(self):
        self.request_change()
        self.post('owner', self.room.id, 'unlock', {'reason': 'x'})
        self.assertEqual(self.api('owner').delete(f'/api/crm/rooms/{self.room.id}/').status_code, 400)

    def test_auditor_and_other_tenant_cannot_drive_revisions(self):
        res = self.post('auditor', self.room.id, 'request_change')
        self.assertEqual(res.status_code, 403)
        self.assertTrue(res.json()['detail'].startswith('Read-only access:'))
        res = self.api(user=self.other_owner).post(f'/api/crm/rooms/{self.room.id}/request_change/')
        self.assertEqual(res.status_code, 404)
        rev2 = self.request_change()
        self.post('staff', rev2.id, 'submit_revision')
        res = self.api(user=self.other_owner).post(f'/api/crm/rooms/{rev2.id}/approve_revision/')
        self.assertEqual(res.status_code, 404)


class ChangeLogTests(RoomLockTestBase):
    def history(self, role='owner', room=None):
        return self.api(role).get(f'/api/crm/rooms/{(room or self.room).id}/history/')

    def entries(self, room=None):
        return list((room or self.room).change_logs.order_by('id').values_list('action', 'field_path', 'old_value',
                                                                                'new_value', 'reason'))

    def test_planner_edit_is_diffed_per_cabinet(self):
        added = {'id': 2, 'category': 'wall', 'subtype': 'Wall', 'width': 400, 'height': 720, 'depth': 300}
        changed = {**CABINET, 'width': 900, 'frontMaterialName': 'Walnut', 'subtype': 'Sink'}
        self.api('staff').patch(f'/api/crm/rooms/{self.room.id}/', {
            'name': 'Main kitchen',
            'planner_data': {'cabinets': [changed, added], 'walls': [{'id': 'w1'}]},
        }, format='json')
        logs = self.entries()
        self.assertIn(('edit', 'name', 'Kitchen', 'Main kitchen', ''), logs)
        self.assertIn(('cabinet_changed', 'cabinets[1].width', 600, 900, ''), logs)
        self.assertIn(('cabinet_changed', 'cabinets[1].frontMaterialName', 'Oak', 'Walnut', ''), logs)
        self.assertIn(('cabinet_changed', 'cabinets[1].subtype', 'Base', 'Sink', ''), logs)
        self.assertIn(('cabinet_added', 'cabinets[2]', None,
                       {'category': 'wall', 'subtype': 'Wall', 'width': 400, 'height': 720, 'depth': 300}, ''), logs)
        self.assertIn(('edit', 'planner_data.walls', None, [{'id': 'w1'}], ''), logs)
        self.assertEqual(len(logs), 6)
        self.assertTrue(all(log.user == self.users['staff'] for log in self.room.change_logs.all()))

    def test_cabinet_removal_logged_and_unchanged_save_logs_nothing(self):
        self.api('owner').patch(f'/api/crm/rooms/{self.room.id}/', {'planner_data': {'cabinets': [CABINET]}},
                                format='json')
        self.assertEqual(self.entries(), [])
        self.api('owner').patch(f'/api/crm/rooms/{self.room.id}/', {'planner_data': {'cabinets': []}}, format='json')
        self.assertEqual(self.entries()[0][:2], ('cabinet_removed', 'cabinets[1]'))

    def test_large_values_are_summarised(self):
        walls = [{'id': i, 'points': list(range(50))} for i in range(40)]
        self.api('owner').patch(f'/api/crm/rooms/{self.room.id}/',
                                {'planner_data': {'cabinets': [CABINET], 'walls': walls}}, format='json')
        log = self.room.change_logs.get(field_path='planner_data.walls')
        self.assertEqual(log.new_value['size'], 40)

    def test_lifecycle_actions_logged_with_reasons(self):
        self.lock()
        self.api('owner').post(f'/api/crm/rooms/{self.room.id}/unlock/', {'reason': 'Typo'}, format='json')
        self.lock()
        rev2_id = self.api('staff').post(f'/api/crm/rooms/{self.room.id}/request_change/').json()['id']
        rev2 = Room.objects.get(id=rev2_id)
        url = f'/api/crm/rooms/{rev2_id}/'
        self.api('staff').post(url + 'submit_revision/')
        self.api('owner').post(url + 'reject_revision/', {'reason': 'Too wide'}, format='json')
        self.api('staff').post(url + 'submit_revision/')
        WorkOrder.objects.create(tenant=self.company, order_number='WO-9', product_name='K',
                                 room_id_ref=self.room.id, status='IN_PROGRESS')
        self.api('owner').post(url + 'approve_revision/', {'override_reason': 'Not cut yet'}, format='json')

        self.assertEqual([(a, r) for a, _, _, _, r in self.entries()],
                         [('lock', ''), ('unlock', 'Typo'), ('lock', ''), ('revision_superseded', ''),
                          ('work_order_flagged', 'Revision changed after start: Rev 2 approved. Not cut yet')])
        self.assertEqual([(a, r) for a, _, _, _, r in self.entries(rev2)], [
            ('revision_created', ''), ('revision_submitted', ''), ('revision_rejected', 'Too wide'),
            ('revision_submitted', ''), ('revision_approved', 'Not cut yet'),
        ])
        self.assertEqual(rev2.change_logs.get(action='revision_approved').new_value, {'started_work_orders': ['WO-9']})

    def test_history_visible_to_owner_admin_auditor_only(self):
        self.api('owner').patch(f'/api/crm/rooms/{self.room.id}/', {'name': 'X'}, format='json')
        for role in ('owner', 'admin', 'auditor'):
            res = self.history(role)
            self.assertEqual(res.status_code, 200, role)
            self.assertEqual(res.json()[0]['field_path'], 'name')
            self.assertEqual(res.json()[0]['user_name'], 'owner@a.com')
        self.assertEqual(self.history('staff').status_code, 403)
        res = self.api(user=self.other_owner).get(f'/api/crm/rooms/{self.room.id}/history/')
        self.assertEqual(res.status_code, 404)

    def test_history_readable_on_locked_room(self):
        self.lock()
        self.assertEqual(self.history('auditor').status_code, 200)


class VariantTests(RoomLockTestBase):
    def duplicate(self, room=None, role='staff'):
        res = self.api(role).post(f'/api/crm/rooms/{(room or self.room).id}/duplicate/', {}, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        return Room.objects.get(id=res.json()['id']), res.json()

    def test_plain_room_duplicate_is_not_a_variant(self):
        copy, _ = self.duplicate()
        self.assertFalse(copy.is_variant)
        self.assertIsNone(copy.source_room)

    def test_locked_room_duplicate_is_a_variant(self):
        self.lock()
        copy, data = self.duplicate()
        self.assertTrue(copy.is_variant)
        self.assertEqual(copy.source_room, self.room)
        self.assertFalse(copy.is_locked)
        self.assertEqual((data['source_room_name'], data['source_room_revision']), ('Kitchen', 1))

    def test_room_with_revision_history_duplicate_is_a_variant(self):
        self.lock()
        rev2_id = self.api('staff').post(f'/api/crm/rooms/{self.room.id}/request_change/').json()['id']
        self.api('owner').post(f'/api/crm/rooms/{self.room.id}/unlock/', {'reason': 'x'}, format='json')
        copy, _ = self.duplicate(self.room)
        self.assertTrue(copy.is_variant)
        copy2, _ = self.duplicate(Room.objects.get(id=rev2_id))
        self.assertTrue(copy2.is_variant)

    def test_duplicate_of_a_variant_stays_a_variant(self):
        self.lock()
        variant, _ = self.duplicate()
        copy, _ = self.duplicate(variant)
        self.assertTrue(copy.is_variant)
        self.assertEqual(copy.source_room, variant)

    def test_only_owner_confirms_variant_with_reason(self):
        self.lock()
        variant, _ = self.duplicate()
        url = f'/api/crm/rooms/{variant.id}/confirm_lock/'
        self.assertEqual(self.api('admin').post(url, {'reason': 'x'}, format='json').status_code, 403)
        self.assertEqual(self.api('staff').post(url, {'reason': 'x'}, format='json').status_code, 403)
        self.assertEqual(self.api('owner').post(url, {}, format='json').status_code, 400)
        res = self.api('owner').post(url, {'reason': 'Customer chose option B'}, format='json')
        self.assertEqual(res.status_code, 200)
        log = variant.change_logs.get(action='lock')
        self.assertEqual(log.reason, 'Customer chose option B')
        self.assertTrue(log.new_value['is_variant'])

    def test_only_owner_can_send_confirmed_variant_to_manufacturing(self):
        self.lock()
        variant, _ = self.duplicate()
        self.api('owner').post(f'/api/crm/rooms/{variant.id}/confirm_lock/', {'reason': 'B'}, format='json')
        for role, expected in (('admin', 400), ('staff', 400), ('owner', 201)):
            res = self.api(role).post('/api/manufacturing/work-orders/', {
                'order_number': f'WO-{role}', 'product_name': 'K', 'room_id_ref': variant.id}, format='json')
            self.assertEqual(res.status_code, expected, role)

    def test_revision_of_variant_stays_a_variant(self):
        self.lock()
        variant, _ = self.duplicate()
        self.api('owner').post(f'/api/crm/rooms/{variant.id}/confirm_lock/', {'reason': 'B'}, format='json')
        rev2 = Room.objects.get(id=self.api('staff').post(f'/api/crm/rooms/{variant.id}/request_change/').json()['id'])
        self.assertTrue(rev2.is_variant)
        self.assertEqual(rev2.source_room, self.room)

    def test_variant_fields_not_writable(self):
        res = self.api('owner').patch(f'/api/crm/rooms/{self.room.id}/', {'is_variant': True}, format='json')
        self.assertEqual(res.status_code, 200)
        self.room.refresh_from_db()
        self.assertFalse(self.room.is_variant)


class StaleWorkOrderTests(RoomLockTestBase):
    def setUp(self):
        super().setUp()
        self.lock()

    def approve_new_revision(self, data=None):
        rev2_id = self.api('staff').post(f'/api/crm/rooms/{self.room.id}/request_change/').json()['id']
        self.api('staff').post(f'/api/crm/rooms/{rev2_id}/submit_revision/')
        return self.api('owner').post(f'/api/crm/rooms/{rev2_id}/approve_revision/', data or {}, format='json')

    def wo(self, number, status='NEW', room=None, tenant=None):
        return WorkOrder.objects.create(tenant=tenant or self.company, order_number=number, product_name='K',
                                        room_id_ref=(room or self.room).id, status=status)

    def test_pending_work_orders_cancelled_when_revision_approved(self):
        pending = self.wo('WO-1')
        done_before = self.wo('WO-0', status='CANCELLED')
        res = self.approve_new_revision()
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['cancelled_work_orders'], ['WO-1'])
        self.assertEqual(res.json()['flagged_work_orders'], [])
        pending.refresh_from_db()
        self.assertEqual((pending.status, pending.status_reason), ('CANCELLED', 'Superseded by Rev 2'))
        self.assertFalse(pending.revision_changed_after_start)
        done_before.refresh_from_db()
        self.assertEqual(done_before.status_reason, '')
        log = self.room.change_logs.get(action='work_order_cancelled')
        self.assertEqual((log.reason, log.new_value['work_order']), ('Superseded by Rev 2', 'WO-1'))

    def test_started_work_orders_flagged_not_cancelled_on_override(self):
        from manufacturing.models import ProductionStation, StationLog
        from django.utils import timezone
        in_progress = self.wo('WO-1', status='IN_PROGRESS')
        new_but_started = self.wo('WO-2')
        station = ProductionStation.objects.create(tenant=self.company, name='Saw', code='SAW')
        StationLog.objects.create(work_order=new_but_started, station=station, started_at=timezone.now())
        pending = self.wo('WO-3')
        res = self.approve_new_revision({'override_reason': 'Only doors changed'})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(sorted(res.json()['flagged_work_orders']), ['WO-1', 'WO-2'])
        self.assertEqual(res.json()['cancelled_work_orders'], ['WO-3'])
        for wo in (in_progress, new_but_started):
            wo.refresh_from_db()
            self.assertTrue(wo.revision_changed_after_start)
            self.assertNotEqual(wo.status, 'CANCELLED')
            self.assertIn('Only doors changed', wo.status_reason)
        res = self.api('staff').get('/api/manufacturing/work-orders/?room_chain=' + str(self.room.id))
        flags = {w['order_number']: w['revision_changed_after_start'] for w in res.json()['results']}
        self.assertEqual(flags, {'WO-1': True, 'WO-2': True, 'WO-3': False})

    def test_other_tenants_work_orders_untouched(self):
        theirs = self.wo('WO-X', tenant=self.other)
        self.approve_new_revision()
        theirs.refresh_from_db()
        self.assertEqual(theirs.status, 'NEW')

    def test_flags_not_writable_through_api(self):
        wo = self.wo('WO-1')
        res = self.api('owner').patch(f'/api/manufacturing/work-orders/{wo.id}/',
                                      {'revision_changed_after_start': True, 'status_reason': 'x'}, format='json')
        self.assertEqual(res.status_code, 200)
        wo.refresh_from_db()
        self.assertEqual((wo.revision_changed_after_start, wo.status_reason), (False, ''))


class ProjectTotalTests(RoomLockTestBase):
    def total(self):
        self.project.refresh_from_db()
        return self.project.total_value

    def test_total_counts_only_confirmed_rooms(self):
        Room.objects.filter(id=self.room.id).update(grand_total=100)
        draft = Room.objects.create(project=self.project, name='Draft', grand_total=500)
        self.lock()
        self.assertEqual(self.total(), 100)

        self.assertEqual(self.api('owner').delete(f'/api/crm/rooms/{draft.id}/').status_code, 204)
        self.assertEqual(self.total(), 100)

        self.assertEqual(self.api('owner').post(f'/api/crm/rooms/{self.room.id}/unlock/', {'reason': 'edit'},
                                                format='json').status_code, 200)
        self.assertEqual(self.total(), 0)
