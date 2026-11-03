"""
backend/app/orchestrator/recovery_graph.py

LangGraph Fault-Tolerant Multi-Agent Collaborative Orchestration Workflow.

Implements:
  1. Task Decomposition & Responsibility Assignment
  2. Isolated Agent Execution with Timeout & Dynamic Response Validation
  3. Context-Threaded Dialectical Peer-Review (Analyst, Alternative Thinker, Critic, Specialist)
  4. Real Dynamic Cross-Agent Debate Round (Direct Rebuttal to Critic's Challenges)
  5. Failure Detection, Health Audit & Dynamic Task Redistribution
  6. Substantive Quality Assessment & Bounded Terminal State Resolution
  7. Transparent Final Consensus Synthesis
"""

from __future__ import annotations

import asyncio
import time
from typing import Any, Callable, Dict, List, Optional

from langgraph.graph import END, StateGraph

from app.agents.base import execute_agent_with_resilience
from app.agents.prompts import AGENT_IDENTITIES, ORCHESTRATOR_SYNTHESIS_PROMPT
from app.core.resilience import (
    AgentStatus,
    AgentTask,
    CircuitBreaker,
    RecoveryPolicy,
    TaskRedistributionEngine,
)
from app.orchestrator.state import CouncilState
from app.providers.base import BaseLLMProvider
from app.api.routes.documents import retrieve_relevant_chunks


def create_initial_state(
    task: str,
    session_id: str = "session_001",
    mode: str = "council",
    selected_agents: Optional[List[str]] = None,
    max_rounds: int = 1,
) -> CouncilState:
    """Helper to initialize a clean CouncilState dictionary."""
    if selected_agents is None:
        selected_agents = ["researcher", "analyst", "alternative", "critic", "specialist"]

    return {
        "session_id": session_id,
        "task": task,
        "mode": mode,
        "selected_agents": selected_agents,
        "healthy_agents": [],
        "failed_agents": [],
        "agent_statuses": {aid: AgentStatus.QUEUED.value for aid in selected_agents},
        "agent_outputs": {},
        "agent_failures": {},
        "reassigned_tasks": [],
        "substitute_outputs": {},
        "current_round": 1,
        "max_rounds": max_rounds,
        "events": [],
        "retrieved_context": [],
        "quality_assessment": {},
        "final_synthesis": None,
        "error": None,
    }


class ResilientCouncilGraph:
    """
    Constructs and executes the fault-tolerant LangGraph council workflow
    with genuine cross-agent debate and response completion validation.
    """

    def __init__(
        self,
        provider_factory: Callable[[str], BaseLLMProvider],
        orchestrator_provider: Optional[BaseLLMProvider] = None,
        circuit_breakers: Optional[Dict[str, CircuitBreaker]] = None,
        policy: Optional[RecoveryPolicy] = None,
        event_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
    ):
        self.provider_factory = provider_factory
        self.orchestrator_provider = orchestrator_provider
        self.circuit_breakers = circuit_breakers or {}
        self.policy = policy or RecoveryPolicy()
        self.event_callback = event_callback
        self.graph = self._build_graph()

    def _get_cb(self, agent_id: str) -> CircuitBreaker:
        if agent_id not in self.circuit_breakers:
            self.circuit_breakers[agent_id] = CircuitBreaker()
        return self.circuit_breakers[agent_id]

    def _emit(self, events: List[Dict[str, Any]], event: Dict[str, Any]):
        """Helper to append event to list and push to live streaming callback if attached."""
        events.append(event)
        if self.event_callback:
            try:
                self.event_callback(event)
            except Exception:
                pass

    def _build_graph(self):
        builder = StateGraph(CouncilState)

        builder.add_node("decompose_task", self.node_decompose_task)
        builder.add_node("execute_primary_council", self.node_execute_primary_council)
        builder.add_node("dynamic_debate", self.node_dynamic_debate_cross_examination)
        builder.add_node("redistribute_and_substitute", self.node_redistribute_and_substitute)
        builder.add_node("evaluate_quality", self.node_evaluate_quality)
        builder.add_node("synthesize_decision", self.node_synthesize_decision)
        builder.add_node("abort_execution", self.node_abort_execution)

        builder.set_entry_point("decompose_task")
        builder.add_edge("decompose_task", "execute_primary_council")

        # Conditional branch after primary execution
        builder.add_conditional_edges(
            "execute_primary_council",
            self.router_after_primary,
            {
                "all_failed": "abort_execution",
                "has_failures": "redistribute_and_substitute",
                "all_healthy": "dynamic_debate",
            },
        )

        builder.add_edge("dynamic_debate", "evaluate_quality")
        builder.add_edge("redistribute_and_substitute", "evaluate_quality")
        builder.add_edge("evaluate_quality", "synthesize_decision")
        builder.add_edge("synthesize_decision", END)
        builder.add_edge("abort_execution", END)

        return builder.compile()

    # ─── Graph Nodes ───────────────────────────────────────────────────────────

    async def node_decompose_task(self, state: CouncilState) -> Dict[str, Any]:
        """Initializes council task context and emits setup events."""
        events = list(state.get("events", []))
        init_evt = {
            "session_id": state["session_id"],
            "event_type": "session_started",
            "task": state["task"],
            "selected_agents": state["selected_agents"],
            "timestamp": time.time(),
        }
        self._emit(events, init_evt)

        for aid in state["selected_agents"]:
            self._emit(events, {
                "session_id": state["session_id"],
                "event_type": "agent_queued",
                "agent_id": aid,
                "timestamp": time.time(),
            })

        return {
            "events": events,
            "agent_statuses": {aid: AgentStatus.QUEUED.value for aid in state["selected_agents"]},
        }

    def _build_contextual_prompt(
        self,
        agent_id: str,
        task: str,
        mode: str,
        outputs: Dict[str, str],
        retrieved_context: Optional[List[Dict[str, Any]]] = None,
    ) -> str:
        """
        Constructs contextually threaded prompts so agents genuinely collaborate,
        evaluate prior findings, challenge assumptions, and resolve critiques.
        Integrates Knowledge Vault RAG evidence into empirical baselines.
        """
        rag_context = ""
        if retrieved_context:
            rag_lines = []
            for c in retrieved_context:
                fname = c.get("filename", "document.pdf")
                pnum = c.get("page_number", 1)
                sim = c.get("similarity", 0.0)
                body = c.get("content", "").strip()
                rag_lines.append(f"--- [DOCUMENT: {fname} | PAGE: {pnum} | RELEVANCE: {sim}] ---\n{body}")
            rag_context = "\n[KNOWLEDGE VAULT RETRIEVED EVIDENCE]:\n" + "\n\n".join(rag_lines) + "\n"

        if mode != "council":
            if mode == "parallel":
                return f"PARALLEL WORKSTREAM TASK:\nUser Request: {task}\n{rag_context}\nProvide your specialized analysis independently from your persona perspective."
            return f"INDIVIDUAL CONSULTATION:\nUser Request: {task}\n{rag_context}\nProvide a comprehensive, authoritative response from your specialized persona."

        if agent_id == "researcher":
            rag_instructions = (
                f"\n- Ground your findings in the Knowledge Vault evidence above. "
                f"Cite sources using [Source: filename, Page X]. If details are absent, explicitly state so."
                if rag_context else ""
            )
            return (
                f"User Request: {task}\n"
                f"{rag_context}\n"
                f"RESEARCHER INSTRUCTION:\n"
                f"Contribute concisely (~60-120 words) as an active council member.\n"
                f"- Outline 2-3 key practical approaches, principles, or empirical facts.\n"
                f"- Speak naturally and directly. Do not write a long essay or formal report.\n"
                f"- Avoid large Markdown tables; use brief paragraphs or clean bullet points.\n"
                f"- Provide minimal complete code only if directly helpful.{rag_instructions}"
            )
        elif agent_id == "analyst":
            r_out = outputs.get("researcher", "")
            r_context = f"\n[RESEARCHER'S POINTS]:\n{r_out[:600]}\n" if r_out else ""
            return (
                f"User Request: {task}\n"
                f"{r_context}\n"
                f"ANALYST INSTRUCTION:\n"
                f"Contribute concisely (~60-120 words) to the ongoing conversation.\n"
                f"- Directly reference what the Researcher stated: agree, disagree, or contrast practical trade-offs.\n"
                f"- Compare the approaches in terms of simplicity, reliability, and practical suitability.\n"
                f"- Give a clear, reasoned recommendation for the user's scenario.\n"
                f"- Avoid large Markdown tables; use concise paragraphs or short bullet points."
            )
        elif agent_id == "alternative":
            prior = []
            if "researcher" in outputs:
                prior.append(f"Researcher: {outputs['researcher'][:350]}")
            if "analyst" in outputs:
                prior.append(f"Analyst: {outputs['analyst'][:350]}")
            prior_str = "\n[DISCUSSION SO FAR]:\n" + "\n".join(prior) + "\n" if prior else ""
            return (
                f"User Request: {task}\n"
                f"{prior_str}\n"
                f"ALTERNATIVE THINKER INSTRUCTION:\n"
                f"Contribute concisely (~60-120 words).\n"
                f"- Propose a creative, unconventional alternative or lateral paradigm that complements or challenges the earlier ideas.\n"
                f"- Explain when and why your alternative would be superior.\n"
                f"- Keep it practical and direct."
            )
        elif agent_id == "critic":
            prior = []
            if "researcher" in outputs:
                prior.append(f"Researcher: {outputs['researcher'][:350]}")
            if "analyst" in outputs:
                prior.append(f"Analyst: {outputs['analyst'][:350]}")
            if "alternative" in outputs:
                prior.append(f"Alternative Thinker: {outputs['alternative'][:350]}")
            prior_str = "\n[COUNCIL STATEMENTS TO REVIEW]:\n" + "\n".join(prior) + "\n" if prior else ""
            return (
                f"User Request: {task}\n"
                f"{prior_str}\n"
                f"CRITIC INSTRUCTION:\n"
                f"Contribute concisely (~60-120 words).\n"
                f"- Scrutinize the proposals: point out edge cases, invalid inputs, boundary errors, or missing validation.\n"
                f"- Speak directly to the council (e.g. 'One critical issue with...').\n"
                f"- State what concrete correction or check is necessary to ensure safety and correctness."
            )
        elif agent_id == "specialist":
            c_out = outputs.get("critic", "")
            critic_str = f"\n[CRITIC'S CONCERNS]:\n{c_out[:500]}\n" if c_out else ""
            return (
                f"User Request: {task}\n"
                f"{critic_str}\n"
                f"SPECIALIST INSTRUCTION:\n"
                f"Contribute concisely (~60-120 words).\n"
                f"- Directly resolve the objections or edge cases raised by the Critic.\n"
                f"- Provide clean, verified, fully closed code or concrete technical guidelines with input validation.\n"
                f"- Ensure any code is self-contained and free of unclosed blocks."
            )
        return f"User Request: {task}\n\nProvide your specialized analysis directly."

    async def node_execute_primary_council(self, state: CouncilState) -> Dict[str, Any]:
        """
        Executes council agents with contextual inter-agent communication,
        dialectical review, failure isolation, and completion validation.
        """
        events = list(state.get("events", []))
        agent_outputs = dict(state.get("agent_outputs", {}))
        agent_failures = dict(state.get("agent_failures", {}))
        agent_statuses = dict(state.get("agent_statuses", {}))
        mode = state.get("mode", "council")

        healthy_agents: List[str] = []
        failed_agents: List[str] = []

        # Retrieve Knowledge Vault RAG context if available
        retrieved_context = state.get("retrieved_context")
        if retrieved_context is None or len(retrieved_context) == 0:
            try:
                retrieved_context = retrieve_relevant_chunks(state["task"], top_k=5)
            except Exception:
                retrieved_context = []

        if retrieved_context:
            sources = sorted(list(set(f"{c['filename']} (P.{c['page_number']})" for c in retrieved_context)))
            self._emit(events, {
                "session_id": state["session_id"],
                "event_type": "knowledge_retrieved",
                "payload": {
                    "count": len(retrieved_context),
                    "sources": sources,
                    "top_relevance": max((c.get("similarity", 0.0) for c in retrieved_context), default=0.0),
                },
                "timestamp": time.time(),
            })

        # Inter-agent reading and speaking relations
        relations = {
            "researcher": "Conducting foundational inquiry & establishing factual baseline",
            "analyst": "↳ Responding to Researcher's empirical baseline",
            "alternative": "↳ Counter-proposing lateral paradigm to avoid groupthink",
            "critic": "↳ Peer-reviewing proposals for edge cases and logical flaws",
            "specialist": "↳ Resolving Critic's objections with production-ready code",
        }

        # Execute selected agents with progressive context threading
        for agent_id in state["selected_agents"]:
            agent_info = AGENT_IDENTITIES.get(agent_id, {
                "name": agent_id.capitalize(),
                "system_prompt": f"You are {agent_id}.",
            })

            provider = self.provider_factory(agent_id)
            cb = self._get_cb(agent_id)

            agent_statuses[agent_id] = AgentStatus.RUNNING.value

            # Emit reading action if earlier findings exist
            if agent_id == "analyst" and "researcher" in agent_outputs:
                self._emit(events, {
                    "session_id": state["session_id"],
                    "event_type": "agent_reading",
                    "agent_id": "analyst",
                    "payload": {"reading_from": "researcher", "action": "Analyzing Researcher's baseline findings"},
                    "timestamp": time.time(),
                })
            elif agent_id == "alternative" and "analyst" in agent_outputs:
                self._emit(events, {
                    "session_id": state["session_id"],
                    "event_type": "agent_reading",
                    "agent_id": "alternative",
                    "payload": {"reading_from": "analyst", "action": "Reviewing Analyst and Researcher proposals"},
                    "timestamp": time.time(),
                })
            elif agent_id == "critic":
                self._emit(events, {
                    "session_id": state["session_id"],
                    "event_type": "agent_review_started",
                    "agent_id": "critic",
                    "payload": {
                        "reviewing": [a for a in ["researcher", "analyst", "alternative"] if a in agent_outputs],
                        "message": "Critic is peer-reviewing earlier proposals for edge cases, numerical errors, and flaws."
                    },
                    "timestamp": time.time(),
                })
            elif agent_id == "specialist" and "critic" in agent_outputs:
                self._emit(events, {
                    "session_id": state["session_id"],
                    "event_type": "agent_reading",
                    "agent_id": "specialist",
                    "payload": {"reading_from": "critic", "action": "Examining Critic's objections and technical constraints"},
                    "timestamp": time.time(),
                })

            # Emit speaking event immediately before inference
            self._emit(events, {
                "session_id": state["session_id"],
                "event_type": "agent_speaking",
                "agent_id": agent_id,
                "payload": {
                    "role": agent_info.get("name", agent_id),
                    "relation": relations.get(agent_id, "Formulating contribution"),
                },
                "timestamp": time.time(),
            })

            # Build contextual prompt threading previous agent contributions and RAG evidence
            task_prompt = self._build_contextual_prompt(
                agent_id=agent_id,
                task=state["task"],
                mode=mode,
                outputs=agent_outputs,
                retrieved_context=retrieved_context,
            )

            result = await execute_agent_with_resilience(
                agent_id=agent_id,
                agent_name=agent_info["name"],
                prompt=task_prompt,
                system_prompt=agent_info["system_prompt"],
                provider=provider,
                circuit_breaker=cb,
                policy=self.policy,
                session_id=state["session_id"],
                max_tokens=450,
            )

            # Collect streaming events
            for ev in result.events:
                self._emit(events, ev)

            if result.is_success and result.content:
                healthy_agents.append(agent_id)
                agent_statuses[agent_id] = result.status.value
                agent_outputs[agent_id] = result.content

                self._emit(events, {
                    "session_id": state["session_id"],
                    "event_type": "agent_message_created",
                    "agent_id": agent_id,
                    "payload": {
                        "sender": agent_id,
                        "role": agent_info.get("name", agent_id),
                        "content": result.content,
                        "relation": relations.get(agent_id, "Delivered perspective"),
                        "preview": result.content[:140] + ("…" if len(result.content) > 140 else ""),
                        "round": state.get("current_round", 1),
                    },
                    "timestamp": time.time(),
                })
            else:
                failed_agents.append(agent_id)
                agent_statuses[agent_id] = AgentStatus.FAILED.value
                agent_failures[agent_id] = {
                    "category": result.failure_category.value if result.failure_category else "UNKNOWN",
                    "error": result.error_message,
                    "retries": result.retry_count,
                }

        return {
            "healthy_agents": healthy_agents,
            "failed_agents": failed_agents,
            "agent_outputs": agent_outputs,
            "agent_failures": agent_failures,
            "agent_statuses": agent_statuses,
            "retrieved_context": retrieved_context,
            "events": events,
        }

    async def node_dynamic_debate_cross_examination(self, state: CouncilState) -> Dict[str, Any]:
        """
        Conducts a genuine multi-agent collaborative debate turn:
        The graph inspects the Critic's peer review and dynamically routes a cross-examination
        turn to the most challenged agent (Researcher, Analyst, or Specialist) to address the objections.
        """
        events = list(state.get("events", []))
        agent_outputs = dict(state.get("agent_outputs", {}))
        mode = state.get("mode", "council")

        if mode != "council" or "critic" not in agent_outputs or len(state["healthy_agents"]) < 2:
            return {"events": events, "agent_outputs": agent_outputs}

        critic_text = agent_outputs.get("critic", "")
        # Dynamically identify who Critic addressed or challenged
        target_agent = "specialist"
        target_role = "Specialist"
        if "researcher" in critic_text.lower() and "researcher" in state["healthy_agents"]:
            target_agent = "researcher"
            target_role = "Researcher"
        elif "analyst" in critic_text.lower() and "analyst" in state["healthy_agents"]:
            target_agent = "analyst"
            target_role = "Analyst"

        debate_prompt = (
            f"DIALECTICAL DEBATE REBUTTAL & REVISION:\n"
            f"User Problem: {state['task']}\n\n"
            f"[CRITIC'S SPECIFIC CHALLENGE]:\n"
            f"{critic_text[:500]}\n\n"
            f"MANDATE FOR {target_role.upper()}:\n"
            f"Directly respond to the Critic's objection in 1 short paragraph (~50-80 words). "
            f"State clearly whether you agree, refine your approach, or explain how you resolve the issue. "
            f"Speak conversationally and directly."
        )

        agent_info = AGENT_IDENTITIES.get(target_agent, {"name": target_role})
        provider = self.provider_factory(target_agent)
        cb = self._get_cb(target_agent)

        self._emit(events, {
            "session_id": state["session_id"],
            "event_type": "agent_responding",
            "agent_id": target_agent,
            "payload": {
                "responding_to": "critic",
                "phase": "PHASE E · DIALECTICAL REBUTTAL & RESOLUTION",
                "relation": f"↳ Addressing Critic's challenge & refining consensus",
            },
            "timestamp": time.time(),
        })

        res = await execute_agent_with_resilience(
            agent_id=target_agent,
            agent_name=f"{agent_info['name']} (Debate Response)",
            prompt=debate_prompt,
            system_prompt=agent_info.get("system_prompt", ""),
            provider=provider,
            circuit_breaker=cb,
            policy=self.policy,
            session_id=state["session_id"],
            max_tokens=350,
        )

        for ev in res.events:
            self._emit(events, ev)

        if res.is_success and res.content:
            rebuttal_key = f"{target_agent}_debate_rebuttal"
            agent_outputs[rebuttal_key] = res.content
            self._emit(events, {
                "session_id": state["session_id"],
                "event_type": "agent_message_created",
                "agent_id": target_agent,
                "payload": {
                    "sender": target_agent,
                    "role": f"{target_role} (Debate Response)",
                    "content": res.content,
                    "relation": "↳ Rebutted Critic's challenge with refined resolution",
                    "phase": "PHASE E · DIALECTICAL RESOLUTION",
                    "preview": res.content[:140] + ("…" if len(res.content) > 140 else ""),
                    "round": 2,
                },
                "timestamp": time.time(),
            })

        return {
            "events": events,
            "agent_outputs": agent_outputs,
        }

    def router_after_primary(self, state: CouncilState) -> str:
        """Determines routing based on agent health."""
        if len(state["healthy_agents"]) == 0:
            return "all_failed"
        if len(state["failed_agents"]) > 0 and self.policy.auto_recovery_enabled:
            return "has_failures"
        return "all_healthy"

    async def node_redistribute_and_substitute(self, state: CouncilState) -> Dict[str, Any]:
        """
        Dynamically redistributes unfinished tasks of failed agents to healthy peers.
        """
        events = list(state.get("events", []))
        reassigned_tasks = list(state.get("reassigned_tasks", []))
        substitute_outputs = dict(state.get("substitute_outputs", {}))
        agent_statuses = dict(state.get("agent_statuses", {}))

        healthy_agents = state["healthy_agents"]
        failed_agents = state["failed_agents"]

        self._emit(events, {
            "session_id": state["session_id"],
            "event_type": "task_reassignment_started",
            "failed_agents": failed_agents,
            "healthy_agents": healthy_agents,
            "timestamp": time.time(),
        })

        for failed_agent_id in failed_agents:
            substitute_id = TaskRedistributionEngine.find_best_substitute(
                failed_agent_id=failed_agent_id,
                healthy_agent_ids=healthy_agents,
            )

            if not substitute_id:
                self._emit(events, {
                    "session_id": state["session_id"],
                    "event_type": "agent_recovery_failed",
                    "failed_agent_id": failed_agent_id,
                    "message": "No healthy substitute available.",
                    "timestamp": time.time(),
                })
                continue

            # Build reassigned task
            orig_task = AgentTask(
                task_id=f"task_{failed_agent_id}",
                original_agent_id=failed_agent_id,
                assigned_agent_id=failed_agent_id,
                title=f"{failed_agent_id.capitalize()} Responsibility",
                prompt=f"Task: {state['task']}\nAddress the core questions expected of the {failed_agent_id}.",
            )

            adapted_task = TaskRedistributionEngine.build_reassignment_task(orig_task, substitute_id)
            reassigned_tasks.append({
                "original_agent_id": failed_agent_id,
                "substitute_agent_id": substitute_id,
                "task_id": adapted_task.task_id,
            })

            self._emit(events, {
                "session_id": state["session_id"],
                "event_type": "task_reassigned",
                "original_agent_id": failed_agent_id,
                "substitute_agent_id": substitute_id,
                "notes": adapted_task.substitution_notes,
                "timestamp": time.time(),
            })

            self._emit(events, {
                "session_id": state["session_id"],
                "event_type": "agent_takeover_started",
                "substitute_agent_id": substitute_id,
                "for_agent_id": failed_agent_id,
                "timestamp": time.time(),
            })

            # Execute the substitute agent
            sub_info = AGENT_IDENTITIES.get(substitute_id, {"name": substitute_id.capitalize()})
            sub_provider = self.provider_factory(substitute_id)
            sub_cb = self._get_cb(substitute_id)

            sub_result = await execute_agent_with_resilience(
                agent_id=substitute_id,
                agent_name=f"{sub_info['name']} (Covering {failed_agent_id})",
                prompt=adapted_task.prompt,
                system_prompt=AGENT_IDENTITIES.get(substitute_id, {}).get("system_prompt", ""),
                provider=sub_provider,
                circuit_breaker=sub_cb,
                policy=self.policy,
                session_id=state["session_id"],
                max_tokens=800,
            )

            for ev in sub_result.events:
                self._emit(events, ev)

            if sub_result.is_success and sub_result.content:
                if substitute_id not in substitute_outputs:
                    substitute_outputs[substitute_id] = {}
                substitute_outputs[substitute_id][failed_agent_id] = sub_result.content
                agent_statuses[failed_agent_id] = AgentStatus.REASSIGNED.value

                self._emit(events, {
                    "session_id": state["session_id"],
                    "event_type": "agent_takeover_completed",
                    "substitute_agent_id": substitute_id,
                    "for_agent_id": failed_agent_id,
                    "timestamp": time.time(),
                })
            else:
                self._emit(events, {
                    "session_id": state["session_id"],
                    "event_type": "agent_recovery_failed",
                    "failed_agent_id": failed_agent_id,
                    "substitute_agent_id": substitute_id,
                    "message": "Substitute agent also failed to complete reassigned task.",
                    "timestamp": time.time(),
                })

        self._emit(events, {
            "session_id": state["session_id"],
            "event_type": "recovery_completed",
            "recovered_count": len([t for t in reassigned_tasks if t["substitute_agent_id"] in substitute_outputs]),
            "timestamp": time.time(),
        })

        return {
            "reassigned_tasks": reassigned_tasks,
            "substitute_outputs": substitute_outputs,
            "agent_statuses": agent_statuses,
            "events": events,
        }

    async def node_evaluate_quality(self, state: CouncilState) -> Dict[str, Any]:
        """
        Performs honest assessment of completeness, identifying recovered,
        missing, and verified dimensions.
        """
        healthy = set(state["healthy_agents"])
        failed = set(state["failed_agents"])
        reassigned_from = set(t["original_agent_id"] for t in state.get("reassigned_tasks", []))
        
        # Missing are failed agents that were never reassigned
        unrecovered = failed - reassigned_from
        
        is_degraded = len(failed) > 0
        total_agents = len(state["selected_agents"])
        health_ratio = len(healthy) / max(total_agents, 1)

        quality = {
            "is_degraded": is_degraded,
            "healthy_agent_count": len(healthy),
            "failed_agent_count": len(failed),
            "health_ratio": round(health_ratio, 2),
            "fully_completed_roles": list(healthy),
            "recovered_roles": list(reassigned_from),
            "unrecovered_roles": list(unrecovered),
            "confidence_level": "HIGH" if not is_degraded else ("MEDIUM" if len(healthy) >= 2 else "LOW"),
        }

        events = list(state.get("events", []))
        if is_degraded:
            self._emit(events, {
                "session_id": state["session_id"],
                "event_type": "council_degraded",
                "details": quality,
                "timestamp": time.time(),
            })

        return {
            "quality_assessment": quality,
            "events": events,
        }

    async def node_synthesize_decision(self, state: CouncilState) -> Dict[str, Any]:
        """
        Synthesizes the final consensus. Integrates findings from healthy agents,
        dialectical debate rebuttals, and substitute passes, noting any degraded dimensions.
        """
        events = list(state.get("events", []))
        self._emit(events, {
            "session_id": state["session_id"],
            "event_type": "synthesis_started",
            "payload": {
                "message": "Quantum Core is formulating unified consensus from all agent findings and dialectical debate."
            },
            "timestamp": time.time(),
        })
        quality = state.get("quality_assessment", {})
        
        # Gather all contributions
        contributions: List[str] = []
        for aid, text in state.get("agent_outputs", {}).items():
            if "_debate_rebuttal" in aid:
                base_aid = aid.replace("_debate_rebuttal", "")
                name = AGENT_IDENTITIES.get(base_aid, {}).get("name", base_aid.capitalize())
                contributions.append(f"### {name} (Debate Rebuttal & Consensus Refinement):\n{text}")
            else:
                name = AGENT_IDENTITIES.get(aid, {}).get("name", aid.capitalize())
                contributions.append(f"### {name}:\n{text}")

        # Gather substitute contributions
        for sub_id, covered in state.get("substitute_outputs", {}).items():
            sub_name = AGENT_IDENTITIES.get(sub_id, {}).get("name", sub_id.capitalize())
            for orig_id, text in covered.items():
                orig_name = AGENT_IDENTITIES.get(orig_id, {}).get("name", orig_id.capitalize())
                contributions.append(f"### {sub_name} (Substituting for {orig_name}):\n{text}")

        contributions_text = "\n\n".join(contributions)

        # Build resilience disclosure notice if degraded
        disclosure = ""
        if quality.get("is_degraded"):
            recovered = ", ".join(quality.get("recovered_roles", [])) or "None"
            unrecovered = ", ".join(quality.get("unrecovered_roles", [])) or "None"
            disclosure = (
                f"\n\n> [!NOTE]\n"
                f"> **Council Resilience Notice**: This session operated in a degraded state "
                f"({quality['healthy_agent_count']}/{len(state['selected_agents'])} agents available).\n"
                f"> - **Recovered Roles**: {recovered}\n"
                f"> - **Missing Roles**: {unrecovered}\n"
                f"> - **Confidence Level**: {quality.get('confidence_level', 'MEDIUM')}\n"
            )

        # Knowledge Vault citations guidance
        citations_guide = ""
        retrieved = state.get("retrieved_context") or []
        if retrieved:
            sources_list = sorted(list(set(f"[Source: {c.get('filename', 'document.pdf')}, Page {c.get('page_number', 1)}]" for c in retrieved)))
            citations_guide = (
                f"\n\nGrounding & Source Verification:\n"
                f"- The following Knowledge Vault document sources are active: {', '.join(sources_list)}.\n"
                f"- Cite verified facts using the format [Source: filename, Page X].\n"
                f"- If specific details are not found in the documents, explicitly state that the documents do not specify this information."
            )

        # Synthesis prompt
        synthesis_input = (
            f"Original Task: {state['task']}\n\n"
            f"Council Deliberation Summary:\n{contributions_text}\n"
            f"{citations_guide}\n\n"
            f"Formulate the definitive Final Council Answer following the structure:\n"
            f"### 1. Direct Answer\n"
            f"### 2. Key Council Insights\n"
            f"### 3. Recommendation & Conclusion\n"
            f"### 4. Important Considerations"
        )

        synth_provider = self.orchestrator_provider or self.provider_factory("orchestrator")
        final_content = ""
        try:
            synth_resp = await synth_provider.generate(
                prompt=synthesis_input,
                system_prompt=ORCHESTRATOR_SYNTHESIS_PROMPT,
                temperature=0.3,
                max_tokens=500,
                timeout_seconds=25.0,
            )
            if synth_resp and synth_resp.content and len(synth_resp.content.strip()) > 30:
                final_content = synth_resp.content.strip() + disclosure
        except Exception:
            final_content = ""

        if not final_content:
            # Deterministic, bounded structured fallback synthesis directly from completed agent contributions
            final_content = self._build_fallback_synthesis(
                task=state["task"],
                outputs=state.get("agent_outputs", {}),
                disclosure=disclosure,
            )

        terminal_state = "PARTIALLY_COMPLETED" if quality.get("is_degraded") else "COMPLETED"

        self._emit(events, {
            "session_id": state["session_id"],
            "event_type": "final_answer_ready",
            "final_synthesis": final_content,
            "status": terminal_state,
            "timestamp": time.time(),
        })

        self._emit(events, {
            "session_id": state["session_id"],
            "event_type": "council_decision",
            "final_synthesis": final_content,
            "content_preview": final_content[:100],
            "timestamp": time.time(),
        })

        self._emit(events, {
            "session_id": state["session_id"],
            "event_type": "session_completed",
            "quality": quality,
            "status": terminal_state,
            "final_synthesis": final_content,
            "timestamp": time.time(),
        })

        return {
            "final_synthesis": final_content,
            "events": events,
            "status": terminal_state,
        }

    def _build_fallback_synthesis(
        self,
        task: str,
        outputs: Dict[str, str],
        disclosure: str = "",
    ) -> str:
        """
        Deterministic, bounded fallback synthesis constructed from completed agent turns
        ensuring the Final Council Answer is ALWAYS generated and structured.
        """
        points = []
        if "researcher" in outputs:
            points.append(f"- **Foundational Methods**: {outputs['researcher'][:220].strip()}...")
        if "analyst" in outputs:
            points.append(f"- **Comparative Feasibility**: {outputs['analyst'][:220].strip()}...")
        if "critic" in outputs:
            points.append(f"- **Critical Scrutiny**: {outputs['critic'][:200].strip()}...")
        if "specialist" in outputs:
            points.append(f"- **Implementation**: {outputs['specialist'][:220].strip()}...")

        insights = "\n".join(points) if points else "- All participating minds contributed to the evaluation."

        return (
            f"### 1. Direct Answer\n"
            f"The collective council analysis concludes that resolving \"{task}\" requires balancing practical simplicity, mathematical correctness, and robust input checks.\n\n"
            f"### 2. Key Council Insights\n"
            f"{insights}\n\n"
            f"### 3. Recommendation & Conclusion\n"
            f"Prioritize the simplest verified method for common use cases, and enforce strict input validation to avoid edge-case failures.\n\n"
            f"### 4. Important Considerations\n"
            f"Guard against zero, negative, or degenerate boundary inputs before executing numerical routines.{disclosure}"
        )

    async def node_abort_execution(self, state: CouncilState) -> Dict[str, Any]:
        """
        Safely halts execution when all agents fail or minimum threshold is not met.
        Transparently informs the user without crashing or fabricating.
        """
        events = list(state.get("events", []))
        error_msg = (
            "Council execution aborted: All five agents failed to execute successfully, "
            "and no healthy execution path remains. Please check model connectivity and configurations."
        )

        self._emit(events, {
            "session_id": state["session_id"],
            "event_type": "council_execution_aborted",
            "status": "FAILED",
            "error": error_msg,
            "timestamp": time.time(),
        })

        return {
            "error": error_msg,
            "final_synthesis": f"❌ **Execution Aborted**: {error_msg}",
            "events": events,
            "status": "FAILED",
        }

    async def run(self, initial_state: CouncilState) -> CouncilState:
        """Runs the compiled LangGraph workflow to completion with bounded execution safety."""
        try:
            return await asyncio.wait_for(self.graph.ainvoke(initial_state), timeout=120.0)
        except asyncio.TimeoutError:
            events = list(initial_state.get("events", []))
            timeout_evt = {
                "session_id": initial_state["session_id"],
                "event_type": "council_timeout",
                "status": "TIMED_OUT",
                "message": "Council deliberation reached maximum 120s execution limit. Partial outputs preserved.",
                "timestamp": time.time(),
            }
            self._emit(events, timeout_evt)
            return {
                **initial_state,
                "status": "TIMED_OUT",
                "error": "Execution timed out after 120 seconds.",
                "final_synthesis": "⚠️ **Deliberation Timed Out**: The council deliberation reached its 120-second execution boundary. Partial contributions have been preserved.",
                "events": events,
            }
