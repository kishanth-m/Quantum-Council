"""
backend/app/api/routes/models.py

Endpoints for inspecting, configuring, and testing local Ollama and online LLM providers
(Groq, OpenAI, and OpenAI-compatible endpoints). Supports shared and per-agent model assignments.
"""

import json
import time
from typing import Dict, List, Optional
import urllib.request
import urllib.error
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.database.db import get_db
from app.database.models import AgentConfig, PrivacySettings, ProviderConfig
from app.providers.openai_provider import DEFAULT_BASE_URLS, OpenAICompatibleProvider
from app.security.secrets_manager import decrypt_secret, encrypt_secret, mask_secret

router = APIRouter(prefix="/models", tags=["Models"])


# ─── Schemas ───────────────────────────────────────────────────────────────────

class ProviderDetail(BaseModel):
    provider: str
    name: str
    type: str  # "local" | "online"
    base_url: str
    model_name: str
    has_api_key: bool
    masked_api_key: str
    is_active: bool
    available_models: List[str]


class SaveProviderConfigRequest(BaseModel):
    provider: str  # "ollama" | "groq" | "openai" | "openai_compatible"
    model_name: str
    api_key: Optional[str] = None
    base_url: Optional[str] = None


class TestConnectionRequest(BaseModel):
    provider: str  # "ollama" | "groq" | "openai" | "openai_compatible"
    model_name: Optional[str] = None
    api_key: Optional[str] = None
    base_url: Optional[str] = None


class TestConnectionResponse(BaseModel):
    success: bool
    message: str
    latency_ms: float


class AssignGlobalModelRequest(BaseModel):
    provider: str
    model_name: str


class AssignAgentModelRequest(BaseModel):
    agent_id: str
    provider: str
    model_name: str


class AgentModelAssignment(BaseModel):
    agent_id: str
    agent_name: str
    provider: str
    model_name: str


class ActiveModelResponse(BaseModel):
    privacy_mode: str
    provider: str
    provider_name: str
    model_name: str
    display_text: str
    is_online: bool
    available_local_models: List[str]


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.get("/active", response_model=ActiveModelResponse)
def get_active_model(db: Session = Depends(get_db)):
    """Retrieve the currently active model and provider across the application."""
    # 1. Privacy mode
    privacy = db.query(PrivacySettings).first()
    privacy_mode = privacy.privacy_mode if privacy else "local_only"

    # 2. Local installed models
    local_models = []
    ollama_url = settings.ollama_base_url.replace("localhost", "127.0.0.1")
    try:
        req = urllib.request.Request(f"{ollama_url}/api/tags", headers={"User-Agent": "QuantumCouncil"})
        with urllib.request.urlopen(req, timeout=0.4) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode())
                for m in data.get("models", []):
                    m_name = m.get("name")
                    if m_name and m_name not in local_models:
                        local_models.append(m_name)
    except Exception:
        pass

    ollama_cfg = db.query(ProviderConfig).filter(ProviderConfig.provider == "ollama").first()
    local_model_name = ollama_cfg.model_name if (ollama_cfg and ollama_cfg.model_name) else (
        local_models[0] if local_models else settings.ollama_default_model
    )

    # In strict local-only mode, only local Ollama is active
    if privacy_mode == "local_only":
        return ActiveModelResponse(
            privacy_mode="local_only",
            provider="ollama",
            provider_name="Ollama Local",
            model_name=local_model_name,
            display_text=f"LOCAL · Ollama · {local_model_name}",
            is_online=False,
            available_local_models=local_models,
        )

    # In hybrid mode: check first agent or active provider config to see if online model is configured
    first_agent = db.query(AgentConfig).first()
    preferred_provider = first_agent.provider if first_agent else "ollama"

    if preferred_provider in ("groq", "openai", "openai_compatible"):
        cfg = db.query(ProviderConfig).filter(
            ProviderConfig.provider == preferred_provider,
            ProviderConfig.is_active == True,
        ).first()
        if cfg and cfg.encrypted_api_key:
            p_label = "Groq" if cfg.provider == "groq" else cfg.provider.upper()
            m_label = cfg.model_name or "llama-3.3-70b-versatile"
            return ActiveModelResponse(
                privacy_mode="hybrid",
                provider=cfg.provider,
                provider_name=f"{p_label} Cloud",
                model_name=m_label,
                display_text=f"ONLINE · {p_label} · {m_label}",
                is_online=True,
                available_local_models=local_models,
            )

    # Check if Groq has an active key even if not explicitly assigned
    groq_cfg = db.query(ProviderConfig).filter(
        ProviderConfig.provider == "groq",
        ProviderConfig.is_active == True,
    ).first()
    if groq_cfg and groq_cfg.encrypted_api_key:
        m_label = groq_cfg.model_name or "llama-3.3-70b-versatile"
        return ActiveModelResponse(
            privacy_mode="hybrid",
            provider="groq",
            provider_name="Groq Cloud",
            model_name=m_label,
            display_text=f"ONLINE · Groq · {m_label}",
            is_online=True,
            available_local_models=local_models,
        )

    return ActiveModelResponse(
        privacy_mode="hybrid",
        provider="ollama",
        provider_name="Ollama Local",
        model_name=local_model_name,
        display_text=f"HYBRID · Ollama · {local_model_name}",
        is_online=False,
        available_local_models=local_models,
    )


@router.get("/status", response_model=List[ProviderDetail])
@router.get("/providers", response_model=List[ProviderDetail])
def list_configured_providers(db: Session = Depends(get_db)):
    """List all supported providers, their active configurations, and masked credentials."""
    # 1. Ollama status
    ollama_models = []
    ollama_active = False
    ollama_url = settings.ollama_base_url.replace("localhost", "127.0.0.1")
    import socket
    try:
        # Fast socket connection check to avoid urllib hanging on Windows
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(0.2)
        sock.connect(("127.0.0.1", 11434))
        sock.close()

        req = urllib.request.Request(f"{ollama_url}/api/tags", headers={"User-Agent": "QuantumCouncil"})
        with urllib.request.urlopen(req, timeout=0.4) as resp:
            if resp.status == 200:
                ollama_active = True
                data = json.loads(resp.read().decode())
                for m in data.get("models", []):
                    m_name = m.get("name")
                    if m_name and m_name not in ollama_models:
                        ollama_models.append(m_name)
    except Exception:
        pass

    ollama_cfg = db.query(ProviderConfig).filter(ProviderConfig.provider == "ollama").first()
    selected_ollama_model = ollama_cfg.model_name if (ollama_cfg and ollama_cfg.model_name) else (
        ollama_models[0] if ollama_models else settings.ollama_default_model
    )

    results: List[ProviderDetail] = [
        ProviderDetail(
            provider="ollama",
            name="Ollama Local",
            type="local",
            base_url=settings.ollama_base_url,
            model_name=selected_ollama_model,
            has_api_key=False,
            masked_api_key="",
            is_active=ollama_active,
            available_models=ollama_models if ollama_models else [settings.ollama_default_model],
        )
    ]

    # 2. Online providers from DB
    online_defs = [
        ("groq", "Groq Cloud", "llama-3.3-70b-versatile", DEFAULT_BASE_URLS["groq"], ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "llama3-70b-8192", "gemma2-9b-it", "deepseek-r1-distill-llama-70b"]),
        ("openai", "OpenAI", "gpt-4o-mini", DEFAULT_BASE_URLS["openai"], ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"]),
        ("openai_compatible", "OpenAI-Compatible", "custom-model", "http://localhost:8080/v1", []),
    ]

    for p_id, p_name, default_model, default_url, sample_models in online_defs:
        cfg = db.query(ProviderConfig).filter(ProviderConfig.provider == p_id).first()
        raw_key = decrypt_secret(cfg.encrypted_api_key) if cfg and cfg.encrypted_api_key else ""
        has_key = bool(raw_key)
        masked = mask_secret(raw_key)
        active_model = cfg.model_name if cfg else default_model
        active_url = cfg.base_url if (cfg and cfg.base_url) else default_url

        results.append(
            ProviderDetail(
                provider=p_id,
                name=p_name,
                type="online",
                base_url=active_url,
                model_name=active_model,
                has_api_key=has_key,
                masked_api_key=masked,
                is_active=has_key,
                available_models=sample_models,
            )
        )

    return results


@router.post("/config", response_model=TestConnectionResponse)
def save_provider_config(
    req: SaveProviderConfigRequest,
    db: Session = Depends(get_db),
):
    """Save or update API credentials and model name for a provider."""
    p_id = req.provider.lower()
    cfg = db.query(ProviderConfig).filter(ProviderConfig.provider == p_id).first()

    enc_key = None
    if req.api_key:
        enc_key = encrypt_secret(req.api_key)
    elif cfg:
        enc_key = cfg.encrypted_api_key

    resolved_url = req.base_url or DEFAULT_BASE_URLS.get(p_id)

    if not cfg:
        cfg = ProviderConfig(
            user_id="default_user",
            provider=p_id,
            model_name=req.model_name,
            encrypted_api_key=enc_key,
            base_url=resolved_url,
            is_active=True,
        )
        db.add(cfg)
    else:
        cfg.model_name = req.model_name
        if enc_key:
            cfg.encrypted_api_key = enc_key
        if resolved_url:
            cfg.base_url = resolved_url
        cfg.is_active = True

    db.commit()
    return TestConnectionResponse(
        success=True,
        message=f"Configuration for {p_id.upper()} saved securely.",
        latency_ms=0.0,
    )


@router.delete("/config/{provider}", response_model=TestConnectionResponse)
def delete_provider_config(provider: str, db: Session = Depends(get_db)):
    """Delete saved credentials and configuration for a provider."""
    p_id = provider.lower()
    cfg = db.query(ProviderConfig).filter(ProviderConfig.provider == p_id).first()
    if cfg:
        db.delete(cfg)
        db.commit()

    # Revert any agents using this provider to Ollama
    agents = db.query(AgentConfig).filter(AgentConfig.provider == p_id).all()
    for a in agents:
        a.provider = "ollama"
        a.model_name = settings.ollama_default_model
    db.commit()

    return TestConnectionResponse(
        success=True,
        message=f"Credentials for {p_id.upper()} deleted.",
        latency_ms=0.0,
    )


@router.post("/test", response_model=TestConnectionResponse)
async def test_provider_connection(
    req: Optional[TestConnectionRequest] = None,
    db: Session = Depends(get_db),
):
    """
    Perform a live API connection test for local Ollama or an online provider.
    Verifies authentication and model accessibility.
    """
    provider = (req.provider if req else "ollama").lower()
    start = time.perf_counter()

    # Test Local Ollama
    if provider == "ollama":
        target_urls = [req.base_url] if (req and req.base_url) else [settings.ollama_base_url, "http://127.0.0.1:11434"]
        model_name = req.model_name if (req and req.model_name) else settings.ollama_default_model
        last_err = ""
        for b_url in target_urls:
            try:
                req_obj = urllib.request.Request(f"{b_url}/api/tags", headers={"User-Agent": "QuantumCouncil"})
                with urllib.request.urlopen(req_obj, timeout=2.5) as res:
                    latency = round((time.perf_counter() - start) * 1000, 2)
                    if res.status == 200:
                        installed = [m.get("name") for m in json.loads(res.read().decode()).get("models", [])]
                        model_found = any(m == model_name or m.startswith(model_name) for m in installed)
                        installed_str = ", ".join(installed) if installed else "none"
                        msg = f"Connected to Ollama. Model '{model_name}' " + ("is ready." if model_found else f"not found in installed list [{installed_str}].")
                        return TestConnectionResponse(success=model_found, message=msg, latency_ms=latency)
                    return TestConnectionResponse(success=False, message=f"Ollama returned HTTP {res.status}", latency_ms=latency)
            except Exception as e:
                last_err = str(e)
                continue
        return TestConnectionResponse(success=False, message=f"Cannot reach Ollama at {target_urls[0]}: {last_err}", latency_ms=round((time.perf_counter() - start) * 1000, 2))

    # Test Online Provider (Groq / OpenAI / Compatible)
    api_key = req.api_key if (req and req.api_key) else ""
    if not api_key:
        cfg = db.query(ProviderConfig).filter(ProviderConfig.provider == provider).first()
        if cfg and cfg.encrypted_api_key:
            api_key = decrypt_secret(cfg.encrypted_api_key)

    if not api_key:
        return TestConnectionResponse(success=False, message=f"No API key provided or saved for {provider.upper()}.", latency_ms=0.0)

    model_name = req.model_name if (req and req.model_name) else ("llama-3.3-70b-versatile" if provider == "groq" else "gpt-4o-mini")
    base_url = req.base_url if (req and req.base_url) else DEFAULT_BASE_URLS.get(provider, "https://api.openai.com/v1")

    adapter = OpenAICompatibleProvider(
        provider_name=provider,
        model_name=model_name,
        api_key=api_key,
        base_url=base_url,
    )

    result = await adapter.check_connection_detailed()
    return TestConnectionResponse(
        success=result["success"],
        message=result["message"],
        latency_ms=result["latency_ms"],
    )


@router.post("/assign-global", response_model=List[AgentModelAssignment])
def assign_global_model(req: AssignGlobalModelRequest, db: Session = Depends(get_db)):
    """Assign a single shared provider and model across all 5 agents."""
    p_lower = req.provider.lower()
    agents = db.query(AgentConfig).all()
    for a in agents:
        a.provider = p_lower
        a.model_name = req.model_name

    # Also update provider config record
    p_cfg = db.query(ProviderConfig).filter(ProviderConfig.provider == p_lower).first()
    if p_cfg:
        p_cfg.model_name = req.model_name
        p_cfg.is_active = True
    else:
        new_cfg = ProviderConfig(
            provider=p_lower,
            model_name=req.model_name,
            is_active=True,
        )
        db.add(new_cfg)

    db.commit()

    return [
        AgentModelAssignment(
            agent_id=a.agent_id,
            agent_name=a.agent_name,
            provider=a.provider,
            model_name=a.model_name,
        )
        for a in agents
    ]


@router.post("/assign-agent", response_model=AgentModelAssignment)
def assign_agent_model(req: AssignAgentModelRequest, db: Session = Depends(get_db)):
    """Assign a specific provider and model to an individual agent."""
    agent = db.query(AgentConfig).filter(AgentConfig.agent_id == req.agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    agent.provider = req.provider.lower()
    agent.model_name = req.model_name
    db.commit()

    return AgentModelAssignment(
        agent_id=agent.agent_id,
        agent_name=agent.agent_name,
        provider=agent.provider,
        model_name=agent.model_name,
    )


@router.get("/assignments", response_model=List[AgentModelAssignment])
def get_agent_assignments(db: Session = Depends(get_db)):
    """Get the current provider and model assignment for each agent."""
    agents = db.query(AgentConfig).all()
    return [
        AgentModelAssignment(
            agent_id=a.agent_id,
            agent_name=a.agent_name,
            provider=a.provider,
            model_name=a.model_name,
        )
        for a in agents
    ]
