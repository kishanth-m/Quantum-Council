import React, { useState, useEffect, useCallback } from 'react';
import { 
  Award, 
  RotateCcw, 
  RefreshCw, 
  Activity, 
  ShieldCheck, 
  Cpu, 
  AlertTriangle, 
  CheckCircle2, 
  BarChart2, 
  Users,
  Database,
  Layers,
  Sparkles
} from 'lucide-react';
import { AGENT_PROFILES, AgentId } from '../types/agent';

interface AnalyticsData {
  total_sessions: number;
  successful_sessions: number;
  completed_sessions: number;
  failed_sessions: number;
  total_model_calls: number;
  total_tokens_used: number;
  average_execution_time_ms: number;
  avg_latency_ms: number;
  average_rounds_per_session: number;
  total_documents_indexed: number;
  most_active_agent: string | null;
  recovery_events_count: number;
  recovery_success_rate: number;
  circuit_breaker_trips: number;
  total_conversations: number;
  total_messages: number;
  agent_activity: Record<string, number>;
}

export const AnalyticsPage: React.FC = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/analytics/summary');
      if (!res.ok) throw new Error(`Analytics API returned HTTP ${res.status}`);
      const summary: AnalyticsData = await res.json();
      setData(summary);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const successRate = data
    ? data.total_sessions > 0
      ? Math.round(((data.successful_sessions + data.completed_sessions) / data.total_sessions) * 100)
      : 100
    : 100;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-[11px] font-mono uppercase tracking-widest text-cyan-400 font-semibold">
              Dialectical Telemetry
            </span>
          </div>
          <h1 className="text-2xl font-bold text-offWhite font-sans">System Analytics &amp; Metrics</h1>
          <p className="text-xs text-gray-400">Real-time performance measurements from the multi-agent orchestration database.</p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs font-mono text-mutedSilver">Synced: {lastUpdated}</span>
          )}
          <button
            onClick={fetchAnalytics}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-200 text-xs font-medium border border-white/10 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 4 Vivid Vitals Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="liquid-card rounded-2xl p-5 border border-cyan-400/30 space-y-2">
          <div className="flex items-center justify-between text-mutedSilver">
            <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-400 font-semibold">Total Deliberations</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-3xl font-bold text-offWhite font-mono">
            {data ? data.total_sessions : '—'}
          </div>
          <p className="text-xs text-gray-400">
            {data ? `${data.successful_sessions} consensus reached` : 'Loading...'}
          </p>
        </div>

        <div className="liquid-card rounded-2xl p-5 border border-emerald-500/30 space-y-2">
          <div className="flex items-center justify-between text-mutedSilver">
            <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-semibold">Success Rate</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-bold text-emerald-400 font-mono">
            {successRate}%
          </div>
          <p className="text-xs text-gray-400">Fault-tolerant recovery active</p>
        </div>

        <div className="liquid-card rounded-2xl p-5 border border-purple-500/30 space-y-2">
          <div className="flex items-center justify-between text-mutedSilver">
            <span className="text-[11px] font-mono uppercase tracking-wider text-purple-400 font-semibold">Tokens Processed</span>
            <Cpu className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-3xl font-bold text-offWhite font-mono">
            {data ? (data.total_tokens_used > 1000 ? `${(data.total_tokens_used / 1000).toFixed(1)}k` : data.total_tokens_used) : '—'}
          </div>
          <p className="text-xs text-gray-400">{data?.total_model_calls ?? 0} model inference calls</p>
        </div>

        <div className="liquid-card rounded-2xl p-5 border border-amber-500/30 space-y-2">
          <div className="flex items-center justify-between text-mutedSilver">
            <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-semibold">Knowledge Vault</span>
            <Database className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-bold text-offWhite font-mono">
            {data ? data.total_documents_indexed : '—'}
          </div>
          <p className="text-xs text-gray-400">Vector chunks indexed</p>
        </div>
      </div>

      {/* Agent Activity Bar Chart Section */}
      <div className="liquid-glass-primary p-6 md:p-8 rounded-3xl space-y-6 border border-white/10">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-950/60 border border-cyan-400/30 flex items-center justify-center text-cyan-300">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-offWhite text-sm font-sans">Cognitive Mind Distribution</h3>
              <p className="text-xs text-gray-400">Turn participation and contribution counts per specialized AI mind.</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {Object.entries(AGENT_PROFILES).map(([id, profile]) => {
            const count = data?.agent_activity?.[id] ?? 0;
            const maxCount = Math.max(...Object.values(data?.agent_activity ?? { a: 1 }), 1);
            const percentage = Math.min(100, Math.round((count / maxCount) * 100));

            return (
              <div key={id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-offWhite capitalize">{profile.name}</span>
                    <span className="text-gray-500">({profile.role})</span>
                  </div>
                  <span className="text-cyan-400 font-semibold">{count} turns</span>
                </div>
                <div className="h-2.5 w-full bg-black/40 rounded-full overflow-hidden border border-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-teal-400 to-cyan-400 rounded-full transition-all duration-700"
                    style={{ width: `${Math.max(percentage, 5)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Architectural Fault-Tolerance Matrix */}
      <div className="liquid-glass-primary p-6 md:p-8 rounded-3xl space-y-4 border border-white/10">
        <div className="flex items-center gap-3 pb-3 border-b border-white/10">
          <div className="w-9 h-9 rounded-xl bg-purple-950/60 border border-purple-500/40 flex items-center justify-center text-purple-400">
            <Award className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-offWhite text-sm font-sans">Architectural Comparison &amp; Resilience Benchmark</h3>
            <p className="text-xs text-gray-400">Evaluation of Quantum Council vs Single-Agent and Naive Multi-Agent systems.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead>
              <tr className="border-b border-white/10 text-gray-400 font-mono">
                <th className="py-3">Architecture Type</th>
                <th className="py-3">Fault Tolerance</th>
                <th className="py-3">Cognitive Diversity</th>
                <th className="py-3">Synthesis Resilience</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-gray-300">
              <tr>
                <td className="py-3 font-semibold text-offWhite">Single-Agent (Baseline)</td>
                <td className="py-3 text-rose-400">Zero (Single Point of Failure)</td>
                <td className="py-3 text-gray-400">Homogeneous (Self-Bias)</td>
                <td className="py-3 text-rose-400">None (Prone to Hallucination)</td>
              </tr>
              <tr>
                <td className="py-3 font-semibold text-offWhite">Naive Multi-Agent (AutoGPT/Crew)</td>
                <td className="py-3 text-amber-400">Fragile (Cascade Failures)</td>
                <td className="py-3 text-amber-400">Partial</td>
                <td className="py-3 text-amber-400">Brittle (Hangs on Timeout)</td>
              </tr>
              <tr className="bg-cyan-950/30 font-semibold text-offWhite">
                <td className="py-3 text-cyan-300 font-bold flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Quantum Council (LangGraph Core)</span>
                </td>
                <td className="py-3 text-emerald-400 font-semibold">Autonomous Circuit Breakers</td>
                <td className="py-3 text-cyan-300 font-semibold">5 Dialectical Minds</td>
                <td className="py-3 text-emerald-400 font-semibold">100% Graceful Degraded Consensus</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
