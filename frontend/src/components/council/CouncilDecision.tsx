import React from 'react';
import { QualityAssessment } from '../../types/council';
import { MarkdownRenderer } from '../common/MarkdownRenderer';
import { 
  Award, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Copy, 
  Check 
} from 'lucide-react';

interface CouncilDecisionProps {
  decision: string | null;
  quality?: QualityAssessment;
  isDegraded?: boolean;
}

export const CouncilDecision: React.FC<CouncilDecisionProps> = ({
  decision,
  quality,
  isDegraded = false,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!decision) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(decision);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const ratingKey = (quality?.confidence_rating || (isDegraded ? 'DEGRADED' : 'MEDIUM')).toUpperCase();
  const confidenceColors: Record<string, string> = {
    HIGH: 'text-neonGreen border-neonGreen/30 bg-neonGreen/10',
    MEDIUM: 'text-amber-400 border-amber-400/30 bg-amber-400/10',
    LOW: 'text-rose-400 border-rose-400/30 bg-rose-400/10',
    DEGRADED: 'text-purple-400 border-purple-400/30 bg-purple-400/10',
  };
  const activeColor = confidenceColors[ratingKey] || confidenceColors.MEDIUM;

  const resilienceNotes = quality?.resilience_notes || [];
  const missingAspects = quality?.missing_aspects || [];
  const completenessPct = typeof quality?.completeness_score === 'number'
    ? Math.round(quality.completeness_score * 100)
    : 100;

  return (
    <div className="glass-panel-glow rounded-xl p-6 mt-6 relative overflow-hidden">
      {/* Background radial accent */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-neonGreen/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header with Metrics */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-charcoal mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-neonGreen/15 border border-neonGreen/40 flex items-center justify-center text-neonGreen">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-offWhite flex items-center gap-2">
              Council Consensus &amp; Synthesised Decision
            </h3>
            <p className="text-xs text-gray-400">Integrated output of surviving minds &amp; substituted roles</p>
          </div>
        </div>

        {/* Quality Assessment Badges */}
        <div className="flex items-center gap-2.5">
          <div className={`px-2.5 py-1 rounded-full border text-xs font-mono font-semibold flex items-center gap-1.5 ${activeColor}`}>
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{ratingKey} CONFIDENCE</span>
          </div>
          <div className="px-2.5 py-1 rounded-full border border-charcoal bg-charcoal/60 text-xs font-mono text-gray-300">
            {completenessPct}% COMPLETENESS
          </div>
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg border border-charcoal bg-obsidian hover:bg-charcoal text-gray-400 hover:text-white transition-colors"
            title="Copy synthesis"
          >
            {copied ? <Check className="w-4 h-4 text-neonGreen" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Synthesis Text Body */}
      <div className="bg-obsidian/60 p-5 rounded-lg border border-charcoal/80 mb-4">
        <MarkdownRenderer content={decision} />
      </div>

      {/* Resilience & Missing Notes */}
      {(resilienceNotes.length > 0 || missingAspects.length > 0) && (
        <div className="bg-charcoal/40 rounded-lg p-3.5 border border-charcoal text-xs space-y-1.5">
          <div className="flex items-center gap-1.5 font-mono text-gray-400 uppercase tracking-wider text-[11px]">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>Resilience &amp; Audit Disclosures</span>
          </div>
          {resilienceNotes.map((note, idx) => (
            <p key={idx} className="text-gray-300 pl-5 relative before:content-['•'] before:absolute before:left-1 before:text-amber-400">
              {note}
            </p>
          ))}
          {missingAspects.map((miss, idx) => (
            <p key={idx} className="text-rose-300 pl-5 relative before:content-['!'] before:absolute before:left-1 before:text-rose-400 font-semibold">
              Omitted Scope: {miss}
            </p>
          ))}
        </div>
      )}
    </div>
  );
};

