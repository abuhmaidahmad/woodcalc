import uuid

from django.utils import timezone
from rest_framework import status
from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError
from tenants.mixins import TenantScopedMixin
from tenants.permissions import HasActiveCompany
from tenants.utils import get_company_by_slug
from .changelog import log_room_action, log_room_edit, snapshot
from .locking import RoomNotLocked
from .revisions import OPEN_STATUSES, recompute_project_total, revision_chain, started_work_orders
from .models import PaymentTransaction, Client, Lead, Quotation, QuotationItem, Project, Room, Payment, RoomChangeLog
from .serializers import (
    PaymentTransactionSerializer,
    ClientSerializer, ClientDetailSerializer,
    LeadSerializer, QuotationSerializer, QuotationItemSerializer,
    ProjectSerializer, ProjectListSerializer, RoomSerializer, RoomLiteSerializer, PaymentSerializer,
    RoomChangeLogSerializer,
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


@api_view(['GET'])
@permission_classes([AllowAny])
def public_room_share_view(request, token):
    """Read-only, unauthenticated lookup for a room's "Share 3D View" link
    (/view/:token). Keyed on the random share_token rather than the room's
    sequential id so a customer link can't be used to guess at other rooms.
    Returns only what the 3D viewer needs — never the full authenticated
    Room payload (no notes, no project/client linkage)."""
    room = Room.objects.select_related('project__client__tenant').filter(share_token=token).first()
    if room is None:
        return Response({'detail': 'Link not found or no longer shared.'}, status=status.HTTP_404_NOT_FOUND)

    data = room.planner_data or {}
    return Response({
        'name': room.name,
        'room_type': room.room_type,
        'company_slug': room.project.client.tenant.slug,
        'room': data.get('room'),
        'walls': data.get('walls', []),
        'stairs': data.get('stairs', []),
        'elements': data.get('elements', []),
        'cabinets': data.get('cabinets', []),
        'countertopMat': data.get('countertopMat'),
        'countertopThickness': data.get('countertopThickness'),
        'backsplashSegments': data.get('backsplashSegments', []),
        'backsplashHeight': data.get('backsplashHeight'),
        'backsplashThickness': data.get('backsplashThickness'),
    })


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


def require_role(request, *roles):
    if request.membership.role not in roles:
        raise PermissionDenied(f"Only {' or '.join(roles)} can do this.")


class RoomViewSet(TenantScopedMixin, ModelViewSet):
    tenant_filter_field = 'project__client__tenant'
    queryset = Room.objects.all().order_by('-created_at')
    serializer_class = RoomSerializer
    permission_classes = [IsAuthenticated, HasActiveCompany, RoomNotLocked]
    lock_exempt_actions = (
        'share_link', 'revoke_share_link', 'duplicate', 'confirm_lock', 'unlock',
        'request_change', 'submit_revision', 'approve_revision', 'reject_revision', 'history',
    )

    def perform_update(self, serializer):
        before = snapshot(serializer.instance)
        room = serializer.save()
        log_room_edit(room, self.request.user, before)

    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        require_role(request, 'owner', 'admin', 'auditor')
        room = self.get_object()
        logs = room.change_logs.select_related('user')[:500]
        return Response(RoomChangeLogSerializer(logs, many=True).data)

    def perform_create(self, serializer):
        project = serializer.validated_data.get('project')
        if project is None or project.client.tenant_id != self.request.company.id:
            raise ValidationError({'project': 'Project not found.'})
        serializer.save()

    def perform_destroy(self, instance):
        if instance.child_revisions.exists():
            raise ValidationError({'detail': 'This room has revisions and cannot be deleted.'})
        instance.delete()

    def _lock(self, room, user):
        room.is_locked = True
        room.locked_at = timezone.now()
        room.locked_by = user

    @action(detail=True, methods=['post'])
    def request_change(self, request, pk=None):
        require_role(request, 'owner', 'admin', 'staff')
        room = self.get_object()
        if not room.is_locked or room.revision_status != Room.RevisionStatus.APPROVED:
            return Response({'detail': 'Only the confirmed, active revision can be changed.'},
                            status=status.HTTP_400_BAD_REQUEST)
        chain = revision_chain(room)
        open_revision = next((r for r in chain if r.parent_revision_id and r.revision_status in OPEN_STATUSES), None)
        if open_revision:
            return Response({'detail': f'Revision {open_revision.revision_number} is already open for this kitchen.',
                             'id': open_revision.id}, status=status.HTTP_400_BAD_REQUEST)
        revision = Room.objects.create(
            project=room.project,
            name=room.name,
            room_type=room.room_type,
            planner_data=room.planner_data,
            grand_total=room.grand_total,
            notes=room.notes,
            revision_number=max(r.revision_number for r in chain) + 1,
            parent_revision=room,
        )
        log_room_action(revision, request.user, RoomChangeLog.Action.REVISION_CREATED,
                        old_value={'revision_number': room.revision_number, 'room': room.id},
                        new_value={'revision_number': revision.revision_number})
        return Response(RoomSerializer(revision).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def submit_revision(self, request, pk=None):
        require_role(request, 'owner', 'admin', 'staff')
        room = self.get_object()
        if not room.parent_revision_id or room.is_locked or room.revision_status not in (
                Room.RevisionStatus.DRAFT, Room.RevisionStatus.REJECTED):
            return Response({'detail': 'Only a draft revision can be submitted for approval.'},
                            status=status.HTTP_400_BAD_REQUEST)
        self._lock(room, request.user)
        room.revision_status = Room.RevisionStatus.PENDING_APPROVAL
        room.save(update_fields=['is_locked', 'locked_at', 'locked_by', 'revision_status', 'updated_at'])
        log_room_action(room, request.user, RoomChangeLog.Action.REVISION_SUBMITTED)
        return Response(RoomSerializer(room).data)

    @action(detail=True, methods=['post'])
    def approve_revision(self, request, pk=None):
        require_role(request, 'owner')
        room = self.get_object()
        if room.revision_status != Room.RevisionStatus.PENDING_APPROVAL:
            return Response({'detail': 'Only a revision pending approval can be approved.'},
                            status=status.HTTP_400_BAD_REQUEST)
        chain = revision_chain(room)
        started = list(started_work_orders(chain, request.company.id).values_list('order_number', flat=True))
        override_reason = (request.data.get('override_reason') or '').strip()
        if started and not override_reason:
            return Response({
                'detail': f"Production has already started for this kitchen ({', '.join(started)}). "
                          f"Approve with an override reason to continue.",
                'started_work_orders': started,
            }, status=status.HTTP_409_CONFLICT)
        for previous in chain:
            if previous.id != room.id and previous.revision_status == Room.RevisionStatus.APPROVED:
                previous.revision_status = Room.RevisionStatus.SUPERSEDED
                previous.is_locked = True
                previous.save(update_fields=['revision_status', 'is_locked', 'updated_at'])
                log_room_action(previous, request.user, RoomChangeLog.Action.REVISION_SUPERSEDED,
                                new_value={'superseded_by': room.id, 'revision_number': room.revision_number})
        self._lock(room, request.user)
        room.revision_status = Room.RevisionStatus.APPROVED
        room.approval_override_reason = override_reason if started else ''
        room.save(update_fields=['is_locked', 'locked_at', 'locked_by', 'revision_status',
                                 'approval_override_reason', 'updated_at'])
        recompute_project_total(room.project)
        log_room_action(room, request.user, RoomChangeLog.Action.REVISION_APPROVED, reason=room.approval_override_reason,
                        new_value={'started_work_orders': started} if started else None)
        return Response(RoomSerializer(room).data)

    @action(detail=True, methods=['post'])
    def reject_revision(self, request, pk=None):
        require_role(request, 'owner')
        room = self.get_object()
        reason = (request.data.get('reason') or '').strip()
        if not reason:
            return Response({'detail': 'A reason is required to reject.'}, status=status.HTTP_400_BAD_REQUEST)
        if room.revision_status != Room.RevisionStatus.PENDING_APPROVAL:
            return Response({'detail': 'Only a revision pending approval can be rejected.'},
                            status=status.HTTP_400_BAD_REQUEST)
        room.is_locked = False
        room.revision_status = Room.RevisionStatus.REJECTED
        room.rejection_reason = reason
        room.save(update_fields=['is_locked', 'revision_status', 'rejection_reason', 'updated_at'])
        log_room_action(room, request.user, RoomChangeLog.Action.REVISION_REJECTED, reason=reason)
        return Response(RoomSerializer(room).data)

    @action(detail=True, methods=['post'])
    def confirm_lock(self, request, pk=None):
        require_role(request, 'owner', 'admin')
        room = self.get_object()
        if room.is_locked:
            return Response({'detail': 'Room is already locked.'}, status=status.HTTP_400_BAD_REQUEST)
        if room.parent_revision_id:
            return Response({'detail': 'Revisions are confirmed by submitting them for approval.'},
                            status=status.HTTP_400_BAD_REQUEST)
        room.is_locked = True
        room.locked_at = timezone.now()
        room.locked_by = request.user
        room.revision_status = Room.RevisionStatus.APPROVED
        room.save(update_fields=['is_locked', 'locked_at', 'locked_by', 'revision_status', 'updated_at'])
        log_room_action(room, request.user, RoomChangeLog.Action.LOCK, new_value={'revision_number': room.revision_number})
        return Response(RoomSerializer(room).data)

    @action(detail=True, methods=['post'])
    def unlock(self, request, pk=None):
        require_role(request, 'owner')
        room = self.get_object()
        reason = (request.data.get('reason') or '').strip()
        if not reason:
            return Response({'detail': 'A reason is required to unlock.'}, status=status.HTTP_400_BAD_REQUEST)
        if not room.is_locked or room.revision_status != Room.RevisionStatus.APPROVED:
            return Response({'detail': 'Only a confirmed, active room can be unlocked.'},
                            status=status.HTTP_400_BAD_REQUEST)
        room.is_locked = False
        room.unlock_reason = reason
        room.revision_status = Room.RevisionStatus.DRAFT
        room.save(update_fields=['is_locked', 'unlock_reason', 'revision_status', 'updated_at'])
        log_room_action(room, request.user, RoomChangeLog.Action.UNLOCK, reason=reason)
        return Response(RoomSerializer(room).data)

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

    @action(detail=True, methods=['post'])
    def share_link(self, request, pk=None):
        """Generate (or rotate) this room's public "Share 3D View" token."""
        room = self.get_object()
        room.share_token = uuid.uuid4()
        room.save(update_fields=['share_token'])
        return Response({'share_token': str(room.share_token)})

    @share_link.mapping.delete
    def revoke_share_link(self, request, pk=None):
        """Revoke this room's public link; the old URL stops working."""
        room = self.get_object()
        room.share_token = None
        room.save(update_fields=['share_token'])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'])
    def duplicate(self, request, pk=None):
        """Clone this room's full design (walls, cabinets, materials, notes) into a
        new room in the same project, so a manufacturer can keep the original
        draft untouched while iterating on a variant — e.g. to give a customer
        multiple design options to pick from for the same location."""
        room = self.get_object()
        name = (request.data.get('name') or '').strip() or f'{room.name} (Copy)'
        copy = Room.objects.create(
            project=room.project,
            name=name,
            room_type=room.room_type,
            planner_data=room.planner_data,
            grand_total=room.grand_total,
            notes=room.notes,
        )
        return Response(RoomSerializer(copy).data, status=status.HTTP_201_CREATED)


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
