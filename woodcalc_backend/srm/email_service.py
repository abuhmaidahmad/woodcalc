import resend
from django.conf import settings

from accounts.models import EmailAccount


class EmailAccountNotConnected(Exception):
    pass


resend.api_key = settings.RESEND_API_KEY

DEFAULT_FROM_ADDRESS = "WoodCalc Purchasing <orders@purchasing.petsaholics.com>"


def build_po_email_body(purchase_order):
    lines = [
        f"Dear {purchase_order.supplier.name},",
        "",
        f"Please find below Purchase Order {purchase_order.po_number} from WoodCalc.",
        "",
        f"Order Date: {purchase_order.order_date}",
    ]
    if purchase_order.expected_delivery_date:
        lines.append(f"Expected Delivery: {purchase_order.expected_delivery_date}")
    lines.append("")
    lines.append("Line Items:")
    lines.append("-" * 50)
    for item in purchase_order.line_items.all():
        lines.append(
            f"{item.material.sku} - {item.material.name}: "
            f"{item.quantity_ordered} {item.material.unit} @ {item.unit_price}/unit"
        )
    lines.append("-" * 50)
    if purchase_order.notes:
        lines.append("")
        lines.append(f"Notes: {purchase_order.notes}")
    lines.append("")
    lines.append("Please confirm receipt of this order.")
    lines.append("")
    lines.append("Best regards,")
    lines.append("WoodCalc Purchasing")
    return "\n".join(lines)


def send_purchase_order_email(purchase_order, sender_user):
    """Sends the given PurchaseOrder to its supplier's email via Resend.
    Uses sender_user's connected EmailAccount address as the reply-to, so
    supplier replies land in the purchasing user's real inbox. Raises
    EmailAccountNotConnected if the user hasn't connected an email account yet."""
    try:
        email_account = sender_user.email_account
    except EmailAccount.DoesNotExist:
        raise EmailAccountNotConnected("No email account connected. Please connect one in Settings first.")

    if not purchase_order.supplier.email:
        raise ValueError(f"Supplier '{purchase_order.supplier.name}' has no email address on file.")

    if not settings.RESEND_API_KEY:
        raise ValueError("RESEND_API_KEY is not set in environment variables")

    params = {
        "from": DEFAULT_FROM_ADDRESS,
        "to": [purchase_order.supplier.email],
        "reply_to": email_account.email_address,
        "subject": f"Purchase Order {purchase_order.po_number} - WoodCalc",
        "text": build_po_email_body(purchase_order),
    }

    resend.Emails.send(params)
