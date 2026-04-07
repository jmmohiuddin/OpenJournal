import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { 
  UserGroupIcon, 
  PlusIcon, 
  ChatBubbleLeftRightIcon,
  ArrowRightIcon 
} from '@heroicons/react/24/outline';
import api from '../services/api';

export default function CirclesPage() {
  const { user } = useSelector(state => state.auth);
  const [myCircles, setMyCircles] = useState([]);
  const [discoverCircles, setDiscoverCircles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('my');

  useEffect(() => {
    loadCircles();
  }, []);

  const loadCircles = async () => {
    try {
      const [myRes, discoverRes] = await Promise.all([
        api.get('/circles/my'),
        api.get('/circles/discover')
      ]);
      setMyCircles(myRes.data.data || []);
      setDiscoverCircles(discoverRes.data.data || []);
    } catch (err) {
      console.error('Failed to load circles:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinCircle = async (circleId) => {
    try {
      await api.post(`/circles/${circleId}/join`);
      loadCircles(); // Refresh
    } catch (err) {
      console.error('Failed to join circle:', err);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-lavender-web rounded w-1/3"></div>
          <div className="h-32 bg-lavender-web rounded"></div>
          <div className="h-32 bg-lavender-web rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-serif font-semibold text-gray-800">
            Thought Circles
          </h1>
          <p className="text-gray-600 mt-1">
            Group spaces for collective exploration
          </p>
        </div>
        <Link
          to="/circles/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-eyes text-white rounded-lg hover:bg-opacity-90 transition"
        >
          <PlusIcon className="w-5 h-5" />
          Create Circle
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-lavender-web mb-6">
        <button
          onClick={() => setActiveTab('my')}
          className={`px-4 py-2 font-medium transition ${
            activeTab === 'my'
              ? 'text-blue-eyes border-b-2 border-blue-eyes'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          My Circles ({myCircles.length})
        </button>
        <button
          onClick={() => setActiveTab('discover')}
          className={`px-4 py-2 font-medium transition ${
            activeTab === 'discover'
              ? 'text-blue-eyes border-b-2 border-blue-eyes'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Discover ({discoverCircles.length})
        </button>
      </div>

      {/* My Circles */}
      {activeTab === 'my' && (
        <div className="space-y-4">
          {myCircles.length === 0 ? (
            <div className="text-center py-12 bg-alice-blue rounded-xl">
              <UserGroupIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-700 mb-2">
                No circles yet
              </h3>
              <p className="text-gray-500 mb-4">
                Join a circle or create your own to start group discussions
              </p>
              <button
                onClick={() => setActiveTab('discover')}
                className="text-blue-eyes hover:underline"
              >
                Discover circles →
              </button>
            </div>
          ) : (
            myCircles.map(circle => (
              <CircleCard 
                key={circle._id} 
                circle={circle} 
                isMember={true}
              />
            ))
          )}
        </div>
      )}

      {/* Discover */}
      {activeTab === 'discover' && (
        <div className="space-y-4">
          {discoverCircles.length === 0 ? (
            <div className="text-center py-12 bg-alice-blue rounded-xl">
              <p className="text-gray-500">
                No public circles available right now
              </p>
            </div>
          ) : (
            discoverCircles.map(circle => (
              <CircleCard 
                key={circle._id} 
                circle={circle} 
                isMember={false}
                onJoin={() => handleJoinCircle(circle._id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function CircleCard({ circle, isMember, onJoin }) {
  const statusColors = {
    forming: 'bg-yellow-100 text-yellow-800',
    active: 'bg-green-100 text-green-800',
    closed: 'bg-gray-100 text-gray-800'
  };

  return (
    <div className="bg-white rounded-xl border border-lavender-web p-5 hover:shadow-md transition">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold text-gray-800">
              {circle.name}
            </h3>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[circle.status]}`}>
              {circle.status}
            </span>
          </div>
          <p className="text-gray-600 mb-3">{circle.topic}</p>
          
          {circle.themes?.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {circle.themes.slice(0, 5).map(theme => (
                <span 
                  key={theme}
                  className="px-2 py-1 bg-alice-blue text-gray-600 text-xs rounded-full"
                >
                  {theme}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <UserGroupIcon className="w-4 h-4" />
              {circle.members?.length || 0}/{circle.maxMembers || 8} members
            </span>
          </div>
        </div>

        <div className="ml-4">
          {isMember ? (
            <Link
              to={`/circles/${circle._id}`}
              className="flex items-center gap-2 px-4 py-2 bg-blue-eyes text-white rounded-lg hover:bg-opacity-90 transition"
            >
              <ChatBubbleLeftRightIcon className="w-5 h-5" />
              Open
            </Link>
          ) : (
            <button
              onClick={onJoin}
              disabled={circle.status === 'closed' || circle.members?.length >= circle.maxMembers}
              className="flex items-center gap-2 px-4 py-2 bg-honeydew text-green-800 rounded-lg hover:bg-green-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowRightIcon className="w-5 h-5" />
              Join
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
