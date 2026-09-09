from rest_framework import serializers
from .models import Feedback


class FeedbackSerializer(serializers.ModelSerializer):
    class Meta:
        model = Feedback
        fields = ['id', 'tenant', 'user', 'message', 'status', 'created_at']
        extra_kwargs = {
            'tenant': {'read_only': True},
            'user': {'read_only': True},
            'status': {'read_only': True},
        }
