"""
backend/app/main.py

FastAPI application entry point.

This file:
  1. Creates the FastAPI app instance.
  2. Configures CORS (so the React frontend on port 5173 can talk to us).
  3. Registers all API routers.
  4. Runs database table creation on startup.
  5. Provides the root endpoint (redirects to /docs).

To run the server:
    cd backend
    uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

--reload means the server restarts automatically when you change a Python file.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from app.config import settings
from app.core.paths import ensure_directory_structure
from app.database.db import create_all_tables
from app.security.middleware import LocalSecurityMiddleware

# Import routers
from app.api.routes.health import router as health_router
from app.api.routes.council import router as council_router
from app.api.routes.auth import router as auth_router
from app.api.routes.documents import router as documents_router
from app.api.routes.models import router as models_router
from app.api.routes.history import router as history_router
from app.api.routes.analytics import router as analytics_router
from app.api.routes.agents import router as agents_router
from app.api.routes.privacy import router as privacy_router
from app.api.routes.chat import router as chat_router
from app.api.routes.data_management import router as data_management_router


# ─── Lifespan ──────────────────────────────────────────────────────────────────
# The lifespan context manager runs code at startup and shutdown.
# This replaces the old @app.on_event("startup") pattern.
@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──
    print(f"\n{'='*60}")
    print(f"  QUANTUM COUNCIL — {settings.app_version}")
    print(f"  Environment : {settings.environment}")
    print(f"  Privacy mode: {settings.default_privacy_mode}")
    print(f"  Database    : {settings.database_url}")
    print(f"  Ollama      : {settings.ollama_base_url}")
    print(f"{'='*60}\n")

    # Ensure isolated per-user data directory structure exists
    ensure_directory_structure()

    # Create database tables if they don't exist
    create_all_tables()
    print("  ✓ Database tables ready")

    yield  # Application runs here

    # ── Shutdown ──
    print("\n  Quantum Council shutting down...")


# ─── App instance ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="Quantum Council API",
    description=(
        "Backend API for the Quantum Council multi-agent AI collaboration platform. "
        "Five specialised AI agents coordinated by a LangGraph orchestrator."
    ),
    version=settings.app_version,
    lifespan=lifespan,
    # Only expose docs in development — never in production
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
)


# ─── CORS ──────────────────────────────────────────────────────────────────────
# CORS allows the browser to make requests from localhost:5173 (React frontend)
# to localhost:8000 (FastAPI backend).
# Without this, the browser blocks all cross-origin requests.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,       # Required for cookie-based auth
    allow_methods=["*"],          # GET, POST, PUT, DELETE, OPTIONS
    allow_headers=["*"],          # Authorization, Content-Type, etc.
)

# Enforce local loopback host validation, anti-DNS rebinding, and cross-origin CSRF protection
app.add_middleware(LocalSecurityMiddleware)


# ─── Routers ───────────────────────────────────────────────────────────────────
# All routes are prefixed with /api/v1 for clean versioning.
# As we build more features, we register more routers here.

app.include_router(health_router, prefix="/api/v1")
app.include_router(council_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(documents_router, prefix="/api/v1")
app.include_router(models_router, prefix="/api/v1")
app.include_router(history_router, prefix="/api/v1")
app.include_router(analytics_router, prefix="/api/v1")
app.include_router(agents_router, prefix="/api/v1")
app.include_router(privacy_router, prefix="/api/v1")
app.include_router(chat_router, prefix="/api/v1")
app.include_router(data_management_router, prefix="/api/v1")


# ─── Root endpoint ─────────────────────────────────────────────────────────────
@app.get("/", include_in_schema=False)
async def root():
    """Redirect root URL to the API docs (development only)."""
    if settings.debug:
        return RedirectResponse(url="/docs")
    return {"message": "Quantum Council API", "version": settings.app_version}

