"""
backend/app/config.py

Central configuration for Quantum Council backend.

All settings are loaded from the .env file using pydantic-settings.
This means:
  - No hardcoded secrets anywhere in the codebase.
  - Settings are validated at startup — the app will not start with a bad config.
  - Every module imports from here instead of reading os.environ directly.

Usage in other modules:
    from app.config import settings
    print(settings.ollama_base_url)
"""

from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

_ENV_PATH = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    """
    Application settings — loaded from .env automatically.
    pydantic-settings reads field names (case-insensitive) from environment variables.
    """

    # ─── Application ───────────────────────────────────────────────────────────
    app_name: str = "Quantum Council"
    app_version: str = "0.1.0"
    debug: bool = False
    environment: str = "development"
    # "local"  = Desktop mode: single-user zero-login experience with local "default_user" identity.
    # "online" = Cloud/multi-tenant mode: strict authentication enforced on all protected endpoints.
    #            Unauthenticated requests return HTTP 401 Unauthorized.
    deployment_mode: str = "local"

    @property
    def is_online_mode(self) -> bool:
        return self.deployment_mode.lower() == "online"

    # ─── Server ────────────────────────────────────────────────────────────────
    host: str = "127.0.0.1"
    port: int = 8000

    # ─── Security ──────────────────────────────────────────────────────────────
    # SECRET_KEY signs JWT tokens. Must be long, random, and private.
    secret_key: str = "quantum_council_default_dev_secret_key_change_in_production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 480

    # ─── Database ──────────────────────────────────────────────────────────────
    # SQLite for local development. The URL format for async SQLite is:
    # sqlite+aiosqlite:///./filename.db  (relative path)
    database_url: str = "sqlite+aiosqlite:///./quantum_council.db"

    # ─── Ollama (local LLM) ────────────────────────────────────────────────────
    ollama_base_url: str = "http://127.0.0.1:11434"
    ollama_default_model: str = "llama3.2:1b"
    ollama_timeout: int = 120  # seconds before a model call times out

    # ─── Privacy ───────────────────────────────────────────────────────────────
    # "local_only" = never call any online provider
    # "hybrid"     = local + online allowed (with user approval per session)
    default_privacy_mode: str = "local_only"

    # ─── Document storage ──────────────────────────────────────────────────────
    upload_dir: str = "./uploads"
    max_upload_size_mb: int = 50

    # ─── ChromaDB (local vector database for RAG) ──────────────────────────────
    chroma_persist_dir: str = "./chroma_db"

    # ─── Embedding model ───────────────────────────────────────────────────────
    # all-MiniLM-L6-v2 is small (22 MB), fast, and runs entirely locally.
    # It is downloaded once on first use by sentence-transformers.
    embedding_model: str = "all-MiniLM-L6-v2"

    # ─── Rate limiting ─────────────────────────────────────────────────────────
    rate_limit_per_minute: int = 60

    # ─── CORS ──────────────────────────────────────────────────────────────────
    # The frontend dev server runs on port 5173 (Vite default).
    allowed_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # ─── Online providers (optional — used only in Hybrid Mode) ────────────────
    # These values live only in .env and never reach the frontend.
    groq_api_key: str = ""
    openai_api_key: str = ""
    openai_base_url: str = ""

    # ─── Pydantic settings config ──────────────────────────────────────────────
    model_config = SettingsConfigDict(
        env_file=(str(_ENV_PATH), ".env"),  # read from backend/.env or cwd/.env
        env_file_encoding="utf-8",
        case_sensitive=False,     # ENV_VAR and env_var both work
        extra="ignore",           # ignore unknown variables in .env
    )

    @property
    def allowed_origins_list(self) -> list[str]:
        """Parse the comma-separated ALLOWED_ORIGINS string into a Python list."""
        return [origin.strip() for origin in self.allowed_origins.split(",")]

    @property
    def is_local_only_mode(self) -> bool:
        """True when the application must not make any online LLM calls."""
        return self.default_privacy_mode == "local_only"


@lru_cache()
def get_settings() -> Settings:
    """
    Returns a cached Settings instance.

    @lru_cache ensures we read the .env file only once per process,
    not on every request. This is the standard FastAPI pattern.

    Usage:
        from app.config import settings
    """
    return Settings()


# Module-level singleton — import this everywhere instead of calling get_settings()
# Example: from app.config import settings
settings: Settings = get_settings()

