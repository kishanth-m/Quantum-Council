"""
backend/app/orchestrator/state.py

LangGraph state definition for Quantum Council's multi-agent workflow
with fault-tolerant recovery and task redistribution.
"""

from typing import Any, Dict, List, Optional
from typing_extensions import TypedDict


class CouncilState(TypedDict):
    session_id: str
    task: str
    mode: str  # "individual" | "parallel" | "council"
    
    # Active council configuration
    selected_agents: List[str]
    healthy_agents: List[str]
    failed_agents: List[str]
    
    # Agent status tracking: agent_id -> AgentStatus string
    agent_statuses: Dict[str, str]
    
    # Primary agent outputs: agent_id -> text content
    agent_outputs: Dict[str, str]
    
    # Failure records: agent_id -> failure details
    agent_failures: Dict[str, Dict[str, Any]]
    
    # Reassigned task specifications
    reassigned_tasks: List[Dict[str, Any]]
    
    # Substitute outputs: substitute_agent_id -> output for the substituted role
    substitute_outputs: Dict[str, Dict[str, str]]
    
    # Discussion / Debate rounds
    current_round: int
    max_rounds: int
    
    # Real-time event stream
    events: List[Dict[str, Any]]
    
    # Grounded RAG context retrieved from Knowledge Vault
    retrieved_context: Optional[List[Dict[str, Any]]]
    
    # Quality & Resilience assessment
    quality_assessment: Dict[str, Any]
    
    # Final synthesized answer
    final_synthesis: Optional[str]
    
    # Overall execution error (if council aborted completely)
    error: Optional[str]

