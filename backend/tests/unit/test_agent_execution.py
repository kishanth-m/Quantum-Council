"""
backend/tests/unit/test_agent_execution.py

Unit tests for resilient agent execution:
  - Success path
  - Transient retry recovery
  - Permanent failure non-retry
  - Timeout enforcement
  - Circuit breaker open fast-fail
"""

import pytest
from app.agents.base import execute_agent_with_resilience
from app.core.resilience import (
    AgentStatus,
    CircuitBreaker,
    CircuitState,
    FailureCategory,
    RecoveryPolicy,
)
from app.providers.mock_provider import MockLLMProvider


@pytest.mark.asyncio
async def test_agent_execution_success():
    provider = MockLLMProvider(response_template="The empirical evidence is verified.")
    res = await execute_agent_with_resilience(
        agent_id="researcher",
        agent_name="Researcher",
        prompt="Analyze data",
        system_prompt="You are researcher",
        provider=provider,
    )
    assert res.is_success is True
    assert res.status == AgentStatus.COMPLETED
    assert "empirical evidence" in (res.content or "")
    assert res.retry_count == 0
    event_types = [e["event_type"] for e in res.events]
    assert "agent_started" in event_types
    assert "agent_completed" in event_types


@pytest.mark.asyncio
async def test_agent_execution_transient_retry_success():
    # Fails 1 time then succeeds on retry 1
    provider = MockLLMProvider(fail_times=1, failure_type=FailureCategory.PROVIDER_UNAVAILABLE)
    policy = RecoveryPolicy(max_retries=2, initial_backoff_seconds=0.01)

    res = await execute_agent_with_resilience(
        agent_id="analyst",
        agent_name="Analyst",
        prompt="Decompose problem",
        system_prompt="You are analyst",
        provider=provider,
        policy=policy,
    )
    assert res.is_success is True
    assert res.status == AgentStatus.COMPLETED
    assert res.retry_count == 1
    event_types = [e["event_type"] for e in res.events]
    assert "agent_retry_started" in event_types
    assert "agent_completed" in event_types


@pytest.mark.asyncio
async def test_agent_execution_permanent_auth_failure_no_retries():
    # Non-retryable error (AuthError)
    provider = MockLLMProvider(fail_times=5, failure_type=FailureCategory.AUTH_ERROR)
    policy = RecoveryPolicy(max_retries=3, initial_backoff_seconds=0.01)

    res = await execute_agent_with_resilience(
        agent_id="critic",
        agent_name="Critic",
        prompt="Review proposal",
        system_prompt="You are critic",
        provider=provider,
        policy=policy,
    )
    assert res.is_success is False
    assert res.status == AgentStatus.FAILED
    assert res.failure_category == FailureCategory.AUTH_ERROR
    # Non-retryable should stop on attempt 1 (0 retries)
    assert res.retry_count == 0


@pytest.mark.asyncio
async def test_agent_execution_timeout_enforcement():
    # Simulate a provider that takes 0.5s when timeout is 0.1s
    provider = MockLLMProvider(simulated_delay=0.5)
    policy = RecoveryPolicy(max_retries=0, agent_timeout_seconds=0.1)

    res = await execute_agent_with_resilience(
        agent_id="specialist",
        agent_name="Specialist",
        prompt="Provide technical architecture",
        system_prompt="You are specialist",
        provider=provider,
        policy=policy,
    )
    assert res.is_success is False
    assert res.status == AgentStatus.FAILED
    assert res.failure_category == FailureCategory.TIMEOUT
    event_types = [e["event_type"] for e in res.events]
    assert "agent_timeout" in event_types


@pytest.mark.asyncio
async def test_agent_execution_circuit_breaker_open():
    cb = CircuitBreaker(state=CircuitState.OPEN)
    provider = MockLLMProvider()

    res = await execute_agent_with_resilience(
        agent_id="alternative",
        agent_name="Alternative Thinker",
        prompt="Propose creative alternative",
        system_prompt="You are alternative",
        provider=provider,
        circuit_breaker=cb,
    )
    assert res.is_success is False
    assert res.failure_category == FailureCategory.CIRCUIT_OPEN
    assert provider.call_count == 0  # Fast-failed without calling provider

