import json

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from crm.layout_import import LayoutError, layout_to_planner_data
from crm.models import Client, Project, Room
from inventory.models import Sink
from tenants.models import Company


class Command(BaseCommand):
    help = 'Import a neutral kitchen layout JSON into a Room as Kitchen Planner planner_data.'

    def add_arguments(self, parser):
        parser.add_argument('--file', required=True)
        parser.add_argument('--tenant', required=True, help='Company slug that must own the room')
        parser.add_argument('--room', type=int)
        parser.add_argument('--client', type=int)
        parser.add_argument('--project', type=int)
        parser.add_argument('--client-name', help='Use this customer, creating it if the tenant has none by that name')
        parser.add_argument('--project-name', help='Use this project under the customer, creating it if missing')
        parser.add_argument('--name')
        parser.add_argument('--sink-id', type=int)
        parser.add_argument('--dry-run', action='store_true')

    def handle(self, *args, **opts):
        company = Company.objects.filter(slug=opts['tenant']).first()
        if company is None:
            raise CommandError(f'No company with slug "{opts["tenant"]}"')

        room = client = project = None
        new_client = new_project = None
        if opts['room']:
            room = Room.objects.select_related('project__client').filter(pk=opts['room'], project__client__tenant=company).first()
            if room is None:
                raise CommandError(f'Room {opts["room"]} not found for tenant {company.slug}')
        else:
            if not opts['name']:
                raise CommandError('Pass --room, or --name with a customer (--client/--client-name) and project (--project/--project-name)')
            if opts['client']:
                client = Client.objects.filter(pk=opts['client'], tenant=company).first()
                if client is None:
                    raise CommandError(f'Client {opts["client"]} not found for tenant {company.slug}')
            elif opts['client_name']:
                client = Client.objects.filter(tenant=company, name=opts['client_name']).order_by('pk').first()
                if client is None:
                    new_client = opts['client_name']
            else:
                raise CommandError('Pass --client <id> or --client-name "..."')
            if opts['project']:
                if client is None:
                    raise CommandError('--project <id> needs an existing customer')
                project = Project.objects.filter(pk=opts['project'], client=client).first()
                if project is None:
                    raise CommandError(f'Project {opts["project"]} does not belong to client {client.pk}')
            elif opts['project_name']:
                if client is not None:
                    project = Project.objects.filter(client=client, name=opts['project_name']).order_by('pk').first()
                if project is None:
                    new_project = opts['project_name']
            else:
                raise CommandError('Pass --project <id> or --project-name "..."')

        sink = None
        if opts['sink_id']:
            s = Sink.objects.filter(pk=opts['sink_id'], tenant=company).first()
            if s is None:
                raise CommandError(f'Sink {opts["sink_id"]} not found for tenant {company.slug}')
            sink = {
                'id': s.pk, 'brand': s.brand, 'model_name': s.model_name, 'material': s.material,
                'color': s.color, 'color_hex': s.color_hex, 'cavity_count': s.cavity_count,
                'width_mm': s.width_mm, 'depth_mm': s.depth_mm, 'bowl_depth_mm': s.bowl_depth_mm,
                'cutout_width_mm': s.cutout_width_mm, 'cutout_depth_mm': s.cutout_depth_mm,
                'price': str(s.price) if s.price is not None else None,
                'roughness': s.roughness, 'metalness': s.metalness,
            }

        try:
            with open(opts['file'], encoding='utf-8') as f:
                layout = json.load(f)
        except (OSError, json.JSONDecodeError) as e:
            raise CommandError(f'Cannot read layout: {e}')

        try:
            data, report = layout_to_planner_data(layout, sink=sink)
        except (LayoutError, KeyError) as e:
            raise CommandError(f'Invalid layout: {e}')

        name = opts['name'] or (room.name if room else layout.get('name'))
        data['projectName'] = name

        if opts['dry_run']:
            self.stdout.write(json.dumps(data, indent=2, ensure_ascii=False))
            self.print_report(report)
            if new_client:
                self.stderr.write(f'Would create customer "{new_client}"')
            if new_project:
                self.stderr.write(f'Would create project "{new_project}"')
            self.stdout.write(self.style.WARNING('Dry run: nothing saved.'))
            return

        with transaction.atomic():
            if new_client:
                client = Client.objects.create(tenant=company, name=new_client)
                self.stderr.write(f'Created customer {client.pk} "{client.name}"')
            if new_project:
                project = Project.objects.create(client=client, name=new_project)
                self.stderr.write(f'Created project {project.pk} "{project.name}"')
            if room is None:
                room = Room.objects.create(project=project, name=name, room_type='kitchen', planner_data=data)
            else:
                room.planner_data = data
                if opts['name']:
                    room.name = opts['name']
                room.save()
        self.print_report(report)
        self.stdout.write(self.style.SUCCESS(f'Saved room {room.pk} "{room.name}" (project {room.project_id}, tenant {company.slug}).'))

    def print_report(self, report):
        for key in ('mapped', 'warnings', 'skipped'):
            self.stderr.write(f'\n{key.upper()}:')
            for line in report[key]:
                self.stderr.write(f'  {line}')
        self.stderr.write('\nCHECKS:')
        for k, v in report['checks'].items():
            self.stderr.write(f'  {k}: {v}')
