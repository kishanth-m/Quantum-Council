import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Shield, 
  Sliders, 
  Save, 
  Check, 
  Palette, 
  Sparkles, 
  Compass, 
  CheckCircle2,
  Activity,
  Layers,
  Database
} from 'lucide-react';
import { councilService } from '../services/councilService';
import { ResilienceConfig } from '../types/council';
import { 
  THEMES, 
  ThemeDefinition, 
  getSavedTheme, 
  applyTheme, 
  MotionPreference, 
  getSavedMotion, 
  setSavedMotion 
} from '../styles/themes';
import { DataManagementSection } from '../components/settings/DataManagementSection';

export const SettingsPage: React.FC = () => {
  const [config, setConfig] = useState<ResilienceConfig>({
    auto_recovery_enabled: true,
    max_retries: 2,
    agent_timeout_seconds: 30,
    allow_role_substitution: true,
    min_healthy_agents: 1,
    allow_partial_completion: true,
  });

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<ThemeDefinition>(getSavedTheme());
  const [motion, setMotion] = useState<MotionPreference>(getSavedMotion());

  useEffect(() => {
    councilService
      .getResilienceConfig()
      .then((data) => setConfig(data))
      .catch((err) => console.error('Failed to load resilience config', err));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await councilService.updateResilienceConfig(config);
      setConfig(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to update config', err);
    } finally {
      setSaving(false);
    }
  };

  const handleSelectTheme = (theme: ThemeDefinition) => {
    setCurrentTheme(theme);
    applyTheme(theme);
  };

  const handleSelectMotion = (m: MotionPreference) => {
    setMotion(m);
    setSavedMotion(m);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-[11px] font-mono uppercase tracking-widest text-cyan-400 font-semibold">
              System Configuration
            </span>
          </div>
          <h1 className="text-2xl font-bold text-offWhite font-sans">Settings &amp; Preferences</h1>
          <p className="text-xs text-gray-400">Configure visual themes, ambient motion, fault-tolerant policies, and data management.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black font-semibold text-xs transition-all hover:bg-cyan-100 hover:shadow-[0_0_20px_rgba(255,255,255,0.4)] cursor-pointer disabled:opacity-50 self-start sm:self-auto"
        >
          {saved ? <Check className="w-4 h-4 text-emerald-600" /> : <Save className="w-4 h-4" />}
          <span>{saved ? 'Saved Successfully!' : 'Save Policies'}</span>
        </button>
      </div>

      {/* ─── SECTION 1: Appearance & Theme Selection ──────────────────────────── */}
      <div className="liquid-glass-primary p-6 md:p-8 rounded-3xl space-y-5 border border-white/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-950/60 border border-cyan-400/30 flex items-center justify-center text-cyan-300">
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-offWhite text-sm font-sans">Visual Themes</h3>
              <p className="text-xs text-gray-400">Optical color systems formulated with deep contrast and subtle luminous glass refraction.</p>
            </div>
          </div>
          <span className="text-xs font-mono text-cyan-300 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-400/40 self-start sm:self-auto font-semibold">
            Active: {currentTheme.name}
          </span>
        </div>

        {/* Theme Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
          {THEMES.map((theme) => {
            const isSelected = currentTheme.id === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => handleSelectTheme(theme)}
                className={`text-left p-4 rounded-2xl border transition-all relative overflow-hidden group cursor-pointer ${
                  isSelected
                    ? 'border-cyan-400 bg-black/60 shadow-[0_0_20px_rgba(69,217,245,0.25)] ring-1 ring-cyan-400'
                    : 'border-white/10 bg-black/30 hover:border-white/20 hover:bg-black/50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-offWhite group-hover:text-cyan-300 transition-colors">
                      {theme.name}
                    </span>
                    <span className="text-[9px] font-mono text-gray-400 uppercase font-semibold">
                      {theme.category}
                    </span>
                  </div>
                  {isSelected && (
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                  )}
                </div>

                <p className="text-[11px] text-gray-400 mb-3 leading-snug line-clamp-2">
                  {theme.description}
                </p>

                {/* 6 Palette Color Swatches */}
                <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-black/40 border border-white/5">
                  {theme.palette.map((color, idx) => (
                    <div
                      key={idx}
                      className="flex-1 h-5 rounded-md border border-white/10 transition-transform group-hover:scale-105"
                      style={{ backgroundColor: color }}
                      title={`Color ${idx + 1}: ${color}`}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── SECTION 2: Animated Motion Background ────────────────────────────── */}
      <div className="liquid-glass-primary p-6 md:p-8 rounded-3xl space-y-4 border border-white/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-950/60 border border-purple-500/40 flex items-center justify-center text-purple-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-offWhite text-sm font-sans">Dynamic Liquid Glass Motion</h3>
              <p className="text-xs text-gray-400">Dual-engine background: 4 drifting GPU ambient plasma orbs + retina-scaled starlight canvas.</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-semibold">
            <Activity className="w-3.5 h-3.5 animate-pulse" />
            <span>MOTION: {motion.toUpperCase()}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
          <button
            type="button"
            onClick={() => handleSelectMotion('on')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
              motion === 'on'
                ? 'border-cyan-400 bg-cyan-950/30 text-offWhite shadow-[0_0_15px_rgba(69,217,245,0.2)]'
                : 'border-white/10 bg-black/30 text-gray-400 hover:border-white/20'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-offWhite">Motion On (Full Dynamic)</span>
              <Compass className={`w-4 h-4 ${motion === 'on' ? 'text-cyan-400 animate-spin' : 'text-gray-500'}`} />
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Active drifting ambient plasma orbs, sparkling starlight embers, and continuous neural filaments.
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleSelectMotion('reduced')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
              motion === 'reduced'
                ? 'border-cyan-400 bg-cyan-950/30 text-offWhite shadow-[0_0_15px_rgba(69,217,245,0.2)]'
                : 'border-white/10 bg-black/30 text-gray-400 hover:border-white/20'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-offWhite">Motion Reduced</span>
              <Activity className="w-4 h-4 text-purple-400" />
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Gentle slow drift with reduced particle density, optimized for lower battery consumption.
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleSelectMotion('off')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
              motion === 'off'
                ? 'border-cyan-400 bg-cyan-950/30 text-offWhite shadow-[0_0_15px_rgba(69,217,245,0.2)]'
                : 'border-white/10 bg-black/30 text-gray-400 hover:border-white/20'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-offWhite">Motion Off (Static)</span>
              <span className="w-2 h-2 rounded-full bg-gray-600" />
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Static ambient lighting field without active particles or fluid translation.
            </p>
          </button>
        </div>
      </div>

      {/* ─── SECTION 3: Fault Tolerance & Resilience Policies ─────────────────── */}
      <div className="liquid-glass-primary p-6 md:p-8 rounded-3xl space-y-5 border border-white/10">
        <div className="flex items-center gap-3 pb-3 border-b border-white/10">
          <div className="w-9 h-9 rounded-xl bg-amber-950/60 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-offWhite text-sm font-sans">Fault Tolerance &amp; Recovery Policies</h3>
            <p className="text-xs text-gray-400">Fine-tune the LangGraph autonomous self-healing parameters and agent thresholds.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-start gap-3 p-4 rounded-2xl bg-black/30 border border-white/10 cursor-pointer hover:border-white/20 transition-all">
            <input
              type="checkbox"
              checked={config.auto_recovery_enabled}
              onChange={(e) => setConfig({ ...config, auto_recovery_enabled: e.target.checked })}
              className="mt-1 w-4 h-4 accent-cyan-400 rounded"
            />
            <div>
              <span className="text-xs font-bold text-offWhite block">Autonomous Self-Healing</span>
              <span className="text-[11px] text-gray-400 leading-relaxed block mt-0.5">
                Automatically substitute failed or unreachable agents with an available peer mind.
              </span>
            </div>
          </label>

          <label className="flex items-start gap-3 p-4 rounded-2xl bg-black/30 border border-white/10 cursor-pointer hover:border-white/20 transition-all">
            <input
              type="checkbox"
              checked={config.allow_partial_completion}
              onChange={(e) => setConfig({ ...config, allow_partial_completion: e.target.checked })}
              className="mt-1 w-4 h-4 accent-cyan-400 rounded"
            />
            <div>
              <span className="text-xs font-bold text-offWhite block">Allow Partial Synthesis</span>
              <span className="text-[11px] text-gray-400 leading-relaxed block mt-0.5">
                Generate consensus report even if some agents drop out or exceed latency limits.
              </span>
            </div>
          </label>
        </div>

        {/* Sliders for timeout and retries */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="p-4 rounded-2xl bg-black/30 border border-white/10 space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-gray-300">Agent Timeout</span>
              <span className="text-cyan-400 font-bold">{config.agent_timeout_seconds}s</span>
            </div>
            <input
              type="range"
              min={10}
              max={120}
              step={5}
              value={config.agent_timeout_seconds}
              onChange={(e) => setConfig({ ...config, agent_timeout_seconds: parseInt(e.target.value) })}
              className="w-full accent-cyan-400"
            />
          </div>

          <div className="p-4 rounded-2xl bg-black/30 border border-white/10 space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-gray-300">Max Auto-Retries</span>
              <span className="text-cyan-400 font-bold">{config.max_retries} attempts</span>
            </div>
            <input
              type="range"
              min={0}
              max={5}
              step={1}
              value={config.max_retries}
              onChange={(e) => setConfig({ ...config, max_retries: parseInt(e.target.value) })}
              className="w-full accent-cyan-400"
            />
          </div>
        </div>
      </div>

      {/* ─── SECTION 4: Storage & Cleanup (Data Management) ────────────────────── */}
      <div className="liquid-glass-primary p-6 md:p-8 rounded-3xl space-y-4 border border-white/10">
        <DataManagementSection />
      </div>
    </div>
  );
};
