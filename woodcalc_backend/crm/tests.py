import uuid

from django.test import TestCase

from crm.models import Client, Project, Room
from tenants.models import Company


class PublicRoomShareViewTests(TestCase):
    def setUp(self):
        company = Company.objects.create(name='A', slug='a')
        client = Client.objects.create(tenant=company, name='C')
        project = Project.objects.create(client=client, name='P')
        self.token = uuid.uuid4()
        self.room = Room.objects.create(
            project=project, name='Kitchen', share_token=self.token,
            planner_data={
                'walls': [{'id': 'w1'}],
                'stairs': [{'id': 's1', 'shape': 'straight'}],
                'cabinets': [{'id': 'c1'}],
            },
        )

    def test_shared_payload_includes_stairs(self):
        res = self.client.get(f'/api/crm/rooms/shared/{self.token}/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['stairs'], [{'id': 's1', 'shape': 'straight'}])

    def test_unknown_token_is_404(self):
        res = self.client.get(f'/api/crm/rooms/shared/{uuid.uuid4()}/')
        self.assertEqual(res.status_code, 404)
