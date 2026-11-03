import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar, SIDEBAR_PINNED_KEY } from './Sidebar';
import { Header } from './Header';
import { applyTheme, getSavedTheme } from '../../styles/themes';

export const MainLayout: React.FC = () => {
  const [isPinned, setIsPinned] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(SIDEBAR_PINNED_KEY) === 'true';
  });
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    applyTheme(getSavedTheme());
  }, []);

  // Keyboard shortcut listener: Ctrl+B or Cmd+B to toggle sidebar, Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === 'Escape' && !isPinned && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPinned, isOpen]);

  return (
    <div className="relative flex h-screen text-offWhite overflow-hidden bg-transparent">
      <div className="relative z-10 flex h-full w-full overflow-hidden bg-transparent">
        {/* Auto-Hiding / Pinned Glass Sidebar */}
        <Sidebar
          isPinned={isPinned}
          setIsPinned={setIsPinned}
          isOpen={isOpen}
          setIsOpen={setIsOpen}
        />

        {/* Full-Screen Workspace */}
        <div className="flex-1 flex flex-col min-w-0 transition-all duration-300 bg-transparent">
          <Header
            onToggleSidebar={() => setIsOpen((prev) => !prev)}
            isSidebarPinned={isPinned}
          />
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 w-full max-w-full bg-transparent">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};
