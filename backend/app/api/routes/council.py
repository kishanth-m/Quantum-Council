"""
backend/app/api/routes/council.py

Endpoints for orchestrating multi-agent Council deliberations:
  - Resilience Configuration GET/PUT
  - Session execution with dynamic failure recovery & genuine cross-agent debate
  - Real-time Server-Sent Event (SSE) streaming
  - Session cancellation and terminal state management
"""

import asyncio
from datetime import datetime, timezone
import json
from typing import Any, Dict, List, Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.core.provider_factory import get_provider_for_agent as central_get_provider
from app.core.resilience import RecoveryPolicy
from app.database.db import get_db
from app.database.models import CouncilSession, AgentMessage, ExecutionEvent, User
from app.security.authorization import get_session_user
from app.core.schemas import (
    CouncilSessionDetailResponse,
    ResilienceConfigSchema,
    ResilienceConfigUpdateSchema,
    StartSessionRequest,
)
from app.orchestrator.recovery_graph import ResilientCouncilGraph, create_initial_state
from app.providers.base import BaseLLMProvider

router = APIRouter(prefix="/council", tags=["Council"])

# In-memory session store & event streams for live execution
_active_sessions: Dict[str, Dict[str, Any]] = {}
_session_events: Dict[str, List[Dict[str, Any]]] = {}
_session_queues: Dict[str, asyncio.Queue] = {}

# System-wide active recovery policy
_global_policy = RecoveryPolicy(
    auto_recovery_enabled=True,
    max_retries=2,
    agent_timeout_seconds=30.0,
    allow_role_substitution=True,
    min_healthy_agents=1,
    allow_partial_completion=True,
)


def get_provider_for_agent(agent_id: str) -> BaseLLMProvider:
    """
    Provider factory: delegates to central_get_provider,
    resolving configured local Ollama or online providers per agent.
    """
    return central_get_provider(agent_id)


@router.get("/resilience/config", response_model=ResilienceConfigSchema)
async def get_resilience_config():
    """Returns the current resilience and recovery configuration."""
    return ResilienceConfigSchema(
        auto_recovery_enabled=_global_policy.auto_recovery_enabled,
        max_retries=_global_policy.max_retries,
        agent_timeout_seconds=_global_policy.agent_timeout_seconds,
        allow_role_substitution=_global_policy.allow_role_substitution,
        min_healthy_agents=_global_policy.min_healthy_agents,
        allow_partial_completion=_global_policy.allow_partial_completion,
    )


@router.put("/resilience/config", response_model=ResilienceConfigSchema)
async def update_resilience_config(update: ResilienceConfigUpdateSchema):
    """Updates resilience and recovery configuration parameters."""
    if update.auto_recovery_enabled is not None:
        _global_policy.auto_recovery_enabled = update.auto_recovery_enabled
    if update.max_retries is not None:
        _global_policy.max_retries = update.max_retries
    if update.agent_timeout_seconds is not None:
        _global_policy.agent_timeout_seconds = update.agent_timeout_seconds
    if update.allow_role_substitution is not None:
        _global_policy.allow_role_substitution = update.allow_role_substitution
    if update.min_healthy_agents is not None:
        _global_policy.min_healthy_agents = update.min_healthy_agents
    if update.allow_partial_completion is not None:
        _global_policy.allow_partial_completion = update.allow_partial_completion

    return await get_resilience_config()


@router.post("/session", response_model=CouncilSessionDetailResponse)
async def start_council_session(
    req: StartSessionRequest,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_session_user),
):
    """
    Starts a new Council session using the fault-tolerant LangGraph workflow.
    Publishes live events to in-memory queues and persists to database upon completion.
    """
    user_id = current_user.id if hasattr(current_user, "id") else "default_user"
    import time
    start_perf = time.perf_counter()
    session_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    # Create real-time streaming queue for SSE listeners
    queue: asyncio.Queue = asyncio.Queue()
    _session_queues[session_id] = queue

    # Determine participating agents
    if req.mode == "individual" and req.agent_id:
        selected_agents = [req.agent_id]
    else:
        selected_agents = ["researcher", "analyst", "alternative", "critic", "specialist"]

    initial_state = create_initial_state(
        task=req.task,
        session_id=session_id,
        mode=req.mode,
        selected_agents=selected_agents,
        max_rounds=req.max_rounds or 1,
    )

    def on_event(event: Dict[str, Any]):
        try:
            queue.put_nowait(event)
        except Exception:
            pass

    graph = ResilientCouncilGraph(
        provider_factory=get_provider_for_agent,
        policy=_global_policy,
        event_callback=on_event,
    )

    result_state = await graph.run(initial_state)
    elapsed_ms = max(int((time.perf_counter() - start_perf) * 1000), 10)

    # Determine terminal state
    if result_state.get("status") == "CANCELLED":
        terminal_status = "CANCELLED"
    elif result_state.get("status") == "TIMED_OUT":
        terminal_status = "TIMED_OUT"
    elif result_state.get("status") == "FAILED" or result_state.get("error"):
        terminal_status = "FAILED"
    elif result_state.get("quality_assessment", {}).get("is_degraded"):
        terminal_status = "PARTIALLY_COMPLETED"
    else:
        terminal_status = "COMPLETED"

    session_record = {
        "id": session_id,
        "task": req.task,
        "mode": req.mode,
        "status": terminal_status.lower(),
        "healthy_agents": result_state.get("healthy_agents", []),
        "failed_agents": result_state.get("failed_agents", []),
        "agent_statuses": result_state.get("agent_statuses", {}),
        "agent_outputs": result_state.get("agent_outputs", {}),
        "agent_failures": result_state.get("agent_failures", {}),
        "reassigned_tasks": result_state.get("reassigned_tasks", []),
        "substitute_outputs": result_state.get("substitute_outputs", {}),
        "quality_assessment": result_state.get("quality_assessment", {}),
        "final_synthesis": result_state.get("final_synthesis"),
        "error": result_state.get("error"),
        "created_at": now,
        "completed_at": datetime.now(timezone.utc),
    }

    _active_sessions[session_id] = session_record
    _session_events[session_id] = result_state.get("events", [])

    # Put sentinel into queue
    queue.put_nowait({"event_type": "stream_end", "session_id": session_id, "status": terminal_status})

    # Persist session to SQLite database if a real db session is available
    if db is not None and hasattr(db, "add"):
        try:
            db_session = CouncilSession(
                id=session_id,
                user_id=user_id,
                title=req.task[:64] + ("..." if len(req.task) > 64 else ""),
                task=req.task,
                mode=req.mode,
                status=terminal_status,
                created_at=now,
                completed_at=session_record["completed_at"],
                final_answer=result_state.get("final_synthesis"),
                total_rounds=1,
                total_model_calls=len(selected_agents),
                execution_time_ms=elapsed_ms,
            )
            db.add(db_session)

            # Persist individual agent messages including debate rebuttals
            for agent_id, output in (result_state.get("agent_outputs") or {}).items():
                clean_aid = agent_id.replace("_debate_rebuttal", "")
                msg = AgentMessage(
                    session_id=session_id,
                    agent_id=clean_aid,
                    agent_name=clean_aid.title() if "_debate_rebuttal" not in agent_id else f"{clean_aid.title()} (Debate Response)",
                    content=output,
                    message_type="revision" if "_debate_rebuttal" in agent_id else ("critique" if clean_aid == "critic" else ("counterargument" if clean_aid == "alternative" else "proposal")),
                    round_number=2 if "_debate_rebuttal" in agent_id else 1,
                    model_id=settings.ollama_default_model,
                    created_at=datetime.now(timezone.utc),
                )
                db.add(msg)

            # Persist execution events for telemetry and replay
            for ev in result_state.get("events", []):
                payload_str = json.dumps(ev.get("payload") or ev.get("details") or {})
                exec_ev = ExecutionEvent(
                    session_id=session_id,
                    event_type=str(ev.get("event_type", "activity")),
                    agent_id=ev.get("agent_id"),
                    payload=payload_str,
                    created_at=datetime.now(timezone.utc),
                )
                db.add(exec_ev)

            db.commit()
        except Exception:
            db.rollback()

    return CouncilSessionDetailResponse(**session_record)


@router.post("/session/stream")
async def stream_council_execution(
    req: StartSessionRequest,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_session_user),
):
    """
    Direct SSE streaming endpoint: executes the Council workflow and streams events
    in real time as agents think, speak, debate, critique, and synthesize.
    """
    user_id = current_user.id if hasattr(current_user, "id") else "default_user"
    import time
    session_id = str(uuid.uuid4())
    queue: asyncio.Queue = asyncio.Queue()
    _session_queues[session_id] = queue

    # Run execution in an async background task feeding the queue
    async def run_workflow():
        now = datetime.now(timezone.utc)
        start_perf = time.perf_counter()

        if req.mode == "individual" and req.agent_id:
            selected_agents = [req.agent_id]
        else:
            selected_agents = ["researcher", "analyst", "alternative", "critic", "specialist"]

        initial_state = create_initial_state(
            task=req.task,
            session_id=session_id,
            mode=req.mode,
            selected_agents=selected_agents,
            max_rounds=req.max_rounds or 1,
        )

        def on_event(event: Dict[str, Any]):
            try:
                queue.put_nowait(event)
            except Exception:
                pass

        graph = ResilientCouncilGraph(
            provider_factory=get_provider_for_agent,
            policy=_global_policy,
            event_callback=on_event,
        )

        result_state = await graph.run(initial_state)
        elapsed_ms = max(int((time.perf_counter() - start_perf) * 1000), 10)

        # Determine terminal state
        if result_state.get("status") == "CANCELLED":
            terminal_status = "CANCELLED"
        elif result_state.get("status") == "TIMED_OUT":
            terminal_status = "TIMED_OUT"
        elif result_state.get("status") == "FAILED" or result_state.get("error"):
            terminal_status = "FAILED"
        elif result_state.get("quality_assessment", {}).get("is_degraded"):
            terminal_status = "PARTIALLY_COMPLETED"
        else:
            terminal_status = "COMPLETED"

        session_record = {
            "id": session_id,
            "task": req.task,
            "mode": req.mode,
            "status": terminal_status.lower(),
            "healthy_agents": result_state.get("healthy_agents", []),
            "failed_agents": result_state.get("failed_agents", []),
            "agent_statuses": result_state.get("agent_statuses", {}),
            "agent_outputs": result_state.get("agent_outputs", {}),
            "agent_failures": result_state.get("agent_failures", {}),
            "reassigned_tasks": result_state.get("reassigned_tasks", []),
            "substitute_outputs": result_state.get("substitute_outputs", {}),
            "quality_assessment": result_state.get("quality_assessment", {}),
            "final_synthesis": result_state.get("final_synthesis"),
            "error": result_state.get("error"),
            "created_at": now.isoformat(),
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }

        _active_sessions[session_id] = session_record
        _session_events[session_id] = result_state.get("events", [])

        # Persist session and messages into SQLite database for history preservation
        from app.database.db import SessionLocal
        db_session = SessionLocal()
        try:
            council_session = CouncilSession(
                id=session_id,
                user_id=user_id,
                title=req.task[:64] + ("..." if len(req.task) > 64 else ""),
                task=req.task,
                mode=req.mode,
                status=terminal_status.lower(),
                created_at=now,
                completed_at=datetime.now(timezone.utc),
                final_answer=result_state.get("final_synthesis"),
                total_rounds=result_state.get("round_number", 1),
                total_model_calls=len(result_state.get("agent_outputs", {})),
                total_tokens=0,
                execution_time_ms=elapsed_ms,
            )
            db_session.add(council_session)

            for agent_id, content in result_state.get("agent_outputs", {}).items():
                clean_aid = agent_id.replace("_debate_rebuttal", "")
                agent_name = AGENT_IDENTITIES.get(clean_aid, {}).get("name", clean_aid.capitalize())
                if "_debate_rebuttal" in agent_id:
                    agent_name = f"{agent_name} (Debate Response)"

                msg = AgentMessage(
                    id=str(uuid.uuid4()),
                    session_id=session_id,
                    agent_id=clean_aid,
                    agent_name=agent_name,
                    content=content,
                    message_type="revision" if "_debate_rebuttal" in agent_id else ("critique" if clean_aid == "critic" else ("counterargument" if clean_aid == "alternative" else "proposal")),
                    round_number=2 if "_debate_rebuttal" in agent_id else 1,
                    model_id=settings.ollama_default_model,
                    created_at=datetime.now(timezone.utc),
                )
                db_session.add(msg)

            for ev in result_state.get("events", []):
                payload_str = json.dumps(ev.get("payload") or ev.get("details") or {}, default=str)
                exec_ev = ExecutionEvent(
                    id=str(uuid.uuid4()),
                    session_id=session_id,
                    event_type=str(ev.get("event_type", "activity")),
                    agent_id=ev.get("agent_id"),
                    payload=payload_str,
                    created_at=datetime.now(timezone.utc),
                )
                db_session.add(exec_ev)

            db_session.commit()
        except Exception:
            db_session.rollback()
        finally:
            db_session.close()

        # Emit final answer ready event
        queue.put_nowait({
            "session_id": session_id,
            "event_type": "final_answer_ready",
            "final_synthesis": result_state.get("final_synthesis"),
            "status": terminal_status,
            "timestamp": time.time(),
        })

        # Emit terminal session event
        queue.put_nowait({
            "session_id": session_id,
            "event_type": "session_completed",
            "status": terminal_status,
            "detail": session_record,
            "final_synthesis": result_state.get("final_synthesis"),
            "timestamp": time.time(),
        })
        queue.put_nowait({"event_type": "stream_end", "session_id": session_id})

    asyncio.create_task(run_workflow())

    async def event_generator():
        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=35.0)
                if event.get("event_type") == "stream_end":
                    break
                payload = json.dumps(event, default=str)
                yield f"event: {event.get('event_type', 'message')}\ndata: {payload}\n\n"
            except asyncio.TimeoutError:
                # Keep-alive heartbeat
                yield ": keepalive\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"}
    )


@router.get("/session/{session_id}", response_model=CouncilSessionDetailResponse)
async def get_session_detail(session_id: str):
    """Fetch status and recovery breakdown for a session."""
    session = _active_sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return CouncilSessionDetailResponse(**session)


@router.get("/session/{session_id}/events")
async def stream_session_events(session_id: str):
    """
    Streams Server-Sent Events (SSE) of live agent execution, retries,
    failures, task reassignments, and final synthesis.
    """
    queue = _session_queues.get(session_id)

    async def live_generator():
        if queue:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30.0)
                    if event.get("event_type") == "stream_end":
                        break
                    payload = json.dumps(event)
                    yield f"event: {event.get('event_type', 'message')}\ndata: {payload}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        else:
            # Fallback replay from history
            events = _session_events.get(session_id, [])
            for event in events:
                payload = json.dumps(event)
                yield f"event: {event.get('event_type', 'message')}\ndata: {payload}\n\n"

    return StreamingResponse(
        live_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"}
    )


@router.post("/session/{session_id}/cancel")
async def cancel_council_session(session_id: str):
    """Cancel an active council deliberation and mark session cancelled."""
    import time
    if session_id in _active_sessions:
        _active_sessions[session_id]["status"] = "CANCELLED"
        _active_sessions[session_id]["error"] = "Deliberation cancelled by user."

    cancel_evt = {
        "session_id": session_id,
        "event_type": "council_cancelled",
        "status": "CANCELLED",
        "message": "Deliberation cancelled by user.",
        "timestamp": time.time(),
    }

    if session_id in _session_events:
        _session_events[session_id].append(cancel_evt)

    queue = _session_queues.get(session_id)
    if queue:
        queue.put_nowait(cancel_evt)
        queue.put_nowait({"event_type": "stream_end", "session_id": session_id})

    return {"status": "CANCELLED", "session_id": session_id}
