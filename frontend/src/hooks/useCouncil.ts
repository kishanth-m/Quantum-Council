import { useState, useCallback, useRef } from 'react';
import { AgentId, AgentVisualStatus, AGENT_PROFILES } from '../types/agent';
import { CouncilSessionDetail, StartSessionRequest } from '../types/council';
import { councilService } from '../services/councilService';
import { TimelineEvent } from '../components/council/DiscussionTimeline';

export interface CouncilTurn {
  id: string;
  agentId: AgentId;
  agentName: string;
  role: string;
  badge: string;
  color: string;
  accentHex: string;
  content: string;
  phaseLabel: string;
  relationPill: string;
  timestamp: string;
  isSubstitute?: boolean;
  substitutedFor?: string;
  isFailure?: boolean;
  errorMessage?: string;
}

export function useCouncil() {
  const [session, setSession] = useState<CouncilSessionDetail | null>(null);
  const [finalSynthesis, setFinalSynthesis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AgentId | null>('analyst');
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [displayedTurns, setDisplayedTurns] = useState<CouncilTurn[]>([]);
  const [currentActiveAgent, setCurrentActiveAgent] = useState<AgentId | 'orchestrator' | null>(null);
  const [currentActionDescription, setCurrentActionDescription] = useState<string>('');
  const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentVisualStatus>>({
    researcher: 'idle',
    analyst: 'idle',
    alternative: 'idle',
    critic: 'idle',
    specialist: 'idle',
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const resetSession = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (session?.id) {
      councilService.cancelSession(session.id).catch(() => {});
    }
    setLoading(false);
    setSession(null);
    setFinalSynthesis(null);
    setError(null);
    setEvents([]);
    setDisplayedTurns([]);
    setCurrentActiveAgent(null);
    setCurrentActionDescription('');
    setAgentStatuses({
      researcher: 'idle',
      analyst: 'idle',
      alternative: 'idle',
      critic: 'idle',
      specialist: 'idle',
    });
  }, [session?.id]);

  const startSession = useCallback(async (req: StartSessionRequest) => {
    abortControllerRef.current = new AbortController();
    setLoading(true);
    setError(null);
    setEvents([]);
    setDisplayedTurns([]);
    setFinalSynthesis(null);
    setCurrentActiveAgent(null);
    setCurrentActionDescription('Convening Quantum Council & initializing orchestration state...');

    const participatingAgents: AgentId[] = req.mode === 'individual' && req.agent_id
      ? [req.agent_id]
      : ['researcher', 'analyst', 'alternative', 'critic', 'specialist'];

    // Set all participating agents to queued
    const queuedState: Record<string, AgentVisualStatus> = {
      researcher: 'idle',
      analyst: 'idle',
      alternative: 'idle',
      critic: 'idle',
      specialist: 'idle',
    };
    participatingAgents.forEach((aid) => {
      queuedState[aid] = 'queued';
    });
    setAgentStatuses(queuedState);

    const phaseMeta: Record<string, { phase: string; relation: string }> = {
      researcher: {
        phase: 'PHASE A · EMPIRICAL INQUIRY',
        relation: 'Establishing foundational factual baseline & literature inquiry',
      },
      analyst: {
        phase: 'PHASE B · LOGICAL REASONING',
        relation: '↳ Directly responding to Researcher\'s empirical baseline',
      },
      alternative: {
        phase: 'PHASE B · LATERAL EXPLORATION',
        relation: '↳ Counter-proposing divergent paradigm & unconventional vectors',
      },
      critic: {
        phase: 'PHASE C · ADVERSARIAL SCRUTINY',
        relation: '↳ Scrutinizing earlier proposals for fallacies, edge cases & risks',
      },
      specialist: {
        phase: 'PHASE D · TECHNICAL RESOLUTION',
        relation: '↳ Reconciling trade-offs & resolving Critic\'s objections',
      },
    };

    try {
      // 1. Attempt real-time SSE stream
      const streamRes = await fetch('/api/v1/council/session/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
        signal: abortControllerRef.current.signal,
      });

      if (streamRes.ok && streamRes.body) {
        const reader = streamRes.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';

          for (const part of parts) {
            const trimmed = part.trim();
            if (!trimmed || trimmed.startsWith(':')) continue;

            const lines = trimmed.split('\n');
            let eventType = 'activity';
            let dataStr = '';

            for (const line of lines) {
              if (line.startsWith('event:')) {
                eventType = line.replace('event:', '').trim();
              } else if (line.startsWith('data:')) {
                dataStr = line.replace('data:', '').trim();
              }
            }

            if (!dataStr) continue;

            try {
              const data = JSON.parse(dataStr);

              // Append to telemetry timeline
              setEvents((prev) => [
                ...prev,
                {
                  id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                  event_type: eventType as any,
                  agent_id: data.agent_id,
                  payload: data.payload || data,
                  timestamp: new Date().toLocaleTimeString(),
                },
              ]);

              // Handle live execution states
              if (eventType === 'agent_speaking') {
                const aid = data.agent_id as AgentId;
                setCurrentActiveAgent(aid);
                setAgentStatuses((prev) => ({ ...prev, [aid]: 'speaking' }));
                setCurrentActionDescription(data.payload?.relation || `${data.payload?.role || aid} is formulating contribution...`);
              } else if (eventType === 'agent_reading') {
                const aid = data.agent_id as AgentId;
                setCurrentActiveAgent(aid);
                setAgentStatuses((prev) => ({ ...prev, [aid]: 'reviewing' }));
                setCurrentActionDescription(data.payload?.action || `${aid} is reading previous findings...`);
              } else if (eventType === 'agent_review_started') {
                setCurrentActiveAgent('critic');
                setAgentStatuses((prev) => ({ ...prev, critic: 'reviewing' }));
                setCurrentActionDescription(data.payload?.message || 'Critic is peer-reviewing earlier proposals for vulnerabilities.');
              } else if (eventType === 'agent_responding') {
                const aid = data.agent_id as AgentId;
                setCurrentActiveAgent(aid);
                setAgentStatuses((prev) => ({ ...prev, [aid]: 'responding' }));
                setCurrentActionDescription(data.payload?.relation || 'Responding to Critic\'s challenge & refining consensus');
              } else if (eventType === 'agent_message_created') {
                const aid = data.agent_id as AgentId;
                const profile = AGENT_PROFILES[aid] || {
                  name: data.payload?.role || aid,
                  role: 'Council Mind',
                  badge: 'CONTRIBUTION',
                  color: 'from-cyan-600 to-blue-700',
                  accentHex: '#00D2FF',
                };

                const turnId = `turn-${aid}-${data.payload?.round || 1}`;
                setDisplayedTurns((prev) => {
                  if (prev.some((t) => t.id === turnId)) return prev;
                  return [
                    ...prev,
                    {
                      id: turnId,
                      agentId: aid,
                      agentName: data.payload?.role || profile.name,
                      role: profile.role,
                      badge: data.payload?.round === 2 ? 'REVISION' : profile.badge,
                      color: profile.color,
                      accentHex: profile.accentHex,
                      content: data.payload?.content || '',
                      phaseLabel: data.payload?.phase || phaseMeta[aid]?.phase || 'COUNCIL DELIBERATION',
                      relationPill: data.payload?.relation || phaseMeta[aid]?.relation || 'Dialectical contribution',
                      timestamp: new Date().toLocaleTimeString(),
                    },
                  ];
                });

                setAgentStatuses((prev) => ({ ...prev, [aid]: 'completed' }));
              } else if (eventType === 'agent_failed') {
                const aid = data.agent_id as AgentId;
                setAgentStatuses((prev) => ({ ...prev, [aid]: 'failed' }));
                setDisplayedTurns((prev) => [
                  ...prev,
                  {
                    id: `turn-fail-${aid}`,
                    agentId: aid,
                    agentName: aid.toUpperCase(),
                    role: 'Isolated Agent',
                    badge: 'FAILED',
                    color: 'from-rose-600 to-red-700',
                    accentHex: '#F43F5E',
                    content: data.message || 'Agent failed during inference and was safely isolated by the circuit breaker.',
                    phaseLabel: 'CIRCUIT BREAKER ISOLATION',
                    relationPill: 'Execution failure isolated · Automatic recovery activated',
                    timestamp: new Date().toLocaleTimeString(),
                    isFailure: true,
                    errorMessage: data.message,
                  },
                ]);
              } else if (eventType === 'synthesis_started') {
                setCurrentActiveAgent('orchestrator');
                setCurrentActionDescription('Quantum Core is formulating unified consensus from all minds and debate resolutions.');
              } else if (eventType === 'final_answer_ready' || eventType === 'council_decision') {
                const synth = data.final_synthesis || (typeof data.payload === 'string' ? data.payload : data.payload?.final_synthesis);
                if (synth) {
                  setFinalSynthesis(synth);
                }
              } else if (eventType === 'session_completed') {
                const synth = data.final_synthesis || data.detail?.final_synthesis;
                if (synth) {
                  setFinalSynthesis(synth);
                }
                if (data.detail) {
                  setSession(data.detail);
                } else {
                  setSession((prev) => ({
                    id: data.session_id || prev?.id || 'session-live',
                    task: req.task,
                    mode: req.mode,
                    status: data.status || 'COMPLETED',
                    healthy_agents: data.healthy_agents || prev?.healthy_agents || [],
                    failed_agents: data.failed_agents || prev?.failed_agents || [],
                    agent_statuses: data.agent_statuses || prev?.agent_statuses || {},
                    agent_outputs: data.agent_outputs || prev?.agent_outputs || {},
                    agent_failures: prev?.agent_failures || {},
                    reassigned_tasks: prev?.reassigned_tasks || [],
                    substitute_outputs: prev?.substitute_outputs || {},
                    quality_assessment: data.quality || prev?.quality_assessment,
                    final_synthesis: synth || prev?.final_synthesis,
                    created_at: prev?.created_at || new Date().toISOString(),
                  }));
                }
                setCurrentActiveAgent(null);
                setCurrentActionDescription('Deliberation concluded successfully.');
              } else if (eventType === 'council_cancelled') {
                setCurrentActiveAgent(null);
                setCurrentActionDescription('Deliberation cancelled by user.');
              }
            } catch (err) {
              console.warn('Failed to parse SSE payload', err);
            }
          }
        }

        setCurrentActiveAgent(null);
        setLoading(false);
        return;
      }

      // 2. Fallback to standard request if streaming endpoint is unavailable
      const initialDetail = await councilService.startSession(req, abortControllerRef.current.signal);
      setSession(initialDetail);
      if (initialDetail.final_synthesis) {
        setFinalSynthesis(initialDetail.final_synthesis);
      }

      const outputs = initialDetail.agent_outputs || {};
      const turns: CouncilTurn[] = [];

      participatingAgents.forEach((agentId) => {
        const profile = AGENT_PROFILES[agentId];
        const content = outputs[agentId] || '';
        if (content) {
          turns.push({
            id: `turn-${agentId}`,
            agentId,
            agentName: profile.name,
            role: profile.role,
            badge: profile.badge,
            color: profile.color,
            accentHex: profile.accentHex,
            content,
            phaseLabel: phaseMeta[agentId]?.phase || 'COUNCIL DELIBERATION',
            relationPill: phaseMeta[agentId]?.relation || 'Deliberation contribution',
            timestamp: new Date().toLocaleTimeString(),
          });
        }
      });

      // Also check for debate rebuttals
      Object.keys(outputs).forEach((key) => {
        if (key.includes('_debate_rebuttal')) {
          const aid = key.replace('_debate_rebuttal', '') as AgentId;
          const profile = AGENT_PROFILES[aid] || { name: aid.toUpperCase(), role: 'Rebuttal', badge: 'REVISION', color: 'from-amber-600 to-orange-700', accentHex: '#F59E0B' };
          turns.push({
            id: `turn-${key}`,
            agentId: aid,
            agentName: `${profile.name} (Debate Response)`,
            role: profile.role,
            badge: 'REVISION',
            color: profile.color,
            accentHex: profile.accentHex,
            content: outputs[key],
            phaseLabel: 'PHASE E · DIALECTICAL RESOLUTION',
            relationPill: '↳ Rebutted Critic\'s challenge with refined resolution',
            timestamp: new Date().toLocaleTimeString(),
          });
        }
      });

      setDisplayedTurns(turns);
      setCurrentActiveAgent(null);
      setCurrentActionDescription('Deliberation concluded successfully.');

    } catch (err: any) {
      if (err.name === 'AbortError' || err.message?.toLowerCase().includes('aborted')) {
        setCurrentActionDescription('Deliberation cancelled by user.');
        setCurrentActiveAgent(null);
      } else {
        setError(err.message || 'Failed to complete council session');
        setCurrentActionDescription('Council deliberation encountered an error.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    session,
    finalSynthesis,
    loading,
    error,
    selectedAgent,
    setSelectedAgent,
    events,
    displayedTurns,
    currentActiveAgent,
    currentActionDescription,
    agentStatuses,
    startSession,
    resetSession,
  };
}
