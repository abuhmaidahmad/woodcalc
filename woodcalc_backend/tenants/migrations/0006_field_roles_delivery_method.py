from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tenants", "0005_membership_auditor_role"),
    ]

    operations = [
        migrations.AddField(
            model_name="companysettings",
            name="delivery_method",
            field=models.CharField(
                choices=[
                    ("in_house", "In-house delivery"),
                    ("third_party_link", "Third-party link"),
                    ("installer", "Installer delivers"),
                ],
                default="third_party_link",
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="companymembership",
            name="role",
            field=models.CharField(
                choices=[
                    ("owner", "Owner"),
                    ("admin", "Admin"),
                    ("staff", "Staff"),
                    ("auditor", "Auditor"),
                    ("field_manager", "Installation Manager"),
                    ("installer", "Installer"),
                    ("driver", "Driver"),
                ],
                default="staff",
                max_length=20,
            ),
        ),
    ]
