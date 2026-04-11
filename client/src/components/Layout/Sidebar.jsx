import { NavLink, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { logout } from '../../store/authSlice';

export default function Sidebar({ isOpen, onClose }) {
  const { user } = useSelector(state => state.auth);
  const { pending } = useSelector(state => state.connections);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const navItems = [
    { to: '/', icon: '📝', label: 'Write', end: true },
    { to: '/entries', icon: '📚', label: 'Entries' },
    { to: '/connections', icon: '✨', label: 'Connections', badge: pending.length },
    { to: '/circles', icon: '🔮', label: 'Circles' },
    { to: '/insights', icon: '📊', label: 'Insights' },
    { to: '/settings', icon: '⚙️', label: 'Settings' }
  ];

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
    if (onClose) onClose();
  };

  const handleNavClick = () => {
    if (onClose && window.innerWidth < 1024) onClose();
  };

  return (
    <aside className={`
      w-64 glass-nav flex flex-col
      fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out
      lg:relative lg:translate-x-0
      ${isOpen ? 'translate-x-0' : '-translate-x-full'}
    `}>
      {/* Logo */}
      <div className="p-6 border-b border-white/20">
        <h1 className="text-xl font-semibold text-gray-800 font-system">Open Journal</h1>
        <p className="text-sm text-gray-600 mt-1 font-system">Reflect. Connect. Grow.</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {navItems.map(item => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                onClick={handleNavClick}
                className={({ isActive }) => `
                  flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-system
                  ${isActive 
                    ? 'bg-blue-eyes text-white font-medium shadow-md scale-[1.02]' 
                    : 'text-gray-700 hover:bg-white/40 hover:backdrop-blur-sm hover:scale-[1.01]'}
                `}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
                {item.badge > 0 && (
                  <span className="ml-auto px-2 py-0.5 bg-honeydew text-green-800 text-xs font-medium rounded-full animate-pulse-soft">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-white/20">
        <NavLink 
          to="/profile"
          className={({ isActive }) => `
            flex items-center gap-3 p-3 rounded-xl transition-all duration-200
            ${isActive ? 'bg-white/50 backdrop-blur-sm shadow-md' : 'bg-white/30 hover:bg-white/50 hover:backdrop-blur-sm'}
          `}
        >
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-eyes to-lavender-web flex items-center justify-center shadow-md">
            <span className="text-lg font-semibold text-white font-system">
              {user?.displayName?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-gray-800 truncate font-system">
              {user?.displayName}
            </p>
            <button 
              onClick={(e) => {
                e.preventDefault();
                handleLogout();
              }}
              className="text-xs text-gray-600 hover:text-gray-800 font-system transition-colors"
            >
              Sign out
            </button>
          </div>
        </NavLink>
      </div>
    </aside>
  );
}
