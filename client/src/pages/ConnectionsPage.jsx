import { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { fetchConnections, acceptConnection, declineConnection } from '../store/connectionsSlice';
import { formatDistanceToNow } from 'date-fns';

export default function ConnectionsPage() {
  const dispatch = useDispatch();
  const { connections, pending, active, loading, error } = useSelector(state => state.connections);
  const { user } = useSelector(state => state.auth);

  const getUserId = (value) => {
    if (!value) return null;
    if (typeof value === 'string') return value;
    return value._id || null;
  };

  const dedupeByOtherUser = (list) => {
    const currentUserId = getUserId(user?._id);
    const byOtherUser = new Map();

    list.forEach((connection) => {
      const seekerId = getUserId(connection.seekerId);
      const sageId = getUserId(connection.sageId);
      const otherUserId = seekerId === currentUserId ? sageId : seekerId;
      if (!otherUserId) return;

      const existing = byOtherUser.get(otherUserId);
      if (!existing) {
        byOtherUser.set(otherUserId, connection);
        return;
      }

      const existingTime = new Date(existing.createdAt || 0).getTime();
      const incomingTime = new Date(connection.createdAt || 0).getTime();
      if (incomingTime > existingTime) {
        byOtherUser.set(otherUserId, connection);
      }
    });

    return Array.from(byOtherUser.values());
  };

  const uniquePending = useMemo(() => dedupeByOtherUser(pending), [pending, user?._id]);
  const uniqueActive = useMemo(() => dedupeByOtherUser(active), [active, user?._id]);

  useEffect(() => {
    dispatch(fetchConnections());
  }, [dispatch]);

  const handleAccept = (id) => {
    dispatch(acceptConnection(id));
  };

  const handleDecline = (id) => {
    dispatch(declineConnection(id));
  };

  return (
    <div className="max-w-3xl mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-800 mb-2">
          Connections
        </h1>
        <p className="text-gray-500">
          People who resonate with your thoughts
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-blue-eyes border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="p-4 bg-peach-crayola/50 rounded-lg text-gray-700 mb-6">
          {error}
        </div>
      )}

      {/* Pending Connections */}
      {uniquePending.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-medium text-gray-700 mb-4 flex items-center gap-2">
            <span>✨</span>
            <span>Pending Resonances</span>
            <span className="px-2 py-0.5 bg-blue-eyes text-white text-xs rounded-full">
                {uniquePending.length}
              </span>
            </h2>
            <div className="space-y-4">
            {uniquePending.map(connection => (
              <PendingCard 
                key={connection._id}
                connection={connection}
                userId={user?._id}
                onAccept={() => handleAccept(connection._id)}
                onDecline={() => handleDecline(connection._id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Active Connections */}
      {uniqueActive.length > 0 && (
        <section>
          <h2 className="text-lg font-medium text-gray-700 mb-4">
            Active Connections
          </h2>
          <div className="space-y-4">
            {uniqueActive.map(connection => (
              <ActiveCard 
                key={connection._id}
                connection={connection}
                userId={user?._id}
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty State */}
      {!loading && connections.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-lavender-web">
          <div className="text-4xl mb-4">✨</div>
          <h3 className="text-lg font-medium text-gray-700 mb-2">
            No connections yet
          </h3>
          <p className="text-gray-500 mb-6 max-w-sm mx-auto">
            Write journal entries with discovery enabled to find people who resonate with your thoughts.
          </p>
          <Link 
            to="/"
            className="inline-block px-6 py-2.5 bg-blue-eyes text-white rounded-lg hover:bg-opacity-90"
          >
            Write an entry
          </Link>
        </div>
      )}
    </div>
  );
}

function PendingCard({ connection, userId, onAccept, onDecline }) {
  const isSeeker = connection.seekerId?._id === userId || connection.seekerId === userId;
  const otherUser = isSeeker ? connection.sageId : connection.seekerId;
  const otherName = otherUser?.displayName || 'Someone';

  return (
    <div className="bg-white rounded-xl border border-lavender-web p-5">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-eyes to-lavender-web flex items-center justify-center flex-shrink-0">
          <span className="text-white font-medium">
            {otherName.charAt(0).toUpperCase()}
          </span>
        </div>
        
        <div className="flex-1">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="font-medium text-gray-800">{otherName}</p>
              <p className="text-xs text-gray-500">
                {isSeeker ? 'May have insights for you' : 'Is seeking guidance'}
              </p>
            </div>
            <span className="text-xs text-blue-eyes font-medium">
              {Math.round((connection.similarityScore || 0.9) * 100)}% match
            </span>
          </div>
          
          <p className="text-sm text-gray-600 mb-4">
            {connection.bridgeMessage || 'You both seem to be thinking about similar topics.'}
          </p>
          
          <div className="flex gap-3">
            <button
              onClick={onAccept}
              className="px-4 py-2 bg-blue-eyes text-white text-sm font-medium rounded-lg hover:bg-opacity-90"
            >
              Accept
            </button>
            <button
              onClick={onDecline}
              className="px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50"
            >
              Decline
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActiveCard({ connection, userId }) {
  const isSeeker = connection.seekerId?._id === userId || connection.seekerId === userId;
  const otherUser = isSeeker ? connection.sageId : connection.seekerId;
  const otherName = otherUser?.displayName || 'Someone';

  return (
    <Link to={`/bridge/${connection._id}`}>
      <div className="bg-white rounded-xl border border-lavender-web p-5 hover:shadow-md hover:border-blue-eyes/50 transition-all">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-honeydew flex items-center justify-center flex-shrink-0">
            <span className="text-green-700 font-medium">
              {otherName.charAt(0).toUpperCase()}
            </span>
          </div>
          
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <p className="font-medium text-gray-800">{otherName}</p>
              <span className={`px-2 py-1 text-xs rounded-full ${
                connection.status === 'completed' 
                  ? 'bg-honeydew text-green-700' 
                  : 'bg-lavender-web text-purple-700'
              }`}>
                {connection.status === 'completed' ? 'Completed' : 'Active'}
              </span>
            </div>
            <p className="text-sm text-gray-500">
              Connected {formatDistanceToNow(new Date(connection.createdAt), { addSuffix: true })}
            </p>
          </div>
          
          <span className="text-gray-400">→</span>
        </div>
      </div>
    </Link>
  );
}
