import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { acceptConnection, declineConnection } from '../../store/connectionsSlice';

export default function ResonanceNotification() {
  const { pending } = useSelector(state => state.connections);
  const [currentNotification, setCurrentNotification] = useState(null);
  const [visible, setVisible] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    if (pending.length > 0 && !currentNotification) {
      setCurrentNotification(pending[0]);
      setVisible(true);
    }
  }, [pending, currentNotification]);

  const handleAccept = async () => {
    if (!currentNotification) return;
    
    try {
      await dispatch(acceptConnection(currentNotification._id)).unwrap();
      setVisible(false);
      setTimeout(() => {
        setCurrentNotification(null);
        navigate(`/bridge/${currentNotification._id}`);
      }, 300);
    } catch (err) {
      console.error('Accept error:', err);
    }
  };

  const handleDecline = async () => {
    if (!currentNotification) return;
    
    try {
      await dispatch(declineConnection(currentNotification._id)).unwrap();
      setVisible(false);
      setTimeout(() => setCurrentNotification(null), 300);
    } catch (err) {
      console.error('Decline error:', err);
    }
  };

  if (!currentNotification || !visible) return null;

  return (
    <div 
      className={`fixed bottom-6 right-6 max-w-sm bg-white rounded-2xl shadow-xl border border-lavender-web overflow-hidden transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-eyes to-lavender-web flex items-center justify-center flex-shrink-0">
            <span className="text-2xl">✨</span>
          </div>
          
          <div className="flex-1">
            <h4 className="font-semibold text-gray-800 mb-1">Resonance Found</h4>
            <p className="text-sm text-gray-600 leading-relaxed">
              {currentNotification.bridgeMessage}
            </p>
            
            {/* Match Strength */}
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-gray-500">Match strength:</span>
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-eyes to-honeydew rounded-full transition-all"
                  style={{ width: `${(currentNotification.similarityScore || 0.9) * 100}%` }}
                />
              </div>
              <span className="text-xs font-medium text-blue-eyes">
                {Math.round((currentNotification.similarityScore || 0.9) * 100)}%
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-5">
          <button
            onClick={handleAccept}
            className="flex-1 px-4 py-2.5 bg-blue-eyes text-white font-medium rounded-lg hover:bg-opacity-90 transition"
          >
            Connect
          </button>
          <button
            onClick={handleDecline}
            className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 font-medium rounded-lg hover:bg-gray-50 transition"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
