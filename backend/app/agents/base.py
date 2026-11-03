"""
backend/app/agents/base.py

Resilient Agent Executor with failure detection, circuit breaker integration,
isolated execution boundaries, and exponential backoff retry.
"""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from app.core.resilience import (
    AgentStatus,
    CircuitBreaker,
    FailureCategory,
    RecoveryPolicy,
)
from app.core.response_validator import execute_with_controlled_continuation
from app.providers.base import BaseLLMProvider, ProviderError, LLMResponse


@dataclass
class AgentExecutionResult:
    agent_id: str
    status: AgentStatus
    content: Optional[str] = None
    failure_category: Optional[FailureCategory] = None
    error_message: Optional[str] = None
    retry_count: int = 0
    latency_ms: int = 0
    tokens_used: int = 0
    events: List[Dict[str, Any]] = field(default_factory=list)

    @property
    def is_success(self) -> bool:
        return self.status in (AgentStatus.COMPLETED, AgentStatus.PARTIALLY_COMPLETED) and bool(self.content)


async def execute_agent_with_resilience(
    agent_id: str,
    agent_name: str,
    prompt: str,
    system_prompt: str,
    provider: BaseLLMProvider,
    circuit_breaker: Optional[CircuitBreaker] = None,
    policy: Optional[RecoveryPolicy] = None,
    session_id: str = "default_session",
    temperature: float = 0.7,
    max_tokens: int = 1024,
) -> AgentExecutionResult:
    """
    Executes an agent with full fault isolation:
      - Validates CircuitBreaker before attempting execution
      - Enforces per-attempt timeout
      - Retries transient failures with exponential backoff up to max_retries
      - Catches all exceptions to ensure orchestrator never crashes
      - Generates streaming event trail for the frontend
    """
    if policy is None:
        policy = RecoveryPolicy()

    events: List[Dict[str, Any]] = []

    def emit_event(event_type: str, data: Dict[str, Any]):
        evt = {
            "session_id": session_id,
            "agent_id": agent_id,
            "agent_name": agent_name,
            "event_type": event_type,
            "timestamp": time.time(),
            **data,
        }
        events.append(evt)

    # 1. Check Circuit Breaker
    if circuit_breaker and not circuit_breaker.can_execute():
        emit_event("agent_failed", {
            "failure_category": FailureCategory.CIRCUIT_OPEN.value,
            "message": f"Circuit breaker OPEN for agent '{agent_id}'. Skipping provider request."
        })
        return AgentExecutionResult(
            agent_id=agent_id,
            status=AgentStatus.FAILED,
            failure_category=FailureCategory.CIRCUIT_OPEN,
            error_message="Circuit breaker is OPEN due to repeated failures.",
            events=events,
        )

    emit_event("agent_started", {"prompt_preview": prompt[:80]})
    emit_event("agent_thinking", {})

    retries_left = policy.max_retries if policy.auto_recovery_enabled else 0
    current_attempt = 0
    backoff = policy.initial_backoff_seconds
    start_total_time = time.time()

    last_error_category: Optional[FailureCategory] = None
    last_error_message: Optional[str] = None

    while current_attempt <= retries_left:
        current_attempt += 1
        attempt_start = time.time()

        try:
            # Enforce execution timeout with controlled continuation validation
            async def _generate_caller(p: str, sp: str, mt: int) -> LLMResponse:
                return await asyncio.wait_for(
                    provider.generate(
                        prompt=p,
                        system_prompt=sp,
                        temperature=temperature,
                        max_tokens=mt,
                        timeout_seconds=policy.agent_timeout_seconds,
                    ),
                    timeout=policy.agent_timeout_seconds,
                )

            final_content, is_complete, report, tokens_used = await execute_with_controlled_continuation(
                generate_fn=_generate_caller,
                prompt=prompt,
                system_prompt=system_prompt,
                max_tokens=max_tokens,
                max_continuations=1,
            )

            # Success or Partial Completion
            if circuit_breaker:
                circuit_breaker.record_success()

            final_status = AgentStatus.COMPLETED if is_complete else AgentStatus.PARTIALLY_COMPLETED

            emit_event("agent_completed", {
                "status": final_status.value,
                "is_complete": is_complete,
                "validation_reason": report.reason,
                "tokens_used": tokens_used,
                "latency_ms": int((time.time() - start_total_time) * 1000),
                "retry_count": current_attempt - 1,
            })

            return AgentExecutionResult(
                agent_id=agent_id,
                status=final_status,
                content=final_content,
                retry_count=current_attempt - 1,
                latency_ms=int((time.time() - start_total_time) * 1000),
                tokens_used=tokens_used,
                events=events,
            )

        except asyncio.TimeoutError:
            last_error_category = FailureCategory.TIMEOUT
            last_error_message = f"Agent '{agent_id}' execution timed out after {policy.agent_timeout_seconds}s."
            if circuit_breaker:
                circuit_breaker.record_failure(last_error_category)
            emit_event("agent_timeout", {"attempt": current_attempt, "timeout": policy.agent_timeout_seconds})

        except ProviderError as pe:
            last_error_category = pe.category
            last_error_message = str(pe)
            if circuit_breaker:
                circuit_breaker.record_failure(last_error_category)
            emit_event("agent_failed", {
                "attempt": current_attempt,
                "failure_category": last_error_category.value,
                "message": last_error_message,
                "retryable": pe.retryable,
            })
            # Non-retryable errors break retry loop immediately
            if not pe.retryable:
                break

        except Exception as e:
            last_error_category = FailureCategory.EXECUTION_ERROR
            last_error_message = f"Unexpected agent exception: {str(e)}"
            if circuit_breaker:
                circuit_breaker.record_failure(last_error_category)
            emit_event("agent_failed", {
                "attempt": current_attempt,
                "failure_category": last_error_category.value,
                "message": last_error_message,
                "retryable": True,
            })

        # Retry logic
        if current_attempt <= retries_left:
            emit_event("agent_retry_started", {
                "attempt": current_attempt,
                "max_retries": policy.max_retries,
                "backoff_seconds": backoff,
            })
            await asyncio.sleep(backoff)
            backoff *= policy.backoff_multiplier

    # Exhausted retries or non-retryable failure
    emit_event("agent_recovery_started", {
        "reason": last_error_message,
        "failure_category": last_error_category.value if last_error_category else None,
    })

    return AgentExecutionResult(
        agent_id=agent_id,
        status=AgentStatus.FAILED,
        failure_category=last_error_category or FailureCategory.UNKNOWN,
        error_message=last_error_message or "Agent execution failed.",
        retry_count=current_attempt - 1,
        latency_ms=int((time.time() - start_total_time) * 1000),
        events=events,
    )

