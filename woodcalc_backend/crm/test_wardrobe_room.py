from decimal import Decimal

from crm.models import Room
from crm.test_room_lock import RoomLockTestBase

WARDROBE_DATA = {
    'kind': 'wardrobe',
    'version': 1,
    'design': {'width': 2400, 'height': 2600, 'depth': 600, 'construction': 'shared', 'backType': 'none', 'sections': []},
    'standard': {'carcassT': 18},
    'grandTotal': 793.95,
}


class WardrobeRoomTests(RoomLockTestBase):
    def test_create_wardrobe_and_closet_rooms(self):
        for room_type in ('wardrobe', 'closet'):
            res = self.api('owner').post('/api/crm/rooms/', {'project': self.project.id, 'name': room_type, 'room_type': room_type}, format='json')
            self.assertEqual(res.status_code, 201, res.content)
            self.assertEqual(res.data['room_type'], room_type)

    def test_save_reopen_and_confirm_wardrobe(self):
        room = Room.objects.create(project=self.project, name='Master wardrobe', room_type='wardrobe')
        res = self.api('owner').patch(f'/api/crm/rooms/{room.id}/', {'planner_data': WARDROBE_DATA, 'grand_total': '793.95'}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        got = self.api('owner').get(f'/api/crm/rooms/{room.id}/').data
        self.assertEqual(got['planner_data'], WARDROBE_DATA)
        self.assertEqual(got['room_type'], 'wardrobe')

        res = self.api('owner').get(f'/api/crm/rooms/{room.id}/confirm_preview/')
        self.assertEqual(res.status_code, 200, res.content)
        self.lock(room)
        room.refresh_from_db()
        self.assertTrue(room.is_locked)
        self.assertEqual(room.planner_data, WARDROBE_DATA)
        self.project.refresh_from_db()
        self.assertEqual(self.project.total_value, Decimal('793.95'))

    def test_wardrobe_revision_flow(self):
        room = Room.objects.create(project=self.project, name='Wardrobe', room_type='wardrobe', planner_data=WARDROBE_DATA, grand_total=Decimal('500'))
        self.lock(room)
        res = self.api('owner').post(f'/api/crm/rooms/{room.id}/request_change/')
        self.assertEqual(res.status_code, 201, res.content)
        rev = Room.objects.get(pk=res.data['id'])
        self.assertEqual(rev.room_type, 'wardrobe')
        self.assertEqual(rev.planner_data, WARDROBE_DATA)
        changed = {**WARDROBE_DATA, 'design': {**WARDROBE_DATA['design'], 'width': 3000}}
        self.assertEqual(self.api('owner').patch(f'/api/crm/rooms/{rev.id}/', {'planner_data': changed, 'grand_total': '650.00'}, format='json').status_code, 200)
        self.assertEqual(self.api('owner').post(f'/api/crm/rooms/{rev.id}/submit_revision/').status_code, 200)
        res = self.api('owner').post(f'/api/crm/rooms/{rev.id}/approve_revision/')
        self.assertEqual(res.status_code, 200, res.content)
        self.project.refresh_from_db()
        self.assertEqual(self.project.total_value, Decimal('650.00'))
