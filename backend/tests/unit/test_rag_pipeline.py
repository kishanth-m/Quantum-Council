"""
backend/tests/unit/test_rag_pipeline.py

Unit tests for Knowledge Vault RAG pipeline:
1. SQLite persistent document chunk indexing
2. Hybrid semantic + keyword retrieval precision (person name, skills, projects)
3. Page citation extraction
4. RAG context injection into Council Orchestrator prompts
5. Querying absent information
"""

import json
import pytest
from app.api.routes.documents import (
    _hybrid_score,
    _text_to_vector,
    _tokenize,
    retrieve_relevant_chunks,
    _vector_cache,
)
from app.database.db import SessionLocal
from app.database.models import Document, DocumentChunk
from app.orchestrator.recovery_graph import ResilientCouncilGraph, create_initial_state
from app.providers.base import BaseLLMProvider, LLMResponse


class MockLLMProvider(BaseLLMProvider):
    def __init__(self, name="mock"):
        self.name = name

    async def generate(self, prompt, system_prompt="", temperature=0.7, max_tokens=1000, timeout_seconds=30.0):
        return LLMResponse(content=f"Response from {self.name} citing [Source: resume.pdf, Page 1]", model_name="mock-model")

    async def check_health(self):
        return True


def test_chunk_vectorization_and_hybrid_scoring():
    text1 = "Arun Kumar is a Senior Software Engineer specializing in Python, Java, and Distributed Systems."
    text2 = "Weather forecasting involves complex atmospheric simulations and barometric pressure modeling."

    tokens1 = _tokenize(text1)
    tokens2 = _tokenize(text2)

    vec1 = _text_to_vector(tokens1)
    vec2 = _text_to_vector(tokens2)

    query = "Arun Kumar Python skills"
    q_tokens = _tokenize(query)

    score1 = _hybrid_score(q_tokens, query, vec1, text1)
    score2 = _hybrid_score(q_tokens, query, vec2, text2)

    assert score1 > 0.4
    assert score2 < 0.1
    assert score1 > score2


def test_persistent_document_chunk_retrieval():
    db = SessionLocal()
    doc_id = "test_doc_rag_001"
    try:
        # Clean previous test entries
        db.query(DocumentChunk).filter(DocumentChunk.document_id == doc_id).delete()
        db.query(Document).filter(Document.id == doc_id).delete()
        db.commit()

        # Insert test document
        doc = Document(
            id=doc_id,
            user_id="default_user",
            filename="arun_profile.pdf",
            original_filename="arun_profile.pdf",
            file_size_bytes=1024,
            page_count=2,
            chunk_count=2,
            status="indexed",
        )
        db.add(doc)

        c1 = DocumentChunk(
            id=f"{doc_id}_c1",
            document_id=doc_id,
            page_number=1,
            chunk_index=0,
            content="Candidate: Arun Kumar. Degree: B.Tech Computer Science. Core competencies: Python, Distributed Systems, LangGraph.",
            vector_json=json.dumps(_text_to_vector(_tokenize("Candidate: Arun Kumar. Degree: B.Tech Computer Science. Core competencies: Python, Distributed Systems, LangGraph."))),
        )
        c2 = DocumentChunk(
            id=f"{doc_id}_c2",
            document_id=doc_id,
            page_number=2,
            chunk_index=1,
            content="Project Experience: Arun Kumar engineered an autonomous multi-agent consensus network with self-healing circuit breakers.",
            vector_json=json.dumps(_text_to_vector(_tokenize("Project Experience: Arun Kumar engineered an autonomous multi-agent consensus network with self-healing circuit breakers."))),
        )
        db.add(c1)
        db.add(c2)
        db.commit()

        # Invalidate in-memory cache to force DB reload
        _vector_cache.clear()

        # Retrieve for Arun Kumar
        results = retrieve_relevant_chunks("What are Arun Kumar's skills?", top_k=5, db=db)
        assert len(results) > 0
        top = results[0]
        assert top["filename"] in ("arun_profile.pdf", "arun_resume.pdf")
        assert top["page_number"] in (1, 2)
        assert "Arun Kumar" in top["content"]

        # Retrieve for absent info
        absent_results = retrieve_relevant_chunks("What is Arun's favorite Formula 1 racing team?", top_k=5, db=db)
        # Should not match high relevance
        matching_scores = [r["similarity"] for r in absent_results if "Formula" in r["content"]]
        assert len(matching_scores) == 0

    finally:
        db.query(DocumentChunk).filter(DocumentChunk.document_id == doc_id).delete()
        db.query(Document).filter(Document.id == doc_id).delete()
        db.commit()
        _vector_cache.clear()
        db.close()


def test_researcher_prompt_includes_retrieved_evidence():
    graph = ResilientCouncilGraph(provider_factory=lambda aid: MockLLMProvider(aid))
    mock_retrieved = [
        {
            "chunk_id": "chk_001",
            "document_id": "doc_1",
            "filename": "quantum_spec.pdf",
            "page_number": 3,
            "content": "Quantum Council utilizes a Byzantine fault-tolerant consensus threshold of 60%.",
            "similarity": 0.88,
        }
    ]

    prompt = graph._build_contextual_prompt(
        agent_id="researcher",
        task="What is the consensus threshold?",
        mode="council",
        outputs={},
        retrieved_context=mock_retrieved,
    )

    assert "[KNOWLEDGE VAULT RETRIEVED EVIDENCE]" in prompt
    assert "quantum_spec.pdf" in prompt
    assert "PAGE: 3" in prompt
    assert "Byzantine fault-tolerant" in prompt
    assert "[Source: filename, Page X]" in prompt


@pytest.mark.asyncio
async def test_full_council_graph_with_rag_integration():
    graph = ResilientCouncilGraph(
        provider_factory=lambda aid: MockLLMProvider(aid),
        orchestrator_provider=MockLLMProvider("orchestrator"),
    )
    initial_state = create_initial_state(
        task="What are the fault tolerance specifications in quantum_spec.pdf?",
        session_id="test_rag_session_101",
        mode="council",
        selected_agents=["researcher", "analyst"],
    )
    initial_state["retrieved_context"] = [
        {
            "chunk_id": "c1",
            "document_id": "d1",
            "filename": "quantum_spec.pdf",
            "page_number": 2,
            "content": "Fault tolerance threshold is 60% with exponential backoff retry.",
            "similarity": 0.85,
        }
    ]

    result = await graph.graph.ainvoke(initial_state)

    assert result["final_synthesis"] is not None
    event_types = [e["event_type"] for e in result["events"]]
    assert "knowledge_retrieved" in event_types
    assert "session_completed" in event_types
    assert result["agent_outputs"]["researcher"] is not None
