"""
backend/tests/unit/test_data_management.py

Unit tests for Data Management storage metrics and cleanup endpoints.
"""

import pytest
from fastapi import HTTPException
from app.api.routes.data_management import (
    CleanupRequest,
    get_storage_metrics,
    execute_cleanup,
    format_bytes,
)
from app.database.db import get_db

def test_format_bytes_utility():
    """Verify byte formatting produces clean human-readable units."""
    assert format_bytes(0) == "0 B"
    assert format_bytes(500) == "500 B"
    assert format_bytes(1024) == "1.0 KB"
    assert format_bytes(1024 * 1024 * 2) == "2.00 MB"
    assert format_bytes(1024 * 1024 * 1024 * 3) == "3.00 GB"

def test_cleanup_request_all_requires_confirmation():
    """Executing 'all' cleanup without exact confirmation phrase raises 400."""
    db_gen = get_db()
    db = next(db_gen)
    try:
        req = CleanupRequest(target="all", confirmation_text="wrong text")
        with pytest.raises(HTTPException) as exc_info:
            execute_cleanup(req=req, db=db)
        assert exc_info.value.status_code == 400
        assert "DELETE ALL DATA" in exc_info.value.detail
    finally:
        db_gen.close()

def test_storage_metrics_direct_invocation():
    """get_storage_metrics executes successfully against the real DB session."""
    db_gen = get_db()
    db = next(db_gen)
    try:
        metrics = get_storage_metrics(db=db)
        assert hasattr(metrics, "categories")
        assert len(metrics.categories) >= 4
        assert hasattr(metrics, "total_managed_bytes")
        assert hasattr(metrics, "total_managed_formatted")
        # Check category IDs
        cat_ids = [c.category_id for c in metrics.categories]
        assert "chats" in cat_ids
        assert "history" in cat_ids
        assert "documents" in cat_ids
        assert "cache" in cat_ids
    finally:
        db_gen.close()
