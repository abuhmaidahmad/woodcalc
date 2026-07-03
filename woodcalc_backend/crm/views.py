from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import PaymentTransaction, Client, Lead, Quotation, QuotationItem, Project, Room, Payment
from .serializers import (
    PaymentTransactionSerializer,
    ClientSerializer, ClientDetailSerializer,
    LeadSerializer, QuotationSerializer, QuotationItemSerializer,
    ProjectSerializer, ProjectListSerializer, RoomSerializer, PaymentSerializer
)


class ClientViewSet(ModelViewSet):
    queryset = Client.objects.all().order_by('name')
    serializer_class = ClientSerializer
    permission_classes = [IsAuthenticated]

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


class LeadViewSet(ModelViewSet):
    queryset = Lead.objects.all().order_by('-created_at')
    serializer_class = LeadSerializer
    permission_classes = [IsAuthenticated]


class QuotationViewSet(ModelViewSet):
    queryset = Quotation.objects.all().order_by('-created_at')
    serializer_class = QuotationSerializer
    permission_classes = [IsAuthenticated]


class QuotationItemViewSet(ModelViewSet):
    queryset = QuotationItem.objects.all()
    serializer_class = QuotationItemSerializer
    permission_classes = [IsAuthenticated]


class ProjectViewSet(ModelViewSet):
    queryset = Project.objects.all().order_by('-created_at')
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'list':
            return ProjectListSerializer
        return ProjectSerializer

    def get_queryset(self):
        qs = Project.objects.all().order_by('-created_at')
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


class RoomViewSet(ModelViewSet):
    queryset = Room.objects.all().order_by('-created_at')
    serializer_class = RoomSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Room.objects.all().order_by('-created_at')
        project_id = self.request.query_params.get('project')
        if project_id:
            qs = qs.filter(project_id=project_id)
        return qs


class PaymentViewSet(ModelViewSet):
    queryset = Payment.objects.all().order_by('due_date')
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Payment.objects.all().order_by('due_date')
        project_id = self.request.query_params.get('project')
        if project_id:
            qs = qs.filter(project_id=project_id)
        return qs


class PaymentTransactionViewSet(ModelViewSet):
    queryset = PaymentTransaction.objects.all()
    serializer_class = PaymentTransactionSerializer

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
        for p in Project.objects.exclude(status__in=['CANCELLED']):
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
