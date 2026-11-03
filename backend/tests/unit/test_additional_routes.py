"""
backend/tests/unit/test_additional_routes.py

Verification tests for Auth, Models, Documents RAG, History, Analytics, Agents, and Privacy endpoints.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_models_status_endpoint():
    response = client.get("/api/v1/models/status")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert data[0]["name"] == "Ollama Local"


def test_analytics_summary_endpoint():
    response = client.get("/api/v1/analytics/summary")
    assert response.status_code == 200
    data = response.json()
    assert "recovery_success_rate" in data
    assert data["recovery_success_rate"] > 90.0


def test_history_sessions_endpoint():
    response = client.get("/api/v1/history/sessions")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


def test_documents_search_endpoint():
    response = client.get("/api/v1/documents/search?query=neural")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


def test_agents_list_and_update():
    # Test GET agents
    res = client.get("/api/v1/agents")
    assert res.status_code == 200
    agents = res.json()
    assert len(agents) == 5
    agent_ids = [a["agent_id"] for a in agents]
    assert "analyst" in agent_ids

    # Test PUT agent update
    put_res = client.put(
        "/api/v1/agents/analyst",
        json={"temperature": 0.5, "max_tokens": 2048},
    )
    assert put_res.status_code == 200
    updated = put_res.json()
    assert updated["temperature"] == 0.5
    assert updated["max_tokens"] == 2048


def test_privacy_settings_get_and_put():
    # Test GET privacy
    res = client.get("/api/v1/privacy/settings")
    assert res.status_code == 200
    data = res.json()
    assert "privacy_mode" in data

    # Test PUT privacy
    put_res = client.put(
        "/api/v1/privacy/settings",
        json={"privacy_mode": "local_only"},
    )
    assert put_res.status_code == 200
    assert put_res.json()["privacy_mode"] == "local_only"
