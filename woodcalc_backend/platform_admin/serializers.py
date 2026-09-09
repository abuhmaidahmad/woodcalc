from rest_framework import serializers
from tenants.models import Company
from feedback.models import Feedback


class AdminCompanySerializer(serializers.ModelSerializer):
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = Company
        fields = [
            'id', 'name', 'slug', 'plan', 'status', 'trial_ends_at',
            'subscription_ends_at', 'max_users', 'member_count', 'created_at', 'updated_at',
        ]
        extra_kwargs = {
            'id': {'read_only': True},
            'slug': {'read_only': True},
            'created_at': {'read_only': True},
            'updated_at': {'read_only': True},
        }

    def get_member_count(self, obj):
        return obj.memberships.count()


class AdminFeedbackSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source='tenant.name', read_only=True)

    class Meta:
        model = Feedback
        fields = ['id', 'tenant', 'tenant_name', 'user', 'message', 'page', 'status', 'admin_notes', 'created_at']
        extra_kwargs = {
            'tenant': {'read_only': True},
            'user': {'read_only': True},
            'message': {'read_only': True},
            'page': {'read_only': True},
            'created_at': {'read_only': True},
        }
