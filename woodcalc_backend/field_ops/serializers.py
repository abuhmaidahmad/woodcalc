from django.contrib.auth import get_user_model
from rest_framework import serializers

from crm.models import Project, Room
from tenants.models import FIELD_WORKER_ROLES, CompanyMembership

from .models import Installation, InstallationAssignment
from .snapshot import HARDWARE_KEYS, HARDWARE_SUMMARY_KEY, build_design_snapshot

User = get_user_model()

DESIGN_KEYS = (
    "room_name", "room_type", "revision_number", "room", "base_height_mm", "wall_thickness_mm", "walls",
    "elements", "cabinets", "appliances", "countertop", "finishes", HARDWARE_SUMMARY_KEY,
)


def full_name(user):
    return f"{user.first_name} {user.last_name}".strip() or user.email


def maps_url(lat, lng):
    if lat is None or lng is None:
        return None
    return f"https://www.google.com/maps/search/?api=1&query={lat},{lng}"


def design_from_snapshot(snapshot):
    snapshot = snapshot if isinstance(snapshot, dict) else {}
    return {key: snapshot.get(key) for key in DESIGN_KEYS}


def request_company(context):
    return getattr(context["request"], "company", None)


class HardwareItemSerializer(serializers.Serializer):
    key = serializers.ChoiceField(choices=HARDWARE_KEYS)
    qty = serializers.IntegerField(min_value=0, max_value=100000)
    spec = serializers.CharField(max_length=100, required=False, allow_blank=True)


def clean_hardware_summary(items):
    cleaned = []
    for item in items:
        row = {"key": item["key"], "qty": item["qty"]}
        if item.get("spec"):
            row["spec"] = item["spec"]
        cleaned.append(row)
    return cleaned


class AssignmentSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    user_role = serializers.SerializerMethodField()

    class Meta:
        model = InstallationAssignment
        fields = ["id", "installation", "user", "is_lead", "user_name", "user_role"]

    def get_user_name(self, obj):
        return full_name(obj.user)

    def get_user_role(self, obj):
        membership = getattr(obj.user, "company_membership", None)
        return membership.role if membership else None

    def validate_installation(self, value):
        if value.tenant_id != request_company(self.context).id:
            raise serializers.ValidationError("Installation not found.")
        return value

    def validate_user(self, value):
        is_field_worker = CompanyMembership.objects.filter(
            user=value, company=request_company(self.context), role__in=FIELD_WORKER_ROLES, user__is_active=True,
        ).exists()
        if not is_field_worker:
            raise serializers.ValidationError("Only installer or driver accounts in your company can be assigned.")
        return value


class InstallationSerializer(serializers.ModelSerializer):
    project = serializers.PrimaryKeyRelatedField(queryset=Project.objects.select_related("client"))
    room = serializers.PrimaryKeyRelatedField(queryset=Room.objects.all())
    assignments = AssignmentSerializer(many=True, read_only=True)
    project_name = serializers.CharField(source="project.name", read_only=True)
    customer_name = serializers.CharField(source="project.client.name", read_only=True)
    customer_phone = serializers.CharField(source="project.client.phone", read_only=True)
    room_name = serializers.SerializerMethodField()
    revision_number = serializers.SerializerMethodField()
    maps_url = serializers.SerializerMethodField()
    design = serializers.SerializerMethodField()
    hardware_summary = HardwareItemSerializer(many=True, write_only=True, required=False)

    class Meta:
        model = Installation
        fields = [
            "id", "project", "project_name", "customer_name", "customer_phone", "room", "room_name",
            "revision_number", "status", "scheduled_date", "area", "address", "lat", "lng", "maps_url",
            "site_contact_name", "site_contact_phone", "notes", "assignments", "design", "hardware_summary",
            "created_at", "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def get_room_name(self, obj):
        return (obj.design_snapshot or {}).get("room_name")

    def get_revision_number(self, obj):
        return (obj.design_snapshot or {}).get("revision_number")

    def get_maps_url(self, obj):
        return maps_url(obj.lat, obj.lng)

    def get_design(self, obj):
        if self.context.get("view") and getattr(self.context["view"], "action", None) == "list":
            return None
        return design_from_snapshot(obj.design_snapshot)

    def validate_project(self, value):
        if value.client.tenant_id != request_company(self.context).id:
            raise serializers.ValidationError("Project not found.")
        return value

    def validate(self, attrs):
        project = attrs.get("project", getattr(self.instance, "project", None))
        room = attrs.get("room", getattr(self.instance, "room", None))
        if self.instance is None or "room" in attrs or "project" in attrs:
            if room is None or room.project_id != project.id:
                raise serializers.ValidationError({"room": "Pick a kitchen from this project."})
            if not room.is_locked or room.revision_status != Room.RevisionStatus.APPROVED:
                raise serializers.ValidationError({"room": "Only a confirmed (locked) kitchen can be installed."})
        return attrs

    def _with_snapshot(self, validated_data):
        summary = validated_data.pop("hardware_summary", None)
        room = validated_data.get("room")
        if room is not None:
            validated_data["design_snapshot"] = build_design_snapshot(room)
        if summary is not None:
            snapshot = validated_data.get("design_snapshot")
            if snapshot is None:
                snapshot = dict(self.instance.design_snapshot or {}) if self.instance else {}
            snapshot[HARDWARE_SUMMARY_KEY] = clean_hardware_summary(summary)
            validated_data["design_snapshot"] = snapshot
        project = validated_data.get("project")
        if project is not None and not validated_data.get("address") and self.instance is None:
            validated_data["address"] = project.address or project.client.address
        return validated_data

    def create(self, validated_data):
        return super().create(self._with_snapshot(validated_data))

    def update(self, instance, validated_data):
        if "room" in validated_data and validated_data["room"] == instance.room:
            validated_data.pop("room")
        return super().update(instance, self._with_snapshot(validated_data))


class LockedRoomSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source="project.name", read_only=True)
    customer_name = serializers.CharField(source="project.client.name", read_only=True)
    project_address = serializers.SerializerMethodField()

    class Meta:
        model = Room
        fields = ["id", "name", "revision_number", "project", "project_name", "customer_name", "project_address"]

    def get_project_address(self, obj):
        return obj.project.address or obj.project.client.address


class CrewMemberSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="user.id")
    name = serializers.SerializerMethodField()

    class Meta:
        model = CompanyMembership
        fields = ["id", "name", "role"]

    def get_name(self, obj):
        return full_name(obj.user)


class InstallerCrewSerializer(serializers.Serializer):
    name = serializers.SerializerMethodField()
    is_lead = serializers.BooleanField()

    def get_name(self, obj):
        return full_name(obj.user)


class InstallerJobSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    status = serializers.CharField()
    scheduled_date = serializers.DateField()
    project_name = serializers.CharField(source="project.name")
    room_name = serializers.SerializerMethodField()
    revision_number = serializers.SerializerMethodField()
    customer_name = serializers.CharField(source="project.client.name")
    customer_phone = serializers.SerializerMethodField()
    area = serializers.CharField()
    address = serializers.SerializerMethodField()
    lat = serializers.SerializerMethodField()
    lng = serializers.SerializerMethodField()
    maps_url = serializers.SerializerMethodField()
    site_contact_name = serializers.CharField()
    site_contact_phone = serializers.CharField()
    notes = serializers.CharField()
    crew = InstallerCrewSerializer(source="assignments", many=True)
    design = serializers.SerializerMethodField()

    def _hidden(self, obj):
        return obj.status == Installation.Status.COMPLETED

    def get_room_name(self, obj):
        return (obj.design_snapshot or {}).get("room_name")

    def get_revision_number(self, obj):
        return (obj.design_snapshot or {}).get("revision_number")

    def get_customer_phone(self, obj):
        return None if self._hidden(obj) else (obj.project.client.phone or None)

    def get_address(self, obj):
        return None if self._hidden(obj) else (obj.address or None)

    def get_lat(self, obj):
        return None if self._hidden(obj) else obj.lat

    def get_lng(self, obj):
        return None if self._hidden(obj) else obj.lng

    def get_maps_url(self, obj):
        return None if self._hidden(obj) else maps_url(obj.lat, obj.lng)

    def get_design(self, obj):
        return design_from_snapshot(obj.design_snapshot)


class InstallerJobListSerializer(InstallerJobSerializer):
    design = None
    crew = None
    notes = None
    site_contact_name = None
    site_contact_phone = None
