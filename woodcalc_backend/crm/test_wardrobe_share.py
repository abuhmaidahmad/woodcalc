import uuid

from crm.models import Room
from inventory.models import Material
from tenants.models import Company
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

    def material(self, sku, tenant=None, **extra):
        fields = {'name': f'Board {sku.split("-")[0].title()}', 'fallback_hex': '#aa8855', 'finish': 'wood', 'price_per_board': '987.65',
                  'unit_cost': '432.10', 'texture_physical_width_mm': 1300, 'texture_physical_height_mm': 2800, **extra}
        return Material.objects.create(tenant=tenant or self.company, sku=sku, **fields)

    def picked_room(self, materials, pricing=None):
        design = {**DESIGN, 'materials': materials, 'pricing': pricing or {'picks': {'Back': 'HDF-8'}, 'marginPct': 37}}
        return Room.objects.create(project=self.project, name='W', room_type='wardrobe', planner_data=wardrobe_data(design))

    def test_finishes_give_the_picked_carcass_and_front_without_prices_or_skus(self):
        self.material('OAK-18', texture_physical_width_mm=1250)
        self.material('WHT-18', fallback_hex='#f3f1ec', finish='matt')
        res = self.public(self.share(self.picked_room({'carcass': 'WHT-18', 'front': 'OAK-18', 'frontMatchesCarcass': False})))
        body = res.json()
        self.assertEqual(body['finishes']['carcass'], {'name': 'Board Wht', 'fallback_hex': '#f3f1ec', 'finish': 'matt', 'texture_physical_width_mm': 1300,
                                                      'texture_physical_height_mm': 2800, 'texture_image': None})
        self.assertEqual(body['finishes']['front']['texture_physical_width_mm'], 1250)
        self.assertEqual(body['design'], DESIGN)
        content = res.content.decode()
        for secret in ('987', '432', 'OAK-18', 'WHT-18', 'HDF-8', 'marginPct', 'price', 'unit_cost'):
            self.assertNotIn(secret, content)

    def test_front_same_as_carcass_uses_the_carcass_finish(self):
        self.material('WHT-18')
        self.material('OAK-18')
        body = self.public(self.share(self.picked_room({'carcass': 'WHT-18', 'front': 'OAK-18', 'frontMatchesCarcass': True}))).json()
        self.assertEqual(body['finishes']['front'], body['finishes']['carcass'])
        self.assertEqual(body['finishes']['front']['name'], 'Board Wht')

    def test_only_this_company_materials_are_used(self):
        other = Company.objects.create(name='B', slug='other-share-co', status=Company.Status.ACTIVE)
        self.material('OAK-18', tenant=other)
        body = self.public(self.share(self.picked_room({'carcass': 'OAK-18', 'front': None}))).json()
        self.assertEqual(body['finishes'], {})

    def test_rooms_without_materials_have_no_finishes(self):
        room = Room.objects.create(project=self.project, name='W', room_type='wardrobe', planner_data=wardrobe_data(DESIGN))
        self.assertEqual(self.public(self.share(room)).json()['finishes'], {})

    def test_standard_is_shared_without_prices_labour_margin_or_skus(self):
        data = wardrobe_data(DESIGN)
        data['standard'] = {'carcassT': 18, 'sheetL': 2800, 'priceHinge': 1.25, 'priceBoardFront': 48.5, 'labourPct': 20,
                            'marginPct': 30, 'spacerBoardSku': 'PB-25'}
        room = Room.objects.create(project=self.project, name='W', room_type='wardrobe', planner_data=data)
        res = self.public(self.share(room))
        self.assertEqual(res.json()['standard'], {'carcassT': 18, 'sheetL': 2800})
        for secret in ('price', 'labour', 'margin', 'PB-25', '48.5'):
            self.assertNotIn(secret, res.content.decode())
