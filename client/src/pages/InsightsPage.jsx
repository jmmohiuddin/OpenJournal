import { useEffect, useState } from 'react';
import api from '../services/api';

export default function InsightsPage() {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        const { data } = await api.get('/entries/insights');
        setInsights(data.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load insights');
      } finally {
        setLoading(false);
      }
    };

    fetchInsights();
  }, []);

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
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-800 mb-2">
          Insights
        </h1>
        <p className="text-gray-500">
          Patterns and trends from your journal
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Intent Distribution */}
        <div className="bg-white rounded-xl border border-lavender-web p-6">
          <h3 className="font-medium text-gray-700 mb-4">Entry Types</h3>
          {insights?.intentDistribution?.length > 0 ? (
            <div className="space-y-3">
              {insights.intentDistribution.map(item => (
                <div key={item._id} className="flex items-center gap-3">
                  <span className="text-lg">
                    {item._id === 'Problem' ? '❓' : item._id === 'Solution' ? '💡' : '🌙'}
                  </span>
                  <span className="flex-1 text-sm text-gray-600">{item._id}</span>
                  <span className="font-medium">{item.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No data yet</p>
          )}
        </div>

        {/* Top Themes */}
        <div className="bg-white rounded-xl border border-lavender-web p-6">
          <h3 className="font-medium text-gray-700 mb-4">Top Themes</h3>
          {insights?.topThemes?.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {insights.topThemes.map(theme => (
                <span 
                  key={theme._id}
                  className="px-3 py-1.5 bg-lavender-web/50 text-sm text-gray-600 rounded-full"
                >
                  {theme._id}
                  <span className="ml-2 text-gray-400">({theme.count})</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No themes extracted yet</p>
          )}
        </div>

        {/* Mood Trend */}
        <div className="bg-white rounded-xl border border-lavender-web p-6 md:col-span-2">
          <h3 className="font-medium text-gray-700 mb-4">Recent Mood Trend</h3>
          {insights?.moodTrend?.length > 0 ? (
            <div className="h-32 flex items-end justify-between gap-2">
              {insights.moodTrend.slice(-14).map((day, i) => {
                const avgScore = day.moods.reduce((acc, m) => acc + m.avgScore, 0) / day.moods.length;
                const height = Math.max(10, (avgScore + 1) * 50);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div 
                      className="w-full bg-gradient-to-t from-blue-eyes to-honeydew rounded-t transition-all"
                      style={{ height: `${height}%` }}
                      title={`${day._id}: ${day.moods.map(m => m.mood).join(', ')}`}
                    />
                    <span className="text-xs text-gray-400">
                      {new Date(day._id).toLocaleDateString('en-US', { weekday: 'short' })}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">Not enough data for mood trend</p>
          )}
        </div>
      </div>

      {/* Empty State */}
      {!insights?.moodTrend?.length && !insights?.intentDistribution?.length && (
        <div className="text-center py-12 bg-white rounded-xl border border-lavender-web mt-6">
          <div className="text-4xl mb-4">📊</div>
          <h3 className="text-lg font-medium text-gray-700 mb-2">
            No insights yet
          </h3>
          <p className="text-gray-500 max-w-sm mx-auto">
            Start writing journal entries to see patterns and trends emerge.
          </p>
        </div>
      )}
    </div>
  );
}
