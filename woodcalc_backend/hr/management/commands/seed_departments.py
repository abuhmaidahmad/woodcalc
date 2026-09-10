from django.core.management.base import BaseCommand
from tenants.models import Company
from hr.models import seed_default_departments


class Command(BaseCommand):
    help = 'Seed the default department list for every company that has none yet (idempotent).'

    def handle(self, *args, **options):
        for company in Company.objects.all():
            before = company.departments.count()
            seed_default_departments(company)
            after = company.departments.count()
            self.stdout.write(f'{company.name}: +{after - before} departments (now {after})')
        self.stdout.write(self.style.SUCCESS('Done.'))
