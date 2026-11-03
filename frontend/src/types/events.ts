export type CouncilEventType =
  | 'session_started'
  | 'task_assigned'
  | 'agent_started'
  | 'agent_thinking'
  | 'agent_review_started'
  | 'agent_message_created'
  | 'agent_completed'
  | 'agent_timeout'
  | 'agent_failed'
  | 'agent_retry_started'
  | 'task_reassignment_started'
  | 'task_reassigned'
  | 'agent_takeover_started'
  | 'agent_takeover_completed'
  | 'agent_recovery_failed'
  | 'recovery_completed'
  | 'council_degraded'
  | 'synthesis_started'
  | 'council_decision'
  | 'council_execution_aborted'
  | 'session_completed';

export interface SSEEventPayload {
  session_id: string;
  event_type: CouncilEventType;
  agent_id?: string;
  payload?: any;
  timestamp: string;
}

