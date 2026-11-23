"""Whether a client can be permanently deleted, and what deleting it removes.

Delete is only for junk or test records: it cascades to projects, rooms,
quotations, payments and installations. So it is blocked whenever the client
has real business data — money recorded against it, a signed contract, or a
manufacturing work order. Real customers who are finished get archived instead.
See docs/customer-archive-delete-spec.md."""

from manufacturing.models import WorkOrder

from .models import Payment, PaymentTransaction, Quotation, Room

# There is no Contract model: a quotation the customer accepted is the signed contract.
SIGNED_CONTRACT_STATUSES = ('ACCEPTED',)


def delete_check(client):
    """Counts of what the client has, plus can_delete and a reason when not."""
    room_ids = list(Room.objects.filter(project__client=client).values_list('id', flat=True))
    counts = {
        'projects': client.projects.count(),
        'rooms': len(room_ids),
        'quotations': Quotation.objects.filter(client=client).count(),
        'payments': Payment.objects.filter(project__client=client).count(),
        'transactions': PaymentTransaction.objects.filter(project__client=client).count(),
        'signed_contracts': Quotation.objects.filter(client=client, status__in=SIGNED_CONTRACT_STATUSES).count(),
        # Work orders point at a room by plain id (room_id_ref), so a cascade
        # would leave them orphaned on the shop floor.
        'work_orders': WorkOrder.objects.filter(tenant_id=client.tenant_id, room_id_ref__in=room_ids).count()
        if room_ids else 0,
    }
    reasons = []
    if counts['payments'] or counts['transactions']:
        reasons.append('payments')
    if counts['signed_contracts']:
        reasons.append('signed_contracts')
    if counts['work_orders']:
        reasons.append('work_orders')
    return {
        'id': client.id,
        'name': client.name,
        'counts': counts,
        'can_delete': not reasons,
        # Machine-readable codes the frontend translates; `reason` is a plain
        # English sentence for logs and API users.
        'blocked_by': reasons,
        'reason': describe(counts, reasons),
    }


def describe(counts, reasons):
    if not reasons:
        return ''
    parts = []
    if 'payments' in reasons:
        n = counts['payments'] + counts['transactions']
        parts.append(f"{n} payment{'s' if n != 1 else ''} recorded")
    if 'signed_contracts' in reasons:
        n = counts['signed_contracts']
        parts.append(f"{n} signed contract{'s' if n != 1 else ''}")
    if 'work_orders' in reasons:
        n = counts['work_orders']
        parts.append(f"{n} work order{'s' if n != 1 else ''}")
    return 'Has ' + ', '.join(parts) + '. Archive this customer instead.'
