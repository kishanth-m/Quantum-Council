"""
backend/app/api/routes/history.py

Session history endpoints.
"""

from typing import Any, List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.database.models import CouncilSession, User
from app.security.authorization import get_session_user

router = APIRouter(prefix="/history", tags=["History"])


class SessionSummary(BaseModel):
    id: str
    title: str
    task: str
    mode: str
    status: str
    created_at: datetime
    execution_time_ms: int
    final_answer: Optional[str] = None


class MessageDetail(BaseModel):
    id: str
    agent_id: str
    agent_name: str
    content: str
    message_type: str
    round_number: int
    created_at: datetime


class SessionDetail(BaseModel):
    id: str
    title: str
    task: str
    mode: str
    status: str
    final_answer: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    execution_time_ms: int
    messages: List[MessageDetail] = []


@router.get("/sessions", response_model=List[SessionSummary])
def get_session_history(
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_session_user),
):
    """Retrieve historical council sessions scoped to user or desktop installation."""
    user_id = current_user.id if hasattr(current_user, "id") else "default_user"
    sessions = (
        db.query(CouncilSession)
        .filter(CouncilSession.user_id == user_id)
        .order_by(CouncilSession.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        SessionSummary(
            id=s.id,
            title=s.title,
            task=s.task,
            mode=s.mode,
            status=s.status,
            created_at=s.created_at,
            execution_time_ms=s.execution_time_ms,
            final_answer=s.final_answer,
        )
        for s in sessions
    ]


@router.get("/sessions/{session_id}", response_model=SessionDetail)
def get_session_detail(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_session_user),
):
    """Retrieve detailed information for a specific council session with IDOR protection."""
    user_id = current_user.id if hasattr(current_user, "id") else "default_user"
    session = db.query(CouncilSession).filter(
        CouncilSession.id == session_id,
        CouncilSession.user_id == user_id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    msgs = [
        MessageDetail(
            id=m.id,
            agent_id=m.agent_id,
            agent_name=m.agent_name,
            content=m.content,
            message_type=m.message_type,
            round_number=m.round_number,
            created_at=m.created_at,
        )
        for m in sorted(session.messages, key=lambda x: x.created_at)
    ]
    
    return SessionDetail(
        id=session.id,
        title=session.title,
        task=session.task,
        mode=session.mode,
        status=session.status,
        final_answer=session.final_answer,
        created_at=session.created_at,
        completed_at=session.completed_at,
        execution_time_ms=session.execution_time_ms,
        messages=msgs,
    )

