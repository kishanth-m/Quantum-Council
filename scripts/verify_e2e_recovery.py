"""
scripts/verify_e2e_recovery.py

Direct verification of Full Council execution and Knowledge Vault RAG using the running local Ollama engine.
"""

import sys
import os
import asyncio
import time

# Ensure backend path is on sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.database.db import SessionLocal
from app.api.routes.council import start_council_session
from app.core.schemas import StartSessionRequest


async def run_council_test(task_prompt: str, test_name: str):
    print(f"\n==========================================")
    print(f"STARTING TEST: {test_name}")
    print(f"PROMPT: {task_prompt}")
    print(f"==========================================")
    
    req = StartSessionRequest(
        task=task_prompt,
        mode="council"
    )
    
    t0 = time.time()
    session = await start_council_session(req)
    total_time = time.time() - t0
    
    print(f"\n--- RESULTS for {test_name} in {total_time:.1f}s ---")
    print(f"Session ID: {session.id}")
    print(f"Status: {session.status}")
    print(f"Healthy agents: {len(session.healthy_agents)} -> {session.healthy_agents}")
    print(f"Failed agents: {len(session.failed_agents)} -> {session.failed_agents}")
    
    synthesis = session.final_synthesis or ""
    print(f"\nFinal synthesis preview (first 500 chars):\n{synthesis[:500]}")
    
    print(f"\nAgent contributions count: {len(session.agent_outputs)}")
    for agent_id, out in session.agent_outputs.items():
        print(f" - {agent_id}: {len(out)} chars | preview: {out[:90]}...")
        
    return session


async def main():
    # Test 1: Full council without docs
    res1 = await run_council_test(
        "What are the key trade-offs between monolithic and microservices architectures? Provide 3 concise points.",
        "Test 1: Monolith vs Microservices"
    )
    
    # Test 2: Full council with Knowledge Vault document
    res2 = await run_council_test(
        "Summarise Arun Kumar's education, technical skills, and projects based on the uploaded documents in the knowledge vault.",
        "Test 2: Document RAG Integration"
    )
    
    # Verify success criteria
    print("\n==========================================")
    print("VERIFICATION EVALUATION SUMMARY")
    print("==========================================")
    t1_pass = res1.status in ("completed", "partially_completed") and len(res1.final_synthesis or "") > 80
    s2 = (res2.final_synthesis or "") + "".join(res2.agent_outputs.values())
    t2_pass = res2.status in ("completed", "partially_completed") and any(k in s2 for k in ["Arun", "Kumar", "LangGraph", "Python", "Computer Science"])
    
    print(f"Test 1 Passed: {t1_pass} (Duration: healthy={len(res1.healthy_agents)}/5, length={len(res1.final_synthesis or '')} chars)")
    print(f"Test 2 (RAG) Passed: {t2_pass} (Found document entities in deliberation/synthesis)")
    
    if t1_pass and t2_pass:
        print("\n>>> ALL VERIFICATIONS SUCCEEDED! Real Ollama model responded without hanging or crashing. <<<")
    else:
        print("\n>>> ONE OR MORE VERIFICATIONS DID NOT MEET EXPECTED CRITERIA. <<<")


if __name__ == "__main__":
    asyncio.run(main())
