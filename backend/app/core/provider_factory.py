"""
backend/app/core/provider_factory.py

Central Provider Factory for Quantum Council.
Dynamically instantiates and returns the configured LLM provider for any agent
(Ollama, Groq, OpenAI, or OpenAI-compatible), enforcing Strict Local-Only privacy policies.
"""

from typing import Optional
from sqlalchemy.orm import Session

from app.config import settings
from app.database.db import SessionLocal
from app.database.models import AgentConfig, PrivacySettings, ProviderConfig
from app.providers.base import BaseLLMProvider, ProviderAuthError
from app.providers.ollama_provider import OllamaProvider
from app.providers.openai_provider import OpenAICompatibleProvider
from app.security.secrets_manager import decrypt_secret


def get_provider_for_agent(
    agent_id: str,
    db: Optional[Session] = None,
) -> BaseLLMProvider:
    """
    Factory function to retrieve the configured provider for a given agent.
    Checks agent-specific configuration and enforces local privacy constraints.
    """
    close_db = False
    if db is None:
        db = SessionLocal()
        close_db = True

    try:
        # 1. Enforce Strict Local-Only Privacy Mode
        privacy = db.query(PrivacySettings).first()
        is_local_only = privacy.privacy_mode == "local_only" if privacy else True

        # 2. Lookup Agent Configuration
        agent_cfg = db.query(AgentConfig).filter(AgentConfig.agent_id == agent_id).first()
        provider_name = (agent_cfg.provider if agent_cfg else "ollama").lower()
        model_name = agent_cfg.model_name if agent_cfg else settings.ollama_default_model

        # If Strict Local-Only is active, block external online providers
        if is_local_only and provider_name in ("groq", "openai", "openai_compatible"):
            raise ProviderAuthError(
                f"Strict Local-Only Mode is active. Outbound call to {provider_name.upper()} was blocked by policy.",
                retryable=False,
            )

        # 3. Instantiate Ollama
        if provider_name == "ollama":
            return OllamaProvider(
                base_url=settings.ollama_base_url,
                default_model=model_name,
            )

        # 4. Instantiate Online Provider (Groq / OpenAI / OpenAI-Compatible)
        prov_cfg = (
            db.query(ProviderConfig)
            .filter(ProviderConfig.provider == provider_name, ProviderConfig.is_active == True)
            .first()
        )

        api_key = decrypt_secret(prov_cfg.encrypted_api_key) if prov_cfg else ""
        base_url = prov_cfg.base_url if prov_cfg else None

        # Fallback to local Ollama if online API key is missing or dummy test credential
        if not api_key or api_key.startswith("gsk_test") or api_key.startswith("sk-test") or len(api_key) < 15:
            return OllamaProvider(
                base_url=settings.ollama_base_url,
                default_model=settings.ollama_default_model,
            )

        return OpenAICompatibleProvider(
            provider_name=provider_name,
            model_name=model_name,
            api_key=api_key,
            base_url=base_url,
        )

    finally:
        if close_db:
            db.close()

