import { useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { logout } from '../../store/authSlice';

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar Component
//
// Breakpoint behaviour:
//   Mobile  (<1024px): off-canvas slide-in drawer (controlled by isOpen/onClose)
//   Desktop (≥1024px): static sidebar always visible
// ─────────────────────────────────────────────────────────────────────────────
export default function Sidebar({ isOpen, onClose }) {
  const { user }    = useSelector(state => state.auth);
  const { pending } = useSelector(state => state.connections);
  const dispatch    = useDispatch();
  const navigate    = useNavigate();
  const location    = useLocation();
  const sidebarRef  = useRef(null);

  // Close on route change (mobile)
  useEffect(() => { onClose?.(); }, [location.pathname]);

  // Trap focus inside drawer when open on mobile
  useEffect(() => {
    if (!isOpen) return;
    const el = sidebarRef.current;
    if (!el) return;
    const focusable = el.querySelectorAll('button, a, [tabindex]:not([tabindex="-1"])');
    focusable[0]?.focus();

    const handleKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const navItems = [
    { to: '/',           icon: '📝', label: 'Write',       end: true  },
    { to: '/entries',    icon: '📚', label: 'Entries'               },
    { to: '/connections',icon: '✨', label: 'Connections', badge: pending.length },
    { to: '/circles',    icon: '🔮', label: 'Circles'               },
    { to: '/insights',   icon: '📊', label: 'Insights'               },
    { to: '/settings',   icon: '⚙️', label: 'Settings'               },
  ];

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
    onClose?.();
  };

  return (
    <>
      {/* ── Sidebar panel ─────────────────────────────────────────────────── */}
      <aside
        ref={sidebarRef}
        role="navigation"
        aria-label="Main navigation"
        className={[
          // Layout
          'flex flex-col flex-shrink-0 z-50',
          // Sizing
          'w-72',                        // mobile drawer width
          // Desktop: static, always visible
          'lg:w-64 lg:static lg:translate-x-0 lg:z-auto',
          // Mobile/tablet: fixed off-canvas
          'fixed top-0 bottom-0 left-0',
          // Transition
          'transition-transform duration-300 ease-in-out',
          // Open/closed state on mobile
          isOpen ? 'translate-x-0' : '-translate-x-full',
          // Glass background
          'glass-nav',
        ].join(' ')}
        style={{ minHeight: '100dvh' }}
      >
        {/* ─ Logo ─────────────────────────────────────────────────────────── */}
        <div className="p-5 border-b border-white/20 flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-sm flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#ABC4FF,#D6EADF)', boxShadow: '0 2px 8px rgba(171,196,255,0.4)' }}
          >
            ✦
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-800 font-system leading-tight">Open Journal</h1>
            <p className="text-xs text-gray-500 font-system">Reflect. Connect. Grow.</p>
          </div>

          {/* Close button — mobile only */}
          <button
            onClick={onClose}
            className="lg:hidden ml-auto touch-target rounded-xl text-gray-500 hover:text-gray-800 hover:bg-white/30 transition-colors"
            aria-label="Close menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ─ Navigation ───────────────────────────────────────────────────── */}
        <nav className="flex-1 p-3 overflow-y-auto">
          <ul className="space-y-1">
            {navItems.map(item => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => [
                    'flex items-center gap-3 px-4 rounded-xl font-system transition-all duration-200',
                    'min-h-[48px]',           // Touch-friendly height
                    isActive
                      ? 'bg-blue-eyes text-white font-medium shadow-md'
                      : 'text-gray-700 hover:bg-white/40 hover:text-gray-900',
                  ].join(' ')}
                >
                  <span className="text-xl w-6 text-center flex-shrink-0" aria-hidden="true">{item.icon}</span>
                  <span className="text-sm">{item.label}</span>
                  {item.badge > 0 && (
                    <span className="ml-auto px-2 py-0.5 bg-honeydew text-green-800 text-xs font-semibold rounded-full animate-pulse-soft min-w-[20px] text-center">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* ─ User Profile ─────────────────────────────────────────────────── */}
        <div className="p-3 border-t border-white/20">
          <NavLink
            to="/profile"
            className={({ isActive }) => [
              'flex items-center gap-3 p-3 rounded-xl transition-all duration-200 min-h-[56px]',
              isActive ? 'bg-white/50 shadow-md' : 'bg-white/25 hover:bg-white/45',
            ].join(' ')}
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-eyes to-lavender-web flex items-center justify-center shadow-md flex-shrink-0">
              <span className="text-base font-semibold text-white font-system">
                {user?.displayName?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-gray-800 truncate font-system">{user?.displayName}</p>
              <button
                onClick={(e) => { e.preventDefault(); handleLogout(); }}
                className="text-xs text-gray-500 hover:text-red-500 font-system transition-colors"
              >
                Sign out
              </button>
            </div>
          </NavLink>

          {/* Footer links */}
          <div className="mt-2 flex flex-col gap-0.5">
            {[
              { to: '/welcome', icon: '✦', label: 'About & Pricing' },
              { to: '/privacy', icon: '🔐', label: 'Privacy Policy' },
            ].map(({ to, icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => [
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-system transition-all duration-200 min-h-[36px]',
                  isActive ? 'text-blue-600 bg-lavender-web/50' : 'text-gray-400 hover:text-gray-600 hover:bg-white/30',
                ].join(' ')}
              >
                <span aria-hidden="true">{icon}</span>
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}
