from cryptography.fernet import Fernet
from django.conf import settings


def _get_fernet():
    key = settings.PAYTABS_ENCRYPTION_KEY
    if not key:
        raise ValueError("PAYTABS_ENCRYPTION_KEY is not set in environment variables")
    return Fernet(key.encode())


def encrypt_token(plain_token: str) -> bytes:
    """Encrypts a PayTabs card token for storage in PaymentMethod.encrypted_token."""
    f = _get_fernet()
    return f.encrypt(plain_token.encode())


def decrypt_token(encrypted_token: bytes) -> str:
    """Decrypts a stored card token back to plaintext, for use when charging renewals."""
    f = _get_fernet()
    return f.decrypt(bytes(encrypted_token)).decode()
