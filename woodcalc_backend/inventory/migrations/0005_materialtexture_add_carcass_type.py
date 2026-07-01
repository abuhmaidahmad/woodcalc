from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0004_materialtexture_texture_physical_dimensions'),
    ]

    operations = [
        migrations.AlterField(
            model_name='materialtexture',
            name='material_type',
            field=models.CharField(
                max_length=10,
                choices=[
                    ('front', 'Front/Door'),
                    ('worktop', 'Worktop/Countertop'),
                    ('carcass', 'Carcass/Interior'),
                ],
            ),
        ),
    ]
