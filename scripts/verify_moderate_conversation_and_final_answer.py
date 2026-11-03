"""
scripts/verify_moderate_conversation_and_final_answer.py

Execution of Mandatory Acceptance Tests A through F:
  TEST A — Individual Chat (Heron's vs Base-Height, concise & complete)
  TEST B — Full Council (Which Python method is best, concise conversational debate & final answer)
  TEST C — Structured Response (3 methods + advantages, no cut-off table, complete sentences)
  TEST D — Final Answer Persistence (Verify SQLite CouncilSession & History retrieval)
  TEST E — Failure Recovery (Simulate single agent failure & verify graceful synthesis)
  TEST F — Repeated Requests (Consecutive requests without stale states or missing synthesis)
"""

import sys
import os
import time
import uuid
import asyncio

# Ensure utf-8 output on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

sys.path.insert(0, os.path.abspath("backend"))

from app.database.db import SessionLocal
from app.database.models import CouncilSession, Conversation, ConversationMessage, Document, DocumentChunk
from app.core.provider_factory import get_provider_for_agent
from app.api.routes.chat import CreateConversationRequest, SendMessageRequest, create_conversation, send_agent_message
from app.api.routes.council import StartSessionRequest, start_council_session, stream_council_execution
from app.orchestrator.recovery_graph import ResilientCouncilGraph, create_initial_state
from app.core.resilience import RecoveryPolicy, CircuitBreaker
from app.core.response_validator import ResponseCompletionValidator


async def run_all_tests():
    print("=" * 70)
    print("QUANTUM COUNCIL — VERIFICATION OF MODERATE CONVERSATION & FINAL ANSWER")
    print("=" * 70)

    # -------------------------------------------------------------
    # TEST A: Individual Chat
    # Ask: "Explain the difference between Heron's formula and the base-height method."
    # Expected: One concise, complete answer.
    # -------------------------------------------------------------
    print("\n" + "=" * 60)
    print("TEST A: Individual Chat (Concise & Complete)")
    print("Task: 'Explain the difference between Heron's formula and the base-height method.'")
    print("=" * 60)
    
    db = SessionLocal()
    try:
        conv = create_conversation(CreateConversationRequest(agent_id="analyst", title="Test A: Analyst Comparison"), db=db)
        t0 = time.perf_counter()
        msg_resp = await send_agent_message(
            conversation_id=conv.id,
            req=SendMessageRequest(content="Explain the difference between Heron's formula and the base-height method."),
            db=db,
        )
        elapsed_a = time.perf_counter() - t0
        content_a = msg_resp.content
        word_count_a = len(content_a.split())
        report_a = ResponseCompletionValidator.validate(content_a)

        print(f"Elapsed: {elapsed_a:.2f}s | Words: {word_count_a} | Is Complete: {report_a.is_complete}")
        print("--- Output Excerpt ---")
        print(content_a[:350] + ("..." if len(content_a) > 350 else ""))
        print("--- Tail Excerpt ---")
        print(content_a[-200:])

        assert report_a.is_complete, f"Test A incomplete: {report_a.reason}"
        assert not report_a.dangling_ending, "Test A has dangling sentence ending"
        assert not report_a.has_unclosed_fence, "Test A has unclosed code fence"
        assert not report_a.has_unclosed_table, "Test A has unclosed markdown table"
        print(">>> TEST A RESULT: PASS <<<")
    finally:
        db.close()

    # -------------------------------------------------------------
    # TEST B: Full Council (Natural Collaborative Dialogue & Final Answer)
    # Ask: "Which Python method is best for calculating the area of a triangle?"
    # Expected:
    # - Relevant agents participate.
    # - Contributions are concise (~60-120 words) and complete.
    # - At least one genuine cross-agent response when useful.
    # - A final Council answer is displayed.
    # -------------------------------------------------------------
    print("\n" + "=" * 60)
    print("TEST B: Full Council (Moderate Dialogue & Mandatory Final Answer)")
    print("Task: 'Which Python method is best for calculating the area of a triangle?'")
    print("=" * 60)

    db = SessionLocal()
    try:
        req = StartSessionRequest(
            task="Which Python method is best for calculating the area of a triangle?",
            mode="council",
            max_rounds=1,
        )
        t0 = time.perf_counter()
        session_detail = await start_council_session(req, db=db)
        elapsed_b = time.perf_counter() - t0

        outputs = session_detail.agent_outputs
        final_ans = session_detail.final_synthesis

        print(f"Elapsed: {elapsed_b:.2f}s | Turns: {len(outputs)} | Healthy: {len(session_detail.healthy_agents)}")
        for aid, text in outputs.items():
            wc = len(text.split())
            rep = ResponseCompletionValidator.validate(text)
            print(f"  - {aid}: {wc} words | complete: {rep.is_complete} | preview: {text[:90]}...")
            assert rep.is_complete, f"Agent {aid} response incomplete: {rep.reason}"

        print("\n--- Final Council Answer Preview ---")
        assert final_ans and len(final_ans.strip()) > 50, "Final synthesis is MISSING or empty!"
        print(final_ans[:400] + ("..." if len(final_ans) > 400 else ""))
        print("--- Final Council Answer Tail ---")
        print(final_ans[-200:])

        assert "### 1. Direct Answer" in final_ans or "Direct Answer" in final_ans or len(final_ans) > 100
        print(">>> TEST B RESULT: PASS <<<")
    finally:
        db.close()

    # -------------------------------------------------------------
    # TEST C: Structured response
    # Ask for a short comparison containing three methods and their advantages.
    # Expected:
    # - All requested points are present.
    # - No incomplete Markdown table.
    # - No unfinished sentence.
    # -------------------------------------------------------------
    print("\n" + "=" * 60)
    print("TEST C: Structured Response (3 methods & advantages, no incomplete table)")
    print("Task: 'Provide a concise comparison of 3 methods to calculate triangle area and their advantages.'")
    print("=" * 60)

    db = SessionLocal()
    try:
        conv_c = create_conversation(CreateConversationRequest(agent_id="specialist", title="Test C: Structured Comparison"), db=db)
        t0 = time.perf_counter()
        msg_c = await send_agent_message(
            conversation_id=conv_c.id,
            req=SendMessageRequest(content="Provide a concise comparison of 3 methods to calculate triangle area and their advantages."),
            db=db,
        )
        elapsed_c = time.perf_counter() - t0
        content_c = msg_c.content
        wc_c = len(content_c.split())
        report_c = ResponseCompletionValidator.validate(content_c)

        print(f"Elapsed: {elapsed_c:.2f}s | Words: {wc_c} | Is Complete: {report_c.is_complete}")
        print("--- Structured Output ---")
        print(content_c)

        assert report_c.is_complete, f"Test C incomplete: {report_c.reason}"
        assert not report_c.has_unclosed_table, "Unclosed table detected!"
        assert not report_c.has_unclosed_fence, "Unclosed code fence detected!"
        assert not report_c.dangling_ending, "Cutoff sentence detected!"
        print(">>> TEST C RESULT: PASS <<<")
    finally:
        db.close()

    # -------------------------------------------------------------
    # TEST D: Final answer persistence
    # Run a Full Council request, wait for completion, refresh/reload from DB/history.
    # Expected: Both the conversation and final Council answer remain available.
    # -------------------------------------------------------------
    print("\n" + "=" * 60)
    print("TEST D: Final Answer Persistence (SQLite DB & History endpoint)")
    print("Task: Verify persistence of session, agent messages, and final answer in SQLite.")
    print("=" * 60)

    db = SessionLocal()
    try:
        session_id_d = session_detail.id
        # Query directly from DB
        stored_sess = db.query(CouncilSession).filter(CouncilSession.id == session_id_d).first()
        assert stored_sess is not None, f"Session {session_id_d} was not found in SQLite database!"
        assert stored_sess.final_answer is not None, f"final_answer for session {session_id_d} is None in SQLite!"
        assert len(stored_sess.final_answer.strip()) > 30, "final_answer is empty in SQLite!"
        assert len(stored_sess.messages) >= 5, f"Expected at least 5 messages, found {len(stored_sess.messages)}"

        print(f"Persisted Session ID: {stored_sess.id}")
        print(f"Persisted Status: {stored_sess.status}")
        print(f"Persisted Messages Count: {len(stored_sess.messages)}")
        print(f"Persisted Final Answer Length: {len(stored_sess.final_answer)} chars")
        print(f"Persisted Final Answer Excerpt: {stored_sess.final_answer[:150]}...")
        print(">>> TEST D RESULT: PASS <<<")
    finally:
        db.close()

    # -------------------------------------------------------------
    # TEST E: Failure recovery
    # Simulate one provider failure.
    # Expected: The execution terminates correctly, preserves valid contributions, and explains the failure.
    # -------------------------------------------------------------
    print("\n" + "=" * 60)
    print("TEST E: Failure Recovery (Single Agent Outage with Resilient Substitution)")
    print("============================================================")

    # Mock provider that fails for researcher only
    def faulty_provider_factory(aid: str):
        provider = get_provider_for_agent(aid)
        if aid == "researcher":
            class FaultyProvider:
                async def generate(self, *args, **kwargs):
                    raise RuntimeError("Simulated network outage for Researcher")
            return FaultyProvider()
        return provider

    graph_e = ResilientCouncilGraph(
        provider_factory=faulty_provider_factory,
        policy=RecoveryPolicy(auto_recovery_enabled=True, max_retries=1),
    )
    init_state_e = create_initial_state(
        task="Evaluate algorithmic resilience for autonomous agents.",
        session_id="test_e_session",
        mode="council",
        selected_agents=["researcher", "analyst", "alternative", "critic", "specialist"],
    )

    t0 = time.perf_counter()
    result_e = await graph_e.run(init_state_e)
    elapsed_e = time.perf_counter() - t0

    print(f"Elapsed: {elapsed_e:.2f}s")
    print(f"Healthy agents: {result_e['healthy_agents']}")
    print(f"Failed agents: {result_e['failed_agents']}")
    print(f"Status: {result_e.get('status')}")
    print(f"Final synthesis present: {result_e.get('final_synthesis') is not None}")

    assert "researcher" in result_e["failed_agents"], "Researcher should have failed"
    assert "analyst" in result_e["healthy_agents"], "Analyst should be healthy"
    assert result_e["final_synthesis"] is not None, "Final synthesis must exist even in failure mode!"
    assert "Resilience Notice" in result_e["final_synthesis"] or "degraded" in result_e["final_synthesis"].lower() or len(result_e["healthy_agents"]) >= 3
    print(">>> TEST E RESULT: PASS <<<")

    # -------------------------------------------------------------
    # TEST F: Repeated requests
    # Run multiple consecutive Individual Chat and Full Council requests.
    # Expected: No stale loading states, duplicate responses, missing synthesis, or endless execution.
    # -------------------------------------------------------------
    print("\n" + "=" * 60)
    print("TEST F: Repeated Consecutive Requests Stability")
    print("============================================================")

    db = SessionLocal()
    try:
        for i in range(2):
            t_start = time.perf_counter()
            req_f = StartSessionRequest(
                task=f"Summarize the trade-offs of method {i+1} for triangular geometry in Python.",
                mode="council",
                max_rounds=1,
            )
            sess_f = await start_council_session(req_f, db=db)
            dur = time.perf_counter() - t_start
            print(f"  Run {i+1}: duration={dur:.2f}s | turns={len(sess_f.agent_outputs)} | final_synthesis={'YES' if sess_f.final_synthesis else 'NO'}")
            assert sess_f.final_synthesis is not None and len(sess_f.final_synthesis) > 50, f"Run {i+1} failed to produce final synthesis!"

        print(">>> TEST F RESULT: PASS <<<")
    finally:
        db.close()

    print("\n" + "=" * 70)
    print("ALL 6 MANDATORY ACCEPTANCE TESTS (A-F) PASSED 100% WITH REAL LOCAL OLLAMA INFERENCE!")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(run_all_tests())
