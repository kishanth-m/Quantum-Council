import React, { useState } from 'react';
import { useCouncil } from '../../hooks/useCouncil';
import { useActiveModel } from '../../hooks/useActiveModel';
import { CouncilDais } from './CouncilDais';
import { CouncilDiscussionStream } from './CouncilDiscussionStream';
import { AgentId } from '../../types/agent';
import { 
  Play, 
  RotateCcw, 
  Users, 
  Layers, 
  User, 
  Cpu, 
  RefreshCw, 
  Activity,
  X,
  Sparkles,
  ChevronRight
} from 'lucide-react';

export const CouncilRoom: React.FC = () => {
  const {
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
  } = useCouncil();
  const { activeModel } = useActiveModel();

  const [taskPrompt, setTaskPrompt] = useState(
    'Analyse the architectural trade-offs between local on-device small language models (SLMs) and cloud-hosted frontier LLMs for high-reliability systems.'
  );
  const [mode, setMode] = useState<'council' | 'parallel' | 'individual'>('council');
  const [individualAgent, setIndividualAgent] = useState<AgentId>('analyst');
  const [showLogDrawer, setShowLogDrawer] = useState(false);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!taskPrompt.trim() || loading) return;

    startSession({
      task: taskPrompt,
      mode,
      agent_id: mode === 'individual' ? individualAgent : undefined,
    });
  };

  const healthyCount = session?.healthy_agents
    ? session.healthy_agents.length
    : Object.values(agentStatuses).filter((s) => s !== 'failed').length;

  return (
    <div className="flex flex-col min-h-full max-w-6xl mx-auto space-y-6 pb-20">
      {/* ─── Top Control Bar: Mode Selection Pill Tabs & Status ─── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span className="text-[11px] font-mono uppercase tracking-widest text-cyan-400 font-semibold">
              Live Collaborative Chamber
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-offWhite font-sans">
            Virtual Council Room
          </h1>
        </div>

        {/* Right Action Bar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Active Model Indicator Badge */}
          <div
            title={`Active Engine: ${activeModel.display_text}`}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-deepMidnight/80 border border-white/10 text-xs font-mono text-gray-300 shadow-sm"
          >
            <Cpu className={`w-3.5 h-3.5 ${activeModel.is_online ? 'text-violetAccent' : 'text-cyan-400'}`} />
            <span className="font-semibold text-gray-200 truncate max-w-[150px] sm:max-w-xs">{activeModel.display_text}</span>
          </div>

          {/* Mode Selector Pill Switcher (Matching Reference 1 Header) */}
          <div className="flex items-center bg-black/40 p-1 rounded-full border border-white/10 backdrop-blur-md">
            <button
              type="button"
              onClick={() => setMode('council')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                mode === 'council'
                  ? 'bg-white text-black font-semibold shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Full Council</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('parallel')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                mode === 'parallel'
                  ? 'bg-white text-black font-semibold shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Parallel</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('individual')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                mode === 'individual'
                  ? 'bg-white text-black font-semibold shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Individual</span>
            </button>
          </div>

          {/* Execution Log Toggle Button */}
          <button
            type="button"
            onClick={() => setShowLogDrawer(!showLogDrawer)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs font-mono transition-all cursor-pointer ${
              showLogDrawer 
                ? 'bg-cyan-950/70 border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(69,217,245,0.25)]' 
                : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
            }`}
            title="Toggle Live Event Log"
          >
            <Activity className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Telemetry</span>
            <span className="text-[10px] opacity-75">({events.length})</span>
          </button>
        </div>
      </div>

      {/* ─── Task Submission Bar ─── */}
      <form onSubmit={handleSubmit} className="liquid-glass-primary p-4 md:p-5 rounded-2xl space-y-3 border border-white/10 shadow-lg">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <input
            type="text"
            value={taskPrompt}
            onChange={(e) => setTaskPrompt(e.target.value)}
            placeholder="Present a challenge, hypothesis, or engineering inquiry to the Council..."
            disabled={loading}
            className="flex-1 bg-black/40 border border-white/15 focus:border-cyan-400/80 rounded-xl px-4 py-2.5 text-sm text-offWhite placeholder-gray-500 focus:outline-none transition-colors shadow-inner"
          />

          {mode === 'individual' && (
            <select
              value={individualAgent}
              onChange={(e) => setIndividualAgent(e.target.value as AgentId)}
              disabled={loading}
              className="bg-black/60 border border-white/15 text-xs text-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-cyan-400/60"
            >
              <option value="researcher">Researcher</option>
              <option value="analyst">Analyst</option>
              <option value="alternative">Alternative Thinker</option>
              <option value="critic">Critic</option>
              <option value="specialist">Specialist</option>
            </select>
          )}

          <div className="flex items-center gap-2 shrink-0">
            {session && (
              <button
                type="button"
                onClick={resetSession}
                disabled={loading}
                title="Reset Chamber and start a new deliberation"
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-medium border border-white/10 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}

            <button
              type="submit"
              disabled={loading || !taskPrompt.trim()}
              className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-white text-black font-semibold text-xs md:text-sm transition-all duration-200 hover:bg-cyan-100 hover:shadow-[0_0_24px_rgba(255,255,255,0.4)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <RotateCcw className="w-4 h-4 animate-spin text-cyan-600" />
                  <span>Deliberating...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Convene Council</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Current live action ticker when deliberating */}
        {loading && currentActionDescription && (
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-300 bg-cyan-950/40 px-3.5 py-2 rounded-xl border border-cyan-400/30 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="font-semibold uppercase tracking-wider">{currentActiveAgent || 'Council'}:</span>
            <span className="text-gray-300 truncate">{currentActionDescription}</span>
          </div>
        )}
      </form>

      {/* ─── 5-Agent Interactive Council Dais (Scrolls upward with page) ─── */}
      <div className="w-full">
        <CouncilDais
          agentStatuses={agentStatuses}
          selectedAgent={selectedAgent}
          onSelectAgent={setSelectedAgent}
          activeAgent={currentActiveAgent}
          healthyCount={healthyCount}
          totalAgents={5}
          reassignedTasks={session?.reassigned_tasks || []}
        />
      </div>

      {/* ─── Main Dialectical Discussion Canvas ─── */}
      <div className="w-full relative">
        <CouncilDiscussionStream
          turns={displayedTurns}
          activeAgent={currentActiveAgent}
          actionDescription={currentActionDescription}
          isDeliberating={loading}
          finalSynthesis={finalSynthesis || session?.final_synthesis}
          qualityAssessment={session?.quality_assessment}
          taskPrompt={taskPrompt}
        />

        {/* Slide-out Telemetry Event Drawer */}
        {showLogDrawer && (
          <div className="fixed top-20 right-6 bottom-8 w-80 md:w-96 liquid-glass-floating rounded-2xl border border-white/20 p-4 flex flex-col shadow-2xl z-50 backdrop-blur-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-offWhite font-mono">
                  Event Telemetry Stream
                </h4>
              </div>
              <button
                onClick={() => setShowLogDrawer(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-[11px]">
              {events.length === 0 ? (
                <p className="text-gray-500 italic p-4 text-center">No telemetry emitted yet.</p>
              ) : (
                events.map((ev, i) => (
                  <div key={i} className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-1">
                    <div className="flex items-center justify-between text-gray-400 text-[10px]">
                      <span className="text-cyan-400 font-semibold">{ev.event_type}</span>
                      <span>{ev.agent_id || 'system'}</span>
                    </div>
                    {ev.payload && (
                      <p className="text-gray-300 text-[10px] break-words">
                        {typeof ev.payload === 'string' ? ev.payload : ev.payload.detail || ev.payload.message || JSON.stringify(ev.payload)}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
