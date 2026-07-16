from cryptography.fernet import Fernet
from django.conf import settings


def _get_fernet():
    key = settings.EMAIL_ENCRYPTION_KEY
    if not key:
        raise ValueError("EMAIL_ENCRYPTION_KEY is not set in environment variables")
    return Fernet(key.encode())


def encrypt_password(plain_password: str) -> bytes:
    """Encrypts a plaintext app password for storage in EmailAccount.encrypted_app_password."""
    f = _get_fernet()
    return f.encrypt(plain_password.encode())


def decrypt_password(encrypted_password: bytes) -> str:
    """Decrypts a stored app password back to plaintext, for use when sending email."""
    f = _get_fernet()
    return f.decrypt(bytes(encrypted_password)).decode()
