"""
backend/tests/integration/test_full_system_integration.py

Comprehensive end-to-end integration test exercising all routers and DB persistence.
Uses MockLLMProvider so tests run deterministically even when Ollama is offline.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.providers.mock_provider import MockLLMProvider
import app.api.routes.council as council_module

client = TestClient(app)


def test_full_system_lifespan_and_routes(monkeypatch):
    # Mock the LLM provider to return fast deterministic outputs when Ollama is not running
    monkeypatch.setattr(
        council_module,
        "get_provider_for_agent",
        lambda aid: MockLLMProvider(
            model_name=aid,
            response_template=f"Empirical analysis by {aid}: Consensus verified.",
        ),
    )

    # 1. Health check
    res_health = client.get("/api/v1/health")
    assert res_health.status_code == 200
    assert "status" in res_health.json()

    # 2. Start Council session and verify DB persistence
    res_session = client.post(
        "/api/v1/council/session",
        json={"task": "Evaluate Byzantine fault tolerance in decentralized multi-agent LLM consensus", "mode": "council"},
    )
    assert res_session.status_code == 200
    session_data = res_session.json()
    session_id = session_data["id"]
    assert "healthy_agents" in session_data
    assert "agent_outputs" in session_data
    assert len(session_data["healthy_agents"]) == 5

    # 3. Verify session detail endpoint
    res_detail = client.get(f"/api/v1/council/session/{session_id}")
    assert res_detail.status_code == 200
    assert res_detail.json()["id"] == session_id

    # 4. Verify History endpoint returns our newly created session
    res_hist = client.get("/api/v1/history/sessions")
    assert res_hist.status_code == 200
    sessions = res_hist.json()
    assert any(s["id"] == session_id for s in sessions)

    # 5. Verify Document upload and search
    upload_res = client.post(
        "/api/v1/documents/upload",
        files={"file": ("test_quantum.txt", b"Quantum Council utilizes a 7-node LangGraph state machine with automatic circuit breakers.")},
    )
    assert upload_res.status_code == 200
    doc_data = upload_res.json()
    assert doc_data["status"] == "indexed"

    search_res = client.get("/api/v1/documents/search?query=LangGraph")
    assert search_res.status_code == 200
    matches = search_res.json()
    assert len(matches) > 0
    assert "LangGraph" in matches[0]["content"]

    # 6. Verify Model provider status
    model_res = client.get("/api/v1/models/status")
    assert model_res.status_code == 200

    # 7. Verify Privacy Settings
    priv_res = client.get("/api/v1/privacy/settings")
    assert priv_res.status_code == 200
    assert priv_res.json()["privacy_mode"] in ["local_only", "hybrid"]

    # 8. Verify Agents listing
    agent_res = client.get("/api/v1/agents")
    assert agent_res.status_code == 200
    assert len(agent_res.json()) == 5
