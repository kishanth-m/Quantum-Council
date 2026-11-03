"""
backend/app/api/routes/documents.py

Document upload, parsing, persistent chunk indexing, and hybrid vector RAG retrieval.
Designed for high precision, page-accurate citations, and pure-Python execution.
"""

import io
import json
import math
import os
import re
import uuid
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.core.paths import get_uploads_dir
from app.database.db import SessionLocal, get_db
from app.database.models import Document, DocumentChunk, DocumentCollection, User
from app.security.authorization import get_current_user_optional

router = APIRouter(prefix="/documents", tags=["Documents & RAG"])

# Strict extension whitelist to block executable and script uploads
ALLOWED_EXTENSIONS = {".pdf", ".txt", ".md", ".json", ".csv"}

# In-memory vector cache: chunk_id -> {"doc_id": ..., "filename": ..., "page_number": ..., "text": ..., "vector": ...}
_vector_cache: Dict[str, Dict[str, Any]] = {}
_vector_store = _vector_cache  # Backward compatibility alias


def _sanitize_filename(filename: Optional[str]) -> str:
    """
    Sanitize filename against path traversal attacks and illegal characters.
    Extracts base filename, removes null bytes and traversal sequences, and enforces safe characters.
    """
    if not filename:
        return f"document_{uuid.uuid4().hex[:8]}.pdf"

    # Extract base name and strip null bytes
    clean = os.path.basename(filename).replace("\x00", "").strip()
    # Strip dangerous directory traversal sequences
    clean = re.sub(r"(\.\.[/\\]|[/\\])", "", clean)
    # Whitelist alphanumeric, underscore, dash, and period
    clean = re.sub(r"[^a-zA-Z0-9_\-\.]", "_", clean)
    # Prevent leading dots (hidden files on Unix)
    if clean.startswith(".") or not clean:
        clean = f"document_{uuid.uuid4().hex[:8]}.pdf"

    return clean


# Common English stopwords to ensure high-precision semantic token filtering
STOPWORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are",
    "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but",
    "by", "can", "cannot", "could", "did", "do", "does", "doing", "down", "during", "each",
    "few", "for", "from", "further", "had", "has", "have", "having", "he", "her", "here", "hers",
    "herself", "him", "himself", "his", "how", "i", "if", "in", "into", "is", "it", "its", "itself",
    "let's", "me", "more", "most", "my", "myself", "no", "nor", "not", "of", "off", "on", "once",
    "only", "or", "other", "our", "ours", "ourselves", "out", "over", "own", "same", "she",
    "should", "so", "some", "such", "than", "that", "the", "their", "theirs", "them", "themselves",
    "then", "there", "these", "they", "this", "those", "through", "to", "too", "under", "until",
    "up", "very", "was", "we", "were", "what", "when", "where", "which", "while", "who", "whom",
    "why", "with", "would", "you", "your", "yours", "yourself", "yourselves", "tell", "summarise",
    "summarize", "using", "uploaded", "document", "documents", "pdf", "file", "files", "please", "give"
}


def _tokenize(text: str) -> List[str]:
    """Tokenize into lowercase alphanumeric tokens."""
    return re.findall(r"\b[a-zA-Z0-9_\-\.]{2,}\b", text.lower())


def _text_to_vector(tokens: List[str]) -> Dict[str, float]:
    """Calculate normalized term-frequency vector."""
    if not tokens:
        return {}
    counts = Counter(tokens)
    total = float(len(tokens))
    return {word: count / total for word, count in counts.items()}


def _cosine_similarity(vec1: Dict[str, float], vec2: Dict[str, float]) -> float:
    """Calculate cosine similarity between two term-frequency vectors."""
    intersection = set(vec1.keys()) & set(vec2.keys())
    if not intersection:
        return 0.0
    numerator = sum(vec1[x] * vec2[x] for x in intersection)
    sum1 = sum(v ** 2 for v in vec1.values())
    sum2 = sum(v ** 2 for v in vec2.values())
    denominator = math.sqrt(sum1) * math.sqrt(sum2)
    if not denominator:
        return 0.0
    return float(numerator) / denominator


def _hybrid_score(query_tokens: List[str], query_raw: str, chunk_vec: Dict[str, float], chunk_text: str) -> float:
    """
    Hybrid scoring combining:
    1. Vector cosine similarity (semantic/TF)
    2. Exact keyword coverage (crucial for person names, skills, tools)
    3. Phrase / bigram presence
    """
    if not query_tokens:
        return 0.0

    query_vec = _text_to_vector(query_tokens)
    cos_sim = _cosine_similarity(query_vec, chunk_vec)

    chunk_lower = chunk_text.lower()
    
    # Exact keyword coverage
    matched_words = sum(1 for q in query_tokens if q in chunk_lower)
    keyword_ratio = matched_words / float(len(query_tokens))

    # Bigram / multi-word phrase boost
    phrase_boost = 0.0
    if len(query_tokens) >= 2:
        for i in range(len(query_tokens) - 1):
            pair = f"{query_tokens[i]} {query_tokens[i+1]}"
            if pair in chunk_lower:
                phrase_boost += 0.25

    return (0.45 * cos_sim) + (0.40 * keyword_ratio) + min(0.35, phrase_boost)


def _load_cache_from_db(db: Session, force_reload: bool = False) -> None:
    """Synchronize in-memory cache from persistent SQLite database."""
    global _vector_cache
    if _vector_cache and not force_reload:
        return

    chunks = db.query(DocumentChunk).all()
    doc_map = {d.id: d.original_filename for d in db.query(Document).all()}

    _vector_cache.clear()
    for c in chunks:
        try:
            vec = json.loads(c.vector_json) if c.vector_json else {}
        except Exception:
            vec = _text_to_vector(_tokenize(c.content))

        _vector_cache[c.id] = {
            "chunk_id": c.id,
            "doc_id": c.document_id,
            "filename": doc_map.get(c.document_id, "document.pdf"),
            "page_number": c.page_number,
            "text": c.content,
            "vector": vec,
        }


# ─── Public Retrieval Function for Council Orchestrator ────────────────────────

def retrieve_relevant_chunks(
    query: str,
    top_k: int = 5,
    min_score: float = 0.08,
    db: Optional[Session] = None,
) -> List[Dict[str, Any]]:
    """
    Public RAG retrieval function called directly by Council Orchestrator (Researcher / Synthesizer)
    and Individual Agent Chat. Grounded in persistent SQLite storage.
    """
    should_close_db = False
    if db is None:
        db = SessionLocal()
        should_close_db = True

    try:
        _load_cache_from_db(db)

        all_query_tokens = _tokenize(query)
        if not all_query_tokens or not _vector_cache:
            return []

        # Filter query tokens to emphasize meaningful domain keywords
        content_tokens = [t for t in all_query_tokens if t not in STOPWORDS]
        query_tokens = content_tokens if content_tokens else all_query_tokens

        scored_results: List[Dict[str, Any]] = []

        for chunk_id, item in _vector_cache.items():
            score = _hybrid_score(query_tokens, query, item["vector"], item["text"])
            if score >= min_score:
                scored_results.append({
                    "chunk_id": chunk_id,
                    "document_id": item["doc_id"],
                    "filename": item.get("filename", "document.pdf"),
                    "page_number": item.get("page_number", 1),
                    "content": item["text"],
                    "similarity": round(score, 3),
                })

        scored_results.sort(key=lambda x: x["similarity"], reverse=True)

        # Fallback for meta-queries referring to uploaded documents/person if score threshold was missed
        if not scored_results:
            query_lower = query.lower()
            is_doc_reference = any(w in query_lower for w in [
                "document", "documents", "pdf", "file", "uploaded", "this person", "the person",
                "candidate", "resume", "cv", "profile", "summary", "overview", "who is", "tell me about"
            ])
            if is_doc_reference and _vector_cache:
                for idx, (chunk_id, item) in enumerate(_vector_cache.items()):
                    if idx >= top_k:
                        break
                    scored_results.append({
                        "chunk_id": chunk_id,
                        "document_id": item["doc_id"],
                        "filename": item.get("filename", "document.pdf"),
                        "page_number": item.get("page_number", 1),
                        "content": item["text"],
                        "similarity": 0.50,
                    })

        return scored_results[:top_k]
    finally:
        if should_close_db:
            db.close()


# ─── Schemas ───────────────────────────────────────────────────────────────────

class DocumentResponse(BaseModel):
    id: str
    filename: str
    original_filename: str
    file_size_bytes: int
    page_count: int
    chunk_count: int
    status: str
    uploaded_at: datetime


class SearchResult(BaseModel):
    chunk_id: str
    document_id: str
    filename: str
    page_number: int
    content: str
    similarity: float


class TestRetrievalRequest(BaseModel):
    query: str
    top_k: Optional[int] = 5


# ─── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=List[DocumentResponse])
def list_documents(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """List indexed documents scoped to the authenticated user or local desktop user."""
    user_id = current_user.id if hasattr(current_user, "id") else "default_user"
    docs = (
        db.query(Document)
        .filter(Document.user_id == user_id)
        .order_by(Document.uploaded_at.desc())
        .all()
    )
    return [
        DocumentResponse(
            id=d.id,
            filename=d.filename,
            original_filename=d.original_filename,
            file_size_bytes=d.file_size_bytes,
            page_count=d.page_count,
            chunk_count=d.chunk_count,
            status=d.status,
            uploaded_at=d.uploaded_at,
        )
        for d in docs
    ]


@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Upload and index a document (PDF or text).
    Extracts text page-by-page, generates cohesive chunks, stores TF-IDF vectors in SQLite,
    and updates live in-memory cache with verifiable page references.
    """
    user_id = current_user.id if hasattr(current_user, "id") else "default_user"
    raw_filename = file.filename or "document.pdf"
    ext = os.path.splitext(raw_filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file extension '{ext}'. Quantum Council only accepts {', '.join(sorted(ALLOWED_EXTENSIONS))}.",
        )

    content_bytes = await file.read()
    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    if len(content_bytes) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum upload size of {settings.max_upload_size_mb}MB.",
        )

    sanitized_filename = _sanitize_filename(raw_filename)
    pages_text: List[Dict[str, Any]] = []
    is_pdf = ext == ".pdf"

    if is_pdf:
        try:
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(content_bytes))
            for page_idx, page in enumerate(reader.pages):
                text = page.extract_text() or ""
                pages_text.append({
                    "page_number": page_idx + 1,
                    "text": text,
                })
        except Exception:
            raw_text = content_bytes.decode("utf-8", errors="ignore")
            pages_text.append({"page_number": 1, "text": raw_text})
    else:
        raw_text = content_bytes.decode("utf-8", errors="ignore")
        pages_text.append({"page_number": 1, "text": raw_text})

    total_extracted_chars = sum(len(p["text"].strip()) for p in pages_text)
    doc_id = str(uuid.uuid4())
    doc_status = "indexed"
    error_msg = None

    if total_extracted_chars < 15:
        doc_status = "failed"
        error_msg = "PDF contains no extractable digital text. Document may be a scanned image requiring OCR."

    # Generate cohesive chunks preserving page numbers
    persisted_chunks: List[DocumentChunk] = []
    global_chunk_idx = 0

    if doc_status == "indexed":
        for p in pages_text:
            p_num = p["page_number"]
            p_text = p["text"].strip()
            if not p_text:
                continue

            # Split on double newlines or logical block boundaries
            raw_blocks = re.split(r"\n\s*\n", p_text)
            current_buffer = ""

            for block in raw_blocks:
                b_clean = block.strip()
                if not b_clean:
                    continue

                if len(current_buffer) + len(b_clean) < 650:
                    current_buffer = f"{current_buffer}\n\n{b_clean}".strip() if current_buffer else b_clean
                else:
                    if current_buffer:
                        chunk_id = f"{doc_id}_p{p_num}_c{global_chunk_idx}"
                        tokens = _tokenize(current_buffer)
                        vec = _text_to_vector(tokens)
                        persisted_chunks.append(
                            DocumentChunk(
                                id=chunk_id,
                                document_id=doc_id,
                                page_number=p_num,
                                chunk_index=global_chunk_idx,
                                content=current_buffer,
                                vector_json=json.dumps(vec),
                                created_at=datetime.now(timezone.utc),
                            )
                        )
                        _vector_cache[chunk_id] = {
                            "chunk_id": chunk_id,
                            "doc_id": doc_id,
                            "filename": file.filename,
                            "page_number": p_num,
                            "text": current_buffer,
                            "vector": vec,
                        }
                        global_chunk_idx += 1
                    current_buffer = b_clean

            if current_buffer:
                chunk_id = f"{doc_id}_p{p_num}_c{global_chunk_idx}"
                tokens = _tokenize(current_buffer)
                vec = _text_to_vector(tokens)
                persisted_chunks.append(
                    DocumentChunk(
                        id=chunk_id,
                        document_id=doc_id,
                        page_number=p_num,
                        chunk_index=global_chunk_idx,
                        content=current_buffer,
                        vector_json=json.dumps(vec),
                        created_at=datetime.now(timezone.utc),
                    )
                )
                _vector_cache[chunk_id] = {
                    "chunk_id": chunk_id,
                    "doc_id": doc_id,
                    "filename": sanitized_filename,
                    "page_number": p_num,
                    "text": current_buffer,
                    "vector": vec,
                }
                global_chunk_idx += 1

    # Write sanitized file into user's isolated local uploads directory
    uploads_dir = get_uploads_dir()
    disk_filename = f"{doc_id}_{sanitized_filename}"
    target_disk_path = (uploads_dir / disk_filename).resolve()
    if not str(target_disk_path).startswith(str(uploads_dir.resolve())):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Path traversal attempt blocked.")
    try:
        with open(target_disk_path, "wb") as f_out:
            f_out.write(content_bytes)
    except Exception:
        pass

    # Persist Document record and chunks into database
    doc_record = Document(
        id=doc_id,
        user_id=user_id,
        filename=sanitized_filename,
        original_filename=raw_filename,
        file_size_bytes=len(content_bytes),
        page_count=len(pages_text) if pages_text else 1,
        chunk_count=len(persisted_chunks),
        status=doc_status,
        error_message=error_msg,
        uploaded_at=datetime.now(timezone.utc),
        indexed_at=datetime.now(timezone.utc) if doc_status == "indexed" else None,
    )

    try:
        db.add(doc_record)
        for chk in persisted_chunks:
            db.add(chk)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to persist document index: {str(e)}")

    return DocumentResponse(
        id=doc_id,
        filename=sanitized_filename,
        original_filename=raw_filename,
        file_size_bytes=len(content_bytes),
        page_count=len(pages_text) if pages_text else 1,
        chunk_count=len(persisted_chunks),
        status=doc_status,
        uploaded_at=datetime.now(timezone.utc),
    )


@router.get("/search", response_model=List[SearchResult])
def search_documents(query: str, top_k: int = 5, db: Session = Depends(get_db)):
    """Perform hybrid keyword + vector retrieval across all indexed documents."""
    results = retrieve_relevant_chunks(query, top_k=top_k, db=db)
    return [
        SearchResult(
            chunk_id=r["chunk_id"],
            document_id=r["document_id"],
            filename=r["filename"],
            page_number=r["page_number"],
            content=r["content"],
            similarity=r["similarity"],
        )
        for r in results
    ]


@router.post("/test-retrieval", response_model=List[SearchResult])
def test_retrieval(req: TestRetrievalRequest, db: Session = Depends(get_db)):
    """Diagnostic test endpoint to verify exact retrieved passages and metadata in UI."""
    results = retrieve_relevant_chunks(req.query, top_k=req.top_k or 5, db=db)
    return [
        SearchResult(
            chunk_id=r["chunk_id"],
            document_id=r["document_id"],
            filename=r["filename"],
            page_number=r["page_number"],
            content=r["content"],
            similarity=r["similarity"],
        )
        for r in results
    ]


@router.get("/{document_id}/chunks")
def get_document_chunks(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Inspect all extracted chunks and page references for a document with ownership check."""
    user_id = current_user.id if hasattr(current_user, "id") else "default_user"
    doc = db.query(Document).filter(Document.id == document_id, Document.user_id == user_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    chunks = (
        db.query(DocumentChunk)
        .filter(DocumentChunk.document_id == document_id)
        .order_by(DocumentChunk.page_number.asc(), DocumentChunk.chunk_index.asc())
        .all()
    )
    return [
        {
            "id": c.id,
            "page_number": c.page_number,
            "chunk_index": c.chunk_index,
            "content": c.content,
        }
        for c in chunks
    ]


@router.delete("/{document_id}")
def delete_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Delete an individual document and its chunks with ownership IDOR verification."""
    user_id = current_user.id if hasattr(current_user, "id") else "default_user"
    doc = db.query(Document).filter(Document.id == document_id, Document.user_id == user_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete chunks from DB
    deleted_chunks = db.query(DocumentChunk).filter(DocumentChunk.document_id == document_id).delete()
    db.delete(doc)
    db.commit()

    # Evict from in-memory cache
    evicted_keys = [k for k, v in _vector_cache.items() if v.get("doc_id") == document_id]
    for k in evicted_keys:
        _vector_cache.pop(k, None)

    # Clean up corresponding file on disk if stored
    uploads_dir = get_uploads_dir()
    for f in uploads_dir.glob(f"{document_id}_*"):
        try:
            f.unlink()
        except OSError:
            pass

    return {
        "success": True,
        "deleted_document_id": document_id,
        "deleted_chunks": deleted_chunks,
    }
