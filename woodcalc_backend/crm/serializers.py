from rest_framework import serializers
from .models import PaymentTransaction, Client, Lead, Quotation, QuotationItem, Project, Room, Payment, RoomChangeLog


class ClientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = '__all__'
        extra_kwargs = {'tenant': {'read_only': True}}


class LeadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lead
        fields = '__all__'
        extra_kwargs = {'tenant': {'read_only': True}}


class QuotationItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuotationItem
        fields = '__all__'


class QuotationSerializer(serializers.ModelSerializer):
    items = QuotationItemSerializer(many=True, read_only=True)

    class Meta:
        model = Quotation
        fields = '__all__'
from .models import Client, Lead, Quotation, QuotationItem, Project, Room, Payment


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = '__all__'


ROOM_LOCK_FIELDS = ['is_locked', 'locked_at', 'locked_by', 'unlock_reason', 'revision_number', 'parent_revision', 'revision_status',
                    'rejection_reason', 'approval_override_reason', 'is_variant', 'source_room']


class SourceRoomFieldsMixin(serializers.Serializer):
    source_room_name = serializers.CharField(source='source_room.name', read_only=True, default=None)
    source_room_revision = serializers.IntegerField(source='source_room.revision_number', read_only=True,
                                                    default=None)


class RoomSerializer(SourceRoomFieldsMixin, serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = '__all__'
        read_only_fields = ROOM_LOCK_FIELDS


class RoomLiteSerializer(SourceRoomFieldsMixin, serializers.ModelSerializer):
    """Room without planner_data — for lists and nesting. The full design JSON
    is only sent when the Kitchen Planner fetches a single room."""
    class Meta:
        model = Room
        fields = ['id', 'project', 'name', 'room_type', 'grand_total', 'notes', 'created_at', 'updated_at',
                  'source_room_name', 'source_room_revision'] + ROOM_LOCK_FIELDS
        read_only_fields = ROOM_LOCK_FIELDS


class ProjectSerializer(serializers.ModelSerializer):
    rooms = RoomLiteSerializer(many=True, read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)
    client_name = serializers.CharField(source='client.name', read_only=True)
    room_count = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = '__all__'

    def get_room_count(self, obj):
        return len(obj.rooms.all())


class ProjectListSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source='client.name', read_only=True)
    room_count = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = ['id', 'name', 'status', 'client', 'client_name', 'total_value', 'room_count', 'created_at']

    def get_room_count(self, obj):
        return len(obj.rooms.all())


class ClientDetailSerializer(serializers.ModelSerializer):
    projects = ProjectListSerializer(many=True, read_only=True)
    total_value = serializers.SerializerMethodField()
    project_count = serializers.SerializerMethodField()

    class Meta:
        model = Client
        fields = '__all__'
        extra_kwargs = {'tenant': {'read_only': True}}

    def get_total_value(self, obj):
        return sum(p.total_value for p in obj.projects.all())

    def get_project_count(self, obj):
        return obj.projects.count()


class PaymentTransactionSerializer(serializers.ModelSerializer):
    is_collected = serializers.ReadOnlyField()
    installment_label = serializers.CharField(source='installment.label', read_only=True)

    class Meta:
        model = PaymentTransaction
        fields = '__all__'


class RoomChangeLogSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = RoomChangeLog
        fields = ['id', 'room', 'user', 'user_name', 'timestamp', 'action', 'field_path', 'old_value', 'new_value',
                  'reason']

    def get_user_name(self, obj):
        if obj.user is None:
            return ''
        return f'{obj.user.first_name} {obj.user.last_name}'.strip() or obj.user.email
