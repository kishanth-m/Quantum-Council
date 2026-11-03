import React from 'react';
import { AgentId, AGENT_PROFILES } from '../../types/agent';
import { MarkdownRenderer } from '../common/MarkdownRenderer';
import { Bot, Sparkles, ArrowRightLeft, AlertOctagon } from 'lucide-react';

interface AgentSpeechPanelProps {
  selectedAgent: AgentId | null;
  agentOutputs: Record<string, string>;
  substituteOutputs: Record<string, string>;
  agentFailures: Record<string, any>;
}

export const AgentSpeechPanel: React.FC<AgentSpeechPanelProps> = ({
  selectedAgent,
  agentOutputs,
  substituteOutputs,
  agentFailures,
}) => {
  if (!selectedAgent) {
    return (
      <div className="glass-panel rounded-xl p-6 h-full flex flex-col items-center justify-center text-center text-gray-500">
        <Bot className="w-12 h-12 text-gray-600 mb-3" />
        <p className="text-sm">Select an agent from the Council chamber to inspect their reasoning trace and contributions.</p>
      </div>
    );
  }

  const profile = (selectedAgent && AGENT_PROFILES[selectedAgent]) || {
    id: selectedAgent || 'analyst',
    name: selectedAgent ? selectedAgent.charAt(0).toUpperCase() + selectedAgent.slice(1) : 'Agent',
    role: 'Intelligence Specialist',
    badge: 'ACTIVE',
    color: 'from-emerald-500 to-green-600',
    accentHex: '#5DD62C',
    avatarSeed: 'Agent',
    description: '',
  };
  const primaryOutput = selectedAgent ? (agentOutputs[selectedAgent] || '') : '';
  const failure = selectedAgent ? agentFailures[selectedAgent] : null;
  const substituteText = selectedAgent ? (substituteOutputs[selectedAgent] || '') : '';

  return (
    <div className="glass-panel rounded-xl p-6 h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-charcoal mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${profile.color}`} />
          <div>
            <h3 className="font-semibold text-offWhite flex items-center gap-2">
              {profile.name}
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-charcoal text-gray-400">
                {profile.badge}
              </span>
            </h3>
            <p className="text-xs text-gray-400">{profile.role}</p>
          </div>
        </div>
      </div>

      {/* Content body */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {/* Failure banner if failed */}
        {failure && (
          <div className="bg-rose-950/40 border border-rose-600/40 rounded-lg p-3.5 text-xs text-rose-300 flex items-start gap-2.5">
            <AlertOctagon className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-200">Agent Fault Detected: {failure.category || 'Error'}</p>
              <p className="mt-1 text-gray-300">{failure.message || 'The agent failed during inference and was isolated by the circuit breaker.'}</p>
            </div>
          </div>
        )}

        {/* Primary Agent Output */}
        {primaryOutput ? (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-mono text-gray-400 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-neonGreen" />
              <span>Primary Analysis</span>
            </div>
            <div className="bg-obsidian/80 border border-charcoal rounded-lg p-4">
              <MarkdownRenderer content={primaryOutput} />
            </div>
          </div>
        ) : (
          !failure && (
            <p className="text-xs text-gray-500 italic">No output recorded yet for this session.</p>
          )
        )}

        {/* Substitute Takeover Contribution if applicable */}
        {substituteText && (
          <div className="space-y-2 mt-4 pt-4 border-t border-charcoal">
            <div className="flex items-center gap-1.5 text-xs font-mono text-purple-400 uppercase tracking-wider">
              <ArrowRightLeft className="w-3.5 h-3.5 text-purple-400" />
              <span>Substituted Task Contribution</span>
            </div>
            <div className="bg-purple-950/20 border border-purple-800/40 rounded-lg p-4">
              <MarkdownRenderer content={substituteText} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

