from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import ArchitectProfile, ManufacturerProfile, SupplierProfile

User = get_user_model()


class CustomerRegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ['id', 'first_name', 'last_name', 'email', 'password', 'phone', 'city']

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.username = validated_data['email']
        user.user_type = 'customer'
        user.set_password(password)
        user.save()
        return user


class ArchitectRegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    company_studio_name = serializers.CharField(required=False, allow_blank=True)
    license_number = serializers.CharField(required=False, allow_blank=True)
    portfolio_url = serializers.URLField(required=False, allow_blank=True)
    specialization = serializers.ChoiceField(
        choices=['residential', 'commercial', 'both'], default='both'
    )
    years_of_experience = serializers.IntegerField(min_value=0, default=0)

    class Meta:
        model = User
        fields = [
            'id', 'first_name', 'last_name', 'email', 'password', 'phone', 'city',
            'company_studio_name', 'license_number', 'portfolio_url',
            'specialization', 'years_of_experience',
        ]

    def create(self, validated_data):
        profile_fields = {
            'company_studio_name': validated_data.pop('company_studio_name', ''),
            'license_number': validated_data.pop('license_number', ''),
            'portfolio_url': validated_data.pop('portfolio_url', ''),
            'specialization': validated_data.pop('specialization', 'both'),
            'years_of_experience': validated_data.pop('years_of_experience', 0),
        }
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.username = validated_data['email']
        user.user_type = 'architect'
        user.set_password(password)
        user.save()
        ArchitectProfile.objects.create(user=user, **profile_fields)
        return user


class ManufacturerRegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    factory_company_name = serializers.CharField()
    commercial_registration_number = serializers.CharField(required=False, allow_blank=True)
    production_capacity = serializers.CharField(required=False, allow_blank=True)
    governorate_region = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            'id', 'first_name', 'last_name', 'email', 'password', 'phone', 'city',
            'factory_company_name', 'commercial_registration_number',
            'production_capacity', 'governorate_region',
        ]

    def create(self, validated_data):
        profile_fields = {
            'factory_company_name': validated_data.pop('factory_company_name'),
            'commercial_registration_number': validated_data.pop('commercial_registration_number', ''),
            'production_capacity': validated_data.pop('production_capacity', ''),
            'governorate_region': validated_data.pop('governorate_region', ''),
        }
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.username = validated_data['email']
        user.user_type = 'manufacturer'
        user.set_password(password)
        user.save()
        ManufacturerProfile.objects.create(user=user, **profile_fields)
        return user


class SupplierRegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    company_name = serializers.CharField()
    commercial_registration_number = serializers.CharField(required=False, allow_blank=True)
    materials_supplied = serializers.ListField(
        child=serializers.CharField(), required=False, default=list
    )
    delivery_coverage_area = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            'id', 'first_name', 'last_name', 'email', 'password', 'phone', 'city',
            'company_name', 'commercial_registration_number',
            'materials_supplied', 'delivery_coverage_area',
        ]

    def create(self, validated_data):
        profile_fields = {
            'company_name': validated_data.pop('company_name'),
            'commercial_registration_number': validated_data.pop('commercial_registration_number', ''),
            'materials_supplied': validated_data.pop('materials_supplied', []),
            'delivery_coverage_area': validated_data.pop('delivery_coverage_area', ''),
        }
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.username = validated_data['email']
        user.user_type = 'supplier'
        user.set_password(password)
        user.save()
        SupplierProfile.objects.create(user=user, **profile_fields)
        return user


class UserMeSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'first_name', 'last_name', 'email', 'phone', 'city', 'user_type', 'is_verified']
