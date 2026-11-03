"""
backend/app/security/secrets_manager.py

Multi-Tier Credential Protection & Sensitive Data Scrubbing for Quantum Council:
1. Windows DPAPI (Data Protection API) native hardware/OS credential isolation.
   Encrypts credentials bound to the user's Windows login account hash.
2. Per-User Machine Master Key (POSIX / Fallback):
   Symmetric 256-bit Fernet encryption stored in the user's private data directory
   with 0600 file permissions.
3. Automatic Backward Compatibility:
   Seamlessly decrypts legacy tokens derived from settings.secret_key.
4. Secret Redaction Utility:
   Scrubs API keys and tokens from application logs, error messages, and tracebacks.
"""

import base64
import hashlib
import os
import re
import sys
from pathlib import Path
from typing import Optional

from cryptography.fernet import Fernet
from app.config import settings
from app.core.paths import get_keys_dir

# ─── Windows DPAPI Support via ctypes ─────────────────────────────────────────

_IS_WINDOWS = sys.platform == "win32"

if _IS_WINDOWS:
    import ctypes
    from ctypes import wintypes

    class _DATA_BLOB(ctypes.Structure):
        _fields_ = [
            ("cbData", wintypes.DWORD),
            ("pbData", ctypes.POINTER(ctypes.c_char)),
        ]

    _CryptProtectData = ctypes.windll.crypt32.CryptProtectData
    _CryptUnprotectData = ctypes.windll.crypt32.CryptUnprotectData
    _LocalFree = ctypes.windll.kernel32.LocalFree
    _CRYPTPROTECT_UI_FORBIDDEN = 0x01
else:
    _DATA_BLOB = None
    _CryptProtectData = None
    _CryptUnprotectData = None
    _LocalFree = None
    _CRYPTPROTECT_UI_FORBIDDEN = 0


def _dpapi_encrypt(plain_text: str) -> Optional[str]:
    """Encrypt a string using Windows Data Protection API (DPAPI)."""
    if not _IS_WINDOWS or not _CryptProtectData:
        return None
    try:
        data = plain_text.encode("utf-8")
        in_blob = _DATA_BLOB(len(data), ctypes.cast(ctypes.create_string_buffer(data), ctypes.POINTER(ctypes.c_char)))
        out_blob = _DATA_BLOB()

        if _CryptProtectData(
            ctypes.byref(in_blob),
            "QuantumCouncilCredential",
            None,
            None,
            None,
            _CRYPTPROTECT_UI_FORBIDDEN,
            ctypes.byref(out_blob),
        ):
            raw_bytes = ctypes.string_at(out_blob.pbData, out_blob.cbData)
            _LocalFree(out_blob.pbData)
            b64_enc = base64.b64encode(raw_bytes).decode("ascii")
            return f"dpapi:{b64_enc}"
        return None
    except Exception:
        return None


def _dpapi_decrypt(cipher_payload: str) -> Optional[str]:
    """Decrypt a DPAPI-encrypted payload."""
    if not _IS_WINDOWS or not _CryptUnprotectData or not cipher_payload.startswith("dpapi:"):
        return None
    try:
        raw_b64 = cipher_payload[len("dpapi:"):]
        encrypted_bytes = base64.b64decode(raw_b64.encode("ascii"))
        in_blob = _DATA_BLOB(len(encrypted_bytes), ctypes.cast(ctypes.create_string_buffer(encrypted_bytes), ctypes.POINTER(ctypes.c_char)))
        out_blob = _DATA_BLOB()

        if _CryptUnprotectData(
            ctypes.byref(in_blob),
            None,
            None,
            None,
            None,
            _CRYPTPROTECT_UI_FORBIDDEN,
            ctypes.byref(out_blob),
        ):
            decrypted_bytes = ctypes.string_at(out_blob.pbData, out_blob.cbData)
            _LocalFree(out_blob.pbData)
            return decrypted_bytes.decode("utf-8")
        return None
    except Exception:
        return None


# ─── Local Per-User Machine Master Key (Fallback) ─────────────────────────────

def _get_local_master_key() -> bytes:
    """
    Retrieve or initialize the per-user private master key.
    Stored with 0600 permissions in the user's isolated keys directory.
    """
    keys_dir = get_keys_dir()
    key_file = keys_dir / "master.key"

    if key_file.exists():
        try:
            return key_file.read_bytes().strip()
        except Exception:
            pass

    # Generate fresh high-entropy key
    key = Fernet.generate_key()
    try:
        key_file.write_bytes(key)
        if sys.platform != "win32":
            os.chmod(key_file, 0o600)
    except Exception:
        # Fallback to key derived from settings.secret_key
        raw_hash = hashlib.sha256(settings.secret_key.encode("utf-8")).digest()
        return base64.urlsafe_b64encode(raw_hash)

    return key


def _fernet_encrypt(plain_text: str) -> str:
    """Encrypt with user's local master key."""
    key = _get_local_master_key()
    f = Fernet(key)
    enc = f.encrypt(plain_text.encode("utf-8")).decode("ascii")
    return f"fernet:{enc}"


def _fernet_decrypt(cipher_payload: str) -> Optional[str]:
    """Decrypt payload with user's local master key."""
    if not cipher_payload.startswith("fernet:"):
        return None
    try:
        raw_token = cipher_payload[len("fernet:"):]
        key = _get_local_master_key()
        f = Fernet(key)
        return f.decrypt(raw_token.encode("ascii")).decode("utf-8")
    except Exception:
        return None


# ─── Legacy Fallback ──────────────────────────────────────────────────────────

def _legacy_fernet_decrypt(ciphertext: str) -> str:
    """Attempt decryption of legacy tokens derived from settings.secret_key."""
    try:
        raw_hash = hashlib.sha256(settings.secret_key.encode("utf-8")).digest()
        key = base64.urlsafe_b64encode(raw_hash)
        f = Fernet(key)
        return f.decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except Exception:
        return ""


# ─── Public API ───────────────────────────────────────────────────────────────

def encrypt_secret(plain_secret: str) -> str:
    """
    Encrypt a plain text API credential.
    Prefers Windows DPAPI on Windows; falls back to isolated per-user Fernet key.
    """
    if not plain_secret:
        return ""

    # Tier 1: Windows DPAPI
    if _IS_WINDOWS:
        dpapi_result = _dpapi_encrypt(plain_secret)
        if dpapi_result:
            return dpapi_result

    # Tier 2: Isolated Per-User Machine Master Key
    return _fernet_encrypt(plain_secret)


def decrypt_secret(encrypted_secret: Optional[str]) -> str:
    """
    Decrypt an encrypted credential string back to plain text.
    Inspects token prefix to route to DPAPI, per-user Fernet, or legacy key.
    """
    if not encrypted_secret:
        return ""

    # Tier 1: DPAPI
    if encrypted_secret.startswith("dpapi:"):
        res = _dpapi_decrypt(encrypted_secret)
        if res is not None:
            return res

    # Tier 2: Per-user Fernet
    if encrypted_secret.startswith("fernet:"):
        res = _fernet_decrypt(encrypted_secret)
        if res is not None:
            return res

    # Tier 3: Legacy un-prefixed Fernet
    return _legacy_fernet_decrypt(encrypted_secret)


def mask_secret(secret: Optional[str]) -> str:
    """
    Return a safely masked representation of an API key for UI display.
    Never returns full secret.
    Examples:
      'gsk_1234567890abcdef' -> 'gsk_...cdef'
      'short'                -> '********'
    """
    if not secret:
        return ""
    if len(secret) <= 8:
        return "********"
    prefix = secret[:4]
    suffix = secret[-4:]
    return f"{prefix}...{suffix}"


# ─── Secret Redaction for Logs & Error Messages ───────────────────────────────

SECRET_PATTERNS = [
    re.compile(r"gsk_[a-zA-Z0-9_\-]{14,}"),
    re.compile(r"sk-[a-zA-Z0-9_\-]{14,}"),
    re.compile(r"AIza[0-9A-Za-z\-_]{30,}"),
    re.compile(r"Bearer\s+[a-zA-Z0-9_\-\.]{20,}"),
]


def redact_sensitive_text(text: str) -> str:
    """
    Scrub API keys, bearer tokens, and private credential patterns from strings
    before logging, formatting error messages, or saving public transcripts.
    """
    if not text:
        return text

    scrubbed = text
    for pattern in SECRET_PATTERNS:
        scrubbed = pattern.sub("[REDACTED_API_KEY]", scrubbed)

    return scrubbed
