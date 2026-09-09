import requests
from django.conf import settings

from .crypto import decrypt_token
from .pricing import PLAN_PRICES_JOD


class PayTabsError(Exception):
    pass


def _headers():
    if not settings.PAYTABS_SERVER_KEY:
        raise ValueError("PAYTABS_SERVER_KEY is not set in environment variables")
    return {
        "Authorization": settings.PAYTABS_SERVER_KEY,
        "Content-Type": "application/json",
    }


def _post(path, payload):
    resp = requests.post(f"{settings.PAYTABS_BASE_URL}{path}", json=payload, headers=_headers(), timeout=30)
    data = resp.json()
    if resp.status_code >= 400:
        raise PayTabsError(data.get("message", "PayTabs request failed"))
    return data


def create_hosted_payment(company, plan, return_url, callback_url):
    """Creates a PayTabs hosted payment page request for a company's chosen plan,
    tokenising the card on success for future off-session renewal charges.
    Returns the redirect_url the frontend should send the browser to."""
    if not settings.PAYTABS_PROFILE_ID:
        raise ValueError("PAYTABS_PROFILE_ID is not set in environment variables")
    amount = PLAN_PRICES_JOD[plan]
    payload = {
        "profile_id": settings.PAYTABS_PROFILE_ID,
        "tran_type": "sale",
        "tran_class": "ecom",
        "cart_id": f"company-{company.id}-{plan}",
        "cart_currency": "JOD",
        "cart_amount": amount,
        "cart_description": f"WoodCalc {plan} plan — annual subscription",
        "tokenise": 2,
        "return": return_url,
        "callback": callback_url,
        "customer_details": {
            "email": company.name,
        },
    }
    data = _post("/payment/request", payload)
    return data["redirect_url"]


def charge_token(payment_method, plan):
    """Charges a company's saved card token for an annual renewal, with no
    customer interaction (server-to-server recurring charge)."""
    amount = PLAN_PRICES_JOD[plan]
    payload = {
        "profile_id": settings.PAYTABS_PROFILE_ID,
        "tran_type": "sale",
        "tran_class": "recurring",
        "cart_id": f"renewal-{payment_method.company_id}-{plan}",
        "cart_currency": "JOD",
        "cart_amount": amount,
        "cart_description": f"WoodCalc {plan} plan — annual renewal",
        "token": decrypt_token(payment_method.encrypted_token),
    }
    return _post("/payment/request", payload)


def query_transaction(tran_ref):
    """Re-fetches a transaction's authoritative status directly from PayTabs.
    The webhook callback body is not trusted on its own — this is the source of truth."""
    payload = {
        "profile_id": settings.PAYTABS_PROFILE_ID,
        "tran_ref": tran_ref,
    }
    return _post("/payment/query", payload)
