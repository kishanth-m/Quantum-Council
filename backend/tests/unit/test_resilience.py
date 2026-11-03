"""
backend/tests/unit/test_resilience.py

Unit tests for Agent Resilience & Adaptive Task Recovery System primitives:
  - AgentStatus and FailureCategory enums
  - CircuitBreaker states and cooldowns
  - TaskRedistributionEngine and substitute selection
  - Task reassignment prompts
"""

import time
import pytest
from app.core.resilience import (
    AgentStatus,
    CircuitBreaker,
    CircuitState,
    FailureCategory,
    RecoveryPolicy,
    AgentTask,
    TaskRedistributionEngine,
    AGENT_SUITABILITY_MATRIX,
)


def test_agent_statuses():
    """Verify all required agent resilience statuses are defined."""
    required = [
        "IDLE", "QUEUED", "RUNNING", "THINKING", "COMPLETED",
        "FAILED", "TIMED_OUT", "RETRYING", "RECOVERING", "REASSIGNED",
        "CANCELLED", "DEGRADED"
    ]
    for r in required:
        assert getattr(AgentStatus, r).value == r


def test_circuit_breaker_initial_state():
    cb = CircuitBreaker()
    assert cb.state == CircuitState.CLOSED
    assert cb.can_execute() is True


def test_circuit_breaker_opens_after_threshold():
    cb = CircuitBreaker(failure_threshold=3, cooldown_seconds=10.0)
    cb.record_failure(FailureCategory.TIMEOUT)
    assert cb.state == CircuitState.CLOSED
    assert cb.can_execute() is True

    cb.record_failure(FailureCategory.TIMEOUT)
    assert cb.state == CircuitState.CLOSED

    cb.record_failure(FailureCategory.TIMEOUT)
    assert cb.state == CircuitState.OPEN
    assert cb.can_execute() is False


def test_circuit_breaker_immediate_open_on_permanent_error():
    cb = CircuitBreaker(failure_threshold=5)
    # Auth errors and model not found are non-transient
    cb.record_failure(FailureCategory.AUTH_ERROR)
    assert cb.state == CircuitState.OPEN
    assert cb.can_execute() is False


def test_circuit_breaker_half_open_recovery():
    cb = CircuitBreaker(failure_threshold=1, cooldown_seconds=0.1)
    cb.record_failure(FailureCategory.EXECUTION_ERROR)
    assert cb.state == CircuitState.OPEN
    assert cb.can_execute() is False

    # Wait past cooldown
    time.sleep(0.15)
    # can_execute triggers transition to HALF_OPEN
    assert cb.can_execute() is True
    assert cb.state == CircuitState.HALF_OPEN

    # A success resets circuit to CLOSED
    cb.record_success()
    assert cb.state == CircuitState.CLOSED
    assert cb.can_execute() is True


def test_redistribution_find_substitute_priority():
    # If researcher fails and analyst is healthy, analyst should be selected
    sub = TaskRedistributionEngine.find_best_substitute(
        failed_agent_id="researcher",
        healthy_agent_ids=["analyst", "critic", "specialist"]
    )
    assert sub == "analyst"

    # If analyst is NOT healthy, next best in matrix is specialist
    sub2 = TaskRedistributionEngine.find_best_substitute(
        failed_agent_id="researcher",
        healthy_agent_ids=["critic", "specialist"]
    )
    assert sub2 == "specialist"


def test_redistribution_fallback_when_no_matrix_match():
    # If only an unlisted agent is available, pick that surviving agent
    sub = TaskRedistributionEngine.find_best_substitute(
        failed_agent_id="critic",
        healthy_agent_ids=["specialist"]
    )
    assert sub == "specialist"


def test_redistribution_returns_none_if_all_agents_failed():
    sub = TaskRedistributionEngine.find_best_substitute(
        failed_agent_id="critic",
        healthy_agent_ids=[]
    )
    assert sub is None


def test_build_reassignment_task():
    orig_task = AgentTask(
        task_id="t1",
        original_agent_id="researcher",
        assigned_agent_id="researcher",
        title="Extract Document Facts",
        prompt="Gather empirical evidence from the uploaded report."
    )
    reassigned = TaskRedistributionEngine.build_reassignment_task(orig_task, "analyst")

    assert reassigned.is_reassigned is True
    assert reassigned.original_agent_id == "researcher"
    assert reassigned.assigned_agent_id == "analyst"
    assert "SUBSTITUTION NOTICE" in reassigned.prompt
    assert "RESEARCHER" in reassigned.prompt
    assert "Gather empirical evidence" in reassigned.prompt

