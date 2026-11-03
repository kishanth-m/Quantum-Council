"""
backend/app/api/routes/agents.py

Endpoints for inspecting and updating per-agent configurations.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.database.models import AgentConfig
from app.agents.prompts import AGENT_IDENTITIES

router = APIRouter(prefix="/agents", tags=["Agents"])


class AgentConfigSchema(BaseModel):
    agent_id: str
    agent_name: str
    system_prompt: str
    personality: str
    provider: str
    model_name: str
    temperature: float
    max_tokens: int
    is_enabled: bool


class AgentConfigUpdate(BaseModel):
    system_prompt: Optional[str] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    is_enabled: Optional[bool] = None


@router.get("", response_model=List[AgentConfigSchema])
def list_agent_configs(db: Session = Depends(get_db)):
    """List configurations for all 5 specialized agents."""
    configs = db.query(AgentConfig).all()
    if not configs:
        # Seed default configs if not present in DB
        for aid, data in AGENT_IDENTITIES.items():
            cfg = AgentConfig(
                user_id="default_user",
                agent_id=aid,
                agent_name=data["name"],
                system_prompt=data["system_prompt"],
                personality=data["personality"],
                provider="ollama",
                model_name="qwen3:4b",
                temperature=0.7,
                max_tokens=1024,
                is_enabled=True,
            )
            db.add(cfg)
        db.commit()
        configs = db.query(AgentConfig).all()

    return [
        AgentConfigSchema(
            agent_id=c.agent_id,
            agent_name=c.agent_name,
            system_prompt=c.system_prompt,
            personality=c.personality or "",
            provider=c.provider,
            model_name=c.model_name,
            temperature=c.temperature,
            max_tokens=c.max_tokens,
            is_enabled=c.is_enabled,
        )
        for c in configs
    ]


@router.put("/{agent_id}", response_model=AgentConfigSchema)
def update_agent_config(
    agent_id: str,
    update: AgentConfigUpdate,
    db: Session = Depends(get_db),
):
    """Update system prompt or sampling hyperparameters for an agent."""
    cfg = db.query(AgentConfig).filter(AgentConfig.agent_id == agent_id).first()
    if not cfg:
        # Create it if it doesn't exist
        cfg = AgentConfig(
            user_id="default_user",
            agent_id=agent_id,
            agent_name=agent_id.title(),
            system_prompt=update.system_prompt or AGENT_IDENTITIES.get(agent_id, {}).get("system_prompt", ""),
            personality="Specialized",
            provider="ollama",
            model_name="qwen3:4b",
            temperature=update.temperature if update.temperature is not None else 0.7,
            max_tokens=update.max_tokens if update.max_tokens is not None else 1024,
            is_enabled=update.is_enabled if update.is_enabled is not None else True,
        )
        db.add(cfg)
    else:
        if update.system_prompt is not None:
            cfg.system_prompt = update.system_prompt
        if update.temperature is not None:
            cfg.temperature = update.temperature
        if update.max_tokens is not None:
            cfg.max_tokens = update.max_tokens
        if update.is_enabled is not None:
            cfg.is_enabled = update.is_enabled

    db.commit()
    db.refresh(cfg)

    return AgentConfigSchema(
        agent_id=cfg.agent_id,
        agent_name=cfg.agent_name,
        system_prompt=cfg.system_prompt,
        personality=cfg.personality or "",
        provider=cfg.provider,
        model_name=cfg.model_name,
        temperature=cfg.temperature,
        max_tokens=cfg.max_tokens,
        is_enabled=cfg.is_enabled,
    )
