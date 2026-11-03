import { apiRequest } from './api';
import { 
  CouncilSessionDetail, 
  ResilienceConfig, 
  StartSessionRequest 
} from '../types/council';

export const councilService = {
  // Start a new session
  startSession: (data: StartSessionRequest, signal?: AbortSignal) => {
    return apiRequest<CouncilSessionDetail>('/council/session', {
      method: 'POST',
      body: JSON.stringify(data),
      signal,
    });
  },

  // Cancel an active session
  cancelSession: (sessionId: string) => {
    return apiRequest<{ status: string; session_id: string }>(`/council/session/${sessionId}/cancel`, {
      method: 'POST',
    });
  },

  // Get session details
  getSession: (sessionId: string) => {
    return apiRequest<CouncilSessionDetail>(`/council/session/${sessionId}`);
  },

  // Resilience Configuration
  getResilienceConfig: () => {
    return apiRequest<ResilienceConfig>('/council/resilience/config');
  },

  updateResilienceConfig: (config: Partial<ResilienceConfig>) => {
    return apiRequest<ResilienceConfig>('/council/resilience/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  },

  // Connect to SSE event stream
  subscribeToSessionEvents: (
    sessionId: string,
    onEvent: (event: any) => void,
    onError?: (err: any) => void
  ) => {
    const eventSource = new EventSource(`/api/v1/council/session/${sessionId}/events`);

    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        onEvent(parsed);
      } catch (e) {
        console.error('Failed to parse SSE payload', e);
      }
    };

    eventSource.onerror = (err) => {
      if (onError) onError(err);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  },
};

