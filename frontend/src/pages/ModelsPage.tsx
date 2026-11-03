/**
 * frontend/src/pages/ModelsPage.tsx
 *
 * Full Online & Local Model Configuration Centre.
 * Connects to live backend endpoints:
 *  - GET  /api/v1/models/providers       → list all providers + status
 *  - POST /api/v1/models/config          → save provider config
 *  - DELETE /api/v1/models/config/{p}    → remove provider config
 *  - POST /api/v1/models/test            → live connection test
 *  - GET  /api/v1/models/assignments     → per-agent model assignments
 *  - POST /api/v1/models/assign-agent    → assign model to single agent
 *  - POST /api/v1/models/assign-global   → assign model to all agents
 *  - GET/PUT /api/v1/privacy/settings    → live privacy mode toggle
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useActiveModel } from '../hooks/useActiveModel';
import {
  Server,
  Cloud,
  Key,
  Zap,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Trash2,
  Save,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Globe,
  Cpu,
  Users,
  Lock,
  ArrowRightLeft,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ProviderDetail {
  provider: string;
  name: string;
  type: 'local' | 'online';
  base_url: string;
  model_name: string;
  has_api_key: boolean;
  masked_api_key: string;
  is_active: boolean;
  available_models: string[];
}

interface AgentAssignment {
  agent_id: string;
  agent_name: string;
  provider: string;
  model_name: string;
}

interface TestResult {
  success: boolean;
  message: string;
  latency_ms: number;
}

// ─── Provider Meta ─────────────────────────────────────────────────────────────

const PROVIDER_META: Record<string, { icon: string; accent: string; description: string }> = {
  ollama: {
    icon: '🦙',
    accent: 'cyan-400',
    description: 'Local inference engine. No data leaves your machine.',
  },
  groq: {
    icon: '⚡',
    accent: 'purple-400',
    description: 'Ultra-fast cloud inference. Free API keys available on console.groq.com.',
  },
  openai: {
    icon: '🤖',
    accent: 'blue-400',
    description: 'OpenAI GPT models. Requires an OpenAI API key.',
  },
  openai_compatible: {
    icon: '🔌',
    accent: 'amber-400',
    description: 'Any OpenAI-compatible endpoint (LM Studio, vLLM, LocalAI, etc.).',
  },
};

// ─── Sub-components ─────────────────────────────────────────────────────────────

interface StatusBadgeProps { active: boolean; label?: string }
const StatusBadge: React.FC<StatusBadgeProps> = ({ active, label }) => (
  <span
    className={`px-2.5 py-1 rounded-full text-xs font-mono font-semibold border ${
      active
        ? 'bg-emerald-950/60 border-emerald-500/30 text-emerald-400'
        : 'bg-gray-900/60 border-gray-700/40 text-gray-500'
    }`}
  >
    {label ?? (active ? 'ACTIVE' : 'INACTIVE')}
  </span>
);

interface TestResultBannerProps { result: TestResult | null; loading: boolean }
const TestResultBanner: React.FC<TestResultBannerProps> = ({ result, loading }) => {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400 animate-pulse py-1">
        <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
        Testing connection…
      </div>
    );
  }
  if (!result) return null;
  return (
    <div
      className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2 border ${
        result.success
          ? 'bg-emerald-950/40 border-emerald-700/40 text-emerald-300'
          : 'bg-red-950/40 border-red-700/40 text-red-300'
      }`}
    >
      {result.success ? <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" /> : <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
      <span className="leading-relaxed">{result.message}{result.latency_ms > 0 ? ` (${result.latency_ms}ms)` : ''}</span>
    </div>
  );
};

// ─── Ollama Panel ───────────────────────────────────────────────────────────────

interface OllamaPanelProps { provider: ProviderDetail; onRefresh: () => void }
const OllamaPanel: React.FC<OllamaPanelProps> = ({ provider, onRefresh }) => {
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [modelInput, setModelInput] = useState(provider.model_name || 'llama3.2:1b');

  useEffect(() => {
    if (provider.model_name) {
      setModelInput(provider.model_name);
    } else if (provider.available_models && provider.available_models.length > 0) {
      setModelInput(provider.available_models[0]);
    }
  }, [provider.model_name, provider.available_models]);

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/v1/models/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'ollama', model_name: modelInput.trim() }),
      });
      const data: TestResult = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setTestResult({ success: false, message: err.message, latency_ms: 0 });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/v1/models/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'ollama', model_name: modelInput.trim() }),
      });
      await fetch('/api/v1/models/assign-global', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'ollama', model_name: modelInput.trim() }),
      });
      window.dispatchEvent(new Event('model-selection-changed'));
      onRefresh();
    } catch (err) {
      console.error('Failed to save ollama model default:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="liquid-glass-primary p-6 rounded-3xl space-y-4 border border-white/10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-950/60 border border-cyan-400/40 flex items-center justify-center text-xl shadow-[0_0_12px_rgba(69,217,245,0.2)]">
            🦙
          </div>
          <div>
            <h3 className="font-bold text-offWhite text-sm font-sans">Ollama Local Instance</h3>
            <p className="text-xs text-gray-400">Primary local engine running on your hardware.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge active={provider.is_active} label={provider.is_active ? 'CONNECTED' : 'UNREACHABLE'} />
          <button onClick={onRefresh} title="Refresh detection" className="p-1.5 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-mono text-gray-400 mb-1">Base URL</label>
          <input
            type="text"
            value={provider.base_url}
            readOnly
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-300 font-mono focus:outline-none cursor-not-allowed shadow-inner"
          />
        </div>
        <div>
          <label className="block text-xs font-mono text-gray-400 mb-1">Active Model Name (type or select below)</label>
          <input
            type="text"
            value={modelInput}
            onChange={(e) => setModelInput(e.target.value)}
            placeholder="e.g. llama3.2:1b or qwen2.5:3b"
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-offWhite font-mono focus:outline-none focus:border-cyan-400/80 transition-colors shadow-inner"
          />
        </div>
      </div>

      {/* Installed models detected from Ollama */}
      <div className="bg-black/40 border border-white/5 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-mono text-gray-400">
            Discovered Models in your running Ollama instance ({provider.available_models?.length || 0}):
          </p>
          <span className="text-[10px] text-gray-500 font-mono">Click to select</span>
        </div>
        {provider.available_models && provider.available_models.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {provider.available_models.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setModelInput(m)}
                className={`px-3 py-1 rounded-xl text-xs font-mono border transition-all cursor-pointer ${
                  modelInput === m
                    ? 'bg-cyan-950/70 border-cyan-400 text-cyan-300 font-bold shadow-[0_0_12px_rgba(69,217,245,0.25)]'
                    : 'bg-white/5 border-white/10 text-gray-300 hover:border-white/20 hover:text-white'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-amber-400/90 font-mono">
            No models detected in Ollama yet. Run `ollama pull &lt;model_name&gt;` in your terminal.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between pt-1">
        <TestResultBanner result={testResult} loading={testing} />
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={handleSave}
            disabled={saving || !modelInput.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-200 text-xs font-medium border border-white/10 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving…' : 'Save Default'}
          </button>
          <button
            onClick={runTest}
            disabled={testing || !modelInput.trim()}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-white text-black font-semibold text-xs hover:bg-cyan-100 transition-all shadow-[0_0_15px_rgba(255,255,255,0.3)] disabled:opacity-50 cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5" />
            Test Connection
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Online Provider Panel ─────────────────────────────────────────────────────

interface OnlineProviderPanelProps {
  provider: ProviderDetail;
  onSaved: () => void;
}

const OnlineProviderPanel: React.FC<OnlineProviderPanelProps> = ({ provider, onSaved }) => {
  const [expanded, setExpanded] = useState(provider.has_api_key);
  const [modelName, setModelName] = useState(provider.model_name || 'llama-3.3-70b-versatile');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState(provider.base_url);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saveResult, setSaveResult] = useState<TestResult | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  useEffect(() => {
    if (provider.model_name) {
      setModelName(provider.model_name);
    }
    if (provider.base_url) {
      setBaseUrl(provider.base_url);
    }
    if (provider.has_api_key) {
      setExpanded(true);
    }
  }, [provider.model_name, provider.base_url, provider.has_api_key]);

  const meta = PROVIDER_META[provider.provider] ?? { icon: '🔗', accent: 'gray-400', description: '' };

  const handleSave = async () => {
    if (!apiKey.trim() && !provider.has_api_key) {
      setSaveResult({ success: false, message: 'Please enter an API key before saving.', latency_ms: 0 });
      return;
    }
    setSaving(true);
    setSaveResult(null);
    try {
      const res = await fetch('/api/v1/models/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: provider.provider,
          model_name: modelName.trim(),
          api_key: apiKey.trim() || undefined,
          base_url: baseUrl.trim() || undefined,
        }),
      });
      const data: TestResult = await res.json();
      setSaveResult(data);
      setApiKey('');
      if (data.success) {
        try {
          await fetch('/api/v1/models/assign-global', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider: provider.provider, model_name: modelName.trim() }),
          });
          window.dispatchEvent(new Event('model-selection-changed'));
        } catch {}
      }
      onSaved();
    } catch (err: any) {
      setSaveResult({ success: false, message: err.message, latency_ms: 0 });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const body: Record<string, string> = { provider: provider.provider, model_name: modelName.trim() };
      if (apiKey.trim()) body.api_key = apiKey.trim();
      if (baseUrl.trim()) body.base_url = baseUrl.trim();
      const res = await fetch('/api/v1/models/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data: TestResult = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setTestResult({ success: false, message: err.message, latency_ms: 0 });
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Remove ${provider.name} configuration? Any agent using it will revert to Ollama.`)) return;
    setDeleting(true);
    try {
      await fetch(`/api/v1/models/config/${provider.provider}`, { method: 'DELETE' });
      window.dispatchEvent(new Event('model-selection-changed'));
      onSaved();
    } catch (err: any) {
      console.error('Delete failed:', err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="glass-panel rounded-2xl overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full p-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-xl">
            {meta.icon}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-offWhite text-sm">{provider.name}</h3>
              {provider.has_api_key && (
                <span className="flex items-center gap-1 text-xs text-emerald-400 font-mono">
                  <Key className="w-3 h-3" />
                  {provider.masked_api_key}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400">{meta.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge active={provider.is_active} label={provider.has_api_key ? 'CONFIGURED' : 'NOT SET'} />
          {expanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
        </div>
      </button>

      {/* Expandable Config Body */}
      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-charcoal">
          <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Model Name - Free text input */}
            <div>
              <label className="block text-xs font-mono text-gray-400 mb-1">
                Model Name <span className="text-gray-500 font-sans">(type any exact model name)</span>
              </label>
              <input
                type="text"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder={provider.provider === 'groq' ? 'e.g. llama-3.3-70b-versatile' : 'e.g. gpt-4o-mini'}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-offWhite font-mono focus:outline-none focus:border-cyan-400/80 transition-colors shadow-inner"
              />

              {/* Suggestions */}
              {provider.available_models && provider.available_models.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[10px] font-mono text-gray-400 mr-1">Suggestions:</span>
                  {provider.available_models.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setModelName(m)}
                      className={`text-[11px] font-mono px-2.5 py-0.5 rounded-lg border transition-all cursor-pointer ${
                        modelName === m
                          ? 'bg-cyan-950/70 border-cyan-400 text-cyan-300 font-bold shadow-[0_0_10px_rgba(69,217,245,0.2)]'
                          : 'bg-white/5 border-white/10 text-gray-300 hover:border-white/20 hover:text-white'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* API Key */}
            <div>
              <label className="block text-xs font-mono text-gray-400 mb-1">
                API Key
                {provider.has_api_key && (
                  <span className="ml-2 text-emerald-400 font-sans">● Encrypted ({provider.masked_api_key})</span>
                )}
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={provider.has_api_key ? 'Enter new key to replace…' : 'Paste your API key…'}
                autoComplete="new-password"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-offWhite font-mono focus:outline-none focus:border-cyan-400/80 transition-colors shadow-inner"
              />
            </div>

            {/* Base URL (for openai_compatible or custom) */}
            {provider.provider === 'openai_compatible' && (
              <div className="md:col-span-2">
                <label className="block text-xs font-mono text-gray-400 mb-1">Base URL</label>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="http://localhost:8080/v1"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-offWhite font-mono focus:outline-none focus:border-cyan-400/80 transition-colors shadow-inner"
                />
              </div>
            )}
          </div>

          {/* Results */}
          <TestResultBanner result={saveResult} loading={saving} />
          <TestResultBanner result={testResult} loading={testing} />

          {/* Actions */}
          <div className="flex items-center justify-between pt-1">
            {provider.has_api_key && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-red-400 hover:bg-red-950/40 border border-red-800/30 text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {deleting ? 'Removing…' : 'Remove Config'}
              </button>
            )}

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={handleTest}
                disabled={testing || saving || (!apiKey.trim() && !provider.has_api_key)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-200 text-xs font-medium border border-white/10 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5" />
                Test Connection
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !modelName.trim()}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-white text-black font-semibold text-xs hover:bg-cyan-100 transition-all shadow-[0_0_15px_rgba(255,255,255,0.3)] disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Saving…' : 'Save Config'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Agent Assignment Table ────────────────────────────────────────────────────

interface AgentAssignmentTableProps {
  assignments: AgentAssignment[];
  providers: ProviderDetail[];
  onAssigned: () => void;
}

const AGENT_ICONS: Record<string, string> = {
  researcher: '🔍',
  analyst: '📊',
  alternative: '💡',
  critic: '🎯',
  specialist: '⚙️',
};

const AgentAssignmentTable: React.FC<AgentAssignmentTableProps> = ({ assignments, providers, onAssigned }) => {
  const [saving, setSaving] = useState<string | null>(null);
  const [globalProvider, setGlobalProvider] = useState('ollama');
  const [globalModel, setGlobalModel] = useState('llama3.2:1b');
  const [globalSaving, setGlobalSaving] = useState(false);

  const activeProviders = providers.filter((p) => p.is_active || p.type === 'local' || p.has_api_key);

  const handleAssignAgent = async (agentId: string, provider: string, modelName: string) => {
    setSaving(agentId);
    try {
      await fetch('/api/v1/models/assign-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: agentId, provider, model_name: modelName }),
      });
      onAssigned();
    } catch (err) {
      console.error('Assign agent failed:', err);
    } finally {
      setSaving(null);
    }
  };

  const handleGlobalAssign = async () => {
    setGlobalSaving(true);
    try {
      await fetch('/api/v1/models/assign-global', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: globalProvider, model_name: globalModel.trim() }),
      });
      onAssigned();
    } catch (err) {
      console.error('Global assign failed:', err);
    } finally {
      setGlobalSaving(false);
    }
  };

  return (
    <div className="glass-panel p-5 rounded-2xl space-y-4">
      <div className="flex items-center gap-3 pb-3 border-b border-charcoal">
        <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
          <Users className="w-4.5 h-4.5 text-purple-400" />
        </div>
        <div>
          <h3 className="font-semibold text-offWhite text-sm">Agent Model Assignments</h3>
          <p className="text-xs text-gray-400">Configure which provider and model each agent uses.</p>
        </div>
      </div>

      {/* Per-Agent Rows */}
      <div className="space-y-2">
        {assignments.map((a) => {
          return (
            <div key={a.agent_id} className="flex items-center gap-3 bg-obsidian/40 rounded-xl px-4 py-3 border border-charcoal/40">
              <span className="text-lg">{AGENT_ICONS[a.agent_id] ?? '🤖'}</span>
              <div className="w-28">
                <p className="text-xs font-semibold text-offWhite">{a.agent_name}</p>
                <p className="text-xs text-gray-500 font-mono">{a.agent_id}</p>
              </div>

              {/* Provider Select */}
              <select
                value={a.provider}
                onChange={(e) => {
                  const p = providers.find((x) => x.provider === e.target.value);
                  handleAssignAgent(a.agent_id, e.target.value, p?.model_name || a.model_name);
                }}
                className="w-40 bg-black/50 border border-white/10 text-xs text-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-cyan-400"
              >
                {activeProviders.map((p) => (
                  <option key={p.provider} value={p.provider}>{p.name}</option>
                ))}
              </select>

              {/* Editable Model Name */}
              <input
                type="text"
                defaultValue={a.model_name}
                onBlur={(e) => {
                  if (e.target.value.trim() && e.target.value.trim() !== a.model_name) {
                    handleAssignAgent(a.agent_id, a.provider, e.target.value.trim());
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                placeholder="exact model name"
                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-offWhite font-mono focus:outline-none focus:border-cyan-400 shadow-inner"
              />

              {saving === a.agent_id && (
                <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* Global Assign Override */}
      <div className="pt-3 border-t border-white/10">
        <p className="text-xs font-mono text-gray-400 mb-2">Global Override — assign same provider and model to all 5 agents</p>
        <div className="flex items-center gap-3">
          <select
            value={globalProvider}
            onChange={(e) => {
              setGlobalProvider(e.target.value);
              const p = providers.find((x) => x.provider === e.target.value);
              if (p?.model_name) setGlobalModel(p.model_name);
            }}
            className="w-44 bg-black/50 border border-white/10 text-xs text-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-cyan-400"
          >
            {activeProviders.map((p) => (
              <option key={p.provider} value={p.provider}>{p.name}</option>
            ))}
          </select>
          <input
            type="text"
            value={globalModel}
            onChange={(e) => setGlobalModel(e.target.value)}
            placeholder="model name"
            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-offWhite font-mono focus:outline-none focus:border-cyan-400 shadow-inner"
          />
          <button
            onClick={handleGlobalAssign}
            disabled={globalSaving || !globalModel.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600/25 hover:bg-purple-600/35 text-purple-300 text-xs font-medium border border-purple-500/30 transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer"
          >
            <Cpu className="w-3.5 h-3.5" />
            {globalSaving ? 'Assigning…' : 'Assign All 5 Agents'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ─────────────────────────────────────────────────────────────────

export const ModelsPage: React.FC = () => {
  const [providers, setProviders] = useState<ProviderDetail[]>([]);
  const [assignments, setAssignments] = useState<AgentAssignment[]>([]);
  const [privacyMode, setPrivacyMode] = useState<'local_only' | 'hybrid'>('local_only');
  const [loading, setLoading] = useState(true);
  const [togglingPrivacy, setTogglingPrivacy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPrivacy = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/privacy/settings');
      if (res.ok) {
        const d = await res.json();
        if (d.privacy_mode) setPrivacyMode(d.privacy_mode);
      }
    } catch {}
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pRes, aRes] = await Promise.all([
        fetch('/api/v1/models/providers'),
        fetch('/api/v1/models/assignments'),
      ]);
      if (!pRes.ok) throw new Error(`Provider fetch failed: ${pRes.status}`);
      if (!aRes.ok) throw new Error(`Assignment fetch failed: ${aRes.status}`);
      setProviders(await pRes.json());
      setAssignments(await aRes.json());
      await fetchPrivacy();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchPrivacy]);

  useEffect(() => {
    fetchAll();
    const handlePrivacyEvent = () => fetchPrivacy();
    window.addEventListener('privacy-mode-changed', handlePrivacyEvent);
    return () => window.removeEventListener('privacy-mode-changed', handlePrivacyEvent);
  }, [fetchAll, fetchPrivacy]);

  const togglePrivacyMode = async () => {
    const nextMode = privacyMode === 'local_only' ? 'hybrid' : 'local_only';
    setTogglingPrivacy(true);
    try {
      const res = await fetch('/api/v1/privacy/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ privacy_mode: nextMode }),
      });
      if (res.ok) {
        setPrivacyMode(nextMode);
        window.dispatchEvent(new Event('privacy-mode-changed'));
      }
    } catch (err) {
      console.error('Failed to toggle privacy:', err);
    } finally {
      setTogglingPrivacy(false);
    }
  };

  const { activeModel } = useActiveModel();
  const ollamaProvider = providers.find((p) => p.provider === 'ollama');
  const onlineProviders = providers.filter((p) => p.type === 'online');
  const isLocalOnly = privacyMode === 'local_only';

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-charcoal">
        <div>
          <h1 className="text-2xl font-bold text-offWhite font-sans">Model Configuration Centre</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Configure local Ollama and online providers. Assign exact model names per agent.
          </p>
        </div>
        <button
          onClick={fetchAll}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-charcoal hover:bg-gray-800 text-gray-300 text-xs border border-gray-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ─── LIVE PRIVACY PROTOCOL BANNER ─── */}
      <div
        className={`p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
          isLocalOnly
            ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
            : 'bg-purple-950/40 border-purple-500/30 text-purple-300'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isLocalOnly ? 'bg-emerald-500/20 text-emerald-400' : 'bg-purple-500/20 text-purple-400'}`}>
            {isLocalOnly ? <Lock className="w-5 h-5" /> : <Globe className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold tracking-wider uppercase">
                {isLocalOnly ? 'Strict Local-Only Mode Active' : 'Hybrid Mode Active'}
              </span>
            </div>
            <p className="text-xs opacity-80 mt-0.5">
              {isLocalOnly
                ? 'Outbound calls to cloud models (Groq/OpenAI) are blocked. Only local models are permitted.'
                : 'Cloud models (Groq/OpenAI) are permitted for assigned agents.'}
            </p>
          </div>
        </div>

        <button
          onClick={togglePrivacyMode}
          disabled={togglingPrivacy}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-semibold border transition-all cursor-pointer ${
            isLocalOnly
              ? 'bg-purple-600/25 hover:bg-purple-600/35 border-purple-500/40 text-purple-300'
              : 'bg-emerald-600/25 hover:bg-emerald-600/35 border-emerald-500/40 text-emerald-300'
          }`}
        >
          <ArrowRightLeft className="w-3.5 h-3.5" />
          {togglingPrivacy ? 'Switching…' : isLocalOnly ? 'Switch to Hybrid Mode' : 'Switch to Local-Only'}
        </button>
      </div>

      {/* Active System Engine Summary */}
      <div className="liquid-glass-secondary p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center">
            <Cpu className={`w-5 h-5 ${activeModel.is_online ? 'text-purple-400' : 'text-cyan-400'}`} />
          </div>
          <div>
            <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider font-semibold">Active System Engine (Real-Time)</span>
            <p className="text-xs font-semibold text-offWhite font-mono">{activeModel.display_text}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:text-right">
          <span className="text-[10px] font-mono text-gray-400 uppercase">Local Models Online:</span>
          <span className="text-xs font-mono text-cyan-400 font-semibold">{activeModel.available_local_models.length} Discovered</span>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-3 bg-red-950/40 border border-red-800/40 text-red-300 rounded-2xl px-4 py-3 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <div>
            <p className="font-semibold">Backend Unreachable</p>
            <p className="text-xs text-red-400 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !error && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="liquid-glass-primary p-5 rounded-2xl animate-pulse h-28 bg-white/[0.03]" />
          ))}
        </div>
      )}

      {/* Local Provider: Ollama */}
      {!loading && ollamaProvider && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Server className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-gray-300 font-mono uppercase tracking-widest">Local Provider</h2>
          </div>
          <OllamaPanel provider={ollamaProvider} onRefresh={fetchAll} />
        </div>
      )}

      {/* Online Providers */}
      {!loading && onlineProviders.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-400" />
              <h2 className="text-sm font-semibold text-gray-300 font-mono uppercase tracking-widest">Online Providers</h2>
              <span className="text-xs text-gray-500 font-mono ml-1">— API keys encrypted at rest</span>
            </div>
            {isLocalOnly && (
              <span className="text-[11px] font-mono text-amber-400 bg-amber-950/40 border border-amber-800/40 px-2.5 py-0.5 rounded-full">
                ⚠️ Enable Hybrid Mode above to query online providers
              </span>
            )}
          </div>
          <div className="space-y-3">
            {onlineProviders.map((p) => (
              <OnlineProviderPanel key={p.provider} provider={p} onSaved={fetchAll} />
            ))}
          </div>
        </div>
      )}

      {/* Agent Assignments */}
      {!loading && assignments.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-semibold text-gray-300 font-mono uppercase tracking-widest">Agent Assignments</h2>
          </div>
          <AgentAssignmentTable assignments={assignments} providers={providers} onAssigned={fetchAll} />
        </div>
      )}
    </div>
  );
};
