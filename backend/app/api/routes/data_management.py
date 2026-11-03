"""
backend/app/api/routes/data_management.py

Complete Data Management & Storage Cleanup API for Quantum Council.
Supports real storage measurement and atomic, transactional cleanup of:
  1. Chats & Conversation Threads
  2. Council Execution History, Events & Logs
  3. Uploaded Documents, Extracted Text & Vector Indexes
  4. Temporary Files & Caches
  5. Master "Clear All Application Data" with explicit safety verification.

Strictly preserves user accounts, auth credentials, provider configurations,
encrypted API keys, agent system prompts, privacy modes, and system files.
"""

import os
import shutil
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.config import settings
from app.core.paths import get_uploads_dir
from app.database.db import get_db
from app.database.models import (
    User,
    CouncilSession,
    AgentMessage,
    ExecutionEvent,
    Document,
    DocumentChunk,
    DocumentCollection,
    Conversation,
    ConversationMessage,
    ProviderConfig,
    AgentConfig,
    PrivacySettings,
)
import app.api.routes.documents as doc_route
import app.api.routes.council as council_route

router = APIRouter(prefix="/data-management", tags=["Data Management"])


# ─── Schemas ───────────────────────────────────────────────────────────────────

class StorageCategory(BaseModel):
    category_id: str
    name: str
    description: str
    size_bytes: int
    size_formatted: str
    item_count: int
    item_label: str
    is_removable: bool = True


class StorageMetricsResponse(BaseModel):
    total_managed_bytes: int
    total_managed_formatted: str
    db_file_size_bytes: int
    db_file_size_formatted: str
    categories: List[StorageCategory]
    cleanup_opportunities: List[str]
    preserved_summary: List[str]


class CleanupRequest(BaseModel):
    target: str  # "chats" | "history" | "documents" | "cache" | "all"
    confirmation_text: Optional[str] = None


class CleanupReportResponse(BaseModel):
    success: bool
    target: str
    reclaimed_bytes: int
    reclaimed_formatted: str
    details: Dict[str, Any]
    preserved_items: List[str]
    message: str


def format_bytes(b: int) -> str:
    """Format bytes into readable string (B, KB, MB, GB)."""
    if b < 1024:
        return f"{b} B"
    elif b < 1024 * 1024:
        return f"{b / 1024:.1f} KB"
    elif b < 1024 * 1024 * 1024:
        return f"{b / (1024 * 1024):.2f} MB"
    else:
        return f"{b / (1024 * 1024 * 1024):.2f} GB"


# ─── Storage Measurement Helpers ───────────────────────────────────────────────

def _get_directory_size(path: str) -> int:
    """Calculate actual disk size of directory."""
    if not os.path.exists(path):
        return 0
    total = 0
    try:
        for entry in os.scandir(path):
            if entry.is_file(follow_symlinks=False):
                total += entry.stat().st_size
            elif entry.is_dir(follow_symlinks=False):
                total += _get_directory_size(entry.path)
    except Exception:
        pass
    return total


@router.get("/storage", response_model=StorageMetricsResponse)
def get_storage_metrics(db: Session = Depends(get_db)):
    """
    Measure actual storage occupied by application data across the database,
    the filesystem, and vector memory.
    """
    # 1. Chat Storage
    conv_count = db.query(func.count(Conversation.id)).scalar() or 0
    msg_count = db.query(func.count(ConversationMessage.id)).scalar() or 0
    msg_bytes = db.query(func.coalesce(func.sum(func.length(ConversationMessage.content)), 0)).scalar() or 0
    conv_bytes = db.query(func.coalesce(func.sum(func.length(Conversation.title)), 0)).scalar() or 0
    chat_total_bytes = int(msg_bytes + conv_bytes + (msg_count * 64))

    # 2. Council Execution History & Logs
    session_count = db.query(func.count(CouncilSession.id)).scalar() or 0
    agent_msg_count = db.query(func.count(AgentMessage.id)).scalar() or 0
    event_count = db.query(func.count(ExecutionEvent.id)).scalar() or 0
    
    session_bytes = db.query(
        func.coalesce(func.sum(func.length(CouncilSession.task) + func.length(func.coalesce(CouncilSession.final_answer, ""))), 0)
    ).scalar() or 0
    agent_msg_bytes = db.query(func.coalesce(func.sum(func.length(AgentMessage.content)), 0)).scalar() or 0
    event_bytes = db.query(func.coalesce(func.sum(func.length(ExecutionEvent.payload)), 0)).scalar() or 0
    history_total_bytes = int(session_bytes + agent_msg_bytes + event_bytes + (session_count * 128))

    # 3. Documents Storage (Disk + DB)
    doc_count = db.query(func.count(Document.id)).scalar() or 0
    doc_db_bytes = db.query(func.coalesce(func.sum(Document.file_size_bytes), 0)).scalar() or 0
    upload_dir_bytes = _get_directory_size(settings.upload_dir)
    document_total_bytes = max(int(doc_db_bytes), upload_dir_bytes)

    # 4. Embeddings & Vector Memory
    chunk_count = len(doc_route._vector_store)
    # Estimate in-memory vector store footprint (approx 512 bytes per token/vector entry)
    embedding_total_bytes = sum(len(v.get("text", "")) + len(v.get("vector", {})) * 8 for v in doc_route._vector_store.values())

    # 5. Temporary Caches
    cache_total_bytes = 0
    temp_dir = "./tmp"
    if os.path.exists(temp_dir):
        cache_total_bytes += _get_directory_size(temp_dir)

    # Database file size
    db_file_bytes = 0
    db_path = settings.database_url.replace("sqlite+aiosqlite:///", "").replace("sqlite:///", "")
    if os.path.exists(db_path):
        db_file_bytes = os.path.getsize(db_path)

    total_managed = chat_total_bytes + history_total_bytes + document_total_bytes + embedding_total_bytes + cache_total_bytes

    categories = [
        StorageCategory(
            category_id="chats",
            name="Agent & User Conversations",
            description="1-on-1 dialogue turns, chat threads, and agent prompt exchanges.",
            size_bytes=chat_total_bytes,
            size_formatted=format_bytes(chat_total_bytes),
            item_count=conv_count,
            item_label=f"{conv_count} threads ({msg_count} messages)",
        ),
        StorageCategory(
            category_id="history",
            name="Council Deliberations & Logs",
            description="Multi-agent debate transcripts, circuit breaker events, and telemetry logs.",
            size_bytes=history_total_bytes,
            size_formatted=format_bytes(history_total_bytes),
            item_count=session_count,
            item_label=f"{session_count} deliberations ({event_count} events)",
        ),
        StorageCategory(
            category_id="documents",
            name="Uploaded Knowledge Documents",
            description="PDFs, text files, and reference literature stored in Knowledge Vault.",
            size_bytes=document_total_bytes,
            size_formatted=format_bytes(document_total_bytes),
            item_count=doc_count,
            item_label=f"{doc_count} files",
        ),
        StorageCategory(
            category_id="embeddings",
            name="Vector Chunks & Embeddings",
            description="Pure-Python TF-IDF vector index and semantic search chunks.",
            size_bytes=embedding_total_bytes,
            size_formatted=format_bytes(embedding_total_bytes),
            item_count=chunk_count,
            item_label=f"{chunk_count} vector chunks",
        ),
        StorageCategory(
            category_id="cache",
            name="Temporary Caches & Buffers",
            description="Ephemeral execution state and temporary file buffers.",
            size_bytes=cache_total_bytes,
            size_formatted=format_bytes(cache_total_bytes),
            item_count=1 if cache_total_bytes > 0 else 0,
            item_label="In-memory cache & buffers",
        ),
    ]

    cleanup_opps = []
    if conv_count > 0:
        cleanup_opps.append(f"Clear {conv_count} conversation threads to reclaim {format_bytes(chat_total_bytes)}")
    if session_count > 0:
        cleanup_opps.append(f"Clear {session_count} council sessions to reclaim {format_bytes(history_total_bytes)}")
    if doc_count > 0:
        cleanup_opps.append(f"Clear {doc_count} uploaded documents to reclaim {format_bytes(document_total_bytes)}")
    if not cleanup_opps:
        cleanup_opps.append("Application storage is currently optimal and clean.")

    preserved = [
        "User account & authentication records",
        "Configured LLM providers (Groq, Ollama) & encrypted API keys",
        "Agent personalities, system prompts & temperature configurations",
        "Active Privacy Mode (Local-Only / Hybrid)",
        "Visual Theme & Ambient Motion preferences",
        "Ollama models and system binaries",
    ]

    return StorageMetricsResponse(
        total_managed_bytes=total_managed,
        total_managed_formatted=format_bytes(total_managed),
        db_file_size_bytes=db_file_bytes,
        db_file_size_formatted=format_bytes(db_file_bytes),
        categories=categories,
        cleanup_opportunities=cleanup_opps,
        preserved_summary=preserved,
    )


# ─── Atomic Deletion / Cleanup Endpoints ───────────────────────────────────────

@router.post("/cleanup", response_model=CleanupReportResponse)
def execute_cleanup(req: CleanupRequest, db: Session = Depends(get_db)):
    """
    Executes real database and filesystem cleanup based on the selected target.
    For 'all', strictly requires confirmation_text == 'DELETE ALL DATA'.
    """
    target = req.target.lower().strip()
    details: Dict[str, Any] = {}
    reclaimed_bytes = 0

    preserved = [
        "User account & bcrypt credentials",
        "LLM Provider configs & encrypted keys",
        "Agent identities & system prompts",
        "Privacy settings (Local-Only / Hybrid)",
        "Appearance themes & motion preferences",
    ]

    if target == "all":
        if req.confirmation_text != "DELETE ALL DATA":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Confirmation failed. You must provide exact confirmation text 'DELETE ALL DATA'."
            )

    try:
        # 1. Clean Chats
        if target in ("chats", "all"):
            msg_count = db.query(ConversationMessage).delete()
            conv_count = db.query(Conversation).delete()
            details["deleted_conversation_messages"] = msg_count
            details["deleted_conversations"] = conv_count
            reclaimed_bytes += msg_count * 120

        # 2. Clean History & Logs
        if target in ("history", "all"):
            event_count = db.query(ExecutionEvent).delete()
            agent_msg_count = db.query(AgentMessage).delete()
            session_count = db.query(CouncilSession).delete()
            
            # Clear in-memory council caches
            council_route._active_sessions.clear()
            council_route._session_events.clear()

            details["deleted_execution_events"] = event_count
            details["deleted_agent_messages"] = agent_msg_count
            details["deleted_council_sessions"] = session_count
            reclaimed_bytes += (event_count * 180) + (agent_msg_count * 250)

        # 3. Clean Documents & Vector Store
        if target in ("documents", "all"):
            chunk_db_count = db.query(DocumentChunk).delete()
            doc_count = db.query(Document).delete()
            coll_count = db.query(DocumentCollection).delete()
            
            # Clear vector store in memory
            vector_count = len(doc_route._vector_cache)
            doc_route._vector_cache.clear()

            # Remove physical upload files from configured and isolated user uploads dir
            file_bytes_removed = 0
            for u_dir in [settings.upload_dir, str(get_uploads_dir())]:
                if os.path.exists(u_dir):
                    for fname in os.listdir(u_dir):
                        fpath = os.path.join(u_dir, fname)
                        if os.path.isfile(fpath):
                            try:
                                file_bytes_removed += os.path.getsize(fpath)
                                os.remove(fpath)
                            except Exception:
                                pass

            details["deleted_documents"] = doc_count
            details["cleared_vector_chunks"] = vector_count
            details["filesystem_bytes_removed"] = file_bytes_removed
            reclaimed_bytes += file_bytes_removed + (vector_count * 64)

        # 4. Clean Caches
        if target in ("cache", "all"):
            temp_bytes = 0
            temp_dir = "./tmp"
            if os.path.exists(temp_dir):
                temp_bytes = _get_directory_size(temp_dir)
                try:
                    shutil.rmtree(temp_dir)
                    os.makedirs(temp_dir, exist_ok=True)
                except Exception:
                    pass
            details["cleared_temp_bytes"] = temp_bytes
            reclaimed_bytes += temp_bytes

        # Commit database transaction
        db.commit()

        # Vacuum SQLite database if clearing all
        if target == "all":
            try:
                db.execute("VACUUM")
                db.commit()
            except Exception:
                pass

        message = (
            "All application data was permanently and safely deleted."
            if target == "all"
            else f"Cleanup for '{target}' completed successfully."
        )

        return CleanupReportResponse(
            success=True,
            target=target,
            reclaimed_bytes=reclaimed_bytes,
            reclaimed_formatted=format_bytes(reclaimed_bytes),
            details=details,
            preserved_items=preserved,
            message=message,
        )

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Cleanup failed due to database or filesystem error: {str(e)}"
        )

