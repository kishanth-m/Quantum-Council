"""
backend/app/api/routes/chat.py

Endpoints for dedicated, independent 1-on-1 conversations with individual AI agents.
Each agent maintains isolated conversation threads, context history, and distinct model routing.
"""

from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.agents.prompts import AGENT_IDENTITIES
from app.api.routes.documents import retrieve_relevant_chunks
from app.core.provider_factory import get_provider_for_agent
from app.core.response_validator import execute_with_controlled_continuation
from app.database.db import get_db
from app.database.models import AgentConfig, Conversation, ConversationMessage, User
from app.security.authorization import get_current_user_optional

router = APIRouter(prefix="/chat", tags=["Agent Chat"])


# ─── Schemas ───────────────────────────────────────────────────────────────────

class CreateConversationRequest(BaseModel):
    agent_id: str
    title: Optional[str] = None


class RenameConversationRequest(BaseModel):
    title: str


class ConversationSummary(BaseModel):
    id: str
    agent_id: str
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int


class MessageItem(BaseModel):
    id: str
    conversation_id: str
    sender: str  # "user" | "agent"
    content: str
    tokens_used: int
    created_at: datetime


class ConversationDetail(BaseModel):
    id: str
    agent_id: str
    title: str
    created_at: datetime
    updated_at: datetime
    messages: List[MessageItem]


class SendMessageRequest(BaseModel):
    content: str


# ─── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/conversations", response_model=List[ConversationSummary])
def list_conversations(
    agent_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """List conversations scoped to authenticated user or default desktop user."""
    user_id = current_user.id if hasattr(current_user, "id") else "default_user"
    query = db.query(Conversation).filter(Conversation.user_id == user_id)
    if agent_id:
        query = query.filter(Conversation.agent_id == agent_id.lower())
    
    convs = query.order_by(Conversation.updated_at.desc()).all()
    return [
        ConversationSummary(
            id=c.id,
            agent_id=c.agent_id,
            title=c.title,
            created_at=c.created_at,
            updated_at=c.updated_at,
            message_count=len(c.messages),
        )
        for c in convs
    ]


@router.post("/conversations", response_model=ConversationSummary)
def create_conversation(
    req: CreateConversationRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Create a new isolated conversation thread scoped to authenticated user."""
    user_id = current_user.id if hasattr(current_user, "id") else "default_user"
    aid = req.agent_id.lower()
    title = req.title or f"Discussion with {aid.title()}"

    conv = Conversation(
        agent_id=aid,
        user_id=user_id,
        title=title,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)

    return ConversationSummary(
        id=conv.id,
        agent_id=conv.agent_id,
        title=conv.title,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        message_count=0,
    )


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
def get_conversation_detail(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Retrieve an agent's conversation thread with ownership IDOR protection."""
    user_id = current_user.id if hasattr(current_user, "id") else "default_user"
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == user_id,
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    sorted_messages = sorted(conv.messages, key=lambda m: m.created_at)
    return ConversationDetail(
        id=conv.id,
        agent_id=conv.agent_id,
        title=conv.title,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        messages=[
            MessageItem(
                id=m.id,
                conversation_id=m.conversation_id,
                sender=m.sender,
                content=m.content,
                tokens_used=m.tokens_used,
                created_at=m.created_at,
            )
            for m in sorted_messages
        ],
    )


@router.put("/conversations/{conversation_id}", response_model=ConversationSummary)
def rename_conversation(
    conversation_id: str,
    req: RenameConversationRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Rename a conversation thread with ownership IDOR verification."""
    user_id = current_user.id if hasattr(current_user, "id") else "default_user"
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == user_id,
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    conv.title = req.title
    conv.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(conv)

    return ConversationSummary(
        id=conv.id,
        agent_id=conv.agent_id,
        title=conv.title,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        message_count=len(conv.messages),
    )


@router.delete("/conversations/{conversation_id}", response_model=dict)
def delete_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Delete a conversation thread with ownership IDOR protection."""
    user_id = current_user.id if hasattr(current_user, "id") else "default_user"
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == user_id,
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    db.delete(conv)
    db.commit()
    return {"status": "deleted", "id": conversation_id}


@router.post("/conversations/{conversation_id}/messages", response_model=MessageItem)
async def send_agent_message(
    conversation_id: str,
    req: SendMessageRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Send a message to an individual agent in this conversation thread.
    Maintains multi-turn conversation context and executes via the agent's configured model.
    """
    user_id = current_user.id if hasattr(current_user, "id") else "default_user"
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == user_id,
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    user_text = req.content.strip()
    if not user_text:
        raise HTTPException(status_code=400, detail="Message content cannot be empty")

    now = datetime.now(timezone.utc)

    # 1. Save User Message
    user_msg = ConversationMessage(
        conversation_id=conv.id,
        sender="user",
        content=user_text,
        tokens_used=len(user_text.split()) * 2,
        created_at=now,
    )
    db.add(user_msg)

    # If first user message, update title
    if len(conv.messages) == 0:
        conv.title = user_text[:40] + ("..." if len(user_text) > 40 else "")

    conv.updated_at = now
    db.commit()

    # 2. Assemble Multi-Turn Context History & Knowledge Vault RAG Grounding
    prior_messages = sorted(conv.messages, key=lambda m: m.created_at)
    context_lines = []
    for m in prior_messages[-8:]:  # Keep recent context window
        role_label = "User" if m.sender == "user" else conv.agent_id.title()
        context_lines.append(f"{role_label}: {m.content}")

    context_prompt = "\n".join(context_lines)

    # Ground message in Knowledge Vault documents if available
    retrieved_chunks = []
    try:
        retrieved_chunks = retrieve_relevant_chunks(user_text, top_k=4, min_score=0.10, db=db)
    except Exception:
        retrieved_chunks = []

    rag_instruction = ""
    if retrieved_chunks:
        sources = sorted(list(set(f"[Source: {c['filename']}, Page {c['page_number']}]" for c in retrieved_chunks)))
        rag_lines = [
            f"--- [DOCUMENT: {c['filename']} | PAGE: {c['page_number']} | RELEVANCE: {c['similarity']}] ---\n{c['content']}"
            for c in retrieved_chunks
        ]
        rag_instruction = (
            f"\n\n[KNOWLEDGE VAULT RETRIEVED EVIDENCE]:\n"
            f"The following verified excerpts were retrieved from uploaded documents to answer the user query:\n\n"
            + "\n\n".join(rag_lines) +
            f"\n\nGrounding & Verification Rules for {conv.agent_id.title()}:\n"
            f"1. Directly answer the user's inquiry using the retrieved evidence above.\n"
            f"2. Cite verified facts with explicit source tags (e.g., {sources[0] if len(sources)==1 else '[Source: filename, Page X]'}).\n"
            f"3. If the user asks for specific information that is NOT mentioned in these excerpts, state clearly that the uploaded documents do not contain that specific detail.\n"
        )
        context_prompt += rag_instruction

    # 3. Resolve Agent System Prompt
    agent_cfg = db.query(AgentConfig).filter(AgentConfig.agent_id == conv.agent_id).first()
    if agent_cfg and agent_cfg.system_prompt:
        system_prompt = agent_cfg.system_prompt
    else:
        system_prompt = AGENT_IDENTITIES.get(conv.agent_id, {}).get("system_prompt", "You are a helpful AI assistant.")

    # 4. Resolve Configured Provider & Model
    try:
        provider = get_provider_for_agent(conv.agent_id, db=db)
        temperature = agent_cfg.temperature if agent_cfg else 0.7
        max_tokens = agent_cfg.max_tokens if agent_cfg else 1024

        async def _generate_caller(p: str, sp: str, mt: int):
            return await provider.generate(
                prompt=p,
                system_prompt=sp,
                temperature=temperature,
                max_tokens=mt,
                timeout_seconds=30.0,
            )

        agent_content, is_complete, report, tokens_used = await execute_with_controlled_continuation(
            generate_fn=_generate_caller,
            prompt=context_prompt,
            system_prompt=system_prompt,
            max_tokens=max_tokens,
            max_continuations=1,
        )
    except Exception as e:
        agent_content = f"[{conv.agent_id.title()} Error]: {str(e)}"
        tokens_used = 0

    # 5. Save Agent Reply
    agent_msg = ConversationMessage(
        conversation_id=conv.id,
        sender="agent",
        content=agent_content,
        tokens_used=tokens_used,
        created_at=datetime.now(timezone.utc),
    )
    db.add(agent_msg)
    conv.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(agent_msg)

    return MessageItem(
        id=agent_msg.id,
        conversation_id=agent_msg.conversation_id,
        sender=agent_msg.sender,
        content=agent_msg.content,
        tokens_used=agent_msg.tokens_used,
        created_at=agent_msg.created_at,
    )

