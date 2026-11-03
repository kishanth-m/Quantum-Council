import React from 'react';
import { AgentId, AgentVisualStatus, AGENT_PROFILES } from '../../types/agent';
import { AgentAvatar } from './AgentAvatar';
import { ShieldCheck, Cpu, ArrowRight, Zap, RefreshCw, AlertTriangle, Radio } from 'lucide-react';

interface CouncilDaisProps {
  agentStatuses: Record<string, AgentVisualStatus>;
  selectedAgent: AgentId | null;
  onSelectAgent: (id: AgentId) => void;
  activeAgent: AgentId | 'orchestrator' | null;
  healthyCount: number;
  totalAgents: number;
  reassignedTasks?: Array<{ original_agent_id: string; substitute_agent_id: string }>;
}

export const CouncilDais: React.FC<CouncilDaisProps> = ({
  agentStatuses,
  selectedAgent,
  onSelectAgent,
  activeAgent,
  healthyCount,
  totalAgents = 5,
  reassignedTasks = [],
}) => {
  const agentOrder: AgentId[] = ['researcher', 'analyst', 'alternative', 'critic', 'specialist'];

  const stageDescriptions: Record<AgentId, string> = {
    researcher: 'Phase A · Baseline',
    analyst: 'Phase B · Deduction',
    alternative: 'Phase B · Contrarian',
    critic: 'Phase C · Scrutiny',
    specialist: 'Phase D · Synthesis',
  };

  const agentThemeColors: Record<AgentId, { glow: string; borderActive: string; accentBadge: string }> = {
    researcher: {
      glow: 'shadow-[0_0_25px_rgba(16,185,129,0.4)]',
      borderActive: 'border-emerald-400',
      accentBadge: 'text-emerald-300 bg-emerald-950/60',
    },
    analyst: {
      glow: 'shadow-[0_0_25px_rgba(69,217,245,0.4)]',
      borderActive: 'border-cyan-400',
      accentBadge: 'text-cyan-300 bg-cyan-950/60',
    },
    alternative: {
      glow: 'shadow-[0_0_25px_rgba(168,85,247,0.4)]',
      borderActive: 'border-purple-400',
      accentBadge: 'text-purple-300 bg-purple-950/60',
    },
    critic: {
      glow: 'shadow-[0_0_25px_rgba(245,158,11,0.4)]',
      borderActive: 'border-amber-400',
      accentBadge: 'text-amber-300 bg-amber-950/60',
    },
    specialist: {
      glow: 'shadow-[0_0_25px_rgba(56,189,248,0.4)]',
      borderActive: 'border-sky-400',
      accentBadge: 'text-sky-300 bg-sky-950/60',
    },
  };

  return (
    <div className="liquid-glass-primary rounded-2xl p-4 md:p-5 space-y-3.5 border border-white/10">
      {/* Dais Header / Status Line */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-cyan-950/60 border border-cyan-400/30 flex items-center justify-center text-cyan-300 shadow-[0_0_12px_rgba(69,217,245,0.2)]">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-offWhite font-mono flex items-center gap-2">
              <span>Council Chamber Dais</span>
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            </h3>
            <p className="text-[11px] text-mutedSilver">
              Five specialized intelligences coordinated in dialectical progression
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 text-xs font-mono">
          {activeAgent && activeAgent !== 'orchestrator' && (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-400/40 text-cyan-300 shadow-[0_0_12px_rgba(69,217,245,0.25)]">
              <Radio className="w-3 h-3 text-cyan-400 animate-pulse" />
              <span className="uppercase font-semibold">{activeAgent} speaking</span>
            </span>
          )}

          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/40 border border-emerald-500/30 text-emerald-300">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>{healthyCount}/{totalAgents} Minds Ready</span>
          </span>
        </div>
      </div>

      {/* 5-Agent Interactive Dais Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 items-stretch">
        {agentOrder.map((agentId, index) => {
          const profile = AGENT_PROFILES[agentId];
          const status = agentStatuses[agentId] || 'idle';
          const isSelected = selectedAgent === agentId;
          const isActive = activeAgent === agentId;
          const reassigned = reassignedTasks.find((t) => t.substitute_agent_id === agentId);
          const theme = agentThemeColors[agentId];

          return (
            <div
              key={agentId}
              onClick={() => onSelectAgent(agentId)}
              className={`relative rounded-2xl p-4 transition-all duration-300 cursor-pointer flex flex-col items-center text-center justify-between border ${
                isActive
                  ? `bg-black/60 ${theme.borderActive} ${theme.glow} scale-[1.03] z-10`
                  : isSelected
                  ? 'bg-black/50 border-cyan-300/60 shadow-[0_0_15px_rgba(22,199,194,0.2)]'
                  : 'liquid-card hover:border-white/20 hover:bg-black/40'
              }`}
            >
              {/* Order Pill */}
              <div className="absolute top-2.5 left-3 text-[9px] font-mono text-gray-500 font-bold">
                0{index + 1}
              </div>

              {/* Status Indicator Pip */}
              <div className="absolute top-2.5 right-3">
                <span className={`w-2 h-2 rounded-full inline-block ${
                  status === 'speaking' || isActive || status === 'responding'
                    ? 'bg-cyan-400 shadow-[0_0_8px_rgba(69,217,245,0.9)] animate-pulse'
                    : status === 'reviewing'
                    ? 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.9)] animate-pulse'
                    : status === 'failed'
                    ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]'
                    : status === 'completed'
                    ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]'
                    : 'bg-gray-600'
                }`} />
              </div>

              {/* Avatar with Glow Ring */}
              <div className="my-2 relative">
                <div className={`p-1 rounded-full ${isActive ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-black' : ''}`}>
                  <AgentAvatar
                    agentId={agentId}
                    size="lg"
                    status={status}
                  />
                </div>
              </div>

              {/* Agent Identity */}
              <div className="space-y-0.5 w-full">
                <h4 className="text-xs font-bold text-offWhite font-sans tracking-wide truncate">
                  {profile.name}
                </h4>
                <p className="text-[10px] font-mono text-cyan-400 truncate">
                  {profile.role}
                </p>
                <div className="text-[9px] font-mono text-gray-400 mt-1">
                  {stageDescriptions[agentId]}
                </div>
              </div>

              {/* Reassignment Pip if Autonomous Recovery triggered */}
              {reassigned && (
                <div className="mt-2 w-full flex items-center justify-center gap-1 text-[9px] font-mono text-amber-300 bg-amber-950/60 py-0.5 px-1.5 rounded-md border border-amber-500/30">
                  <Zap className="w-2.5 h-2.5 text-amber-400" />
                  <span>Substituted</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
