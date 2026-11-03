"""
backend/app/api/routes/health.py

Health check endpoint.
"""

from datetime import datetime, timezone
import httpx
from fastapi import APIRouter
from sqlalchemy import text

from app.config import settings
from app.core.schemas import HealthResponse
from app.database.db import SessionLocal

router = APIRouter(prefix="/health", tags=["Health"])

def _check_database() -> str:
    try:
        with SessionLocal() as session:
            session.execute(text("SELECT 1"))
        return "connected"
    except Exception as e:
        return f"error: {e}"

async def _check_ollama() -> str:
    import socket
    import urllib.request
    import urllib.error
    from urllib.parse import urlparse

    try:
        parsed = urlparse(settings.ollama_base_url)
        host = parsed.hostname or "127.0.0.1"
        if host == "localhost":
            host = "127.0.0.1"
        port = parsed.port or 11434

        # Fast socket connection test to prevent urllib hanging on Windows
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(0.2)
        sock.connect((host, port))
        sock.close()
    except Exception:
        return "unreachable"

    try:
        req = urllib.request.Request(f"http://{host}:{port}/api/tags", headers={"User-Agent": "QuantumCouncil"})
        with urllib.request.urlopen(req, timeout=0.5) as resp:
            if resp.status == 200:
                return "connected"
            return f"error: HTTP {resp.status}"
    except (urllib.error.URLError, OSError, TimeoutError):
        return "unreachable"
    except Exception as e:
        return f"error: {e}"

@router.get("", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    db_status = _check_database()
    ollama_status = await _check_ollama()

    return HealthResponse(
        status="healthy" if db_status == "connected" else "degraded",
        version=settings.app_version,
        environment=settings.environment,
        database=db_status,
        ollama=ollama_status,
        privacy_mode=settings.default_privacy_mode,
        timestamp=datetime.now(timezone.utc),
    )
