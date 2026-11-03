import React from 'react';
import { CouncilEventType } from '../../types/events';
import { 
  Activity, 
  AlertTriangle, 
  RefreshCw, 
  ArrowRightLeft, 
  CheckCircle, 
  Zap,
  Info
} from 'lucide-react';

export interface TimelineEvent {
  id: string;
  event_type: CouncilEventType;
  agent_id?: string;
  payload?: any;
  timestamp: string;
}

interface DiscussionTimelineProps {
  events: TimelineEvent[];
}

export const DiscussionTimeline: React.FC<DiscussionTimelineProps> = ({ events }) => {
  const getEventIcon = (type: CouncilEventType) => {
    switch (type) {
      case 'agent_failed':
      case 'agent_timeout':
        return <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />;
      case 'agent_retry_started':
        return <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />;
      case 'task_reassigned':
      case 'agent_takeover_started':
      case 'agent_review_started':
        return <ArrowRightLeft className="w-3.5 h-3.5 text-purple-400" />;
      case 'council_decision':
      case 'session_completed':
        return <CheckCircle className="w-3.5 h-3.5 text-neonGreen" />;
      case 'agent_thinking':
      case 'synthesis_started':
        return <Zap className="w-3.5 h-3.5 text-lavender" />;
      case 'agent_message_created':
        return <Activity className="w-3.5 h-3.5 text-neonGreen" />;
      default:
        return <Activity className="w-3.5 h-3.5 text-gray-400" />;
    }
  };

  const getEventDescription = (event: TimelineEvent) => {
    const agent = event.agent_id ? String(event.agent_id).toUpperCase() : 'COUNCIL';
    const typeStr = String(event.event_type || 'activity');
    switch (typeStr) {
      case 'session_started':
        return 'Council session convened. Decomposing task.';
      case 'task_assigned':
        return `${agent} assigned collaborative mission.`;
      case 'agent_started':
        return `${agent} active on deliberation workstream.`;
      case 'agent_thinking':
        return `${agent} synthesising reasoning trace...`;
      case 'agent_review_started':
        return 'Critic initiated peer review of earlier findings for logical fallacies and risks.';
      case 'agent_message_created':
        return `${agent} published deliberation turn.`;
      case 'agent_completed':
        return `${agent} successfully submitted analysis.`;
      case 'agent_failed':
        return `${agent} execution failed. Isolating boundary.`;
      case 'agent_retry_started':
        return `Initiating exponential backoff retry for ${agent}.`;
      case 'task_reassigned':
        return `Redistributing ${agent}'s unfinished duties to substitute.`;
      case 'agent_takeover_started':
        return `${agent} accepted reassigned task responsibility.`;
      case 'agent_takeover_completed':
        return `${agent} completed substitute task execution.`;
      case 'synthesis_started':
        return 'Quantum Core formulated collaborative consensus from all minds.';
      case 'council_degraded':
        return 'Operating in degraded resilience mode with surviving minds.';
      case 'council_decision':
        return 'Final multi-agent synthesis formulated.';
      case 'session_completed':
        return 'Session completed successfully.';
      default:
        return typeStr.replace(/_/g, ' ');
    }
  };

  return (
    <div className="glass-panel rounded-xl p-5 h-full flex flex-col">
      <div className="flex items-center justify-between pb-3 border-b border-charcoal mb-3">
        <h3 className="text-xs font-mono uppercase tracking-wider text-gray-300 flex items-center gap-2">
          <Activity className="w-4 h-4 text-neonGreen" />
          <span>Real-Time Execution Log</span>
        </h3>
        <span className="text-[10px] font-mono text-gray-500">{events.length} events</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
        {events.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-500 text-xs italic">
            Waiting for session to begin...
          </div>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              className="flex items-start gap-2.5 text-xs p-2 rounded-lg bg-obsidian/60 border border-charcoal/60 hover:border-gray-700 transition-colors"
            >
              <div className="mt-0.5 p-1 rounded bg-charcoal">
                {getEventIcon(event.event_type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-gray-200 font-sans">{getEventDescription(event)}</p>
                <span className="text-[10px] font-mono text-gray-500">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

