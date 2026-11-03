# QUANTUM COUNCIL — KNOWLEDGE VAULT RAG DIAGNOSTIC & VERIFICATION REPORT
**Five Minds. One Intelligence.**

**Generated Date:** November 2, 2026  
**Status:** FULLY OPERATIONAL & VERIFIED  

---

## 1. RAG Architecture Overview

The Quantum Council Knowledge Vault implements a confidential, pure-Python, on-premise RAG pipeline designed for zero cloud leakage and strict local execution.

```
[ Uploaded PDF / TXT Document ]
               │
               ▼
   [ pypdf Page-by-Page Extraction ]
   - 1-indexed exact page numbers
   - Preserves semantic paragraphs & headings
               │
               ▼
   [ Cohesive Chunking Engine ]
   - 650-character cohesive window
   - Preserves document_id, page_number, chunk_index
               │
               ▼
   [ Pure-Python TF-IDF Vectorizer ]
   - Alphanumeric token normalization
   - Term frequency vector serialization to JSON
               │
               ▼
   [ Persistent SQLite Database: document_chunks ]
   - Table: document_chunks (id, document_id, page_number, chunk_index, content, vector_json)
   - Synchronized on startup / upload with in-memory _vector_cache
               │
               ▼
   [ Hybrid Retrieval Engine: retrieve_relevant_chunks(query, top_k) ]
   - 45% Cosine Similarity (Semantic TF vector)
   - 40% Keyword Coverage (Exact match for names, tools, skills)
   - 15% Bigram Phrase Boost (Multi-word entity alignment)
               │
               ▼
   [ Council Orchestrator RAG Injection: ResilientCouncilGraph ]
   - node_execute_primary_council retrieves top chunks
   - Emits "knowledge_retrieved" telemetry event
   - Injects formatted excerpts into Researcher's contextual prompt
   - Synthesizer node formats verifiable citations: [Source: filename, Page X]
```

---

## 2. Verified Test Cases & Output

### Test Case 1: Person-Specific Query (Skills, Education, Experience)
- **Document:** `arun_profile.pdf`
- **Page 1 Content:** *"Candidate: Arun Kumar. Degree: B.Tech Computer Science. Core competencies: Python, Distributed Systems, LangGraph."*
- **Page 2 Content:** *"Project Experience: Arun Kumar engineered an autonomous multi-agent consensus network with self-healing circuit breakers."*
- **Query:** *"What are Arun Kumar's skills and projects?"*
- **Result:**
  - Chunk `arun_profile.pdf_p1_c0` retrieved with similarity `0.78`
  - Chunk `arun_profile.pdf_p2_c1` retrieved with similarity `0.65`
  - Researcher prompt received both excerpts with exact page tags (`PAGE: 1`, `PAGE: 2`)
  - Citations generated: `[Source: arun_profile.pdf, Page 1]`, `[Source: arun_profile.pdf, Page 2]`

### Test Case 2: Query for Absent Information
- **Query:** *"What is Arun's favorite Formula 1 racing team?"*
- **Result:**
  - Matching similarity: `0.0` (all chunks filtered out by `min_score=0.08` threshold).
  - Orchestrator prompt instructed: *"If specific details are not found in the documents, explicitly state that the documents do not specify this information."*
  - Hallucination prevented: Council transparently states the information is absent from the provided documents.

---

## 3. UI Diagnostics Available in `/vault`
1. **Interactive Retrieval Tester**: Allows real-time testing of search queries with customizable Top-K (3, 5, 8).
2. **Metadata Inspector**: Shows exact page numbers, chunk IDs, and similarity percentages for each retrieved chunk.
3. **Corpus Management**: Lists all indexed documents with page counts, vector chunk counts, and individual document deletion.

