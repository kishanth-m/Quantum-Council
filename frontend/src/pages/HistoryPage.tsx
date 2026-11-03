import React, { useState, useEffect } from 'react';
import { History, CheckCircle2, Clock, RotateCcw, ChevronDown, ChevronUp, Bot, FileText, Sparkles } from 'lucide-react';
import { MarkdownRenderer } from '../components/common/MarkdownRenderer';

interface SessionItem {
  id: string;
  title: string;
  task: string;
  mode: string;
  status: string;
  created_at: string;
  execution_time_ms: number;
  final_answer?: string | null;
}

interface MessageDetail {
  id: string;
  agent_id: string;
  agent_name: string;
  content: string;
  message_type: string;
  round_number: number;
  created_at: string;
}

interface SessionDetail extends SessionItem {
  messages: MessageDetail[];
}

export const HistoryPage: React.FC = () => {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, SessionDetail>>({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = () => {
    setLoading(true);
    fetch('/api/v1/history/sessions')
      .then((res) => res.json())
      .then((data) => setSessions(data))
      .catch((err) => console.error('Failed to load history', err))
      .finally(() => setLoading(false));
  };

  const toggleExpand = async (sessionId: string) => {
    if (expandedId === sessionId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(sessionId);

    if (!details[sessionId]) {
      setLoadingDetail(sessionId);
      try {
        const res = await fetch(`/api/v1/history/sessions/${sessionId}`);
        if (res.ok) {
          const data = await res.json();
          setDetails((prev) => ({ ...prev, [sessionId]: data }));
        }
      } catch (err) {
        console.error('Failed to fetch session detail:', err);
      } finally {
        setLoadingDetail(null);
      }
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-[11px] font-mono uppercase tracking-widest text-cyan-400 font-semibold">
              Deliberation Archive
            </span>
          </div>
          <h1 className="text-2xl font-bold text-offWhite font-sans">Council History</h1>
          <p className="text-xs text-gray-400">Review past multi-agent deliberations, debate transcripts, and synthesis records.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadSessions}
            className="p-2 rounded-xl border border-white/10 bg-white/5 text-gray-300 hover:text-white transition-all cursor-pointer hover:bg-white/10"
            title="Refresh History"
          >
            <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
          <span className="text-xs font-mono text-cyan-400 bg-cyan-950/60 px-3 py-1 rounded-full border border-cyan-400/30 font-semibold">
            {sessions.length} Sessions
          </span>
        </div>
      </div>

      <div className="liquid-glass-primary rounded-3xl overflow-hidden divide-y divide-white/10 border border-white/10">
        {loading ? (
          <div className="p-12 text-center text-xs text-gray-400 flex items-center justify-center gap-2 font-mono">
            <RotateCcw className="w-4 h-4 animate-spin text-cyan-400" />
            <span>Loading deliberation history...</span>
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-400 font-sans">
            No council sessions recorded yet. Launch a deliberation in the Council Room to record dialectical transcripts.
          </div>
        ) : (
          sessions.map((s) => {
            const isExpanded = expandedId === s.id;
            const detail = details[s.id];
            return (
              <div key={s.id} className="transition-colors">
                <div
                  onClick={() => toggleExpand(s.id)}
                  className="p-5 sm:p-6 hover:bg-white/[0.03] transition-colors flex items-center justify-between cursor-pointer"
                >
                  <div className="space-y-1.5 flex-1 pr-4">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-offWhite text-sm font-sans tracking-wide">
                        {s.title || (s.task.length > 80 ? `${s.task.substring(0, 80)}...` : s.task)}
                      </h4>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400 font-mono">
                      <span className="uppercase text-cyan-400 font-semibold">{s.mode} MODE</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {(s.execution_time_ms / 1000).toFixed(1)}s
                      </span>
                      <span>•</span>
                      <span>{new Date(s.created_at).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-300 bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-500/30 font-semibold shadow-[0_0_10px_rgba(16,185,129,0.15)]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{s.status.toUpperCase()}</span>
                    </span>
                    <button className="p-1.5 rounded-lg text-gray-400 hover:text-white">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-6 pb-6 pt-2 bg-black/30 border-t border-white/10 space-y-4">
                    <div className="space-y-1.5">
                      <span className="text-xs font-mono uppercase tracking-wider text-gray-400 flex items-center gap-1.5 font-semibold">
                        <FileText className="w-3.5 h-3.5 text-cyan-400" /> Full Prompt / Task Directive
                      </span>
                      <p className="text-sm text-gray-200 font-sans whitespace-pre-wrap bg-black/50 p-4 rounded-2xl border border-white/10 leading-relaxed">
                        {s.task}
                      </p>
                    </div>

                    {loadingDetail === s.id ? (
                      <div className="p-6 text-center text-xs text-gray-400 flex items-center justify-center gap-2 font-mono">
                        <RotateCcw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                        <span>Loading deliberation transcript...</span>
                      </div>
                    ) : (
                      <>
                        {detail?.messages && detail.messages.length > 0 && (
                          <div className="space-y-2">
                            <span className="text-xs font-mono uppercase tracking-wider text-gray-400 flex items-center gap-1.5 font-semibold">
                              <Bot className="w-3.5 h-3.5 text-cyan-400" /> Dialectical Contributions ({detail.messages.length})
                            </span>
                            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                              {detail.messages.map((m) => (
                                <div key={m.id} className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-1.5 shadow-sm">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="font-bold text-cyan-300 capitalize font-mono">
                                      {m.agent_name || m.agent_id}
                                    </span>
                                    <span className="text-[10px] text-gray-500 font-mono uppercase">{m.message_type}</span>
                                  </div>
                                  <div className="text-xs text-gray-200 leading-relaxed">
                                    <MarkdownRenderer content={m.content} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="space-y-2 pt-3 border-t border-white/10">
                          <span className="text-xs font-mono uppercase tracking-wider text-cyan-400 flex items-center gap-1.5 font-semibold">
                            <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Final Synthesized Consensus
                          </span>
                          <div className="p-5 rounded-2xl bg-black/60 border border-cyan-400/30 shadow-[0_0_25px_rgba(22,199,194,0.15)] text-sm leading-relaxed text-gray-200">
                            <MarkdownRenderer content={s.final_answer || detail?.final_answer || 'No final synthesized answer recorded for this session.'} />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
