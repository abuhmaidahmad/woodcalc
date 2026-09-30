from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0022_cabinettemplate'),
    ]

    operations = [
        migrations.AddField(
            model_name='drawersystem',
            name='price_per_set_c',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True),
        ),
        migrations.AddField(
            model_name='drawersystem',
            name='price_per_set_m',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True),
        ),
    ]
