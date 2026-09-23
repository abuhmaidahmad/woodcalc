import json
from io import StringIO
from pathlib import Path

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import SimpleTestCase, TestCase

from crm.layout_import import layout_to_planner_data
from crm.models import Client, Project, Room
from tenants.models import Company

FIXTURE = Path(__file__).parent / 'fixtures' / 'layouts' / 'abc_l_peninsula.json'


def load_fixture():
    return json.loads(FIXTURE.read_text(encoding='utf-8'))


class LayoutConversionTests(SimpleTestCase):
    def setUp(self):
        self.data, self.report = layout_to_planner_data(load_fixture())
        self.by_code = {c['importCode']: c for c in self.data['cabinets']}

    def test_wall_inner_lengths(self):
        checks = self.report['checks']
        self.assertEqual(checks['wall_sink_wall_inner'], 3070)
        self.assertEqual(checks['wall_door_wall_inner'], 3675)
        self.assertEqual(checks['wall_cooking_wall_inner'], 3600)

    def test_no_collisions(self):
        self.assertEqual(self.report['checks']['collisions'], [])

    def test_sink_on_window_and_hob_on_gas(self):
        self.assertEqual(self.report['checks']['sink_centre'], self.report['checks']['window_centre'])
        self.assertEqual(self.report['checks']['hob_centre'], 1650)

    def test_openings_embedded(self):
        els = {e['type']: e for e in self.data['elements']}
        self.assertEqual(els['window']['wallIndex'], 0)
        self.assertEqual(els['window']['elevation'], 1050)
        self.assertEqual(els['window']['h'], 1400)
        self.assertEqual(els['door']['wallIndex'], 1)
        self.assertTrue(all(e['embeddedInWall'] for e in self.data['elements']))

    def test_rotations_and_blind_sides(self):
        self.assertEqual(self.by_code['SK']['rotation'], 270)
        self.assertEqual(self.by_code['C1']['rotation'], 0)
        self.assertEqual(self.by_code['C2']['rotation'], 90)
        self.assertEqual(self.by_code['FH-FR']['rotation'], 180)
        self.assertEqual(self.by_code['C1']['blindSide'], 'left')
        self.assertEqual(self.by_code['C2']['blindSide'], 'left')

    def test_catalog_subtypes(self):
        self.assertEqual(self.by_code['C1']['subtype'], 'Blind')
        self.assertEqual(self.by_code['H90']['subtype'], 'Hob + Oven')
        self.assertEqual(self.by_code['HD']['subtype'], 'Appliance')
        self.assertEqual(self.by_code['peninsula-OH']['subtype'], 'Shelf')
        self.assertEqual(self.by_code['peninsula-OH']['elevation'], 870)

    def test_stools_skipped(self):
        self.assertEqual(len(self.report['skipped']), 2)


class ImportLayoutCommandTests(TestCase):
    def setUp(self):
        self.company = Company.objects.create(name='A', slug='a')
        self.other = Company.objects.create(name='B', slug='b')
        self.client_a = Client.objects.create(tenant=self.company, name='C')
        self.project = Project.objects.create(client=self.client_a, name='P')
        self.room = Room.objects.create(project=self.project, name='Kitchen')

    def run_cmd(self, *args):
        out, err = StringIO(), StringIO()
        call_command('import_layout', '--file', str(FIXTURE), *args, stdout=out, stderr=err)
        return out.getvalue()

    def test_dry_run_does_not_save(self):
        out = self.run_cmd('--tenant', 'a', '--room', str(self.room.pk), '--dry-run')
        self.assertIn('"cabinets"', out)
        self.room.refresh_from_db()
        self.assertEqual(self.room.planner_data, {})

    def test_overwrite_room(self):
        self.run_cmd('--tenant', 'a', '--room', str(self.room.pk))
        self.room.refresh_from_db()
        self.assertEqual(len(self.room.planner_data['walls']), 3)

    def test_create_room(self):
        self.run_cmd('--tenant', 'a', '--client', str(self.client_a.pk), '--project', str(self.project.pk), '--name', 'Imported')
        self.assertTrue(Room.objects.filter(project=self.project, name='Imported').exists())

    def test_other_tenant_rejected(self):
        with self.assertRaises(CommandError):
            self.run_cmd('--tenant', 'b', '--room', str(self.room.pk))
        with self.assertRaises(CommandError):
            self.run_cmd('--tenant', 'b', '--client', str(self.client_a.pk), '--project', str(self.project.pk), '--name', 'X')
