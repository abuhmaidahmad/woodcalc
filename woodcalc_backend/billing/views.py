from datetime import timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from tenants.models import Company
from tenants.utils import get_company_for_user

from .crypto import encrypt_token
from .models import Invoice, PaymentMethod
from .paytabs_client import PayTabsError, create_hosted_payment, query_transaction
from .pricing import PLAN_PRICES_JOD


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def checkout(request):
    company = get_company_for_user(request.user)
    if company is None:
        return Response({"detail": "No company found for this account."}, status=status.HTTP_400_BAD_REQUEST)

    plan = request.data.get("plan")
    if plan not in PLAN_PRICES_JOD:
        return Response({"detail": f"Unknown plan '{plan}'."}, status=status.HTTP_400_BAD_REQUEST)

    return_url = request.build_absolute_uri("/").rstrip("/") + "/billing/return"
    callback_url = request.build_absolute_uri("/api/billing/webhook/")

    try:
        redirect_url = create_hosted_payment(company, plan, return_url, callback_url)
    except (PayTabsError, ValueError) as e:
        return Response({"detail": str(e)}, status=status.HTTP_502_BAD_GATEWAY)

    Invoice.objects.create(company=company, plan=plan, amount=PLAN_PRICES_JOD[plan], status=Invoice.Status.PENDING)
    return Response({"redirect_url": redirect_url})


@api_view(["POST"])
@permission_classes([AllowAny])
def webhook(request):
    """PayTabs IPN callback. The callback body itself is not trusted — it only tells us
    to go re-fetch the transaction's real status directly from PayTabs before acting."""
    tran_ref = request.data.get("tran_ref")
    if not tran_ref:
        return Response(status=status.HTTP_400_BAD_REQUEST)

    try:
        data = query_transaction(tran_ref)
    except (PayTabsError, ValueError):
        return Response(status=status.HTTP_502_BAD_GATEWAY)

    # Field names below follow PayTabs' documented query-transaction response shape
    # (payment_result.response_status "A" = authorized/success); confirm against a
    # real sandbox response once credentials exist, before relying on this in production.
    if data.get("payment_result", {}).get("response_status") != "A":
        return Response(status=status.HTTP_200_OK)

    cart_id = data.get("cart_id", "")
    try:
        company_id, plan = cart_id.replace("renewal-", "").replace("company-", "").rsplit("-", 1)
    except ValueError:
        return Response(status=status.HTTP_200_OK)

    company = Company.objects.filter(id=company_id).first()
    if company is None or plan not in PLAN_PRICES_JOD:
        return Response(status=status.HTTP_200_OK)

    token = data.get("token")
    if token:
        PaymentMethod.objects.filter(company=company, is_active=True).update(is_active=False)
        PaymentMethod.objects.create(
            company=company,
            encrypted_token=encrypt_token(token),
            card_last4=(data.get("payment_info", {}) or {}).get("last_4_digits", ""),
            card_brand=(data.get("payment_info", {}) or {}).get("card_scheme", ""),
        )

    now = timezone.now()
    Invoice.objects.filter(company=company, plan=plan, status=Invoice.Status.PENDING).update(
        status=Invoice.Status.PAID,
        paytabs_tran_ref=tran_ref,
        paid_at=now,
        billing_period_start=now,
        billing_period_end=now + timedelta(days=365),
    )

    company.status = Company.Status.ACTIVE
    company.plan = plan
    company.subscription_ends_at = now + timedelta(days=365)
    company.save(update_fields=["status", "plan", "subscription_ends_at"])

    return Response(status=status.HTTP_200_OK)
