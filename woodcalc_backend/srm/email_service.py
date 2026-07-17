import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from accounts.models import EmailAccount
from accounts.email_crypto import decrypt_password


class EmailAccountNotConnected(Exception):
    pass


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
    """Sends the given PurchaseOrder to its supplier's email, using sender_user's
    connected EmailAccount for authentication. Raises EmailAccountNotConnected if
    the user hasn't connected an email account yet."""
    try:
        email_account = sender_user.email_account
    except EmailAccount.DoesNotExist:
        raise EmailAccountNotConnected("No email account connected. Please connect one in Settings first.")

    if not purchase_order.supplier.email:
        raise ValueError(f"Supplier '{purchase_order.supplier.name}' has no email address on file.")

    app_password = decrypt_password(email_account.encrypted_app_password)

    msg = MIMEMultipart()
    msg['From'] = email_account.email_address
    msg['To'] = purchase_order.supplier.email
    msg['Subject'] = f"Purchase Order {purchase_order.po_number} - WoodCalc"
    msg.attach(MIMEText(build_po_email_body(purchase_order), 'plain'))

    with smtplib.SMTP(email_account.smtp_host, email_account.smtp_port) as server:
        server.starttls()
        server.login(email_account.email_address, app_password)
        server.send_message(msg)
