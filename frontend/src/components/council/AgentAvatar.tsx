import React from 'react';
import { AgentId, AgentVisualStatus, AGENT_PROFILES } from '../../types/agent';
import { 
  Bot, 
  BrainCircuit, 
  Volume2, 
  AlertTriangle, 
  RefreshCw, 
  CheckCircle2, 
  ShieldAlert,
  ArrowRightLeft,
  Eye,
  Edit3,
  Clock
} from 'lucide-react';

interface AgentAvatarProps {
  agentId: AgentId;
  status: AgentVisualStatus;
  isSubstitute?: boolean;
  substitutedFor?: string;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  activeSpeaking?: boolean;
}

export const AgentAvatar: React.FC<AgentAvatarProps> = ({
  agentId,
  status,
  isSubstitute = false,
  substitutedFor,
  onClick,
  size = 'md',
  activeSpeaking = false,
}) => {
  const profile = AGENT_PROFILES[agentId] || AGENT_PROFILES.analyst;

  // Status visual cues
  let ringColor = 'border-charcoal';
  let badgeText = status.toUpperCase().replace('_', ' ');
  let badgeColor = 'bg-charcoal text-gray-400';
  let statusIcon = <Bot className="w-3.5 h-3.5" />;
  let glowStyle = '';

  switch (status) {
    case 'queued':
      ringColor = 'border-gray-600 animate-pulse';
      badgeColor = 'bg-gray-800 text-gray-400 border border-gray-600/50';
      statusIcon = <Clock className="w-3.5 h-3.5 text-gray-300" />;
      break;
    case 'thinking':
      ringColor = 'border-lavender animate-pulse';
      badgeColor = 'bg-lavender/20 text-lavender border border-lavender/40';
      statusIcon = <BrainCircuit className="w-3.5 h-3.5 text-lavender animate-spin" />;
      glowStyle = 'shadow-[0_0_20px_rgba(102,103,171,0.5)]';
      break;
    case 'speaking':
      ringColor = 'border-cyan-400';
      badgeColor = 'bg-cyan-950/60 text-cyan-300 border border-cyan-400/50 font-semibold';
      statusIcon = <Volume2 className="w-3.5 h-3.5 text-cyan-300 animate-bounce" />;
      glowStyle = 'shadow-[0_0_25px_rgba(69,217,245,0.6)]';
      break;
    case 'responding':
      ringColor = 'border-cyan-400 animate-pulse';
      badgeColor = 'bg-cyan-950/60 text-cyan-300 border border-cyan-400/50 font-semibold';
      statusIcon = <ArrowRightLeft className="w-3.5 h-3.5 text-cyan-300" />;
      glowStyle = 'shadow-[0_0_25px_rgba(34,211,238,0.5)]';
      break;
    case 'reviewing':
      ringColor = 'border-amber-400 animate-pulse';
      badgeColor = 'bg-amber-950/60 text-amber-300 border border-amber-400/50 font-semibold';
      statusIcon = <Eye className="w-3.5 h-3.5 text-amber-300" />;
      glowStyle = 'shadow-[0_0_25px_rgba(251,191,36,0.5)]';
      break;
    case 'criticising':
      ringColor = 'border-rose-500 animate-pulse';
      badgeColor = 'bg-rose-950/70 text-rose-300 border border-rose-500/50 font-semibold';
      statusIcon = <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />;
      glowStyle = 'shadow-[0_0_25px_rgba(244,63,94,0.6)]';
      break;
    case 'revising':
      ringColor = 'border-orange-500 animate-spin';
      badgeColor = 'bg-orange-950/60 text-orange-300 border border-orange-500/50';
      statusIcon = <Edit3 className="w-3.5 h-3.5 text-orange-400" />;
      glowStyle = 'shadow-[0_0_20px_rgba(249,115,22,0.5)]';
      break;
    case 'failed':
      ringColor = 'border-rose-600';
      badgeColor = 'bg-rose-950/60 text-rose-400 border border-rose-500/50';
      statusIcon = <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />;
      glowStyle = 'shadow-[0_0_20px_rgba(225,29,72,0.5)]';
      break;
    case 'recovering':
      ringColor = 'border-amber-500 animate-spin';
      badgeColor = 'bg-amber-950/60 text-amber-400 border border-amber-500/50';
      statusIcon = <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />;
      glowStyle = 'shadow-[0_0_20px_rgba(245,158,11,0.5)]';
      break;
    case 'taking_over':
      ringColor = 'border-purple-500 animate-pulse';
      badgeColor = 'bg-purple-950/60 text-purple-300 border border-purple-500/50';
      statusIcon = <ArrowRightLeft className="w-3.5 h-3.5 text-purple-400" />;
      glowStyle = 'shadow-[0_0_25px_rgba(184,51,168,0.6)]';
      badgeText = substitutedFor ? `SUB: ${substitutedFor.toUpperCase()}` : 'TAKING OVER';
      break;
    case 'completed':
      ringColor = 'border-emerald-500/70';
      badgeColor = 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/40';
      statusIcon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
      break;
    default:
      ringColor = 'border-charcoal/80';
      badgeColor = 'bg-charcoal/80 text-gray-400 border border-charcoal';
      break;
  }

  const dimensions = {
    sm: 'w-12 h-12',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
  }[size];

  return (
    <div 
      className="flex flex-col items-center cursor-pointer group transition-transform duration-300 hover:scale-105"
      onClick={onClick}
    >
      <div className={`relative ${dimensions} rounded-full border-2 p-1 bg-obsidian ${ringColor} ${glowStyle} transition-all duration-500`}>
        {/* Core avatar gradient */}
        <div className={`w-full h-full rounded-full bg-gradient-to-tr ${profile.color} flex items-center justify-center text-white font-bold text-lg shadow-inner relative overflow-hidden`}>
          <span>{profile.name.charAt(0)}</span>
          
          {/* Subtle grid texture overlay */}
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:8px_8px]" />
        </div>

        {/* Floating status icon pin */}
        <div className="absolute -top-1 -right-1 p-1 bg-charcoal rounded-full border border-charcoalElevated shadow-md">
          {statusIcon}
        </div>

        {/* Active speaking indicator */}
        {(status === 'speaking' || activeSpeaking) && (
          <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neonGreen opacity-75" />
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-neonGreen" />
          </span>
        )}

        {/* Reassignment / Substitution badge */}
        {isSubstitute && (
          <div className="absolute -bottom-1 -left-1 p-1 bg-purple-900 rounded-full border border-purple-400 shadow-md" title={`Substituted for ${substitutedFor}`}>
            <ArrowRightLeft className="w-3 h-3 text-purple-200" />
          </div>
        )}
      </div>

      {/* Name & Role label */}
      <div className="mt-1.5 text-center">
        <h4 className="text-xs font-semibold text-offWhite tracking-wide group-hover:text-neonGreen transition-colors truncate max-w-[100px]">
          {profile.name}
        </h4>
        <span className={`inline-block text-[9px] font-mono px-2 py-0.5 rounded-full mt-0.5 ${badgeColor}`}>
          {badgeText}
        </span>
      </div>
    </div>
  );
};
