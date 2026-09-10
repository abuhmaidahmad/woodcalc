from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import CompanyMembership
from .permissions_registry import PERMISSION_CODES

User = get_user_model()


class MembershipUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'first_name', 'last_name', 'email', 'is_active']


class MembershipSerializer(serializers.ModelSerializer):
    user = MembershipUserSerializer(read_only=True)

    class Meta:
        model = CompanyMembership
        fields = ['id', 'user', 'role', 'permissions', 'created_at']
        read_only_fields = ['id', 'user', 'created_at']

    def validate_role(self, value):
        if value == CompanyMembership.Role.OWNER:
            raise serializers.ValidationError("Cannot set role to owner through this endpoint.")
        return value

    def validate_permissions(self, value):
        if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
            raise serializers.ValidationError("permissions must be a list of permission code strings.")
        unknown = set(value) - PERMISSION_CODES
        if unknown:
            raise serializers.ValidationError(f"Unknown permission code(s): {', '.join(sorted(unknown))}")
        return value


class MembershipCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, min_length=8)
    role = serializers.ChoiceField(choices=[CompanyMembership.Role.ADMIN, CompanyMembership.Role.STAFF],
                                    default=CompanyMembership.Role.STAFF)
    permissions = serializers.ListField(child=serializers.CharField(), required=False, default=list)

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def validate_permissions(self, value):
        unknown = set(value) - PERMISSION_CODES
        if unknown:
            raise serializers.ValidationError(f"Unknown permission code(s): {', '.join(sorted(unknown))}")
        return value

    def create(self, validated_data):
        company = self.context['company']
        password = validated_data.pop('password')
        permissions = validated_data.pop('permissions', [])
        role = validated_data.pop('role')

        user = User(
            email=validated_data['email'],
            first_name=validated_data['first_name'],
            last_name=validated_data.get('last_name', ''),
            user_type='manufacturer',
        )
        user.username = validated_data['email']
        user.set_password(password)
        user.save()

        return CompanyMembership.objects.create(
            company=company, user=user, role=role, permissions=permissions,
        )
