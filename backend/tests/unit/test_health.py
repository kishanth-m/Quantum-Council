"""
backend/tests/unit/test_health.py

Unit tests for the health check endpoint.
"""

from unittest.mock import AsyncMock, patch
from app.api.routes.health import health_check
from app.core.schemas import HealthResponse

async def test_health_endpoint_direct():
    """health_check() should return a valid HealthResponse object."""
    with patch("app.api.routes.health._check_ollama", new_callable=AsyncMock) as mock_ollama:
        mock_ollama.return_value = "connected"
        res: HealthResponse = await health_check()
        assert res.status == "healthy"
        assert res.database == "connected"
        assert res.ollama == "connected"
        assert res.version == "0.1.0"
        assert res.privacy_mode in ("local_only", "hybrid")

async def test_health_endpoint_degraded_when_ollama_unreachable():
    """health_check() should report degraded if database fails, or show ollama unreachable."""
    with patch("app.api.routes.health._check_ollama", new_callable=AsyncMock) as mock_ollama:
        mock_ollama.return_value = "unreachable"
        res: HealthResponse = await health_check()
        assert res.ollama == "unreachable"
        assert res.database == "connected"
