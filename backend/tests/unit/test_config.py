"""
backend/tests/unit/test_config.py

Unit tests for the configuration module.
These tests verify that settings load correctly and have sensible defaults.

Run with:
    cd backend
    python -m pytest tests/unit/test_config.py -v
"""

import pytest
from app.config import settings


def test_settings_load():
    """Settings object is created without raising errors."""
    assert settings is not None


def test_app_name():
    assert settings.app_name == "Quantum Council"


def test_secret_key_is_set():
    """Secret key must be present — app refuses to start without it."""
    assert settings.secret_key
    assert settings.secret_key != "CHANGE_ME_generate_a_random_64_char_hex_string"


def test_ollama_url_is_local():
    """
    In local_only privacy mode, Ollama must be a localhost address.
    This prevents accidentally routing to an external service.
    """
    if settings.is_local_only_mode:
        assert "127.0.0.1" in settings.ollama_base_url or "localhost" in settings.ollama_base_url


def test_allowed_origins_list():
    """allowed_origins_list property parses the comma-separated string correctly."""
    origins = settings.allowed_origins_list
    assert isinstance(origins, list)
    assert len(origins) >= 1
    assert all(o.startswith("http") for o in origins)


def test_privacy_mode_valid():
    """Privacy mode must be one of the two accepted values."""
    assert settings.default_privacy_mode in ("local_only", "hybrid")


def test_upload_size_limit():
    """Upload size must be positive and reasonable."""
    assert 1 <= settings.max_upload_size_mb <= 500


def test_token_expiry():
    """Token expiry must be positive."""
    assert settings.access_token_expire_minutes > 0

