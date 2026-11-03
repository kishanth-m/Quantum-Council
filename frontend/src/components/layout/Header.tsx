import React, { useState, useEffect, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ShieldCheck, Activity, Globe, Lock, RefreshCw, Cpu, Menu, Users, MessageSquare, Database, LayoutDashboard } from 'lucide-react';
import { useActiveModel } from '../../hooks/useActiveModel';

interface HeaderProps {
  onToggleSidebar?: () => void;
  isSidebarPinned?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleSidebar,
  isSidebarPinned = false,
}) => {
  const [privacyMode, setPrivacyMode] = useState<'local_only' | 'hybrid'>('local_only');
  const [toggling, setToggling] = useState(false);
  const { activeModel } = useActiveModel();
  const location = useLocation();

  const fetchPrivacy = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/privacy/settings');
      if (res.ok) {
        const data = await res.json();
        if (data.privacy_mode) {
          setPrivacyMode(data.privacy_mode);
        }
      }
    } catch {
      // offline / starting up
    }
  }, []);

  useEffect(() => {
    fetchPrivacy();
    const handlePrivacyEvent = () => fetchPrivacy();
    window.addEventListener('privacy-mode-changed', handlePrivacyEvent);
    return () => window.removeEventListener('privacy-mode-changed', handlePrivacyEvent);
  }, [fetchPrivacy]);

  const toggleMode = async () => {
    if (toggling) return;
    const nextMode = privacyMode === 'local_only' ? 'hybrid' : 'local_only';
    setToggling(true);
    try {
      const res = await fetch('/api/v1/privacy/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ privacy_mode: nextMode }),
      });
      if (res.ok) {
        setPrivacyMode(nextMode);
        window.dispatchEvent(new Event('privacy-mode-changed'));
        window.dispatchEvent(new Event('model-selection-changed'));
      }
    } catch (err) {
      console.error('Failed to toggle privacy mode:', err);
    } finally {
      setToggling(false);
    }
  };

  const isLocal = privacyMode === 'local_only';

  const PRIMARY_NAV = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Council Room', path: '/council', icon: Users },
    { name: 'Agent Chat', path: '/chat', icon: MessageSquare },
    { name: 'Knowledge Vault', path: '/vault', icon: Database },
  ];

  return (
    <header className="h-16 border-b border-white/10 liquid-glass-subtle px-4 md:px-6 flex items-center justify-between z-20 sticky top-0 transition-all backdrop-blur-xl">
      {/* Left: Sidebar trigger + Title badge */}
      <div className="flex items-center gap-3">
        {!isSidebarPinned && (
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white transition-all cursor-pointer"
            title="Toggle Navigation Sidebar (Ctrl+B)"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}

        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-xs font-mono font-bold tracking-wider text-offWhite uppercase hidden sm:inline">
            Quantum Council
          </span>
        </div>

        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-[11px] font-mono shadow-[0_0_12px_rgba(16,185,129,0.15)]">
          <Activity className="w-3 h-3 animate-pulse" />
          <span>AUTONOMOUS ACTIVE</span>
        </div>
      </div>

      {/* Center: Reference 1 Style Pill Switcher */}
      <div className="hidden md:flex items-center bg-black/40 p-1 rounded-full border border-white/10 backdrop-blur-md">
        {PRIMARY_NAV.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`px-3.5 py-1.5 rounded-full text-xs transition-all duration-200 flex items-center gap-1.5 font-medium ${
                isActive
                  ? 'bg-white text-black font-semibold shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <item.icon className="w-3.5 h-3.5" />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2.5 md:gap-3">
        {/* Active Model Indicator */}
        <div
          title={`Active Model: ${activeModel.display_text}`}
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-deepMidnight/70 border border-white/10 text-[11px] font-mono text-gray-300 shadow-sm"
        >
          <Cpu className={`w-3.5 h-3.5 ${activeModel.is_online ? 'text-violetAccent' : 'text-cyan-400'}`} />
          <span className="font-medium text-gray-200 max-w-[130px] truncate">{activeModel.display_text}</span>
        </div>

        {/* Interactive Privacy Mode Toggle Badge */}
        <button
          onClick={toggleMode}
          disabled={toggling}
          title={`Click to switch to ${isLocal ? 'Hybrid Mode (Online LLMs)' : 'Strict Local-Only'}`}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono transition-all border cursor-pointer ${
            isLocal
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300 hover:bg-emerald-900/40 shadow-[0_0_12px_rgba(16,185,129,0.12)]'
              : 'bg-purple-950/40 border-purple-500/30 text-purple-300 hover:bg-purple-900/40 shadow-[0_0_12px_rgba(129,117,255,0.15)]'
          }`}
        >
          {toggling ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : isLocal ? (
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Globe className="w-3.5 h-3.5 text-purple-400" />
          )}
          <span className="font-semibold text-[11px] tracking-wide">
            {isLocal ? 'LOCAL ONLY' : 'HYBRID'}
          </span>
        </button>

        {/* User Identity Pill */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-tealAccent/30 via-cyan-400/20 to-violetAccent/40 flex items-center justify-center text-cyan-200 font-semibold text-xs border border-cyan-400/30 shadow-[0_0_10px_rgba(22,199,194,0.2)]">
          QC
        </div>
      </div>
    </header>
  );
};
