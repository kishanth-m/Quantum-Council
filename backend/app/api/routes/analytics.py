"""
backend/app/api/routes/analytics.py

Real database-driven analytics and runtime monitoring endpoint.
All metrics are aggregated dynamically from actual SQLite database records.
Never returns hardcoded or fabricated statistics.
"""

from typing import Dict, Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.database.models import (
    CouncilSession,
    AgentMessage,
    Conversation,
    ConversationMessage,
    Document,
    ExecutionEvent,
)

router = APIRouter(prefix="/analytics", tags=["Analytics"])


class AnalyticsSummary(BaseModel):
    total_sessions: int = 0
    successful_sessions: int = 0
    completed_sessions: int = 0
    failed_sessions: int = 0
    total_model_calls: int = 0
    total_tokens_used: int = 0
    average_execution_time_ms: float = 0.0
    avg_latency_ms: float = 0.0
    average_rounds_per_session: float = 0.0
    total_documents_indexed: int = 0
    most_active_agent: Optional[str] = None
    recovery_events_count: int = 0
    recovery_success_rate: float = 100.0
    circuit_breaker_trips: int = 0
    total_conversations: int = 0
    total_messages: int = 0
    agent_activity: Dict[str, int] = {}


@router.get("/summary", response_model=AnalyticsSummary)
def get_analytics_summary(db: Session = Depends(get_db)):
    """
    Retrieve real runtime performance and resilience recovery analytics.
    Aggregated dynamically from SQLite records.
    """
    # 1. Council sessions metrics
    total_sessions = db.query(CouncilSession).count()
    completed_sessions = (
        db.query(CouncilSession)
        .filter(CouncilSession.status == "completed")
        .count()
    )
    failed_sessions = (
        db.query(CouncilSession)
        .filter(CouncilSession.status.in_(["failed", "aborted", "cancelled"]))
        .count()
    )

    # 2. Execution time and tokens
    avg_time_result = (
        db.query(func.avg(CouncilSession.execution_time_ms))
        .filter(CouncilSession.status == "completed", CouncilSession.execution_time_ms > 0)
        .scalar()
    )
    avg_latency = round(float(avg_time_result), 1) if avg_time_result else 0.0

    total_tokens_result = (
        db.query(func.sum(CouncilSession.total_tokens)).scalar()
    )
    total_tokens = int(total_tokens_result) if total_tokens_result else 0

    total_calls_result = (
        db.query(func.sum(CouncilSession.total_model_calls)).scalar()
    )
    total_model_calls = int(total_calls_result) if total_calls_result else 0

    avg_rounds_result = (
        db.query(func.avg(CouncilSession.total_rounds)).scalar()
    )
    avg_rounds = round(float(avg_rounds_result), 1) if avg_rounds_result else 1.0

    # 3. Documents indexed
    doc_count = db.query(Document).filter(Document.status != "deleted").count()

    # 4. Agent messages & activity
    total_agent_msgs = db.query(AgentMessage).count()
    
    agent_msg_counts = (
        db.query(AgentMessage.agent_id, func.count(AgentMessage.id))
        .group_by(AgentMessage.agent_id)
        .all()
    )
    agent_activity = {aid: count for aid, count in agent_msg_counts}
    
    most_active = None
    if agent_activity:
        most_active = max(agent_activity.items(), key=lambda x: x[1])[0]

    # 5. Conversations & messages
    total_convs = db.query(Conversation).count()
    total_conv_msgs = db.query(ConversationMessage).count()
    total_all_msgs = total_agent_msgs + total_conv_msgs

    # 6. Recovery & Circuit Breaker events from ExecutionEvent table
    recovery_events = (
        db.query(ExecutionEvent)
        .filter(ExecutionEvent.event_type.in_([
            "task_reassigned",
            "agent_takeover_started",
            "agent_takeover_completed",
            "agent_retry_started",
            "task_reassignment_started",
        ]))
        .count()
    )

    circuit_trips = (
        db.query(ExecutionEvent)
        .filter(ExecutionEvent.event_type.in_([
            "circuit_breaker_opened",
            "circuit_breaker_tripped",
            "agent_failed",
            "agent_timeout",
        ]))
        .count()
    )

    # Compute genuine recovery success rate
    if circuit_trips > 0:
        recovered = (
            db.query(ExecutionEvent)
            .filter(ExecutionEvent.event_type.in_([
                "agent_takeover_completed",
                "recovery_completed",
            ]))
            .count()
        )
        # Avoid division-by-zero, cap between 0.0 and 100.0
        success_rate = round(min(100.0, max(0.0, (recovered / circuit_trips) * 100.0)), 1)
    else:
        success_rate = 100.0 if total_sessions > 0 else 0.0

    return AnalyticsSummary(
        total_sessions=total_sessions,
        successful_sessions=completed_sessions,
        completed_sessions=completed_sessions,
        failed_sessions=failed_sessions,
        total_model_calls=total_model_calls,
        total_tokens_used=total_tokens,
        average_execution_time_ms=avg_latency,
        avg_latency_ms=avg_latency,
        average_rounds_per_session=avg_rounds,
        total_documents_indexed=doc_count,
        most_active_agent=most_active,
        recovery_events_count=recovery_events,
        recovery_success_rate=success_rate,
        circuit_breaker_trips=circuit_trips,
        total_conversations=total_convs,
        total_messages=total_all_msgs,
        agent_activity=agent_activity,
    )
