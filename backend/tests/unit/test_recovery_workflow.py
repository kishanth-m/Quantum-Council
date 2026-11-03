"""
backend/tests/unit/test_recovery_workflow.py

Comprehensive tests for the LangGraph Fault-Tolerant Multi-Agent Workflow
testing all required resilience scenarios:
  1. All 5 agents healthy
  2. 1 agent transient failure -> succeeds on retry
  3. 1 agent permanent failure -> dynamic task redistribution & role substitution
  4. 2 agents fail -> 3 healthy continue with redistribution
  5. 3 agents fail -> 2 healthy continue
  6. 4 agents fail -> 1 healthy completes essential tasks
  7. All 5 agents fail -> safe abort with clear transparent error
  8. Partial result preservation & honest quality disclosure
"""

import pytest
from app.core.resilience import FailureCategory, RecoveryPolicy
from app.orchestrator.recovery_graph import ResilientCouncilGraph, create_initial_state
from app.providers.mock_provider import MockLLMProvider


@pytest.mark.asyncio
async def test_scenario_all_five_agents_healthy():
    """Scenario 1: All 5 agents execute normally without failures."""
    def provider_factory(agent_id: str):
        return MockLLMProvider(
            model_name=f"model-{agent_id}",
            response_template=f"Findings from {agent_id.upper()}: all systems optimal."
        )

    graph = ResilientCouncilGraph(provider_factory=provider_factory)
    state = create_initial_state(task="Design fault-tolerant system architecture")

    result = await graph.run(state)

    assert result["error"] is None
    assert len(result["healthy_agents"]) == 5
    assert len(result["failed_agents"]) == 0
    assert result["quality_assessment"]["is_degraded"] is False
    assert result["quality_assessment"]["confidence_level"] == "HIGH"
    assert result["final_synthesis"] is not None
    assert "Council Resilience Notice" not in result["final_synthesis"]


@pytest.mark.asyncio
async def test_scenario_one_agent_retry_recovery():
    """Scenario 2: One agent fails transiently once and recovers on retry."""
    def provider_factory(agent_id: str):
        if agent_id == "researcher":
            # 1 transient timeout, succeeds on attempt 2
            return MockLLMProvider(
                model_name="mock-researcher",
                fail_times=1,
                failure_type=FailureCategory.TIMEOUT,
                response_template="Researcher recovered empirical data after retry."
            )
        return MockLLMProvider(model_name=f"model-{agent_id}")

    policy = RecoveryPolicy(max_retries=2, initial_backoff_seconds=0.01)
    graph = ResilientCouncilGraph(provider_factory=provider_factory, policy=policy)
    state = create_initial_state(task="Investigate performance anomalies")

    result = await graph.run(state)

    assert result["error"] is None
    assert len(result["healthy_agents"]) == 5
    assert "researcher" in result["healthy_agents"]
    assert "Researcher recovered" in result["agent_outputs"]["researcher"]
    assert result["quality_assessment"]["is_degraded"] is False


@pytest.mark.asyncio
async def test_scenario_one_agent_permanent_failure_redistributed():
    """
    Scenario 3: Researcher fails permanently (e.g. invalid API key or dead server).
    Analyst is selected as best substitute, takes over evidence analysis.
    Council completes with honest resilience notice.
    """
    def provider_factory(agent_id: str):
        if agent_id == "researcher":
            # Permanent failure
            return MockLLMProvider(
                model_name="dead-researcher-model",
                fail_times=5,
                failure_type=FailureCategory.PROVIDER_UNAVAILABLE,
            )
        return MockLLMProvider(
            model_name=f"model-{agent_id}",
            response_template=f"Detailed response from {agent_id.upper()}."
        )

    policy = RecoveryPolicy(max_retries=1, initial_backoff_seconds=0.01)
    graph = ResilientCouncilGraph(provider_factory=provider_factory, policy=policy)
    state = create_initial_state(task="Audit financial report discrepancies")

    result = await graph.run(state)

    assert result["error"] is None
    assert "researcher" in result["failed_agents"]
    assert len(result["healthy_agents"]) == 4

    # Verify task reassignment to Analyst
    reassigned = result["reassigned_tasks"]
    assert len(reassigned) == 1
    assert reassigned[0]["original_agent_id"] == "researcher"
    assert reassigned[0]["substitute_agent_id"] == "analyst"

    # Verify substitute output exists
    assert "analyst" in result["substitute_outputs"]
    assert "researcher" in result["substitute_outputs"]["analyst"]

    # Verify quality audit & transparent disclosure in final synthesis
    assert result["quality_assessment"]["is_degraded"] is True
    assert "researcher" in result["quality_assessment"]["recovered_roles"]
    assert "Council Resilience Notice" in (result["final_synthesis"] or "")


@pytest.mark.asyncio
async def test_scenario_two_agents_fail():
    """Scenario 4: Researcher and Critic both fail. Analyst and Specialist step in."""
    def provider_factory(agent_id: str):
        if agent_id in ("researcher", "critic"):
            return MockLLMProvider(fail_times=5, failure_type=FailureCategory.AUTH_ERROR)
        return MockLLMProvider(model_name=f"model-{agent_id}")

    policy = RecoveryPolicy(max_retries=0)
    graph = ResilientCouncilGraph(provider_factory=provider_factory, policy=policy)
    state = create_initial_state(task="Review cybersecurity policy")

    result = await graph.run(state)

    assert result["error"] is None
    assert len(result["healthy_agents"]) == 3
    assert set(result["failed_agents"]) == {"researcher", "critic"}
    assert result["quality_assessment"]["is_degraded"] is True
    assert result["final_synthesis"] is not None


@pytest.mark.asyncio
async def test_scenario_three_agents_fail():
    """Scenario 5: 3 agents fail. 2 healthy agents continue collaboration."""
    def provider_factory(agent_id: str):
        if agent_id in ("researcher", "alternative", "critic"):
            return MockLLMProvider(fail_times=5, failure_type=FailureCategory.TIMEOUT)
        return MockLLMProvider(model_name=f"model-{agent_id}")

    policy = RecoveryPolicy(max_retries=0)
    graph = ResilientCouncilGraph(provider_factory=provider_factory, policy=policy)
    state = create_initial_state(task="Analyze system migration")

    result = await graph.run(state)

    assert result["error"] is None
    assert len(result["healthy_agents"]) == 2
    assert set(result["healthy_agents"]) == {"analyst", "specialist"}
    assert result["quality_assessment"]["is_degraded"] is True
    assert result["quality_assessment"]["confidence_level"] == "MEDIUM"


@pytest.mark.asyncio
async def test_scenario_four_agents_fail_one_survivor():
    """Scenario 6: 4 agents fail. The lone survivor completes essential analysis."""
    def provider_factory(agent_id: str):
        if agent_id != "specialist":
            return MockLLMProvider(fail_times=5, failure_type=FailureCategory.PROVIDER_UNAVAILABLE)
        return MockLLMProvider(model_name="specialist-model", response_template="Specialist solo analysis.")

    policy = RecoveryPolicy(max_retries=0)
    graph = ResilientCouncilGraph(provider_factory=provider_factory, policy=policy)
    state = create_initial_state(task="Emergency database recovery")

    result = await graph.run(state)

    assert result["error"] is None
    assert result["healthy_agents"] == ["specialist"]
    assert len(result["failed_agents"]) == 4
    assert result["quality_assessment"]["is_degraded"] is True
    assert result["quality_assessment"]["confidence_level"] == "LOW"
    assert "Specialist" in (result["final_synthesis"] or "")


@pytest.mark.asyncio
async def test_scenario_all_five_agents_fail():
    """Scenario 7: All 5 agents fail. Safely aborts without crash or fabrication."""
    def provider_factory(agent_id: str):
        return MockLLMProvider(fail_times=5, failure_type=FailureCategory.OLLAMA_DISCONNECTED)

    policy = RecoveryPolicy(max_retries=0)
    graph = ResilientCouncilGraph(provider_factory=provider_factory, policy=policy)
    state = create_initial_state(task="Analyze paper")

    result = await graph.run(state)

    assert result["error"] is not None
    assert "All five agents failed" in result["error"]
    assert len(result["healthy_agents"]) == 0
    assert len(result["failed_agents"]) == 5
    assert "❌ **Execution Aborted**" in (result["final_synthesis"] or "")
    # Check that abort event was emitted
    event_types = [e["event_type"] for e in result["events"]]
    assert "council_execution_aborted" in event_types

