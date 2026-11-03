import React, { useState, useEffect } from 'react';
import { GlassPanel } from '../common/glass/GlassPanel';
import { GlassCard } from '../common/glass/GlassCard';
import { GlassButton } from '../common/glass/GlassButton';
import { GlassModal } from '../common/glass/GlassModal';
import { 
  Database, 
  Trash2, 
  AlertTriangle, 
  HardDrive, 
  MessageSquare, 
  History, 
  FileText, 
  Cpu, 
  RefreshCw, 
  CheckCircle2, 
  ShieldCheck, 
  Sparkles,
  Layers,
  Lock
} from 'lucide-react';

interface StorageCategory {
  category_id: string;
  name: string;
  description: string;
  size_bytes: number;
  size_formatted: string;
  item_count: number;
  item_label: string;
  is_removable: boolean;
}

interface StorageMetrics {
  total_managed_bytes: number;
  total_managed_formatted: string;
  db_file_size_bytes: number;
  db_file_size_formatted: string;
  categories: StorageCategory[];
  cleanup_opportunities: string[];
  preserved_summary: string[];
}

interface CleanupReport {
  success: boolean;
  target: string;
  reclaimed_bytes: number;
  reclaimed_formatted: string;
  details: Record<string, any>;
  preserved_items: string[];
  message: string;
}

export const DataManagementSection: React.FC = () => {
  const [metrics, setMetrics] = useState<StorageMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  // Modal states
  const [activeModalTarget, setActiveModalTarget] = useState<string | null>(null);
  const [confirmationInput, setConfirmationInput] = useState('');
  const [completionReport, setCompletionReport] = useState<CleanupReport | null>(null);
  const [cleanupError, setCleanupError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/data-management/storage');
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      }
    } catch (err) {
      console.error('Failed to load storage metrics', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const openConfirmation = (target: string) => {
    setActiveModalTarget(target);
    setConfirmationInput('');
    setCompletionReport(null);
    setCleanupError(null);
  };

  const closeModal = () => {
    setActiveModalTarget(null);
    setConfirmationInput('');
    setCompletionReport(null);
    setCleanupError(null);
  };

  const handleExecuteCleanup = async (target: string) => {
    setCleaning(true);
    setCleanupError(null);
    try {
      const res = await fetch('/api/v1/data-management/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target,
          confirmation_text: target === 'all' ? confirmationInput.trim() : undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Cleanup request failed.');
      }

      const report: CleanupReport = await res.json();
      setCompletionReport(report);
      await fetchMetrics();
    } catch (err: any) {
      setCleanupError(err.message || 'An error occurred during cleanup.');
    } finally {
      setCleaning(false);
    }
  };

  const getTargetTitle = (target: string) => {
    switch (target) {
      case 'chats': return 'Clear All Chat History';
      case 'history': return 'Clear Council Execution History & Logs';
      case 'documents': return 'Clear Uploaded Documents & Knowledge Vault';
      case 'cache': return 'Clear Cache & Temporary Files';
      case 'all': return 'Clear All Application Data (Master Action)';
      default: return 'Confirm Data Deletion';
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── Storage Telemetry Overview ─── */}
      <GlassPanel variant="primary" className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-charcoal">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-neonGreen/10 border border-neonGreen/30 flex items-center justify-center text-neonGreen">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-offWhite font-sans">
                Storage &amp; Data Management
              </h3>
              <p className="text-xs text-gray-400">
                Inspect local disk utilization, purge conversation artifacts, and reclaim storage space safely.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={fetchMetrics}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-charcoal bg-charcoal/50 text-gray-300 hover:text-white text-xs font-mono transition-colors"
              title="Refresh Storage Metrics"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-neonGreen' : ''}`} />
              <span>Refresh Metrics</span>
            </button>

            <span className="text-xs font-mono text-neonGreen px-3 py-1.5 rounded-xl bg-neonGreen/10 border border-neonGreen/30 font-semibold">
              Total: {metrics?.total_managed_formatted || '0 B'}
            </span>
          </div>
        </div>

        {/* Category Storage Breakdown Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {metrics?.categories.map((cat) => {
            const icons: Record<string, any> = {
              chats: MessageSquare,
              history: History,
              documents: FileText,
              embeddings: Cpu,
              cache: Layers,
            };
            const Icon = icons[cat.category_id] || Database;

            return (
              <GlassCard key={cat.category_id} className="space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-offWhite font-sans">
                    <Icon className="w-4 h-4 text-neonGreen" />
                    <span>{cat.name}</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-neonGreen bg-charcoal/60 px-2.5 py-0.5 rounded-full border border-charcoalElevated">
                    {cat.size_formatted}
                  </span>
                </div>

                <p className="text-[11px] text-gray-400 leading-normal">
                  {cat.description}
                </p>

                <div className="pt-2 border-t border-charcoal/60 flex items-center justify-between text-[11px] font-mono text-gray-400">
                  <span>{cat.item_label}</span>
                  {cat.category_id !== 'embeddings' && (
                    <button
                      onClick={() => openConfirmation(cat.category_id)}
                      className="text-xs text-rose-400 hover:text-rose-300 underline font-sans cursor-pointer"
                    >
                      Purge
                    </button>
                  )}
                </div>
              </GlassCard>
            );
          })}
        </div>

        {/* Preserved Data Safety Guarantee Banner */}
        <div className="bg-charcoal/30 border border-charcoalElevated rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-emerald-300">
            <ShieldCheck className="w-5 h-5 text-neonGreen shrink-0" />
            <div>
              <span className="font-semibold text-offWhite">Safe Cleanup Guarantee:</span>
              <p className="text-gray-400 text-[11px] mt-0.5">
                Cleanup operations will NEVER delete user accounts, encrypted API keys, provider configurations, agent system prompts, privacy modes, or local Ollama models.
              </p>
            </div>
          </div>
        </div>
      </GlassPanel>

      {/* ─── Individual & Master Cleanup Actions ─── */}
      <GlassPanel variant="primary" className="p-6 space-y-6">
        <div className="pb-3 border-b border-charcoal">
          <h4 className="text-sm font-bold text-offWhite font-sans uppercase tracking-wider">
            Selective Cleanup Controls
          </h4>
          <p className="text-xs text-gray-400 mt-0.5">
            Execute targeted deletion on specific storage domains without affecting other data.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Action 1: Chats */}
          <div className="glass-panel p-4 rounded-xl border border-charcoal flex items-center justify-between gap-3">
            <div>
              <h5 className="text-xs font-semibold text-offWhite">Clear Chat History</h5>
              <p className="text-[11px] text-gray-400">Removes 1-on-1 agent conversation threads &amp; message records.</p>
            </div>
            <GlassButton
              variant="secondary"
              size="sm"
              onClick={() => openConfirmation('chats')}
              className="text-rose-400 hover:text-rose-300 border-rose-900/40"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </GlassButton>
          </div>

          {/* Action 2: History & Logs */}
          <div className="glass-panel p-4 rounded-xl border border-charcoal flex items-center justify-between gap-3">
            <div>
              <h5 className="text-xs font-semibold text-offWhite">Clear Council History &amp; Logs</h5>
              <p className="text-[11px] text-gray-400">Purges past multi-agent debate sessions &amp; telemetry logs.</p>
            </div>
            <GlassButton
              variant="secondary"
              size="sm"
              onClick={() => openConfirmation('history')}
              className="text-rose-400 hover:text-rose-300 border-rose-900/40"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </GlassButton>
          </div>

          {/* Action 3: Documents */}
          <div className="glass-panel p-4 rounded-xl border border-charcoal flex items-center justify-between gap-3">
            <div>
              <h5 className="text-xs font-semibold text-offWhite">Clear Knowledge Vault</h5>
              <p className="text-[11px] text-gray-400">Deletes uploaded PDFs, text files, and in-memory vector index.</p>
            </div>
            <GlassButton
              variant="secondary"
              size="sm"
              onClick={() => openConfirmation('documents')}
              className="text-rose-400 hover:text-rose-300 border-rose-900/40"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </GlassButton>
          </div>

          {/* Action 4: Cache */}
          <div className="glass-panel p-4 rounded-xl border border-charcoal flex items-center justify-between gap-3">
            <div>
              <h5 className="text-xs font-semibold text-offWhite">Clear Cache &amp; Temp Buffers</h5>
              <p className="text-[11px] text-gray-400">Empties temporary execution artifacts &amp; session buffers.</p>
            </div>
            <GlassButton
              variant="secondary"
              size="sm"
              onClick={() => openConfirmation('cache')}
              className="text-rose-400 hover:text-rose-300 border-rose-900/40"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </GlassButton>
          </div>
        </div>

        {/* ─── Master Action: Clear All Application Data ─── */}
        <div className="pt-4 border-t border-charcoal">
          <div className="glass-panel-glow p-5 rounded-2xl border-2 border-rose-600/40 bg-rose-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <h4 className="text-sm font-bold text-rose-200 uppercase tracking-wide">
                  Master Reset: Clear All Application Data
                </h4>
              </div>
              <p className="text-xs text-gray-300 leading-normal max-w-2xl">
                Permanently purges all conversations, deliberation transcripts, agent execution logs, and uploaded Knowledge Vault documents. Resets local storage while securely preserving all model keys, accounts, and application settings.
              </p>
            </div>

            <GlassButton
              variant="danger"
              size="md"
              onClick={() => openConfirmation('all')}
              className="shrink-0"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear All Data</span>
            </GlassButton>
          </div>
        </div>
      </GlassPanel>

      {/* ─── Confirmation & Progress Glass Modal ─── */}
      <GlassModal
        isOpen={activeModalTarget !== null}
        onClose={closeModal}
        title={activeModalTarget ? getTargetTitle(activeModalTarget) : ''}
        maxWidth="max-w-lg"
      >
        {completionReport ? (
          // Completion Report View
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <CheckCircle2 className="w-5 h-5 text-neonGreen shrink-0" />
                <span>Cleanup Completed Successfully</span>
              </div>
              <p className="text-xs text-gray-300">{completionReport.message}</p>
              <div className="text-xs font-mono text-neonGreen pt-1">
                Reclaimed Local Storage: <span className="font-bold">{completionReport.reclaimed_formatted}</span>
              </div>
            </div>

            <div className="space-y-1.5 text-xs text-gray-300 bg-charcoal/40 p-3.5 rounded-xl border border-charcoal">
              <span className="font-semibold text-offWhite uppercase font-mono text-[10px]">Preserved Configurations:</span>
              <ul className="list-disc pl-4 space-y-0.5 text-gray-400 text-[11px]">
                {completionReport.preserved_items.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>

            <GlassButton variant="primary" size="md" onClick={closeModal} className="w-full">
              Done
            </GlassButton>
          </div>
        ) : (
          // Warning & Confirmation View
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-600/40 text-rose-300 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-rose-200">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Destructive Operation Warning</span>
              </div>
              <p className="text-gray-300 leading-normal">
                {activeModalTarget === 'all'
                  ? 'This action will permanently delete all conversations, agent message logs, council deliberations, uploaded documents, and vector search embeddings.'
                  : `This action will permanently delete all data in the '${activeModalTarget}' domain.`}
              </p>
              <div className="text-[11px] text-gray-400 pt-1 font-mono">
                Estimated reclaimable space: <span className="text-neonGreen font-semibold">{metrics?.total_managed_formatted || '0 B'}</span>
              </div>
            </div>

            {/* Preserved items reassurance */}
            <div className="p-3.5 rounded-xl bg-charcoal/40 border border-charcoal text-xs space-y-1">
              <span className="font-semibold text-offWhite flex items-center gap-1.5 text-[11px]">
                <ShieldCheck className="w-3.5 h-3.5 text-neonGreen" /> Preserved Intact:
              </span>
              <p className="text-gray-400 text-[11px]">
                User accounts, API keys, provider configurations, agent prompts, and themes will NOT be affected.
              </p>
            </div>

            {/* Strict Confirmation Typing for Master Reset */}
            {activeModalTarget === 'all' && (
              <div className="space-y-2 pt-2 border-t border-charcoal">
                <label className="text-xs font-mono text-gray-300 block">
                  To confirm, type <span className="text-rose-400 font-bold">DELETE ALL DATA</span> below:
                </label>
                <input
                  type="text"
                  value={confirmationInput}
                  onChange={(e) => setConfirmationInput(e.target.value)}
                  placeholder="DELETE ALL DATA"
                  disabled={cleaning}
                  className="w-full bg-obsidian border border-charcoal focus:border-rose-500 rounded-xl px-4 py-2.5 text-sm text-offWhite font-mono focus:outline-none transition-colors"
                />
              </div>
            )}

            {cleanupError && (
              <div className="text-xs text-rose-400 bg-rose-950/50 p-3 rounded-lg border border-rose-800">
                {cleanupError}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-charcoal">
              <GlassButton variant="ghost" size="md" onClick={closeModal} disabled={cleaning}>
                Cancel
              </GlassButton>
              <GlassButton
                variant="danger"
                size="md"
                disabled={
                  cleaning ||
                  (activeModalTarget === 'all' && confirmationInput.trim() !== 'DELETE ALL DATA')
                }
                onClick={() => activeModalTarget && handleExecuteCleanup(activeModalTarget)}
              >
                {cleaning ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Cleaning...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Permanently Delete</span>
                  </>
                )}
              </GlassButton>
            </div>
          </div>
        )}
      </GlassModal>
    </div>
  );
};

