import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
  Users, 
  ShieldCheck, 
  Cpu, 
  Activity, 
  ArrowRight, 
  Sparkles, 
  Database,
  RefreshCw,
  AlertTriangle,
  History,
  CheckCircle2,
  Lock,
  Globe,
  Radio,
  FileText,
  Clock,
  Zap,
  ArrowUpRight
} from 'lucide-react';
import { AGENT_PROFILES, AgentId } from '../types/agent';
import { useActiveModel } from '../hooks/useActiveModel';

interface RecentSession {
  id: string;
  title: string;
  task: string;
  mode: string;
  status: string;
  created_at: string;
}

export const Overview: React.FC = () => {
  const { activeModel } = useActiveModel();
  const [healthStatus, setHealthStatus] = useState<string>('CHECKING…');
  const [ollamaStatus, setOllamaStatus] = useState<string>('LOCAL');
  const [privacyMode, setPrivacyMode] = useState<string>('local_only');
  const [docCount, setDocCount] = useState<number>(0);
  const [sessionCount, setSessionCount] = useState<number>(0);
  const [circuitTrips, setCircuitTrips] = useState<number>(0);
  const [recoveryRate, setRecoveryRate] = useState<number>(100);
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);

  const fetchOverviewData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Health probe
      const healthRes = await fetch('/api/v1/health').catch(() => null);
      if (healthRes && healthRes.ok) {
        const hData = await healthRes.json();
        setHealthStatus(hData.status?.toUpperCase() || 'HEALTHY');
        setOllamaStatus(hData.ollama === 'connected' ? 'ONLINE' : 'OFFLINE');
      } else {
        setHealthStatus('DEGRADED');
        setOllamaStatus('OFFLINE');
      }

      // 2. Real Analytics Summary
      const analyticsRes = await fetch('/api/v1/analytics/summary').catch(() => null);
      if (analyticsRes && analyticsRes.ok) {
        const aData = await analyticsRes.json();
        setSessionCount(aData.total_sessions ?? 0);
        setDocCount(aData.total_documents_indexed ?? 0);
        setCircuitTrips(aData.circuit_breaker_trips ?? 0);
        setRecoveryRate(aData.recovery_success_rate ?? 100);
      }

      // 3. Privacy setting
      const privRes = await fetch('/api/v1/privacy/settings').catch(() => null);
      if (privRes && privRes.ok) {
        const pData = await privRes.json();
        setPrivacyMode(pData.privacy_mode || 'local_only');
      }

      // 4. Recent history sessions
      const histRes = await fetch('/api/v1/history/sessions').catch(() => null);
      if (histRes && histRes.ok) {
        const sessions = await histRes.json();
        if (Array.isArray(sessions)) {
          setRecentSessions(sessions.slice(0, 5));
        }
      }

      setLastRefreshed(new Date().toLocaleTimeString());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverviewData();
  }, [fetchOverviewData]);

  const isLocalOnly = privacyMode === 'local_only';

  const AGENT_ORDER: AgentId[] = ['researcher', 'analyst', 'alternative', 'critic', 'specialist'];

  const AGENT_PALETTES: Record<AgentId, { border: string; glow: string; textAccent: string; bgBadge: string }> = {
    researcher: {
      border: 'border-emerald-500/40',
      glow: 'shadow-[0_0_20px_rgba(16,185,129,0.2)]',
      textAccent: 'text-emerald-300',
      bgBadge: 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30',
    },
    analyst: {
      border: 'border-cyan-400/40',
      glow: 'shadow-[0_0_20px_rgba(69,217,245,0.2)]',
      textAccent: 'text-cyan-300',
      bgBadge: 'bg-cyan-950/60 text-cyan-300 border-cyan-400/30',
    },
    alternative: {
      border: 'border-purple-400/40',
      glow: 'shadow-[0_0_20px_rgba(168,85,247,0.2)]',
      textAccent: 'text-purple-300',
      bgBadge: 'bg-purple-950/60 text-purple-300 border-purple-500/30',
    },
    critic: {
      border: 'border-amber-400/40',
      glow: 'shadow-[0_0_20px_rgba(245,158,11,0.2)]',
      textAccent: 'text-amber-300',
      bgBadge: 'bg-amber-950/60 text-amber-300 border-amber-500/30',
    },
    specialist: {
      border: 'border-sky-400/40',
      glow: 'shadow-[0_0_20px_rgba(56,189,248,0.2)]',
      textAccent: 'text-sky-300',
      bgBadge: 'bg-sky-950/60 text-sky-300 border-sky-400/30',
    },
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* ─── Top Control Strip ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/10">
        <div>
          <span className="text-[11px] font-mono text-cyan-400 uppercase tracking-widest font-semibold flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            Intelligence Command Center
          </span>
          <h2 className="text-xl md:text-2xl font-bold text-offWhite font-sans tracking-tight">
            System Operations &amp; Deliberation Overview
          </h2>
        </div>
        <div className="flex items-center gap-3">
          {lastRefreshed && (
            <span className="text-xs font-mono text-mutedSilver">
              Telemetry sync: {lastRefreshed}
            </span>
          )}
          <button
            onClick={fetchOverviewData}
            disabled={loading}
            className="liquid-glass-interactive flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium text-gray-200 hover:text-white cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* ─── Hero Card: High-Impact Gradient Glass Pod (Matching Reference 1 & 2) ─── */}
      <div className="relative rounded-3xl overflow-hidden p-8 md:p-10 border border-white/20 shadow-[0_24px_64px_rgba(0,0,0,0.85)] bg-gradient-to-br from-teal-500/20 via-cyan-600/10 to-violet-600/20 backdrop-blur-2xl">
        {/* Subtle decorative mesh gradient blobs */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-400/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-violet-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/40 border border-cyan-400/40 text-cyan-300 text-xs font-mono font-semibold shadow-[0_0_15px_rgba(69,217,245,0.2)]">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>AUTONOMOUS MULTI-AGENT SYNTHESIS</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-offWhite font-sans tracking-tight leading-tight">
            Five Minds. <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-300 via-cyan-300 to-violet-300">One Intelligence.</span>
          </h1>

          <p className="text-sm md:text-base text-gray-200 leading-relaxed font-sans">
            A state-of-the-art collaborative AI chamber where five specialized autonomous agents debate, cross-examine hypotheses, review assumptions, isolate faults, and synthesize verified consensus.
          </p>

          <div className="pt-2 flex flex-wrap gap-3.5">
            <Link
              to="/council"
              className="inline-flex items-center gap-2.5 px-6 py-3 rounded-full bg-white text-black font-semibold text-sm transition-all duration-200 hover:bg-cyan-100 hover:shadow-[0_0_25px_rgba(255,255,255,0.5)] active:scale-[0.98]"
            >
              <span>Enter Council Room</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/vault"
              className="liquid-glass-interactive inline-flex items-center gap-2 px-5 py-3 rounded-full text-offWhite font-medium text-sm border border-white/20 hover:border-cyan-400/40"
            >
              <Database className="w-4 h-4 text-cyan-400" />
              <span>Knowledge Vault ({docCount} indexed)</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ─── Four Vivid Vitals Cards (Directly matching Reference 2 & 3 aesthetic) ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: System Integrity */}
        <div className="liquid-card rounded-2xl p-5 border border-emerald-500/25 relative overflow-hidden group hover:border-emerald-400/50 transition-all">
          <div className="flex items-center justify-between text-mutedSilver mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-semibold">
              System Integrity
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-950/60 text-emerald-300 border border-emerald-500/30">
              100% ONLINE
            </span>
          </div>
          <div className="text-2xl font-bold text-offWhite font-mono mt-1">{healthStatus}</div>
          <p className="text-xs text-gray-400 mt-1">
            {sessionCount} total sessions orchestrated
          </p>
          <div className="w-full bg-white/5 h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-emerald-400 h-full w-full rounded-full" />
          </div>
        </div>

        {/* Card 2: Fault Isolation */}
        <div className="liquid-card rounded-2xl p-5 border border-amber-500/25 relative overflow-hidden group hover:border-amber-400/50 transition-all">
          <div className="flex items-center justify-between text-mutedSilver mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-semibold">
              Resilience Protocol
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-950/60 text-amber-300 border border-amber-500/30">
              {recoveryRate}% RECOVERY
            </span>
          </div>
          <div className="text-2xl font-bold text-offWhite font-mono mt-1">
            {circuitTrips === 0 ? 'Fault-Tolerant' : `${circuitTrips} Trips Isolated`}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Autonomous role substitution armed
          </p>
          <div className="w-full bg-white/5 h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-amber-400 h-full w-[98%] rounded-full" />
          </div>
        </div>

        {/* Card 3: Privacy Protocol */}
        <div className="liquid-card rounded-2xl p-5 border border-purple-500/25 relative overflow-hidden group hover:border-purple-400/50 transition-all">
          <div className="flex items-center justify-between text-mutedSilver mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-purple-400 font-semibold">
              Data Sovereignty
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-950/60 text-purple-300 border border-purple-500/30">
              {isLocalOnly ? 'AIR-GAPPED' : 'HYBRID'}
            </span>
          </div>
          <div className="text-2xl font-bold text-offWhite font-mono mt-1">
            {isLocalOnly ? 'Strict Local' : 'Hybrid Cloud'}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {isLocalOnly ? 'Zero telemetry leaves hardware' : 'Frontier LLM routing enabled'}
          </p>
          <div className="w-full bg-white/5 h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-purple-400 h-full w-full rounded-full" />
          </div>
        </div>

        {/* Card 4: Active AI Engine */}
        <div className="liquid-card rounded-2xl p-5 border border-cyan-400/25 relative overflow-hidden group hover:border-cyan-400/50 transition-all">
          <div className="flex items-center justify-between text-mutedSilver mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-400 font-semibold">
              Active Engine
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-950/60 text-cyan-300 border border-cyan-400/30">
              {activeModel.is_online ? 'CLOUD' : 'LOCAL'}
            </span>
          </div>
          <div className="text-2xl font-bold text-offWhite font-mono mt-1 truncate" title={activeModel.model_name}>
            {activeModel.model_name}
          </div>
          <p className="text-xs text-gray-400 mt-1 truncate" title={activeModel.display_text}>
            {activeModel.display_text}
          </p>
          <div className="w-full bg-white/5 h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-cyan-400 h-full w-full rounded-full" />
          </div>
        </div>
      </div>

      {/* ─── The Five Specialized Minds Grid (Matching Reference 2 & 3 Note Style) ─── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-offWhite font-sans flex items-center gap-2">
              <Users className="w-5 h-5 text-cyan-400" />
              <span>The Five Specialized Minds</span>
            </h3>
            <p className="text-xs text-mutedSilver">Each AI agent possesses an isolated perspective, system prompt, and reasoning method.</p>
          </div>
          <Link
            to="/studio"
            className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-full border border-white/10 hover:border-cyan-400/40 transition-all"
          >
            <span>Agent Studio</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {AGENT_ORDER.map((agentId, index) => {
            const profile = AGENT_PROFILES[agentId];
            const palette = AGENT_PALETTES[agentId];

            return (
              <div
                key={agentId}
                className={`liquid-card rounded-2xl p-5 border ${palette.border} flex flex-col justify-between hover:scale-[1.02] transition-all duration-300 ${palette.glow}`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-mono text-gray-400 font-bold">
                      0{index + 1}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase border ${palette.bgBadge}`}>
                      {profile.role.split(' ')[0]}
                    </span>
                  </div>

                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${profile.color} border border-white/20 flex items-center justify-center text-lg font-bold text-white mb-3 shadow-md`}>
                    {profile.name.charAt(0)}
                  </div>

                  <h4 className="font-bold text-sm text-offWhite font-sans tracking-wide">
                    {profile.name}
                  </h4>
                  <p className={`text-[11px] font-mono font-medium ${palette.textAccent} mt-0.5`}>
                    {profile.role}
                  </p>

                  <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
                    {profile.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[10px] font-mono text-gray-400">
                  <span>Temperature</span>
                  <span className="font-bold text-gray-200">
                    {agentId === 'alternative' ? '0.85' : agentId === 'critic' ? '0.30' : '0.70'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Recent Deliberations Feed (Matching Reference 1 Recent Transactions) ─── */}
      <div className="liquid-glass-primary rounded-3xl p-6 md:p-8 border border-white/10 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-950/60 border border-cyan-400/30 flex items-center justify-center text-cyan-300">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-offWhite font-sans">
                Recent Chamber Deliberations
              </h3>
              <p className="text-xs text-mutedSilver">
                Archived multi-agent debates with full round-by-round consensus
              </p>
            </div>
          </div>
          <Link
            to="/history"
            className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 hover:underline"
          >
            <span>View All ({sessionCount})</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentSessions.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            No deliberations recorded yet. Launch the Council Room above to convene your first council!
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {recentSessions.map((session) => (
              <div
                key={session.id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white/[0.02] px-2 rounded-xl transition-colors"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-cyan-950/50 border border-cyan-400/30 flex items-center justify-center text-cyan-300 shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <h5 className="text-sm font-semibold text-offWhite font-sans truncate" title={session.title || session.task}>
                      {session.title || session.task}
                    </h5>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] font-mono text-gray-400">
                      <span className="capitalize">{session.mode || 'council'} mode</span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(session.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-start sm:self-center">
                  <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase bg-emerald-950/60 text-emerald-300 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.15)]">
                    {session.status || 'CONSENSUS REACHED'}
                  </span>
                  <Link
                    to={`/history`}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 transition-colors"
                    title="Inspect Transcript"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
