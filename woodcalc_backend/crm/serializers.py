from rest_framework import serializers
from .models import Client, Lead, Quotation, QuotationItem, Project, Room, Payment


class ClientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = '__all__'


class LeadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lead
        fields = '__all__'


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


class RoomSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = '__all__'


class ProjectSerializer(serializers.ModelSerializer):
    rooms = RoomSerializer(many=True, read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)
    client_name = serializers.CharField(source='client.name', read_only=True)
    room_count = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = '__all__'

    def get_room_count(self, obj):
        return obj.rooms.count()


class ProjectListSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source='client.name', read_only=True)
    room_count = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = ['id', 'name', 'status', 'client', 'client_name', 'total_value', 'room_count', 'created_at']

    def get_room_count(self, obj):
        return obj.rooms.count()


class ClientDetailSerializer(serializers.ModelSerializer):
    projects = ProjectListSerializer(many=True, read_only=True)
    total_value = serializers.SerializerMethodField()
    project_count = serializers.SerializerMethodField()

    class Meta:
        model = Client
        fields = '__all__'

    def get_total_value(self, obj):
        return sum(p.total_value for p in obj.projects.all())

    def get_project_count(self, obj):
        return obj.projects.count()
