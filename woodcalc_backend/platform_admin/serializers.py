from rest_framework import serializers
from tenants.models import Company, CompanyMembership
from feedback.models import Feedback
from billing.models import Invoice, PaymentMethod
from hr.models import Employee
from crm.models import Client


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


class AdminCompanyMemberSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source='user.email', read_only=True)
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)

    class Meta:
        model = CompanyMembership
        fields = ['id', 'email', 'first_name', 'last_name', 'role', 'created_at']


class AdminCompanyInvoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Invoice
        fields = [
            'id', 'plan', 'amount', 'currency', 'status',
            'billing_period_start', 'billing_period_end', 'paid_at', 'created_at',
        ]


class AdminCompanyPaymentMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentMethod
        fields = ['id', 'card_brand', 'card_last4', 'is_active', 'created_at']


class AdminCompanyDetailSerializer(AdminCompanySerializer):
    members = AdminCompanyMemberSerializer(source='memberships', many=True, read_only=True)
    invoices = serializers.SerializerMethodField()
    payment_methods = AdminCompanyPaymentMethodSerializer(many=True, read_only=True)
    employee_count = serializers.SerializerMethodField()
    client_count = serializers.SerializerMethodField()

    class Meta(AdminCompanySerializer.Meta):
        fields = AdminCompanySerializer.Meta.fields + [
            'members', 'invoices', 'payment_methods', 'employee_count', 'client_count',
        ]

    def get_invoices(self, obj):
        invoices = obj.invoices.order_by('-created_at')[:20]
        return AdminCompanyInvoiceSerializer(invoices, many=True).data

    def get_employee_count(self, obj):
        return Employee.objects.filter(tenant=obj).count()

    def get_client_count(self, obj):
        return Client.objects.filter(tenant=obj).count()


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
