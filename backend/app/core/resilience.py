"""
backend/app/core/resilience.py

Agent Resilience & Adaptive Task Recovery System for Quantum Council.

Provides:
  - AgentStatus and FailureCategory enums
  - CircuitBreaker for unstable LLM providers
  - TaskAssignment and RecoveryReport data structures
  - Suitability matrix for dynamic task redistribution
  - TaskRedistributionEngine for role substitution
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Dict, List, Optional


class AgentStatus(str, Enum):
    IDLE = "IDLE"
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    THINKING = "THINKING"
    COMPLETED = "COMPLETED"
    PARTIALLY_COMPLETED = "PARTIALLY_COMPLETED"
    FAILED = "FAILED"
    TIMED_OUT = "TIMED_OUT"
    RETRYING = "RETRYING"
    RECOVERING = "RECOVERING"
    REASSIGNED = "REASSIGNED"
    CANCELLED = "CANCELLED"
    DEGRADED = "DEGRADED"


class FailureCategory(str, Enum):
    PROVIDER_UNAVAILABLE = "PROVIDER_UNAVAILABLE"
    OLLAMA_DISCONNECTED = "OLLAMA_DISCONNECTED"
    MODEL_NOT_FOUND = "MODEL_NOT_FOUND"
    AUTH_ERROR = "AUTH_ERROR"
    RATE_LIMIT = "RATE_LIMIT"
    TIMEOUT = "TIMEOUT"
    MALFORMED_OUTPUT = "MALFORMED_OUTPUT"
    EMPTY_RESPONSE = "EMPTY_RESPONSE"
    EXECUTION_ERROR = "EXECUTION_ERROR"
    CANCELLED = "CANCELLED"
    CIRCUIT_OPEN = "CIRCUIT_OPEN"
    UNKNOWN = "UNKNOWN"


class CircuitState(str, Enum):
    CLOSED = "CLOSED"      # Normal operation
    OPEN = "OPEN"          # Provider failing repeatedly; fast-fail without calling
    HALF_OPEN = "HALF_OPEN"  # Testing one request to see if provider recovered


@dataclass
class CircuitBreaker:
    """
    Per-provider / per-agent circuit breaker.
    Prevents repeated calls to a known-failing model or provider.
    """
    failure_threshold: int = 3
    cooldown_seconds: float = 30.0
    state: CircuitState = CircuitState.CLOSED
    failure_count: int = 0
    last_failure_time: float = field(default_factory=time.time)
    last_state_change: float = field(default_factory=time.time)

    def record_success(self) -> None:
        """Call on successful invocation to reset failure counts."""
        self.failure_count = 0
        if self.state != CircuitState.CLOSED:
            self.state = CircuitState.CLOSED
            self.last_state_change = time.time()

    def record_failure(self, failure_type: FailureCategory) -> None:
        """Record an error. Permanent errors can open circuit immediately."""
        self.last_failure_time = time.time()
        self.failure_count += 1
        
        # Immediate open for non-retryable critical auth or model missing
        if failure_type in (FailureCategory.AUTH_ERROR, FailureCategory.MODEL_NOT_FOUND):
            self.state = CircuitState.OPEN
            self.last_state_change = time.time()
        elif self.failure_count >= self.failure_threshold:
            self.state = CircuitState.OPEN
            self.last_state_change = time.time()

    def can_execute(self) -> bool:
        """Check if requests are allowed to proceed."""
        if self.state == CircuitState.CLOSED:
            return True
        now = time.time()
        if self.state == CircuitState.OPEN:
            if now - self.last_failure_time >= self.cooldown_seconds:
                # Transition to HALF_OPEN to trial a single request
                self.state = CircuitState.HALF_OPEN
                self.last_state_change = now
                return True
            return False
        if self.state == CircuitState.HALF_OPEN:
            return True
        return False


@dataclass
class RecoveryPolicy:
    """Configurable resilience rules for a council session."""
    auto_recovery_enabled: bool = True
    max_retries: int = 2
    agent_timeout_seconds: float = 30.0
    initial_backoff_seconds: float = 0.5
    backoff_multiplier: float = 2.0
    allow_role_substitution: bool = True
    min_healthy_agents: int = 1
    allow_partial_completion: bool = True


@dataclass
class AgentTask:
    """Represents a specific responsibility assigned to an agent."""
    task_id: str
    original_agent_id: str
    assigned_agent_id: str
    title: str
    prompt: str
    subtasks: List[str] = field(default_factory=list)
    status: AgentStatus = AgentStatus.QUEUED
    retry_count: int = 0
    failure_history: List[Dict[str, Any]] = field(default_factory=list)
    output: Optional[str] = None
    is_reassigned: bool = False
    reassigned_to: Optional[str] = None
    substitution_notes: Optional[str] = None


# Suitability matrix mapping each primary agent to candidate fallback agents
# in order of priority.
AGENT_SUITABILITY_MATRIX: Dict[str, List[str]] = {
    "researcher": ["analyst", "specialist", "critic"],
    "analyst": ["specialist", "alternative", "critic"],
    "alternative": ["analyst", "specialist", "researcher"],
    "critic": ["analyst", "specialist", "researcher"],
    "specialist": ["analyst", "alternative", "researcher"],
}

# Domain adaptation guidance when an agent steps in for another
ROLE_SUBSTITUTION_GUIDANCE: Dict[str, Dict[str, str]] = {
    "researcher": {
        "analyst": "In addition to logical analysis, examine available evidence and extract key findings.",
        "specialist": "In addition to technical assessment, inspect available technical references and data.",
        "critic": "Highlight missing empirical evidence and identify information gaps."
    },
    "analyst": {
        "specialist": "Evaluate logical dependencies and feasibility constraints for the proposed solution.",
        "alternative": "Examine the reasoning structure and identify alternative logical models.",
        "critic": "Analyze structural consistency and flag invalid assumptions."
    },
    "alternative": {
        "analyst": "Propose alternative paradigms and counter-arguments to the baseline approach.",
        "specialist": "Explore non-standard or unconventional technical architectures."
    },
    "critic": {
        "analyst": "Perform an error-detection pass to audit claims, logic flaws, and missing constraints.",
        "specialist": "Scrutinize technical risks, security oversights, and implementation pitfalls."
    },
    "specialist": {
        "analyst": "Assess concrete implementation feasibility and architecture tradeoffs.",
        "alternative": "Suggest concrete technologies or execution blueprints."
    }
}


class TaskRedistributionEngine:
    """
    Analyzes failed agents and dynamically assigns their responsibilities to
    the most suitable healthy surviving agents.
    """

    @classmethod
    def find_best_substitute(
        cls,
        failed_agent_id: str,
        healthy_agent_ids: List[str]
    ) -> Optional[str]:
        """
        Determines the most capable surviving agent for the failed agent's role.
        """
        candidates = AGENT_SUITABILITY_MATRIX.get(failed_agent_id, [])
        for candidate in candidates:
            if candidate in healthy_agent_ids:
                return candidate
        # If no preferred candidate is healthy, pick any healthy agent
        if healthy_agent_ids:
            return healthy_agent_ids[0]
        return None

    @classmethod
    def build_reassignment_task(
        cls,
        original_task: AgentTask,
        substitute_agent_id: str
    ) -> AgentTask:
        """
        Creates an augmented task for the substitute agent with adapted instructions.
        """
        failed_agent_id = original_task.original_agent_id
        guidance = ROLE_SUBSTITUTION_GUIDANCE.get(failed_agent_id, {}).get(
            substitute_agent_id,
            f"Note: Original agent '{failed_agent_id}' was unavailable. Cover essential responsibilities."
        )

        augmented_prompt = (
            f"[SUBSTITUTION NOTICE: Taking over for {failed_agent_id.upper()}]\n"
            f"{guidance}\n\n"
            f"ORIGINAL OBJECTIVE:\n{original_task.prompt}"
        )

        return AgentTask(
            task_id=f"{original_task.task_id}_sub_{substitute_agent_id}",
            original_agent_id=failed_agent_id,
            assigned_agent_id=substitute_agent_id,
            title=f"{original_task.title} (Reassigned to {substitute_agent_id.capitalize()})",
            prompt=augmented_prompt,
            subtasks=original_task.subtasks,
            status=AgentStatus.QUEUED,
            is_reassigned=True,
            substitution_notes=f"Substituted by {substitute_agent_id} due to {failed_agent_id} failure"
        )
