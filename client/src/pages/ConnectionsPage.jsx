import { useEffect, useMemo, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import {
  fetchConnections,
  acceptConnection,
  declineConnection,
  upsertConnection,
  enrichConnection
} from '../store/connectionsSlice';
import {
  onResonance,
  onConnectionEnriched,
  onConnectionAccepted
} from '../services/socket';
import { formatDistanceToNow } from 'date-fns';

export default function ConnectionsPage() {
  const dispatch   = useDispatch();
  const { connections, pending, active, loading, error } = useSelector(state => state.connections);
  const { user }   = useSelector(state => state.auth);
  const [refreshing, setRefreshing] = useState(false);

  // -----------------------------------------------------------------------
  // Socket subscriptions — update Redux state in real-time
  // -----------------------------------------------------------------------
  useEffect(() => {
    // New pending connection arrived
    const unsubResonance = onResonance((payload) => {
      if (!payload?.connectionId) return;
      // Build a minimal connection record from the socket payload so the
      // card renders immediately while we wait for AI enrichment.
      dispatch(upsertConnection({
        _id:             payload.connectionId,
        connectionType:  payload.connectionType,
        bridgeMessage:   payload.bridgeMessage,
        similarityScore: payload.similarity,
        status:          'pending',
        seekerAccepted:  false,
        sageAccepted:    false,
        // Role tells us which side the current user is
        _myRole:         payload.role,
        _theirEntry:     payload.theirEntry,
        _summary:        payload.summary,
        sharedThemes:    payload.sharedThemes || []
      }));
    });

    // AI bridge message enrichment finished — patch the existing card
    const unsubEnriched = onConnectionEnriched((payload) => {
      if (!payload?.connectionId) return;
      dispatch(enrichConnection({
        connectionId:  payload.connectionId,
        bridgeMessage: payload.bridgeMessage,
        summary:       payload.summary
      }));
    });

    // Other user accepted — refresh to get updated status (and popuated names)
    const unsubAccepted = onConnectionAccepted(() => {
      dispatch(fetchConnections());
    });

    return () => {
      unsubResonance();
      unsubEnriched();
      unsubAccepted();
    };
  }, [dispatch]);

  // -----------------------------------------------------------------------
  // Initial load
  // -----------------------------------------------------------------------
  useEffect(() => {
    dispatch(fetchConnections());
  }, [dispatch]);

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------
  const handleAccept  = useCallback((id) => dispatch(acceptConnection(id)),  [dispatch]);
  const handleDecline = useCallback((id) => dispatch(declineConnection(id)), [dispatch]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await dispatch(fetchConnections());
    setRefreshing(false);
  }, [dispatch]);

  // -----------------------------------------------------------------------
  // Deduplication helpers (keep newest connection per other-user pair)
  // -----------------------------------------------------------------------
  const getUserId = (value) => {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (value._id) return value._id.toString();
    if (value.id)  return value.id.toString();
    return value.toString?.() || null;
  };

  const resolveParticipants = (connection) => {
    const seeker = connection.seekerId || connection.user1Id;
    const sage   = connection.sageId   || connection.user2Id;
    return { seeker, sage };
  };

  const dedupeByOtherUser = (list) => {
    const currentUserId = getUserId(user?._id || user?.id || user);
    const byOtherUser   = new Map();

    list.forEach((connection) => {
      const { seeker, sage } = resolveParticipants(connection);
      const seekerId  = getUserId(seeker);
      const sageId    = getUserId(sage);
      const otherId   = seekerId === currentUserId ? sageId : seekerId;
      if (!otherId) return;

      const existing     = byOtherUser.get(otherId);
      if (!existing) { byOtherUser.set(otherId, connection); return; }

      const existingTime = new Date(existing.createdAt   || 0).getTime();
      const incomingTime = new Date(connection.createdAt || 0).getTime();
      if (incomingTime > existingTime) byOtherUser.set(otherId, connection);
    });

    return Array.from(byOtherUser.values());
  };

  const uniquePending = useMemo(() => dedupeByOtherUser(pending), [pending, user?._id, user?.id]);
  const uniqueActive  = useMemo(() => dedupeByOtherUser(active),  [active,  user?._id, user?.id]);

  // Empty-state: only show when there are truly no non-declined connections
  const hasAnyConnections = connections.some(c => c.status !== 'declined');

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div className="max-w-3xl mx-auto py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800 mb-1">Connections</h1>
          <p className="text-gray-500">People who resonate with your thoughts</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing || loading}
          title="Refresh connections"
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-eyes border border-blue-eyes/40 rounded-lg hover:bg-blue-eyes/5 disabled:opacity-40 transition-colors"
        >
          <span className={refreshing || loading ? 'animate-spin inline-block' : 'inline-block'}>
            ↻
          </span>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Loading state */}
      {loading && !refreshing && (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-blue-eyes border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Error state */}
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
          <h2 className="text-lg font-medium text-gray-700 mb-4">Active Connections</h2>
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

      {/* Empty State — only when no non-declined connections exist */}
      {!loading && !hasAnyConnections && (
        <div className="text-center py-12 bg-white rounded-xl border border-lavender-web">
          <div className="text-4xl mb-4">✨</div>
          <h3 className="text-lg font-medium text-gray-700 mb-2">No connections yet</h3>
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

// ---------------------------------------------------------------------------
// Pending Connection Card
// ---------------------------------------------------------------------------
function PendingCard({ connection, userId, onAccept, onDecline }) {
  const currentUserId = typeof userId === 'string' ? userId : userId?._id?.toString?.();
  const seeker        = connection.seekerId   || connection.user1Id;
  const sage          = connection.sageId     || connection.user2Id;
  const seekerId      = seeker?._id           || seeker;
  const isSeeker      = (seekerId?.toString?.() || seekerId) === currentUserId;
  const otherUser     = isSeeker ? sage : seeker;

  // otherUser can be a populated object with displayName, or just a raw ID string
  // from a socket-pushed partial record — fall back gracefully in both cases.
  const otherName = otherUser?.displayName || 'Someone';

  return (
    <div className="bg-white rounded-xl border border-lavender-web p-5">
      <div className="flex items-start gap-4">
        {/* Avatar */}
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
              {Math.round((connection.similarityScore || 0) * 100)}% match
            </span>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            {connection.bridgeMessage || 'You both seem to be thinking about similar topics.'}
          </p>

          {/* Shared themes pill row */}
          {(connection.sharedThemes || []).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {connection.sharedThemes.slice(0, 4).map(theme => (
                <span
                  key={theme}
                  className="px-2 py-0.5 bg-lavender-web/60 text-purple-700 text-xs rounded-full"
                >
                  {theme}
                </span>
              ))}
            </div>
          )}

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

// ---------------------------------------------------------------------------
// Active Connection Card
// ---------------------------------------------------------------------------
function ActiveCard({ connection, userId }) {
  const currentUserId = typeof userId === 'string' ? userId : userId?._id?.toString?.();
  const seeker        = connection.seekerId || connection.user1Id;
  const sage          = connection.sageId   || connection.user2Id;
  const seekerId      = seeker?._id         || seeker;
  const isSeeker      = (seekerId?.toString?.() || seekerId) === currentUserId;
  const otherUser     = isSeeker ? sage : seeker;
  const otherName     = otherUser?.displayName || 'Someone';

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
              {connection.createdAt
                ? <>Connected {formatDistanceToNow(new Date(connection.createdAt), { addSuffix: true })}</>
                : 'Recently connected'}
            </p>
          </div>

          <span className="text-gray-400">→</span>
        </div>
      </div>
    </Link>
  );
}
