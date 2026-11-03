import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, Globe, RotateCcw, CheckCircle2, Sparkles } from 'lucide-react';

export const PrivacyPage: React.FC = () => {
  const [privacyMode, setPrivacyMode] = useState<'local_only' | 'hybrid'>('local_only');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const load = () => {
      fetch('/api/v1/privacy/settings')
        .then((res) => res.json())
        .then((data) => {
          if (data.privacy_mode) {
            setPrivacyMode(data.privacy_mode as any);
          }
        })
        .catch((err) => console.error('Failed to fetch privacy settings', err));
    };
    load();
    window.addEventListener('privacy-mode-changed', load);
    return () => window.removeEventListener('privacy-mode-changed', load);
  }, []);

  const handleModeChange = async (mode: 'local_only' | 'hybrid') => {
    setPrivacyMode(mode);
    setSaving(true);
    try {
      const res = await fetch('/api/v1/privacy/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ privacy_mode: mode }),
      });
      if (res.ok) {
        setSaved(true);
        window.dispatchEvent(new Event('privacy-mode-changed'));
        window.dispatchEvent(new Event('model-selection-changed'));
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (err) {
      console.error('Failed to update privacy mode', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-[11px] font-mono uppercase tracking-widest text-cyan-400 font-semibold">
              Security Architecture
            </span>
          </div>
          <h1 className="text-2xl font-bold text-offWhite font-sans">Privacy &amp; Data Sovereignty</h1>
          <p className="text-xs text-gray-400">Enforce strict data boundaries and local model execution parameters.</p>
        </div>
        {saving && (
          <span className="text-xs font-mono text-cyan-400 flex items-center gap-1.5 bg-cyan-950/60 px-3 py-1.5 rounded-full border border-cyan-400/30">
            <RotateCcw className="w-3.5 h-3.5 animate-spin" />
            <span>Enforcing Mode...</span>
          </span>
        )}
        {saved && (
          <span className="text-xs font-mono text-emerald-400 flex items-center gap-1.5 bg-emerald-950/60 px-3 py-1.5 rounded-full border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Policy Enforced</span>
          </span>
        )}
      </div>

      {/* Mode Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          onClick={() => handleModeChange('local_only')}
          className={`p-6 rounded-3xl border cursor-pointer transition-all ${
            privacyMode === 'local_only'
              ? 'liquid-glass-elevated border-emerald-400/60 shadow-[0_0_30px_rgba(16,185,129,0.25)] ring-1 ring-emerald-400/50'
              : 'liquid-card border-white/10 hover:border-white/20'
          }`}
        >
          <div className="w-12 h-12 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mb-4 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-offWhite text-base font-sans">Strict Local-Only Mode</h3>
          <p className="text-xs text-gray-300 mt-2 leading-relaxed">
            All 5 agents run entirely on on-premise hardware via Ollama. Cloud calls, online fallbacks, and external telemetry are permanently disabled at the network layer.
          </p>
          <span className="inline-block text-[10px] font-mono font-bold px-3 py-1 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 mt-4 tracking-wider">
            AIR-GAPPED COMPLIANT
          </span>
        </div>

        <div
          onClick={() => handleModeChange('hybrid')}
          className={`p-6 rounded-3xl border cursor-pointer transition-all ${
            privacyMode === 'hybrid'
              ? 'liquid-glass-elevated border-purple-400/60 shadow-[0_0_30px_rgba(168,85,247,0.25)] ring-1 ring-purple-400/50'
              : 'liquid-card border-white/10 hover:border-white/20'
          }`}
        >
          <div className="w-12 h-12 rounded-2xl bg-purple-950/60 border border-purple-500/40 flex items-center justify-center text-purple-400 mb-4 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
            <Globe className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-offWhite text-base font-sans">Hybrid Mode</h3>
          <p className="text-xs text-gray-300 mt-2 leading-relaxed">
            Permits designated agents (such as the Specialist or Critic) to query frontier online LLMs (Groq / OpenAI) when local VRAM is constrained, with full transparency.
          </p>
          <span className="inline-block text-[10px] font-mono font-bold px-3 py-1 rounded-full bg-purple-950/80 text-purple-300 border border-purple-500/30 mt-4 tracking-wider">
            HIGH-THROUGHPUT FRONTIER
          </span>
        </div>
      </div>

      {/* Boundary Safeguard Checkmarks */}
      <div className="liquid-glass-primary p-6 md:p-8 rounded-3xl space-y-4 border border-white/10">
        <h4 className="font-bold text-offWhite text-sm font-sans flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-cyan-400" />
          <span>Active Privacy Protections</span>
        </h4>
        <div className="space-y-3 text-xs text-gray-300 font-mono">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Zero document leakage: PDFs never leave local filesystem storage</span>
          </div>
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>No external training on user council sessions</span>
          </div>
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Local SQLite database with parameterized SQL queries</span>
          </div>
        </div>
      </div>
    </div>
  );
};
