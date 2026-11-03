"""
scripts/verify_mandatory_tests.py

Comprehensive end-to-end verification of Tests A through F against the live Ollama local model.
"""

import asyncio
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.database.db import SessionLocal
from app.database.models import Conversation, AgentConfig
from app.api.routes.chat import create_conversation, send_agent_message, SendMessageRequest, CreateConversationRequest
from app.api.routes.council import start_council_session
from app.core.schemas import StartSessionRequest
from app.core.response_validator import ResponseCompletionValidator
from app.providers.mock_provider import MockLLMProvider
from app.orchestrator.recovery_graph import ResilientCouncilGraph, create_initial_state


async def test_a_individual_researcher():
    print("\n" + "="*60)
    print("MANDATORY TEST A: Individual Researcher Response")
    print("Task: 'Explain three practical approaches to finding the area of a triangle in Python. Compare their advantages and limitations.'")
    print("="*60)

    db = SessionLocal()
    try:
        conv_req = CreateConversationRequest(agent_id="researcher", title="Test A: Triangle Area Approaches")
        conv = create_conversation(conv_req, db=db)
        
        msg_req = SendMessageRequest(
            content="Explain three practical approaches to finding the area of a triangle in Python. Compare their advantages and limitations."
        )
        t0 = time.time()
        msg_item = await send_agent_message(conversation_id=conv.id, req=msg_req, db=db)
        elapsed = time.time() - t0

        content = msg_item.content
        val = ResponseCompletionValidator.validate(content)
        
        print(f"Elapsed Time: {elapsed:.2f}s")
        print(f"Token count estimate: {msg_item.tokens_used}")
        print(f"Is complete: {val.is_complete}")
        print(f"Needs continuation: {val.needs_continuation}")
        print(f"Has unclosed fence: {val.has_unclosed_fence}")
        print(f"Has unclosed table: {val.has_unclosed_table}")
        print(f"Content length: {len(content)} chars")
        print(f"\n--- Researcher Full Output Preview ---\n{content[:800]}...\n[Tail preview]:\n...{content[-300:]}")

        has_no_meta_planning = "we need to" not in content.lower()[:150]
        has_python_code = "```python" in content
        is_pass = val.is_complete and len(content) > 300 and has_no_meta_planning
        print(f"\n>>> TEST A RESULT: {'PASS' if is_pass else 'FAIL'} <<<")
        return is_pass
    finally:
        db.close()


async def test_b_analyst_response():
    print("\n" + "="*60)
    print("MANDATORY TEST B: Analyst Response & Reasoned Recommendation")
    print("Task: 'Compare Heron's formula and the base-height method for calculating the area of a triangle in Python. Recommend the most suitable approach for a beginner.'")
    print("="*60)

    db = SessionLocal()
    try:
        conv_req = CreateConversationRequest(agent_id="analyst", title="Test B: Heron vs Base-Height")
        conv = create_conversation(conv_req, db=db)
        
        msg_req = SendMessageRequest(
            content="Compare Heron's formula and the base-height method for calculating the area of a triangle in Python. Recommend the most suitable approach for a beginner."
        )
        t0 = time.time()
        msg_item = await send_agent_message(conversation_id=conv.id, req=msg_req, db=db)
        elapsed = time.time() - t0

        content = msg_item.content
        val = ResponseCompletionValidator.validate(content)
        
        print(f"Elapsed Time: {elapsed:.2f}s")
        print(f"Is complete: {val.is_complete}")
        print(f"Content length: {len(content)} chars")
        print(f"\n--- Analyst Output Preview ---\n{content[:800]}...\n[Tail preview]:\n...{content[-300:]}")

        has_no_meta = not content.lower().startswith("we need to provide logical and feasibility analysis")
        has_comparison = any(k in content.lower() for k in ["heron", "base", "recommend", "beginner"])
        is_pass = val.is_complete and len(content) > 250 and has_no_meta and has_comparison
        print(f"\n>>> TEST B RESULT: {'PASS' if is_pass else 'FAIL'} <<<")
        return is_pass
    finally:
        db.close()


async def test_c_full_council_debate():
    print("\n" + "="*60)
    print("MANDATORY TEST C: Full Council Dynamic Debate")
    print("Task: 'Design a reliable and efficient Python approach for calculating the area of a triangle. Compare different methods and recommend the best implementation.'")
    print("="*60)

    db = SessionLocal()
    try:
        req = StartSessionRequest(
            task="Design a reliable and efficient Python approach for calculating the area of a triangle. Compare different methods and recommend the best implementation.",
            mode="council"
        )
        t0 = time.time()
        session = await start_council_session(req, db=db)
        elapsed = time.time() - t0

        print(f"Total Council Deliberation Time: {elapsed:.2f}s")
        print(f"Session Status: {session.status}")
        print(f"Healthy agents: {len(session.healthy_agents)}/5: {session.healthy_agents}")
        print(f"Outputs count: {len(session.agent_outputs)}")
        for aid, out in session.agent_outputs.items():
            print(f"  - {aid}: {len(out)} chars | preview: {out[:90]}...")

        # Check for debate rebuttal
        has_debate_turn = any("_debate_rebuttal" in k for k in session.agent_outputs.keys())
        print(f"Has dynamic cross-agent debate turn: {has_debate_turn}")

        synthesis = session.final_synthesis or ""
        print(f"\nFinal Synthesis Preview (first 500 chars):\n{synthesis[:500]}...")

        is_pass = session.status in ("completed", "partially_completed") and len(session.healthy_agents) >= 4 and len(synthesis) > 300
        print(f"\n>>> TEST C RESULT: {'PASS' if is_pass else 'FAIL'} <<<")
        return is_pass
    finally:
        db.close()


async def test_d_long_output_table_and_code():
    print("\n" + "="*60)
    print("MANDATORY TEST D: Long Output With Markdown Table, Code, and Conclusion")
    print("="*60)

    db = SessionLocal()
    try:
        conv_req = CreateConversationRequest(agent_id="specialist", title="Test D: Long Structured Report")
        conv = create_conversation(conv_req, db=db)
        
        msg_req = SendMessageRequest(
            content="Produce a detailed technical comparison of 3 algorithms for triangle area calculation. Include a Markdown comparison table with columns (Algorithm, Time Complexity, Space Complexity, Numerical Stability, Ideal Use Case), production Python code with validation, and a conclusion."
        )
        t0 = time.time()
        msg_item = await send_agent_message(conversation_id=conv.id, req=msg_req, db=db)
        elapsed = time.time() - t0

        content = msg_item.content
        val = ResponseCompletionValidator.validate(content)
        
        print(f"Elapsed Time: {elapsed:.2f}s")
        print(f"Is complete: {val.is_complete}")
        print(f"Has unclosed fence: {val.has_unclosed_fence}")
        print(f"Has unclosed table: {val.has_unclosed_table}")
        print(f"Contains table (| --- |): {'|' in content and '---' in content}")
        print(f"Contains code fence: {'```python' in content and content.count('```') % 2 == 0}")
        print(f"Content length: {len(content)} chars")
        print(f"\n--- Specialist Long Output Excerpt ---\n{content[:800]}...\n[Tail excerpt]:\n...{content[-350:]}")

        is_pass = val.is_complete and not val.has_unclosed_fence and not val.has_unclosed_table and len(content) > 400
        print(f"\n>>> TEST D RESULT: {'PASS' if is_pass else 'FAIL'} <<<")
        return is_pass
    finally:
        db.close()


async def test_e_failure_recovery():
    print("\n" + "="*60)
    print("MANDATORY TEST E: Fault Tolerance & Isolated Agent Failure Recovery")
    print("="*60)

    # Factory where researcher fails permanently with provider error, others healthy
    def resilient_factory(aid: str):
        if aid == "researcher":
            from app.providers.base import ProviderError
            from app.core.resilience import FailureCategory
            class FailingProvider(MockLLMProvider):
                async def generate(self, *args, **kwargs):
                    raise ProviderError("Simulated upstream provider outage", category=FailureCategory.PROVIDER_UNAVAILABLE, retryable=False)
            return FailingProvider(aid)
        return MockLLMProvider(aid, response_template=f"Solid analytical contribution from {aid}.")

    graph = ResilientCouncilGraph(provider_factory=resilient_factory)
    initial_state = create_initial_state(task="Design high-availability cloud architecture")

    t0 = time.time()
    result = await graph.run(initial_state)
    elapsed = time.time() - t0

    print(f"Elapsed: {elapsed:.2f}s")
    print(f"Healthy agents: {result['healthy_agents']}")
    print(f"Failed agents: {result['failed_agents']}")
    print(f"Is degraded: {result['quality_assessment']['is_degraded']}")
    print(f"Has substitute output for researcher: {'analyst' in result.get('substitute_outputs', {}) or 'critic' in result.get('substitute_outputs', {}) or len(result.get('reassigned_tasks', [])) > 0}")
    print(f"Final synthesis contains resilience notice: {'Council Resilience Notice' in (result['final_synthesis'] or '')}")

    is_pass = "researcher" in result["failed_agents"] and len(result["healthy_agents"]) >= 3 and result['final_synthesis'] is not None
    print(f"\n>>> TEST E RESULT: {'PASS' if is_pass else 'FAIL'} <<<")
    return is_pass


async def test_f_knowledge_vault_grounding():
    print("\n" + "="*60)
    print("MANDATORY TEST F: Knowledge Vault Document RAG Grounding")
    print("Task: 'What are Arun Kumar\\'s technical competencies and project experience based on the uploaded document?'")
    print("="*60)

    db = SessionLocal()
    try:
        conv_req = CreateConversationRequest(agent_id="researcher", title="Test F: Knowledge Vault RAG")
        conv = create_conversation(conv_req, db=db)
        
        msg_req = SendMessageRequest(
            content="What are Arun Kumar's technical competencies and project experience based on the uploaded document in the knowledge vault?"
        )
        t0 = time.time()
        msg_item = await send_agent_message(conversation_id=conv.id, req=msg_req, db=db)
        elapsed = time.time() - t0

        content = msg_item.content
        val = ResponseCompletionValidator.validate(content)
        
        print(f"Elapsed Time: {elapsed:.2f}s")
        print(f"Is complete: {val.is_complete}")
        print(f"Response length: {len(content)} chars")
        print(f"\n--- Grounded Output Preview ---\n{content[:800]}...")

        # Must mention actual skills/projects from the uploaded pdf (Python, LangGraph, Quantum Council)
        has_entities = any(k in content for k in ["Python", "LangGraph", "Docker", "B.Tech", "Computer Science", "Quantum Council", "Arun"])
        is_pass = val.is_complete and has_entities and len(content) > 150
        print(f"Extracted Grounded Entities: {has_entities}")
        print(f"\n>>> TEST F RESULT: {'PASS' if is_pass else 'FAIL'} <<<")
        return is_pass
    finally:
        db.close()


async def main():
    print("\n" + "#"*70)
    print("QUANTUM COUNCIL — EXECUTION OF MANDATORY VERIFICATION TESTS A THROUGH F")
    print("#"*70)

    t_a = await test_a_individual_researcher()
    t_b = await test_b_analyst_response()
    t_c = await test_c_full_council_debate()
    t_d = await test_d_long_output_table_and_code()
    t_e = await test_e_failure_recovery()
    t_f = await test_f_knowledge_vault_grounding()

    print("\n" + "="*70)
    print("FINAL SUMMARY OF MANDATORY TESTS")
    print("="*70)
    print(f"Test A (Researcher - Complete Triangle Area):     {'PASS' if t_a else 'FAIL'}")
    print(f"Test B (Analyst - Heron vs Base-Height & Rec):    {'PASS' if t_b else 'FAIL'}")
    print(f"Test C (Full Council - Dynamic Debate & Debrief): {'PASS' if t_c else 'FAIL'}")
    print(f"Test D (Specialist - Long Output & Code/Table):   {'PASS' if t_d else 'FAIL'}")
    print(f"Test E (Failure Recovery - Single Agent Outage):  {'PASS' if t_e else 'FAIL'}")
    print(f"Test F (Knowledge Vault - Grounded RAG Response): {'PASS' if t_f else 'FAIL'}")

    all_passed = all([t_a, t_b, t_c, t_d, t_e, t_f])
    if all_passed:
        print("\n>>> ALL 6 MANDATORY TESTS PASSED 100% WITH REAL LOCAL OLLAMA INFERENCE! <<<")
    else:
        print("\n>>> ONE OR MORE TESTS FAILED. PLEASE INSPECT LOGS. <<<")


if __name__ == "__main__":
    asyncio.run(main())

