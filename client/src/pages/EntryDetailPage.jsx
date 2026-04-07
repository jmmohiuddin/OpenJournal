import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { formatDistanceToNow, format } from 'date-fns';
import api from '../services/api';
import { deleteEntry } from '../store/entriesSlice';

const moodColors = {
  hopeful: 'bg-honeydew text-green-700',
  grateful: 'bg-honeydew text-green-700',
  determined: 'bg-blue-eyes/20 text-blue-700',
  reflective: 'bg-lavender-web text-purple-700',
  anxious: 'bg-peach-crayola text-orange-700',
  frustrated: 'bg-peach-crayola text-orange-700',
  confused: 'bg-lavender-web text-purple-700',
  melancholic: 'bg-gray-100 text-gray-600'
};

const intentLabels = {
  Problem: { icon: '❓', label: 'Problem', color: 'text-orange-600' },
  Solution: { icon: '💡', label: 'Solution', color: 'text-green-600' },
  Reflection: { icon: '🌙', label: 'Reflection', color: 'text-purple-600' }
};

export default function EntryDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchEntry = async () => {
      try {
        const { data } = await api.get(`/entries/${id}`);
        setEntry(data.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load entry');
      } finally {
        setLoading(false);
      }
    };

    fetchEntry();
  }, [id]);

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this entry?')) return;
    
    try {
      await dispatch(deleteEntry(id)).unwrap();
      navigate('/entries');
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-blue-eyes border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto py-8">
        <div className="p-4 bg-peach-crayola/50 rounded-lg text-gray-700">
          {error}
        </div>
        <Link to="/entries" className="mt-4 inline-block text-blue-eyes hover:underline">
          ← Back to entries
        </Link>
      </div>
    );
  }

  if (!entry) return null;

  const intentInfo = intentLabels[entry.intentLabel];

  return (
    <div className="max-w-3xl mx-auto py-8">
      {/* Back Link */}
      <Link 
        to="/entries" 
        className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6"
      >
        <span>←</span>
        <span>Back to entries</span>
      </Link>

      {/* Entry Card */}
      <article className="bg-white rounded-2xl border border-lavender-web overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-lavender-web bg-alice-blue/50">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">
                {format(new Date(entry.createdAt), 'EEEE, MMMM d, yyyy')}
              </p>
              <p className="text-xs text-gray-400">
                {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {entry.sentiment?.mood && (
                <span className={`px-3 py-1.5 text-sm font-medium rounded-full ${moodColors[entry.sentiment.mood]}`}>
                  {entry.sentiment.mood}
                </span>
              )}
              {intentInfo && (
                <span className={`flex items-center gap-1.5 text-sm font-medium ${intentInfo.color}`}>
                  <span>{intentInfo.icon}</span>
                  <span>{intentInfo.label}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          <div className="font-journal text-lg text-gray-700 leading-relaxed whitespace-pre-wrap">
            {entry.content}
          </div>
        </div>

        {/* Themes */}
        {entry.themes?.length > 0 && (
          <div className="px-8 pb-6">
            <p className="text-xs text-gray-500 mb-2">Themes</p>
            <div className="flex flex-wrap gap-2">
              {entry.themes.map(theme => (
                <span 
                  key={theme}
                  className="px-3 py-1.5 bg-lavender-web/50 text-sm text-gray-600 rounded-full"
                >
                  {theme}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-lavender-web bg-alice-blue/30 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {entry.isDiscoverable && (
              <span className="flex items-center gap-2 text-sm text-blue-eyes">
                <span>✨</span>
                <span>Discoverable</span>
              </span>
            )}
            {entry.aiProcessed && (
              <span className="text-xs text-gray-400">
                AI analyzed
              </span>
            )}
          </div>

          <button
            onClick={handleDelete}
            className="text-sm text-gray-400 hover:text-red-500 transition"
          >
            Delete entry
          </button>
        </div>
      </article>
    </div>
  );
}
