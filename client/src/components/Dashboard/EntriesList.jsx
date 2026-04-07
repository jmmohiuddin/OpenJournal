import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

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

const intentIcons = {
  Problem: '❓',
  Solution: '💡',
  Reflection: '🌙'
};

export default function EntriesList({ entries }) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No entries yet. Start writing!</p>
        <Link 
          to="/"
          className="mt-4 inline-block px-6 py-2 bg-blue-eyes text-white rounded-lg hover:bg-opacity-90"
        >
          Write your first entry
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {entries.map(entry => (
        <EntryCard key={entry._id} entry={entry} />
      ))}
    </div>
  );
}

function EntryCard({ entry }) {
  return (
    <Link to={`/entry/${entry._id}`}>
      <article className="bg-white rounded-xl border border-lavender-web p-5 hover:shadow-md hover:border-blue-eyes/50 transition-all">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {entry.intentLabel && (
              <span 
                className="text-lg" 
                title={entry.intentLabel}
              >
                {intentIcons[entry.intentLabel]}
              </span>
            )}
            <span className="text-sm text-gray-500">
              {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
            </span>
          </div>

          {entry.sentiment?.mood && (
            <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${moodColors[entry.sentiment.mood] || 'bg-gray-100 text-gray-600'}`}>
              {entry.sentiment.mood}
            </span>
          )}
        </div>

        {/* Content Preview */}
        <p className="font-journal text-gray-700 line-clamp-3 leading-relaxed">
          {entry.content}
        </p>

        {/* Themes */}
        {entry.themes?.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {entry.themes.slice(0, 4).map(theme => (
              <span 
                key={theme}
                className="px-2.5 py-1 bg-alice-blue text-xs text-gray-600 rounded-full"
              >
                {theme}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        {entry.isDiscoverable && (
          <div className="mt-4 pt-3 border-t border-lavender-web flex items-center gap-2 text-xs text-blue-eyes">
            <span>✨</span>
            <span>Discoverable</span>
          </div>
        )}
      </article>
    </Link>
  );
}
