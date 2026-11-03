import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  Users, 
  MessageSquare, 
  Bot, 
  Database, 
  Cpu, 
  History, 
  BarChart3, 
  ShieldCheck, 
  Settings,
  Sparkles,
  Pin,
  PinOff,
  ChevronRight,
  Menu,
  X
} from 'lucide-react';
import { useActiveModel } from '../../hooks/useActiveModel';

export const NAV_ITEMS = [
  { name: 'Overview', path: '/', icon: LayoutDashboard },
  { name: 'Council Room', path: '/council', icon: Users, highlight: true },
  { name: 'Agent Chat', path: '/chat', icon: MessageSquare },
  { name: 'Agent Studio', path: '/studio', icon: Bot },
  { name: 'Knowledge Vault', path: '/vault', icon: Database },
  { name: 'Model Centre', path: '/models', icon: Cpu },
  { name: 'History', path: '/history', icon: History },
  { name: 'Analytics', path: '/analytics', icon: BarChart3 },
  { name: 'Privacy Centre', path: '/privacy', icon: ShieldCheck },
  { name: 'Settings', path: '/settings', icon: Settings },
];

export const SIDEBAR_PINNED_KEY = 'qc_sidebar_pinned';

interface SidebarProps {
  isPinned: boolean;
  setIsPinned: (pinned: boolean) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isPinned,
  setIsPinned,
  isOpen,
  setIsOpen,
}) => {
  const { activeModel } = useActiveModel();
  const location = useLocation();
  const leaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Close sidebar on route change if unpinned
  useEffect(() => {
    if (!isPinned) {
      setIsOpen(false);
    }
  }, [location.pathname, isPinned, setIsOpen]);

  // Handle mouse enter trigger / sidebar
  const handleMouseEnter = () => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    setIsOpen(true);
  };

  // Handle mouse leave with 380ms delay to prevent accidental closing
  const handleMouseLeave = () => {
    if (isPinned) return;
    leaveTimerRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 380);
  };

  const togglePin = () => {
    const next = !isPinned;
    setIsPinned(next);
    localStorage.setItem(SIDEBAR_PINNED_KEY, String(next));
    if (next) setIsOpen(true);
  };

  return (
    <>
      {/* ─── Minimal Left Trigger Rail (Visible when unpinned & closed) ─── */}
      {!isPinned && (
        <div
          onMouseEnter={handleMouseEnter}
          className="fixed left-0 top-0 bottom-0 w-3.5 z-40 group cursor-pointer flex items-center justify-center transition-colors"
          title="Hover or press Ctrl+B to open Navigation"
        >
          <div className="w-1.5 h-16 rounded-r-full bg-white/10 group-hover:bg-cyan-400 transition-all group-hover:h-24 shadow-[0_0_12px_rgba(69,217,245,0.4)]" />
        </div>
      )}

      {/* ─── Backdrop Overlay when unpinned & open (Mobile / Tablet) ─── */}
      <AnimatePresence>
        {!isPinned && isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-obsidian/60 backdrop-blur-xs z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* ─── Main Animated Glass Sidebar ─── */}
      <motion.aside
        initial={false}
        animate={{
          x: isPinned || isOpen ? 0 : -264,
          opacity: isPinned || isOpen ? 1 : 0,
        }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`fixed top-0 left-0 bottom-0 w-64 z-50 liquid-glass-primary border-r border-white/10 flex flex-col h-screen select-none shadow-[20px_0_60px_rgba(0,0,0,0.85)] ${
          isPinned ? 'lg:static' : ''
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-tealAccent/30 via-electricCyan/20 to-violetAccent/30 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shadow-[0_0_16px_rgba(22,199,194,0.3)]">
              <Sparkles className="w-5 h-5 text-electricCyan" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-offWhite font-sans tracking-wide">
                QUANTUM COUNCIL
              </h1>
              <p className="text-[10px] font-mono text-cyan-400/90 uppercase tracking-wider font-semibold">
                Five Minds · One Intel
              </p>
            </div>
          </div>

          <button
            onClick={togglePin}
            className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
              isPinned
                ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-300 shadow-[0_0_10px_rgba(69,217,245,0.25)]'
                : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
            }`}
            title={isPinned ? 'Unpin Sidebar (Auto-Hide)' : 'Pin Sidebar Docked'}
          >
            {isPinned ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Navigation Destination Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive: active }) =>
                  `group relative flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 ${
                    active
                      ? 'text-white bg-white/10 border border-white/15 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)] font-semibold'
                      : 'text-gray-300 hover:text-white hover:bg-white/5'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      isActive ? 'text-electricCyan' : 'text-gray-400 group-hover:text-cyan-300'
                    }`}
                  />
                  <span className="font-sans">{item.name}</span>
                </div>

                {item.highlight && (
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-cyan-400/20 text-cyan-300 border border-cyan-400/40 uppercase font-bold tracking-wider">
                    Live
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Active Engine Footer Status Card */}
        <div className="p-4 border-t border-white/10">
          <div className="p-3.5 rounded-2xl liquid-glass-secondary border border-white/10 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-mono text-gray-400">
              <span className="uppercase font-semibold tracking-wider">Active Engine</span>
              <span className={`w-2 h-2 rounded-full ${activeModel.is_online ? 'bg-violetAccent animate-pulse shadow-[0_0_8px_#8175FF]' : 'bg-cyan-400 animate-pulse shadow-[0_0_8px_#45D9F5]'}`} />
            </div>
            <div className="flex items-center gap-2">
              <Cpu className={`w-3.5 h-3.5 ${activeModel.is_online ? 'text-violetAccent' : 'text-cyan-400'} shrink-0`} />
              <span className="text-xs font-mono font-semibold text-offWhite truncate" title={activeModel.model_name}>
                {activeModel.model_name}
              </span>
            </div>
            <p className="text-[10px] text-gray-400 font-mono truncate" title={activeModel.display_text}>
              {activeModel.display_text}
            </p>
          </div>
        </div>
      </motion.aside>
    </>
  );
};
