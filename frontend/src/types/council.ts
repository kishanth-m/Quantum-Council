import { AgentId, AgentVisualStatus } from './agent';

export interface ResilienceConfig {
  auto_recovery_enabled: boolean;
  max_retries: number;
  agent_timeout_seconds: number;
  allow_role_substitution: boolean;
  min_healthy_agents: number;
  allow_partial_completion: boolean;
}

export interface ReassignedTaskInfo {
  original_agent_id: string;
  substitute_agent_id: string;
  task_description: string;
  reassignment_reason: string;
  status: string;
}

export interface QualityAssessment {
  original_task_count: number;
  completed_task_count: number;
  reassigned_task_count: number;
  failed_task_count: number;
  completeness_score: number;
  confidence_rating: 'HIGH' | 'MEDIUM' | 'LOW' | 'DEGRADED';
  missing_aspects: string[];
  resilience_notes: string[];
}

export interface CouncilSessionDetail {
  id: string;
  task: string;
  mode: 'individual' | 'parallel' | 'council';
  status: 'pending' | 'running' | 'completed' | 'aborted' | 'COMPLETED' | 'PARTIALLY_COMPLETED' | 'FAILED' | 'TIMED_OUT' | 'CANCELLED';
  healthy_agents: string[];
  failed_agents: string[];
  agent_statuses: Record<string, string>;
  agent_outputs: Record<string, string>;
  agent_failures: Record<string, any>;
  reassigned_tasks: ReassignedTaskInfo[];
  substitute_outputs: Record<string, string>;
  quality_assessment?: QualityAssessment;
  final_synthesis?: string;
  error?: string;
  created_at: string;
  completed_at?: string;
}

export interface StartSessionRequest {
  task: string;
  mode: 'individual' | 'parallel' | 'council';
  agent_id?: AgentId;
  max_rounds?: number;
}

