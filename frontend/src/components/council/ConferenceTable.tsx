import React from 'react';
import { AgentId, AgentVisualStatus } from '../../types/agent';
import { AgentAvatar } from './AgentAvatar';
import { Cpu, ShieldCheck } from 'lucide-react';

interface ConferenceTableProps {
  agentStatuses: Record<string, AgentVisualStatus>;
  selectedAgent: AgentId | null;
  onSelectAgent: (agentId: AgentId) => void;
  reassignedTasks: Array<{
    original_agent_id: string;
    substitute_agent_id: string;
  }>;
  healthyCount: number;
  totalAgents: number;
}

export const ConferenceTable: React.FC<ConferenceTableProps> = ({
  agentStatuses,
  selectedAgent,
  onSelectAgent,
  reassignedTasks,
  healthyCount,
  totalAgents = 5,
}) => {
  const agents: AgentId[] = ['researcher', 'analyst', 'specialist', 'critic', 'alternative'];

  // Calculate circular positioning for 5 agents (pentagonal symmetry)
  // Angles in degrees: 270 (top), 342, 54, 126, 198
  const angles = [270, 342, 54, 126, 198];

  return (
    <div className="relative w-full max-w-[620px] aspect-square mx-auto flex items-center justify-center p-8 select-none">
      {/* Outer ambient holographic rings */}
      <div className="absolute inset-4 rounded-full border border-lavender/10 animate-[spin_60s_linear_infinite]" />
      <div className="absolute inset-12 rounded-full border border-dashed border-charcoal/80" />
      <div className="absolute inset-20 rounded-full border border-neonGreen/10 animate-[spin_40s_linear_infinite_reverse]" />

      {/* Central Quantum Holographic Core */}
      <div className="relative w-44 h-44 rounded-full bg-gradient-to-b from-charcoal/80 to-midnightPurple/90 border border-lavender/30 flex flex-col items-center justify-center p-4 text-center backdrop-blur-md shadow-[0_0_50px_rgba(33,6,53,0.8)] z-10">
        <div className="w-12 h-12 rounded-full bg-neonGreen/10 border border-neonGreen/30 flex items-center justify-center mb-2 animate-pulse">
          <Cpu className="w-6 h-6 text-neonGreen" />
        </div>
        <span className="text-xs font-mono text-gray-400 tracking-wider uppercase">Quantum Core</span>
        <div className="flex items-center gap-1.5 mt-1 text-sm font-semibold text-offWhite">
          <ShieldCheck className="w-4 h-4 text-neonGreen" />
          <span>{healthyCount}/{totalAgents} Minds Online</span>
        </div>
      </div>

      {/* 5 Agents arranged in circular formation */}
      {agents.map((agentId, index) => {
        const angle = angles[index];
        const rad = (angle * Math.PI) / 180;
        // Radius as percentage of container width
        const radius = 38; // 38% from center
        const x = 50 + radius * Math.cos(rad);
        const y = 50 + radius * Math.sin(rad);

        const status = agentStatuses[agentId] || 'idle';
        const reassignedInfo = reassignedTasks.find(
          (t) => t.substitute_agent_id === agentId
        );

        return (
          <div
            key={agentId}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 z-20"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            <AgentAvatar
              agentId={agentId}
              status={status}
              isSubstitute={!!reassignedInfo}
              substitutedFor={reassignedInfo?.original_agent_id}
              onClick={() => onSelectAgent(agentId)}
              size="md"
            />
          </div>
        );
      })}
    </div>
  );
};

