import hashlib
import secrets

import resend
from django.conf import settings
from django.utils import timezone
from datetime import timedelta

from .models import PasswordResetToken

resend.api_key = settings.RESEND_API_KEY

DEFAULT_FROM_ADDRESS = "WoodCalc <info@woodcalcerp.com>"
TOKEN_TTL = timedelta(hours=1)


def _hash_token(raw_token):
    return hashlib.sha256(raw_token.encode()).hexdigest()


def create_reset_token(user):
    raw_token = secrets.token_urlsafe(32)
    PasswordResetToken.objects.create(
        user=user,
        token_hash=_hash_token(raw_token),
        expires_at=timezone.now() + TOKEN_TTL,
    )
    return raw_token


def send_reset_email(user, raw_token):
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={raw_token}"

    if not settings.RESEND_API_KEY:
        print(f"[password reset] RESEND_API_KEY not set — reset link for {user.email}: {reset_url}", flush=True)
        return

    params = {
        "from": DEFAULT_FROM_ADDRESS,
        "to": [user.email],
        "subject": "Reset your WoodCalc password",
        "text": (
            f"Hi {user.first_name or user.email},\n\n"
            "We received a request to reset your WoodCalc password. "
            f"Click the link below to set a new one:\n\n{reset_url}\n\n"
            "This link expires in 1 hour and can only be used once. "
            "If you didn't request this, you can safely ignore this email.\n\n"
            "— WoodCalc"
        ),
    }
    resend.Emails.send(params)


def consume_reset_token(raw_token, new_password):
    token_hash = _hash_token(raw_token)
    token = PasswordResetToken.objects.filter(token_hash=token_hash).select_related('user').first()

    if token is None:
        raise ValueError("This reset link is invalid.")
    if token.used_at is not None:
        raise ValueError("This reset link has already been used.")
    if token.expires_at < timezone.now():
        raise ValueError("This reset link has expired.")

    user = token.user
    user.set_password(new_password)
    user.save(update_fields=['password'])

    token.used_at = timezone.now()
    token.save(update_fields=['used_at'])

    return user
