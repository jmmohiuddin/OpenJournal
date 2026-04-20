import { useState, useEffect } from 'react';
import api from '../services/api';

export default function AdminFeedbackPage() {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeedback = async () => {
      try {
        const { data } = await api.get('/feedback');
        if (data.success) {
          setFeedbacks(data.data);
        }
      } catch (error) {
        console.error('Error fetching feedback:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchFeedback();
  }, []);

  const getStatusColor = (status) => {
    switch(status) {
      case 'new': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'reviewed': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'resolved': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTypeIcon = (type) => {
    switch(type) {
      case 'idea': return '💡';
      case 'bug': return '🐛';
      case 'question': return '❔';
      default: return '💬';
    }
  };

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto px-4 md:px-8 py-10 font-system">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="font-journal text-3xl text-gray-800 mb-2">Feedback Inbox</h1>
          <p className="text-gray-500 text-sm">Thoughts and insights from your community.</p>
        </div>
        <div className="text-sm text-gray-500 bg-white/70 backdrop-blur-md px-4 py-2 flex items-center gap-2 rounded-xl border border-lavender-web shadow-sm">
          Total Responses: <span className="font-bold text-gray-800">{feedbacks.length}</span>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <span className="text-4xl animate-pulse text-blue-300">✦</span>
        </div>
      ) : feedbacks.length === 0 ? (
        <div className="text-center py-24 bg-white/50 backdrop-blur-md rounded-3xl border border-alice-blue shadow-sm">
          <span className="text-5xl mb-4 block opacity-40">🍃</span>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">The inbox is quiet.</h3>
          <p className="text-gray-500 text-sm">No feedback has been submitted yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {feedbacks.map((item) => (
            <div 
              key={item._id} 
              className="bg-white/80 backdrop-blur-md rounded-2xl p-6 border border-lavender-web shadow-sm hover:shadow-md transition-shadow flex flex-col"
            >
              <div className="flex justify-between items-start mb-4">
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">
                  <span className="text-base">{getTypeIcon(item.type)}</span>
                  {item.type}
                </span>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${getStatusColor(item.status)}`}>
                  {item.status}
                </span>
              </div>
              
              <p className="text-gray-800 text-sm mb-6 whitespace-pre-wrap leading-relaxed flex-1">
                {item.message}
              </p>
              
              <div className="flex items-center justify-between text-[11px] border-t border-alice-blue pt-4 mt-auto text-gray-400">
                <span className="font-medium text-gray-500 truncate max-w-[150px]">
                  {item.email || 'Anonymous'}
                </span>
                <span>
                  {new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
