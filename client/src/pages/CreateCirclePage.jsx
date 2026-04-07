import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import api from '../services/api';

export default function CreateCirclePage() {
  const navigate = useNavigate();
  const { user } = useSelector(state => state.auth);
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState({
    name: '',
    topic: '',
    entryId: '',
    isPrivate: false
  });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    try {
      const { data } = await api.get('/entries', { params: { limit: 20 } });
      setEntries(data.data || []);
    } catch (err) {
      console.error('Failed to load entries:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.name.trim() || !form.topic.trim() || !form.entryId) {
      setError('Please fill in all required fields');
      return;
    }

    setCreating(true);
    try {
      const { data } = await api.post('/circles', form);
      navigate(`/circles/${data.data._id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create circle');
    } finally {
      setCreating(false);
    }
  };

  const selectedEntry = entries.find(e => e._id === form.entryId);

  return (
    <div className="max-w-2xl mx-auto p-6">
      <button
        onClick={() => navigate('/circles')}
        className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeftIcon className="w-5 h-5" />
        Back to Circles
      </button>

      <h1 className="text-3xl font-serif font-semibold text-gray-800 mb-2">
        Create a Thought Circle
      </h1>
      <p className="text-gray-600 mb-8">
        Start a group space based on one of your journal entries
      </p>

      {error && (
        <div className="mb-6 p-4 bg-peach-crayola/30 border border-peach-crayola rounded-lg text-peach-crayola">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Entry Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Based on Entry *
          </label>
          <select
            value={form.entryId}
            onChange={(e) => setForm({ ...form, entryId: e.target.value })}
            className="w-full px-4 py-3 border border-lavender-web rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-eyes"
          >
            <option value="">Select an entry...</option>
            {entries.map(entry => (
              <option key={entry._id} value={entry._id}>
                {entry.content.slice(0, 60)}... ({entry.intentLabel || 'Reflection'})
              </option>
            ))}
          </select>
          {selectedEntry?.themes?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {selectedEntry.themes.map(theme => (
                <span 
                  key={theme}
                  className="px-2 py-1 bg-alice-blue text-gray-600 text-xs rounded-full"
                >
                  {theme}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Circle Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Circle Name *
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g., Morning Mindfulness Group"
            maxLength={100}
            className="w-full px-4 py-3 border border-lavender-web rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-eyes"
          />
        </div>

        {/* Topic */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Topic / Focus *
          </label>
          <input
            type="text"
            value={form.topic}
            onChange={(e) => setForm({ ...form, topic: e.target.value })}
            placeholder="What will this circle explore together?"
            maxLength={200}
            className="w-full px-4 py-3 border border-lavender-web rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-eyes"
          />
        </div>

        {/* Privacy */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="isPrivate"
            checked={form.isPrivate}
            onChange={(e) => setForm({ ...form, isPrivate: e.target.checked })}
            className="w-5 h-5 rounded border-lavender-web text-blue-eyes focus:ring-blue-eyes"
          />
          <label htmlFor="isPrivate" className="text-gray-700">
            Make this circle private (invite-only)
          </label>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={creating}
          className="w-full py-3 bg-blue-eyes text-white font-medium rounded-lg hover:bg-opacity-90 disabled:opacity-50 transition"
        >
          {creating ? 'Creating...' : 'Create Circle'}
        </button>
      </form>
    </div>
  );
}
