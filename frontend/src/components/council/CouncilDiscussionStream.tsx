import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CouncilTurn } from '../../hooks/useCouncil';
import { MarkdownRenderer } from '../common/MarkdownRenderer';
import { AgentId } from '../../types/agent';
import { 
  Bot, 
  Sparkles, 
  Copy, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Volume2, 
  ArrowRightLeft, 
  AlertTriangle, 
  ShieldCheck, 
  Cpu, 
  Layers, 
  Zap, 
  RotateCcw,
  Radio,
  ArrowDown,
  BookOpen
} from 'lucide-react';

interface CouncilDiscussionStreamProps {
  turns: CouncilTurn[];
  activeAgent: AgentId | 'orchestrator' | null;
  actionDescription: string;
  isDeliberating: boolean;
  finalSynthesis?: string | null;
  qualityAssessment?: any;
  taskPrompt?: string;
}

interface TurnCardProps {
  turn: CouncilTurn;
  index: number;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  isCopied: boolean;
  onCopy: (text: string, id: string) => void;
}

// Memoized Turn Card to avoid costly re-renders when streaming new turns
const TurnCard: React.FC<TurnCardProps> = React.memo(({
  turn,
  index,
  isExpanded,
  onToggleExpand,
  isCopied,
  onCopy,
}) => {
  return (
    <article 
      className={`liquid-glass-primary rounded-2xl p-5 md:p-6 transition-all duration-300 space-y-4 border ${
        turn.isFailure 
          ? 'border-rose-600/40 bg-rose-950/25 shadow-[0_10px_30px_rgba(225,29,72,0.15)]' 
          : 'border-white/10 hover:border-cyan-400/35 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.8),0_0_25px_rgba(69,217,245,0.08)]'
      }`}
    >
      {/* Turn Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div className="flex items-center gap-3.5">
          {/* Avatar Icon */}
          <div className={`w-11 h-11 rounded-2xl bg-gradient-to-tr ${turn.color} flex items-center justify-center text-white font-bold text-base shadow-sm shrink-0 border border-white/20`}>
            {turn.agentName.charAt(0)}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-offWhite font-sans tracking-tight">
                {turn.agentName}
              </h3>
              <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-black/50 text-gray-300 border border-white/10">
                {turn.badge}
              </span>
              <span className="text-[10px] font-mono text-cyan-400 uppercase font-bold tracking-wider">
                Turn {index + 1}
              </span>
            </div>
            <p className="text-xs text-mutedSilver mt-0.5">{turn.role}</p>
          </div>
        </div>

        {/* Right Meta & Actions */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <span className="text-[11px] font-mono text-gray-400">{turn.timestamp}</span>
          <button
            onClick={() => onCopy(turn.content, turn.id)}
            className="p-1.5 rounded-xl border border-white/10 bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Copy contribution"
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-cyan-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => onToggleExpand(turn.id)}
            className="p-1.5 rounded-xl border border-white/10 bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Collaborative Contextual Relationship Banner */}
      <div className="flex items-center gap-2 text-xs font-mono text-cyan-300 bg-cyan-950/40 border border-cyan-500/30 px-3.5 py-1.5 rounded-xl shadow-xs">
        <ArrowRightLeft className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
        <span className="truncate">{turn.relationPill}</span>
      </div>

      {/* Message Body */}
      {isExpanded && (
        <div className="text-sm font-sans text-gray-200 leading-relaxed pt-1">
          {turn.isFailure ? (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-950/40 border border-rose-600/40 text-rose-300 text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-rose-200">Circuit Breaker Isolated Agent</p>
                <p className="mt-1 text-gray-300">{turn.errorMessage || turn.content}</p>
              </div>
            </div>
          ) : (
            <div className="bg-black/50 border border-white/5 rounded-2xl p-5 md:p-6 shadow-inner text-sm leading-relaxed">
              <MarkdownRenderer content={turn.content} />
            </div>
          )}
        </div>
      )}
    </article>
  );
});

export const CouncilDiscussionStream: React.FC<CouncilDiscussionStreamProps> = ({
  turns,
  activeAgent,
  actionDescription,
  isDeliberating,
  finalSynthesis,
  qualityAssessment,
  taskPrompt,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedTurns, setExpandedTurns] = useState<Record<string, boolean>>({});
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const bottomAnchorRef = useRef<HTMLDivElement | null>(null);

  // Locate the outer scrolling container (<main> in MainLayout)
  const getScrollContainer = useCallback((): HTMLElement | null => {
    return document.querySelector('main');
  }, []);

  // Monitor scroll position to display Jump to Latest button without forced scrolling
  useEffect(() => {
    const mainEl = getScrollContainer();
    if (!mainEl) return;

    const handleScroll = () => {
      const scrollBottom = mainEl.scrollHeight - mainEl.scrollTop - mainEl.clientHeight;
      // Show jump pill when user is scrolled up > 350px
      setShowJumpToBottom(scrollBottom > 350);
    };

    mainEl.addEventListener('scroll', handleScroll, { passive: true });
    return () => mainEl.removeEventListener('scroll', handleScroll);
  }, [getScrollContainer]);

  // Gentle auto-scroll to bottom ONLY if user is already near the bottom
  useEffect(() => {
    const mainEl = getScrollContainer();
    if (!mainEl) return;

    const distanceFromBottom = mainEl.scrollHeight - mainEl.scrollTop - mainEl.clientHeight;
    // Only auto-scroll if user is following along within 180px of bottom
    if (distanceFromBottom < 180) {
      mainEl.scrollTo({
        top: mainEl.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [turns.length, activeAgent, finalSynthesis, getScrollContainer]);

  const scrollToBottom = () => {
    const mainEl = getScrollContainer();
    if (mainEl) {
      mainEl.scrollTo({
        top: mainEl.scrollHeight,
        behavior: 'smooth',
      });
      setShowJumpToBottom(false);
    }
  };

  const toggleExpand = useCallback((turnId: string) => {
    setExpandedTurns((prev) => ({ ...prev, [turnId]: !prev[turnId] }));
  }, []);

  const copyContent = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const isDegraded = qualityAssessment?.is_degraded ?? false;

  return (
    <div className="w-full space-y-6 relative pb-10">
      {/* User Directive Prompt Card */}
      {taskPrompt && (
        <div className="liquid-glass-primary rounded-2xl p-5 md:p-6 border-l-4 border-l-cyan-400 space-y-2.5 border border-white/10 shadow-lg">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-cyan-400 uppercase tracking-widest font-semibold flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Convened Council Directive
            </span>
            <span className="text-mutedSilver">Deliberation Scope</span>
          </div>
          <p className="text-sm md:text-base font-sans text-offWhite leading-relaxed whitespace-pre-wrap font-medium">
            {taskPrompt}
          </p>
        </div>
      )}

      {/* Empty State before session starts */}
      {turns.length === 0 && !isDeliberating && (
        <div className="liquid-glass-secondary rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-4 min-h-[380px] border border-white/10">
          <div className="w-16 h-16 rounded-2xl bg-black/50 border border-cyan-400/30 flex items-center justify-center text-cyan-300 shadow-[0_0_30px_rgba(69,217,245,0.25)]">
            <Cpu className="w-8 h-8 animate-pulse text-cyan-400" />
          </div>
          <div className="space-y-2 max-w-lg">
            <h3 className="text-lg font-bold text-offWhite font-sans">Council Chamber Standing By</h3>
            <p className="text-xs text-gray-300 leading-relaxed font-sans">
              Enter your research question or system hypothesis above. The five specialized AI minds will engage in sequential dialectical collaboration, ground findings in uploaded Knowledge Vault documents, and formulate an authoritative unified consensus.
            </p>
          </div>
        </div>
      )}

      {/* Chronological Dialogue Turns (Memoized Cards) */}
      <div className="space-y-6">
        {turns.map((turn, index) => (
          <TurnCard
            key={turn.id}
            turn={turn}
            index={index}
            isExpanded={expandedTurns[turn.id] ?? true}
            onToggleExpand={toggleExpand}
            isCopied={copiedId === turn.id}
            onCopy={copyContent}
          />
        ))}
      </div>

      {/* Live Active Deliberation Status Card (Animated when speaking) */}
      {isDeliberating && activeAgent && activeAgent !== 'orchestrator' && (
        <div className="liquid-glass-elevated rounded-2xl p-5 border border-cyan-400/40 flex items-center justify-between gap-4 animate-pulse shadow-[0_0_25px_rgba(69,217,245,0.15)]">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-cyan-950/70 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shadow-[0_0_15px_rgba(69,217,245,0.3)]">
              <Volume2 className="w-5 h-5 animate-bounce text-cyan-400" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono uppercase text-cyan-400 font-semibold flex items-center gap-1.5">
                  <Radio className="w-3 h-3 text-cyan-400 animate-pulse" />
                  Live Speaking Turn
                </span>
                <span className="text-xs font-semibold text-offWhite font-sans capitalize">
                  {activeAgent}
                </span>
              </div>
              <p className="text-xs text-gray-300 font-mono">
                {actionDescription || 'Synthesizing reasoning trace and responding to peer minds...'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-950/60 border border-cyan-400/40 text-cyan-300 text-xs font-mono shadow-[0_0_12px_rgba(69,217,245,0.2)]">
            <RotateCcw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
            <span>DELIBERATING</span>
          </div>
        </div>
      )}

      {/* Orchestrator Synthesis Active Notice */}
      {isDeliberating && activeAgent === 'orchestrator' && (
        <div className="liquid-glass-elevated rounded-2xl p-5 border border-violet-400/40 flex items-center justify-between gap-4 animate-pulse shadow-[0_0_25px_rgba(168,85,247,0.15)]">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-purple-950/70 border border-purple-400/40 flex items-center justify-center text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.3)]">
              <Zap className="w-5 h-5 animate-spin text-purple-300" />
            </div>
            <div className="space-y-0.5">
              <span className="text-xs font-mono uppercase text-purple-300 font-semibold">
                Orchestrator Consensus Formulation
              </span>
              <p className="text-xs text-gray-300 font-mono">
                Quantum Core is formulating unified consensus from all agent findings...
              </p>
            </div>
          </div>

          <span className="text-xs font-mono text-purple-300 uppercase tracking-widest px-3 py-1.5 rounded-full border border-purple-500/30 bg-purple-950/60 shadow-[0_0_15px_rgba(129,117,255,0.2)]">
            SYNTHESIZING
          </span>
        </div>
      )}

      {/* Final Synthesized Council Consensus Card (Expansive, Full-Width Presentation) */}
      {finalSynthesis && (
        <div className="liquid-glass-elevated rounded-3xl p-6 md:p-8 border-2 border-cyan-400/50 shadow-[0_0_50px_rgba(22,199,194,0.25)] space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-cyan-950/70 border border-cyan-400/50 flex items-center justify-center text-cyan-300 shadow-[0_0_20px_rgba(69,217,245,0.4)]">
                <ShieldCheck className="w-7 h-7 text-cyan-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-offWhite font-sans">
                    Quantum Council Consensus
                  </h2>
                  <span className="text-[10px] font-mono px-3 py-0.5 rounded-full bg-cyan-400/25 text-cyan-300 border border-cyan-400/50 font-bold tracking-wider shadow-xs">
                    VERIFIED SYNTHESIS
                  </span>
                </div>
                <p className="text-xs text-mutedSilver">
                  Unified multi-agent consensus synthesized across all specialized perspectives with grounded citations.
                </p>
              </div>
            </div>

            <button
              onClick={() => copyContent(finalSynthesis, 'final-consensus')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-white/10 bg-white/10 text-gray-200 hover:text-white hover:bg-white/15 transition-all text-xs font-mono cursor-pointer shadow-sm self-start sm:self-auto"
            >
              {copiedId === 'final-consensus' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Consensus</span>
                </>
              )}
            </button>
          </div>

          {/* Markdown Consensus Body */}
          <div className="bg-black/60 border border-white/5 rounded-2xl p-6 md:p-8 shadow-inner text-sm leading-relaxed text-gray-200">
            <MarkdownRenderer content={finalSynthesis} />
          </div>

          {/* Degraded mode transparency alert */}
          {isDegraded && (
            <div className="bg-amber-950/40 border border-amber-600/40 rounded-xl p-4 text-xs text-amber-300 space-y-1">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Fault-Tolerant Degraded Execution Notice</span>
              </div>
              <p className="text-gray-300 text-[11px] leading-relaxed">
                This deliberation operated under resilient task substitution. Completed with {qualityAssessment.healthy_agent_count || 4}/5 minds available.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Fallback indicator if turns completed but synthesis failed to generate */}
      {!isDeliberating && turns.length > 0 && !finalSynthesis && (
        <div className="liquid-glass-elevated rounded-2xl p-6 border border-amber-500/40 bg-amber-950/20 text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-amber-300 font-semibold text-sm">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <span>Final Synthesis Incomplete</span>
          </div>
          <p className="text-xs text-gray-300 max-w-lg mx-auto">
            The council completed their individual perspectives, but the unified consensus formulation did not finalize. You can review the dialogue turns above.
          </p>
        </div>
      )}

      {/* Bottom anchor for scrolling */}
      <div ref={bottomAnchorRef} />

      {/* Floating "Jump to Latest" Pill Button */}
      {showJumpToBottom && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="fixed bottom-8 right-8 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full bg-cyan-500 text-black font-semibold text-xs shadow-[0_0_25px_rgba(69,217,245,0.6)] hover:bg-cyan-400 active:scale-95 transition-all cursor-pointer animate-bounce"
        >
          <ArrowDown className="w-3.5 h-3.5" />
          <span>Jump to Latest</span>
        </button>
      )}
    </div>
  );
};
