"""
backend/tests/unit/test_chat_and_models.py

Comprehensive tests for:
1. Online model provider configuration, masking, and testing.
2. Per-agent and global model assignments.
3. Strict Local-Only privacy enforcement.
4. Independent agent conversation creation, message turn context, and strict isolation.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.providers.mock_provider import MockLLMProvider
import app.core.provider_factory as factory_module

client = TestClient(app)


def test_models_config_save_and_masking():
    # 1. Save a Groq configuration with an API key
    dummy_test_key = "gsk_" + "mock_test_key_0123456789"
    res = client.post(
        "/api/v1/models/config",
        json={
            "provider": "groq",
            "model_name": "llama-3.3-70b-versatile",
            "api_key": dummy_test_key,
        },
    )
    assert res.status_code == 200
    assert res.json()["success"] is True

    # 2. Check provider listing - API key must be masked, not plain
    res_list = client.get("/api/v1/models/providers")
    assert res_list.status_code == 200
    providers = res_list.json()
    groq_item = next((p for p in providers if p["provider"] == "groq"), None)
    assert groq_item is not None
    assert groq_item["has_api_key"] is True
    assert dummy_test_key not in groq_item["masked_api_key"]
    assert "..." in groq_item["masked_api_key"]


def test_model_assignment_per_agent():
    # Assign Analyst to Groq
    res = client.post(
        "/api/v1/models/assign-agent",
        json={
            "agent_id": "analyst",
            "provider": "groq",
            "model_name": "llama-3.3-70b-versatile",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["agent_id"] == "analyst"
    assert data["provider"] == "groq"
    assert data["model_name"] == "llama-3.3-70b-versatile"

    # Verify assignments endpoint
    res_assign = client.get("/api/v1/models/assignments")
    assert res_assign.status_code == 200
    assignments = {a["agent_id"]: a for a in res_assign.json()}
    assert assignments["analyst"]["provider"] == "groq"


def test_strict_local_only_blocks_online_provider(monkeypatch):
    # Set privacy to strict local_only
    client.put("/api/v1/privacy/settings", json={"privacy_mode": "local_only"})

    # Assign Specialist to online provider
    client.post(
        "/api/v1/models/assign-agent",
        json={"agent_id": "specialist", "provider": "openai", "model_name": "gpt-4o-mini"},
    )

    # Attempting to get provider for specialist in local_only mode must fail or block
    from app.providers.base import ProviderAuthError
    with pytest.raises(ProviderAuthError):
        factory_module.get_provider_for_agent("specialist")

    # Reset privacy to hybrid or local_only
    client.put("/api/v1/privacy/settings", json={"privacy_mode": "hybrid"})


def test_independent_agent_conversations(monkeypatch):
    # Mock provider for fast deterministic testing
    monkeypatch.setattr(
        "app.api.routes.chat.get_provider_for_agent",
        lambda aid, db=None: MockLLMProvider(
            model_name=aid,
            response_template=f"Acknowledged by {aid.title()}. Research hypothesis evaluated.",
        ),
    )

    # 1. Create a conversation for Researcher
    res_r = client.post(
        "/api/v1/chat/conversations",
        json={"agent_id": "researcher", "title": "Literature Survey on Quantum Circuits"},
    )
    assert res_r.status_code == 200
    r_conv = res_r.json()
    r_id = r_conv["id"]

    # 2. Create a conversation for Analyst
    res_a = client.post(
        "/api/v1/chat/conversations",
        json={"agent_id": "analyst", "title": "Complexity Analysis of Bell States"},
    )
    assert res_a.status_code == 200
    a_conv = res_a.json()
    a_id = a_conv["id"]

    # 3. Verify Isolation: Listing Researcher conversations must NOT include Analyst's
    r_list = client.get("/api/v1/chat/conversations?agent_id=researcher").json()
    assert any(c["id"] == r_id for c in r_list)
    assert not any(c["id"] == a_id for c in r_list)

    # 4. Send Message to Researcher
    msg_res = client.post(
        f"/api/v1/chat/conversations/{r_id}/messages",
        json={"content": "What are the latest empirical results for surface code error correction?"},
    )
    assert msg_res.status_code == 200
    reply = msg_res.json()
    assert reply["sender"] == "agent"
    assert "Researcher" in reply["content"]

    # 5. Check Conversation Detail has both user and agent message
    detail = client.get(f"/api/v1/chat/conversations/{r_id}").json()
    assert len(detail["messages"]) == 2
    assert detail["messages"][0]["sender"] == "user"
    assert detail["messages"][1]["sender"] == "agent"

    # 6. Verify Analyst's conversation is still empty
    a_detail = client.get(f"/api/v1/chat/conversations/{a_id}").json()
    assert len(a_detail["messages"]) == 0

    # 7. Delete Researcher conversation
    del_res = client.delete(f"/api/v1/chat/conversations/{r_id}")
    assert del_res.status_code == 200

    # Verify Analyst conversation remains intact
    a_detail_after = client.get(f"/api/v1/chat/conversations/{a_id}").json()
    assert a_detail_after["id"] == a_id


def test_active_model_endpoint():
    res = client.get("/api/v1/models/active")
    assert res.status_code == 200
    data = res.json()
    assert "privacy_mode" in data
    assert "provider" in data
    assert "model_name" in data
    assert "display_text" in data
    assert "is_online" in data
    assert "available_local_models" in data


