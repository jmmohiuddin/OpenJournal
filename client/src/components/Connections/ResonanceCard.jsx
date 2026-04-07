import { useState, useEffect } from 'react';
import { XMarkIcon, SparklesIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import api from '../../services/api';

export default function ResonanceCard({ match, onConnect, onDismiss, onExplain }) {
  const [explanation, setExplanation] = useState(null);
  const [loadingExplanation, setLoadingExplanation] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleExplainMatch = async () => {
    if (explanation) {
      setIsExpanded(!isExpanded);
      return;
    }

    setLoadingExplanation(true);
    try {
      const response = await api.post('/ai/explain-match', {
        entry1: match.myEntry,
        entry2: match.theirEntry
      });
      setExplanation(response.data.explanation);
      setIsExpanded(true);
    } catch (error) {
      console.error('Failed to explain match:', error);
    } finally {
      setLoadingExplanation(false);
    }
  };

  // Format the similarity score as percentage
  const compatibilityScore = Math.round((match.similarity || 0.85) * 100);
  
  // Get mood color
  const moodColors = {
    hopeful: 'bg-green-100 text-green-700',
    anxious: 'bg-yellow-100 text-yellow-700',
    reflective: 'bg-blue-100 text-blue-700',
    frustrated: 'bg-red-100 text-red-700',
    grateful: 'bg-purple-100 text-purple-700',
    confused: 'bg-orange-100 text-orange-700',
    determined: 'bg-indigo-100 text-indigo-700',
    melancholic: 'bg-gray-100 text-gray-600'
  };

  const theirMood = match.theirEntry?.sentiment?.mood || 'reflective';
  const moodStyle = moodColors[theirMood] || moodColors.reflective;

  return (
    <div className="fixed bottom-6 right-6 w-80 z-50 animate-slide-up">
      <div className="bg-white rounded-xl shadow-lg border border-lavender-web overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-alice-blue to-lavender-web px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SparklesIcon className="w-5 h-5 text-blue-eyes" />
            <span className="font-medium text-gray-700">Resonance Found</span>
          </div>
          <button
            onClick={onDismiss}
            className="p-1 hover:bg-white/50 rounded-full transition-colors"
          >
            <XMarkIcon className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Compatibility Score */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500">Compatibility</span>
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-eyes to-honeydew rounded-full transition-all"
                  style={{ width: `${compatibilityScore}%` }}
                />
              </div>
              <span className="text-sm font-medium text-blue-eyes">{compatibilityScore}%</span>
            </div>
          </div>

          {/* Match Summary */}
          <div className="mb-3">
            <p className="text-sm text-gray-600 line-clamp-2">
              {match.summary || "Someone else is thinking about similar topics. This could be a meaningful connection."}
            </p>
          </div>

          {/* Shared Themes */}
          {match.sharedThemes && match.sharedThemes.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {match.sharedThemes.slice(0, 3).map((theme, i) => (
                <span 
                  key={i}
                  className="text-xs px-2 py-1 bg-lavender-web text-gray-600 rounded-full"
                >
                  {theme}
                </span>
              ))}
            </div>
          )}

          {/* Their Entry Type & Mood */}
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-xs px-2 py-1 rounded-full ${
              match.theirEntry?.intentLabel === 'Solution' 
                ? 'bg-honeydew text-green-700' 
                : match.theirEntry?.intentLabel === 'Problem'
                  ? 'bg-peach-crayola text-orange-700'
                  : 'bg-lavender-web text-gray-600'
            }`}>
              {match.theirEntry?.intentLabel || 'Reflection'}
            </span>
            <span className={`text-xs px-2 py-1 rounded-full ${moodStyle}`}>
              {theirMood}
            </span>
          </div>

          {/* Explanation (expandable) */}
          {isExpanded && explanation && (
            <div className="mb-3 p-3 bg-alice-blue rounded-lg text-sm text-gray-600 animate-fade-in">
              <p className="font-medium text-gray-700 mb-1">Why this match?</p>
              <p>{explanation}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleExplainMatch}
              disabled={loadingExplanation}
              className="flex-1 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex items-center justify-center gap-1"
            >
              {loadingExplanation ? (
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <span>{isExpanded ? 'Hide' : 'Why?'}</span>
              )}
            </button>
            <button
              onClick={() => onConnect(match)}
              className="flex-1 px-3 py-2 text-sm bg-blue-eyes text-white rounded-lg hover:bg-opacity-90 transition-colors flex items-center justify-center gap-1"
            >
              <ChatBubbleLeftRightIcon className="w-4 h-4" />
              <span>Connect</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Container for multiple resonance cards
export function ResonanceCardStack({ matches, onConnect, onDismiss }) {
  const [visibleMatches, setVisibleMatches] = useState([]);
  
  useEffect(() => {
    // Show matches one at a time with delay
    setVisibleMatches(matches.slice(0, 1));
  }, [matches]);

  const handleDismiss = (matchId) => {
    setVisibleMatches(prev => prev.filter(m => m.id !== matchId));
    onDismiss(matchId);
    
    // Show next match if available
    const currentIndex = matches.findIndex(m => m.id === matchId);
    if (currentIndex < matches.length - 1) {
      setTimeout(() => {
        setVisibleMatches([matches[currentIndex + 1]]);
      }, 300);
    }
  };

  if (visibleMatches.length === 0) return null;

  return (
    <>
      {visibleMatches.map((match, index) => (
        <ResonanceCard
          key={match.id}
          match={match}
          onConnect={onConnect}
          onDismiss={() => handleDismiss(match.id)}
          style={{ bottom: `${24 + index * 8}px` }}
        />
      ))}
    </>
  );
}
