from rest_framework import status
from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from tenants.mixins import TenantScopedMixin
from tenants.permissions import HasActiveCompany
from tenants.utils import get_company_by_slug
from .models import PaymentTransaction, Client, Lead, Quotation, QuotationItem, Project, Room, Payment
from .serializers import (
    PaymentTransactionSerializer,
    ClientSerializer, ClientDetailSerializer,
    LeadSerializer, QuotationSerializer, QuotationItemSerializer,
    ProjectSerializer, ProjectListSerializer, RoomSerializer, RoomLiteSerializer, PaymentSerializer
)


@api_view(['POST'])
@permission_classes([AllowAny])
def public_lead_capture(request):
    """Lets an anonymous guest on the public Kitchen Planner (/browse/:companySlug)
    submit their contact info + in-progress design as a Lead for that manufacturer's
    sales team, with no account required."""
    company = get_company_by_slug(request.data.get('company'))
    if company is None:
        return Response({'detail': 'Unknown company.'}, status=status.HTTP_400_BAD_REQUEST)

    name = (request.data.get('name') or '').strip()
    if not name:
        return Response({'detail': 'Name is required.'}, status=status.HTTP_400_BAD_REQUEST)

    lead = Lead.objects.create(
        tenant=company,
        name=name,
        email=request.data.get('email', ''),
        phone=request.data.get('phone', ''),
        source='kitchen_planner_guest',
        design_snapshot=request.data.get('design_snapshot') or {},
        design_total=request.data.get('design_total') or None,
    )
    return Response({'id': lead.id}, status=status.HTTP_201_CREATED)


class ClientViewSet(TenantScopedMixin, ModelViewSet):
    queryset = Client.objects.prefetch_related('projects__rooms').order_by('name')
    serializer_class = ClientSerializer
    permission_classes = [IsAuthenticated, HasActiveCompany]

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return ClientDetailSerializer
        return ClientSerializer

    @action(detail=True, methods=['get'])
    def projects(self, request, pk=None):
        client = self.get_object()
        projects = client.projects.all().order_by('-created_at')
        serializer = ProjectListSerializer(projects, many=True)
        return Response(serializer.data)


class LeadViewSet(TenantScopedMixin, ModelViewSet):
    queryset = Lead.objects.all().order_by('-created_at')
    serializer_class = LeadSerializer
    permission_classes = [IsAuthenticated, HasActiveCompany]


class QuotationViewSet(TenantScopedMixin, ModelViewSet):
    tenant_filter_field = 'client__tenant'
    queryset = Quotation.objects.all().order_by('-created_at')
    serializer_class = QuotationSerializer
    permission_classes = [IsAuthenticated, HasActiveCompany]


class QuotationItemViewSet(TenantScopedMixin, ModelViewSet):
    tenant_filter_field = 'quotation__client__tenant'
    queryset = QuotationItem.objects.all()
    serializer_class = QuotationItemSerializer
    permission_classes = [IsAuthenticated, HasActiveCompany]


class ProjectViewSet(TenantScopedMixin, ModelViewSet):
    tenant_filter_field = 'client__tenant'
    queryset = Project.objects.select_related('client').prefetch_related('rooms', 'payments').order_by('-created_at')
    permission_classes = [IsAuthenticated, HasActiveCompany]

    def get_serializer_class(self):
        if self.action == 'list':
            return ProjectListSerializer
        return ProjectSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        client_id = self.request.query_params.get('client')
        if client_id:
            qs = qs.filter(client_id=client_id)
        status = self.request.query_params.get('status')
        if status:
            qs = qs.filter(status=status)
        return qs

    @action(detail=True, methods=['get'])
    def rooms(self, request, pk=None):
        project = self.get_object()
        rooms = project.rooms.all().order_by('created_at')
        serializer = RoomSerializer(rooms, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def payments(self, request, pk=None):
        project = self.get_object()
        payments = project.payments.all().order_by('due_date')
        serializer = PaymentSerializer(payments, many=True)
        return Response(serializer.data)


class RoomViewSet(TenantScopedMixin, ModelViewSet):
    tenant_filter_field = 'project__client__tenant'
    queryset = Room.objects.all().order_by('-created_at')
    serializer_class = RoomSerializer
    permission_classes = [IsAuthenticated, HasActiveCompany]

    def get_serializer_class(self):
        if self.action == 'list':
            return RoomLiteSerializer
        return RoomSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        project_id = self.request.query_params.get('project')
        if project_id:
            qs = qs.filter(project_id=project_id)
        return qs


class PaymentViewSet(TenantScopedMixin, ModelViewSet):
    tenant_filter_field = 'project__client__tenant'
    queryset = Payment.objects.all().order_by('due_date')
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated, HasActiveCompany]

    def get_queryset(self):
        qs = super().get_queryset()
        project_id = self.request.query_params.get('project')
        if project_id:
            qs = qs.filter(project_id=project_id)
        return qs


class PaymentTransactionViewSet(TenantScopedMixin, ModelViewSet):
    tenant_filter_field = 'project__client__tenant'
    queryset = PaymentTransaction.objects.all()
    serializer_class = PaymentTransactionSerializer
    permission_classes = [IsAuthenticated, HasActiveCompany]

    def get_queryset(self):
        qs = super().get_queryset()
        project = self.request.query_params.get('project')
        if project:
            qs = qs.filter(project_id=project)
        return qs

    @action(detail=False, methods=['get'])
    def collections(self, request):
        """Owner view: outstanding balance per project + upcoming post-dated cheques."""
        from decimal import Decimal
        data = []
        for p in Project.objects.filter(client__tenant=request.company).exclude(status__in=['CANCELLED']):
            txs = list(p.transactions.all())
            collected = sum((t.amount for t in txs if t.is_collected), Decimal('0'))
            pending_cheques = [
                {
                    'id': t.id, 'amount': str(t.amount), 'currency': t.currency,
                    'cheque_number': t.cheque_number, 'cheque_bank': t.cheque_bank,
                    'cheque_due_date': t.cheque_due_date, 'cheque_status': t.cheque_status,
                }
                for t in txs
                if t.method == 'CHEQUE' and t.cheque_status in ('RECEIVED', 'DEPOSITED')
            ]
            outstanding = (p.total_value or Decimal('0')) - collected
            if p.total_value or txs:
                data.append({
                    'project_id': p.id,
                    'project': str(p),
                    'total_value': str(p.total_value),
                    'collected': str(collected),
                    'outstanding': str(outstanding),
                    'pending_cheques': pending_cheques,
                })
        return Response(data)

    @action(detail=True, methods=['post'])
    def set_cheque_status(self, request, pk=None):
        tx = self.get_object()
        status_val = request.data.get('cheque_status')
        valid = dict(PaymentTransaction.CHEQUE_STATUS_CHOICES)
        if tx.method != 'CHEQUE':
            return Response({'error': 'Not a cheque transaction'}, status=400)
        if status_val not in valid:
            return Response({'error': f'Invalid status. Options: {list(valid)}'}, status=400)
        tx.cheque_status = status_val
        tx.save()
        return Response(PaymentTransactionSerializer(tx).data)
