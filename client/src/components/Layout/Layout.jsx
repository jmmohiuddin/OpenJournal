import { useState, useEffect, createContext, useContext } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import ResonanceNotification from '../Connections/ResonanceNotification';
import { useSocket } from '../../hooks/useSocket';

// ── Sidebar context — lets any child open/close the mobile drawer ────────────
export const SidebarContext = createContext({ open: false, setOpen: () => {} });
export const useSidebar = () => useContext(SidebarContext);

export default function Layout() {
  useSocket();

  const [open, setOpen] = useState(false);

  // Close drawer when viewport grows beyond mobile breakpoint
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const handler = (e) => { if (e.matches) setOpen(false); };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <SidebarContext.Provider value={{ open, setOpen }}>
      <div className="flex min-h-screen bg-alice-blue">

        {/* ── Sidebar (desktop: static, tablet/mobile: off-canvas drawer) ── */}
        <Sidebar isOpen={open} onClose={() => setOpen(false)} />

        {/* ── Mobile overlay — closes drawer on backdrop tap ─────────────── */}
        {open && (
          <div
            className="sidebar-overlay lg:hidden"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* ── Main content ────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-auto min-w-0">
          {/* Top bar — visible on mobile/tablet only ─── */}
          <header className="lg:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3 glass-nav border-b border-white/20">
            <button
              onClick={() => setOpen(true)}
              className="touch-target rounded-xl text-gray-700 hover:bg-white/30 transition-colors"
              aria-label="Open menu"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6"  x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            {/* App name — centered */}
            <div className="flex-1 text-center">
              <span className="text-sm font-semibold text-gray-800 font-system tracking-tight">Open Journal</span>
            </div>

            {/* Placeholder for right action (keeps centering) */}
            <div className="w-11" />
          </header>

          {/* Page content with responsive padding */}
          <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
            <Outlet />
          </div>
        </main>

        <ResonanceNotification />
      </div>
    </SidebarContext.Provider>
  );
}
