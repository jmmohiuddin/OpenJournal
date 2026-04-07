import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { XMarkIcon, SparklesIcon } from '@heroicons/react/24/outline';
import socket, { connectSocket } from '../../services/socket';

export default function NotificationProvider({ children }) {
  const { isAuthenticated, token } = useSelector(state => state.auth);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (isAuthenticated && token) {
      connectSocket();

      // Listen for resonance notifications (new matches)
      socket.on('resonance', (data) => {
        setNotifications(prev => [...prev, {
          id: Date.now(),
          type: 'resonance',
          ...data
        }]);
      });

      // Listen for connection accepted
      socket.on('connection_accepted', (data) => {
        setNotifications(prev => [...prev, {
          id: Date.now(),
          type: 'accepted',
          ...data
        }]);
      });

      // Listen for new message notifications
      socket.on('new_message', (data) => {
        setNotifications(prev => [...prev, {
          id: Date.now(),
          type: 'message',
          ...data
        }]);
      });

      return () => {
        socket.off('resonance');
        socket.off('connection_accepted');
        socket.off('new_message');
      };
    }
  }, [isAuthenticated, token]);

  const dismissNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <>
      {children}
      
      {/* Notification Stack - Bottom Right */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-3 max-w-sm">
        {notifications.slice(-3).map(notification => (
          <ResonanceCard 
            key={notification.id} 
            notification={notification}
            onDismiss={() => dismissNotification(notification.id)}
          />
        ))}
      </div>
    </>
  );
}

function ResonanceCard({ notification, onDismiss }) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Auto-dismiss after 10 seconds
    const timer = setTimeout(() => {
      handleDismiss();
    }, 10000);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(onDismiss, 300);
  };

  if (notification.type === 'resonance') {
    return (
      <div className={`
        card-resonance
        transform transition-all duration-300 
        ${isExiting ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}
        animate-slide-in
      `}>
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-eyes/20 rounded-xl backdrop-blur-sm">
            <SparklesIcon className="w-6 h-6 text-blue-eyes" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-gray-800 text-sm font-system">
                ✨ New Resonance Found
              </p>
              <button 
                onClick={handleDismiss}
                className="text-gray-400 hover:text-gray-700 transition-colors p-1 hover:bg-white/40 rounded-lg"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-gray-600 text-sm mt-1 line-clamp-2 font-system">
              {notification.bridgeMessage || "Someone's insight resonates with your thoughts"}
            </p>

            {notification.sharedThemes?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {notification.sharedThemes.slice(0, 3).map(theme => (
                  <span 
                    key={theme}
                    className="px-2 py-0.5 bg-blue-eyes/10 text-gray-600 text-xs rounded-full font-system border border-blue-eyes/20"
                  >
                    {theme}
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-2 text-xs text-gray-600 font-system">
                <span className="font-semibold text-blue-eyes">
                  {Math.round((notification.combinedScore || notification.similarity || 0.85) * 100)}% match
                </span>
                <span>•</span>
                <span>You're the {notification.role === 'seeker' ? 'Seeker' : 'Sage'}</span>
              </div>
              <Link
                to="/connections"
                onClick={handleDismiss}
                className="btn-primary text-xs px-3 py-1.5"
              >
                View
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (notification.type === 'accepted') {
    return (
      <div className={`
        glass-panel border-2 border-honeydew/50 p-4
        transform transition-all duration-300 
        ${isExiting ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}
        animate-slide-in
      `}>
        <div className="flex items-start gap-3">
          <div className="p-2 bg-honeydew/40 rounded-xl backdrop-blur-sm">
            <span className="text-lg">🎉</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-gray-800 text-sm font-system">
                Connection Accepted!
              </p>
              <button 
                onClick={handleDismiss} 
                className="text-gray-400 hover:text-gray-700 transition-colors p-1 hover:bg-white/40 rounded-lg"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-600 text-sm mt-1 font-system">
              {notification.displayName || 'Someone'} is ready to connect
            </p>
            <Link
              to={`/bridge/${notification.connectionId}`}
              onClick={handleDismiss}
              className="inline-block mt-2 btn-success text-xs px-3 py-1.5"
            >
              Start Conversation
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (notification.type === 'message') {
    return (
      <div className={`
        glass-panel p-4
        transform transition-all duration-300 
        ${isExiting ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}
        animate-slide-in
      `}>
        <div className="flex items-start gap-3">
          <div className="p-2 bg-lavender-web/40 rounded-xl backdrop-blur-sm">
            <span className="text-lg">💬</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-gray-800 text-sm font-system">
                New Message
              </p>
              <button 
                onClick={handleDismiss} 
                className="text-gray-400 hover:text-gray-700 transition-colors p-1 hover:bg-white/40 rounded-lg"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-600 text-sm mt-1 line-clamp-2 font-system">
              {notification.preview || 'You have a new message'}
            </p>
            <Link
              to={`/bridge/${notification.connectionId}`}
              onClick={handleDismiss}
              className="inline-block mt-2 btn-primary text-xs px-3 py-1.5"
            >
              Reply
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
