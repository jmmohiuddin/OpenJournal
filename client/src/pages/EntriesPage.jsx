import { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchEntries } from '../store/entriesSlice';
import EntriesList from '../components/Dashboard/EntriesList';

export default function EntriesPage() {
  const dispatch = useDispatch();
  const { entries, loading, error } = useSelector(state => state.entries);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    intent: 'all',
    mood: 'all',
    discoverable: 'all'
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    dispatch(fetchEntries());
  }, [dispatch]);

  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      // Search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesContent = entry.content?.toLowerCase().includes(query);
        const matchesThemes = entry.themes?.some(t => t.toLowerCase().includes(query));
        if (!matchesContent && !matchesThemes) return false;
      }

      // Intent filter
      if (filters.intent !== 'all' && entry.intentLabel !== filters.intent) {
        return false;
      }

      // Mood filter
      if (filters.mood !== 'all' && entry.sentiment?.mood !== filters.mood) {
        return false;
      }

      // Discoverable filter
      if (filters.discoverable !== 'all') {
        const isDiscoverable = filters.discoverable === 'yes';
        if (entry.isDiscoverable !== isDiscoverable) return false;
      }

      return true;
    });
  }, [entries, searchQuery, filters]);

  const intentOptions = ['all', 'Problem', 'Solution', 'Reflection'];
  const moodOptions = ['all', 'hopeful', 'anxious', 'reflective', 'frustrated', 'grateful', 'confused', 'determined', 'melancholic'];

  const clearFilters = () => {
    setSearchQuery('');
    setFilters({ intent: 'all', mood: 'all', discoverable: 'all' });
  };

  const hasActiveFilters = searchQuery || filters.intent !== 'all' || filters.mood !== 'all' || filters.discoverable !== 'all';

  return (
    <div className="max-w-3xl mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-800 mb-2">
          Your Journal
        </h1>
        <p className="text-gray-500">
          {filteredEntries.length} of {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
        </p>
      </div>

      {/* Search & Filter Bar */}
      <div className="mb-6 space-y-4">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search entries by content or themes..."
              className="w-full pl-10 pr-4 py-2.5 border border-lavender-web rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-eyes"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              🔍
            </span>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2.5 border rounded-lg flex items-center gap-2 transition ${
              showFilters || hasActiveFilters
                ? 'border-blue-eyes bg-blue-eyes/10 text-blue-eyes'
                : 'border-lavender-web text-gray-600 hover:bg-gray-50'
            }`}
          >
            <span>⚙️</span>
            <span>Filters</span>
            {hasActiveFilters && (
              <span className="w-2 h-2 bg-blue-eyes rounded-full" />
            )}
          </button>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="p-4 bg-white rounded-lg border border-lavender-web space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  Intent Type
                </label>
                <select
                  value={filters.intent}
                  onChange={(e) => setFilters(f => ({ ...f, intent: e.target.value }))}
                  className="w-full px-3 py-2 border border-lavender-web rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-eyes"
                >
                  {intentOptions.map(opt => (
                    <option key={opt} value={opt}>
                      {opt === 'all' ? 'All Types' : opt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  Mood
                </label>
                <select
                  value={filters.mood}
                  onChange={(e) => setFilters(f => ({ ...f, mood: e.target.value }))}
                  className="w-full px-3 py-2 border border-lavender-web rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-eyes"
                >
                  {moodOptions.map(opt => (
                    <option key={opt} value={opt}>
                      {opt === 'all' ? 'All Moods' : opt.charAt(0).toUpperCase() + opt.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  Discovery
                </label>
                <select
                  value={filters.discoverable}
                  onChange={(e) => setFilters(f => ({ ...f, discoverable: e.target.value }))}
                  className="w-full px-3 py-2 border border-lavender-web rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-eyes"
                >
                  <option value="all">All Entries</option>
                  <option value="yes">Discoverable Only</option>
                  <option value="no">Private Only</option>
                </select>
              </div>
            </div>

            {hasActiveFilters && (
              <div className="flex justify-end">
                <button
                  onClick={clearFilters}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-blue-eyes border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="p-4 bg-peach-crayola/50 rounded-lg text-gray-700">
          {error}
        </div>
      )}

      {!loading && !error && filteredEntries.length === 0 && entries.length > 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-2">No entries match your filters</p>
          <button
            onClick={clearFilters}
            className="text-blue-eyes hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}

      {!loading && !error && (
        <EntriesList entries={filteredEntries} />
      )}
    </div>
  );
}
