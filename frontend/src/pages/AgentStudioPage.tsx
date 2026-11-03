import React, { useState, useEffect } from 'react';
import { AgentId, AGENT_PROFILES } from '../types/agent';
import { Save, RotateCcw, Check } from 'lucide-react';

interface AgentConfigData {
  agent_id: string;
  agent_name: string;
  system_prompt: string;
  personality: string;
  provider: string;
  model_name: string;
  temperature: number;
  max_tokens: number;
  is_enabled: boolean;
}

export const AgentStudioPage: React.FC = () => {
  const [selectedAgent, setSelectedAgent] = useState<AgentId>('analyst');
  const [configs, setConfigs] = useState<Record<string, AgentConfigData>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch('/api/v1/agents')
      .then((res) => res.json())
      .then((data: AgentConfigData[]) => {
        const mapped: Record<string, AgentConfigData> = {};
        data.forEach((c) => {
          mapped[c.agent_id] = c;
        });
        setConfigs(mapped);
      })
      .catch((err) => console.error('Failed to load agent configs', err))
      .finally(() => setLoading(false));
  }, []);

  const currentConfig = configs[selectedAgent] || {
    agent_id: selectedAgent,
    agent_name: AGENT_PROFILES[selectedAgent].name,
    system_prompt: '',
    temperature: 0.7,
    max_tokens: 1024,
    is_enabled: true,
  };

  const handlePromptChange = (val: string) => {
    setConfigs((prev) => ({
      ...prev,
      [selectedAgent]: {
        ...currentConfig,
        system_prompt: val,
      },
    }));
  };

  const handleTemperatureChange = (val: number) => {
    setConfigs((prev) => ({
      ...prev,
      [selectedAgent]: {
        ...currentConfig,
        temperature: val,
      },
    }));
  };

  const handleTokensChange = (val: number) => {
    setConfigs((prev) => ({
      ...prev,
      [selectedAgent]: {
        ...currentConfig,
        max_tokens: val,
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/agents/${selectedAgent}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_prompt: currentConfig.system_prompt,
          temperature: currentConfig.temperature,
          max_tokens: currentConfig.max_tokens,
          is_enabled: currentConfig.is_enabled,
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (err) {
      console.error('Failed to save config', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-[11px] font-mono uppercase tracking-widest text-cyan-400 font-semibold">
              Cognitive Architecture
            </span>
          </div>
          <h1 className="text-2xl font-bold text-offWhite font-sans">Agent Studio</h1>
          <p className="text-xs text-gray-400">Configure role personas, system prompts, and sampling parameters.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black font-semibold text-xs transition-all hover:bg-cyan-100 shadow-[0_0_20px_rgba(255,255,255,0.3)] cursor-pointer disabled:opacity-50"
        >
          {saved ? <Check className="w-4 h-4 text-emerald-600" /> : <Save className="w-4 h-4" />}
          <span>{saved ? 'Saved Changes!' : 'Save Persona'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Agent Selector Sidebar */}
        <div className="md:col-span-4 space-y-2">
          {Object.values(AGENT_PROFILES).map((a) => (
            <button
              key={a.id}
              onClick={() => setSelectedAgent(a.id)}
              className={`w-full text-left p-3.5 rounded-2xl border flex items-center gap-3 transition-all cursor-pointer ${
                selectedAgent === a.id
                  ? 'bg-cyan-950/60 border-cyan-400 text-offWhite shadow-[0_0_15px_rgba(69,217,245,0.25)]'
                  : 'liquid-card border-white/10 text-gray-400 hover:text-white hover:border-white/20'
              }`}
            >
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${a.color} flex items-center justify-center text-white font-bold text-xs shadow-sm shrink-0 border border-white/20`}>
                {a.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-semibold truncate">{a.name}</h4>
                <span className="text-[10px] font-mono text-cyan-400 uppercase font-semibold">{a.badge}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Prompt & Hyperparameters Editor */}
        <div className="md:col-span-8 liquid-glass-primary p-6 md:p-8 rounded-3xl space-y-5 border border-white/10">
          <div>
            <label className="block text-xs font-mono uppercase text-gray-400 mb-2 font-semibold">
              System Instruction Prompt
            </label>
            <textarea
              rows={8}
              value={currentConfig.system_prompt || ''}
              onChange={(e) => handlePromptChange(e.target.value)}
              placeholder="Loading system prompt..."
              className="w-full bg-black/40 border border-white/10 focus:border-cyan-400/80 rounded-2xl p-4 text-sm text-gray-200 font-mono leading-relaxed focus:outline-none shadow-inner"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 pt-1">
            <div className="p-4 rounded-2xl bg-black/30 border border-white/10 space-y-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-gray-400">Temperature</span>
                <span className="text-cyan-400 font-bold">{currentConfig.temperature}</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.5"
                step="0.05"
                value={currentConfig.temperature}
                onChange={(e) => handleTemperatureChange(parseFloat(e.target.value))}
                className="w-full accent-cyan-400"
              />
            </div>

            <div className="p-4 rounded-2xl bg-black/30 border border-white/10 space-y-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-gray-400">Max Tokens</span>
                <span className="text-cyan-400 font-bold">{currentConfig.max_tokens}</span>
              </div>
              <input
                type="range"
                min="256"
                max="4096"
                step="128"
                value={currentConfig.max_tokens}
                onChange={(e) => handleTokensChange(parseInt(e.target.value))}
                className="w-full accent-cyan-400"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
