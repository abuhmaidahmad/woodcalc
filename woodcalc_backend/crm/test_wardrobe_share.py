import uuid

from crm.models import Room
from crm.test_room_lock import CABINET, RoomLockTestBase

DESIGN = {'width': 2400, 'height': 2600, 'depth': 600, 'construction': 'shared', 'sections': [{'zones': []}]}
CLOSET = {**DESIGN, 'mode': 'closet', 'closet': {'shape': 'U', 'width': 3000, 'roomDepth': 2600, 'height': 2400,
                                                 'runs': {'A': {'depth': 600, 'sections': []}}, 'island': {'enabled': True}}}


def wardrobe_data(design):
    return {'kind': 'wardrobe', 'version': 1, 'design': design, 'standard': {'carcassT': 18},
            'materials': {'Carcass': {'sku': 'EG-W980', 'name': 'White'}}, 'grandTotal': 793.95,
            'summary': {'sheets': 8}, 'frontColor': '#c49a6c'}


class WardrobeShareViewTests(RoomLockTestBase):
    def share(self, room):
        res = self.api('owner').post(f'/api/crm/rooms/{room.id}/share_link/')
        self.assertEqual(res.status_code, 200, res.content)
        return res.json()['share_token']

    def public(self, token):
        return self.client.get(f'/api/crm/rooms/shared/{token}/')

    def test_wardrobe_room_returns_design_only(self):
        room = Room.objects.create(project=self.project, name='Master wardrobe', room_type='wardrobe', planner_data=wardrobe_data(DESIGN))
        res = self.public(self.share(room))
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body['kind'], 'wardrobe')
        self.assertEqual(body['design'], DESIGN)
        self.assertEqual(body['standard'], {'carcassT': 18})
        self.assertEqual(body['frontColor'], '#c49a6c')
        self.assertEqual(body['company_name'], self.company.name)
        self.assertEqual(body['name'], 'Master wardrobe')
        for key in ('grandTotal', 'materials', 'summary', 'cabinets', 'notes', 'project', 'grand_total'):
            self.assertNotIn(key, body)
        self.assertNotIn('793', res.content.decode())
        self.assertNotIn('EG-W980', res.content.decode())

    def test_closet_room_returns_its_full_closet(self):
        room = Room.objects.create(project=self.project, name='Walk-in', room_type='closet', planner_data=wardrobe_data(CLOSET))
        body = self.public(self.share(room)).json()
        self.assertEqual(body['design']['mode'], 'closet')
        self.assertEqual(body['design']['closet'], CLOSET['closet'])

    def test_kitchen_response_is_unchanged(self):
        self.room.planner_data = {'cabinets': [CABINET], 'walls': [{'id': 'w1'}], 'room': {'width': 3000}, 'grandTotal': 500}
        self.room.save()
        body = self.public(self.share(self.room)).json()
        self.assertEqual(set(body), {'name', 'room_type', 'company_slug', 'room', 'walls', 'stairs', 'elements', 'cabinets',
                                     'countertopMat', 'countertopThickness', 'backsplashSegments', 'backsplashHeight',
                                     'backsplashThickness'})
        self.assertEqual(body['cabinets'], [CABINET])

    def test_revoked_or_unknown_token_is_not_found(self):
        room = Room.objects.create(project=self.project, name='W', room_type='wardrobe', planner_data=wardrobe_data(DESIGN))
        token = self.share(room)
        self.assertEqual(self.api('owner').delete(f'/api/crm/rooms/{room.id}/share_link/').status_code, 204)
        self.assertEqual(self.public(token).status_code, 404)
        self.assertEqual(self.public(uuid.uuid4()).status_code, 404)
