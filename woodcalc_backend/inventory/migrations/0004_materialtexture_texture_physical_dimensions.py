from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0003_add_board_dims_thickness_finish_to_materialtexture'),
    ]

    operations = [
        migrations.AddField(
            model_name='materialtexture',
            name='texture_physical_width_mm',
            field=models.PositiveIntegerField(
                default=600,
                help_text='Real-world width this texture image represents (mm). Used to scale grain correctly in 3D view.',
            ),
        ),
        migrations.AddField(
            model_name='materialtexture',
            name='texture_physical_height_mm',
            field=models.PositiveIntegerField(
                default=600,
                help_text='Real-world height this texture image represents (mm). Used to scale grain correctly in 3D view.',
            ),
        ),
    ]
