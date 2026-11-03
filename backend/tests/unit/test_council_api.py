"""
backend/tests/unit/test_council_api.py

API integration tests for Quantum Council endpoints:
  - Resilience configuration GET & PUT
  - Council session creation with dynamic recovery
  - Session detail lookup
  - SSE event streaming
"""

import pytest
from unittest.mock import patch
from app.api.routes.council import (
    get_resilience_config,
    update_resilience_config,
    start_council_session,
    get_session_detail,
    stream_session_events,
)
from app.core.schemas import (
    ResilienceConfigUpdateSchema,
    StartSessionRequest,
)
from app.providers.mock_provider import MockLLMProvider


@pytest.mark.asyncio
async def test_resilience_config_get_and_put():
    config = await get_resilience_config()
    assert config.auto_recovery_enabled is True
    assert config.max_retries == 2

    # Update max retries to 3 and agent_timeout to 45.0
    updated = await update_resilience_config(ResilienceConfigUpdateSchema(
        max_retries=3,
        agent_timeout_seconds=45.0
    ))
    assert updated.max_retries == 3
    assert updated.agent_timeout_seconds == 45.0

    # Reset back to default
    await update_resilience_config(ResilienceConfigUpdateSchema(
        max_retries=2,
        agent_timeout_seconds=30.0
    ))


@pytest.mark.asyncio
async def test_council_session_creation_endpoint():
    # Mock get_provider_for_agent to use MockLLMProvider
    with patch("app.api.routes.council.get_provider_for_agent") as mock_get_provider:
        mock_get_provider.side_effect = lambda aid: MockLLMProvider(
            model_name=f"mock-{aid}",
            response_template=f"Response from agent {aid}"
        )

        req = StartSessionRequest(
            task="Evaluate autonomous vehicle safety protocols",
            mode="council"
        )
        res = await start_council_session(req)

        assert res.id is not None
        assert res.task == req.task
        assert res.status == "completed"
        assert len(res.healthy_agents) == 5
        assert res.final_synthesis is not None

        # Verify lookup endpoint works
        detail = await get_session_detail(res.id)
        assert detail.id == res.id
        assert detail.status == "completed"

        # Verify SSE event stream generates data
        stream_res = await stream_session_events(res.id)
        assert stream_res.media_type == "text/event-stream"

