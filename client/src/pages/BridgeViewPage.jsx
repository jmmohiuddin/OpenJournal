import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { formatDistanceToNow } from 'date-fns';
import api from '../services/api';
import { useSocket } from '../hooks/useSocket';

export default function BridgeViewPage() {
  const { connectionId } = useParams();
  const { user } = useSelector(state => state.auth);
  const { socket, joinChat, sendMessage } = useSocket();
  
  const [connection, setConnection] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const messagesEndRef = useRef(null);

  const mergeUniqueMessages = (incoming) => {
    const map = new Map();
    incoming.forEach((msg) => {
      if (msg?._id) {
        map.set(msg._id, msg);
      }
    });
    return Array.from(map.values()).sort(
      (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
    );
  };

  useEffect(() => {
    loadConnection();
    loadMessages();
  }, [connectionId]);

  useEffect(() => {
    if (!connectionId) return;
    const pollId = setInterval(() => {
      loadMessages({ silent: true });
    }, 4000);
    return () => clearInterval(pollId);
  }, [connectionId]);

  useEffect(() => {
    if (socket && connectionId) {
      joinChat(connectionId);
      
      socket.on('message', handleNewMessage);
      
      return () => {
        socket.off('message', handleNewMessage);
      };
    }
  }, [socket, connectionId, joinChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConnection = async () => {
    try {
      const { data } = await api.get(`/connections/${connectionId}`);
      setConnection(data.data);
    } catch (err) {
      console.error('Failed to load connection:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async ({ silent = false } = {}) => {
    try {
      const { data } = await api.get(`/connections/${connectionId}/messages`);
      setMessages((prev) => (silent ? mergeUniqueMessages([...prev, ...data.data]) : mergeUniqueMessages(data.data)));
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  const handleNewMessage = (message) => {
    setMessages(prev => mergeUniqueMessages([...prev, message]));
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    const content = newMessage.trim();
    setSending(true);
    setNewMessage('');
    try {
      // Primary path: REST message creation works on serverless deployments.
      const { data } = await api.post(`/connections/${connectionId}/messages`, { content });
      if (data?.data) {
        setMessages(prev => mergeUniqueMessages([...prev, data.data]));
      }
      // Keep socket emit as secondary realtime hint for connected peers.
      sendMessage(connectionId, content);
    } catch (err) {
      console.error('Failed to send message:', err);
      // Fallback to socket-only attempt if REST fails.
      sendMessage(connectionId, content);
    } finally {
      setSending(false);
    }
  };

  const handleMarkHelpful = async (helpful) => {
    try {
      const { data } = await api.post(`/connections/${connectionId}/feedback`, { helpful });
      setConnection(data.data);
      setShowFeedback(false);
    } catch (err) {
      console.error('Failed to submit feedback:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-alice-blue">
        <div className="w-8 h-8 border-2 border-blue-eyes border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!connection) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-alice-blue">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Connection not found</p>
          <Link to="/connections" className="text-blue-eyes hover:underline">
            Back to connections
          </Link>
        </div>
      </div>
    );
  }

  const getId = (value) => {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (value._id) return value._id.toString();
    if (value.id) return value.id.toString();
    return value.toString?.() || null;
  };
  const currentUserId = getId(user?._id || user?.id || user);
  const seeker = connection.seekerId || connection.user1Id;
  const sage = connection.sageId || connection.user2Id;
  const isSeeker = getId(seeker) === currentUserId;
  const otherUser = isSeeker ? sage : seeker;
  const myEntry = isSeeker ? connection.problemEntryId : connection.solutionEntryId;
  const theirEntry = isSeeker ? connection.solutionEntryId : connection.problemEntryId;

  return (
    <div className="h-screen flex bg-alice-blue">
      {/* Left Panel - Context */}
      <div className="w-1/3 bg-white border-r border-lavender-web flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-lavender-web">
          <Link 
            to="/connections"
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-2 mb-3"
          >
            <span>←</span>
            <span>Back</span>
          </Link>
          <h2 className="font-semibold text-gray-800">Context</h2>
        </div>

        {/* Entries */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* My Entry */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">YOUR ENTRY</p>
            <div className="bg-alice-blue rounded-lg p-4">
              <p className="font-journal text-sm text-gray-700 line-clamp-6">
                {myEntry?.content || 'Entry content'}
              </p>
              {myEntry?.themes?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {myEntry.themes.slice(0, 3).map(theme => (
                    <span key={theme} className="px-2 py-0.5 bg-lavender-web text-xs rounded-full">
                      {theme}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Their Entry */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">
              {isSeeker ? 'THEIR INSIGHT' : 'THEIR CHALLENGE'}
            </p>
            <div className="bg-honeydew/50 rounded-lg p-4">
              <p className="font-journal text-sm text-gray-700 line-clamp-6">
                {theirEntry?.content || 'Entry content'}
              </p>
              {theirEntry?.themes?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {theirEntry.themes.slice(0, 3).map(theme => (
                    <span key={theme} className="px-2 py-0.5 bg-green-100 text-xs rounded-full">
                      {theme}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Bridge Message */}
          <div className="p-4 bg-lavender-web/50 rounded-lg">
            <p className="text-sm text-gray-600 italic">
              "{connection.bridgeMessage}"
            </p>
            <p className="text-xs text-gray-500 mt-2">— The Guide</p>
          </div>

          {/* Feedback Section - Only for Seeker */}
          {isSeeker && connection.status === 'accepted' && connection.markedHelpful === null && (
            <div className="p-4 bg-white rounded-lg border border-lavender-web">
              <p className="text-sm font-medium text-gray-700 mb-3">
                Was this connection helpful?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleMarkHelpful(true)}
                  className="flex-1 px-4 py-2 bg-honeydew text-green-700 text-sm font-medium rounded-lg hover:bg-green-100 transition"
                >
                  ✓ Yes, helpful!
                </button>
                <button
                  onClick={() => handleMarkHelpful(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200 transition"
                >
                  Not really
                </button>
              </div>
            </div>
          )}

          {/* Rating Section - After marking helpful */}
          {connection.markedHelpful !== null && !connection[isSeeker ? 'seekerRating' : 'sageRating'] && (
            <RatingSection 
              connectionId={connectionId}
              onRated={(updatedConnection) => setConnection(updatedConnection)}
            />
          )}

          {/* Resolved Badge */}
          {connection.status === 'resolved' && (
            <div className="p-4 bg-honeydew rounded-lg text-center">
              <span className="text-green-700 font-medium">✓ Marked as Helpful</span>
              {connection.seekerRating && (
                <div className="mt-2 flex justify-center gap-1">
                  {[1, 2, 3, 4, 5].map(star => (
                    <span key={star} className={star <= connection.seekerRating ? 'text-yellow-500' : 'text-gray-300'}>
                      ★
                    </span>
                  ))}
                </div>
              )}
              <p className="text-xs text-green-600 mt-1">
                Thank you for your feedback!
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Chat */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="p-4 border-b border-lavender-web bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-eyes to-lavender-web flex items-center justify-center">
              <span className="text-white font-medium">
                {otherUser?.displayName?.charAt(0).toUpperCase() || '?'}
              </span>
            </div>
            <div>
              <h1 className="font-medium text-gray-800">
                {otherUser?.displayName || 'Anonymous'}
              </h1>
              <p className="text-xs text-gray-500">
                {Math.round((connection.similarityScore || 0.9) * 100)}% resonance
              </p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map(msg => (
            <MessageBubble 
              key={msg._id}
              message={msg}
              isOwn={msg.senderId?._id === user?._id}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="p-4 bg-white border-t border-lavender-web">
          <div className="flex gap-3">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-4 py-3 border border-lavender-web rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-eyes"
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || sending}
              className="px-6 py-3 bg-blue-eyes text-white font-medium rounded-lg hover:bg-opacity-90 disabled:opacity-50 transition"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MessageBubble({ message, isOwn }) {
  if (message.type === 'ai_wingman' || message.type === 'system') {
    return (
      <div className="flex justify-center">
        <div className="max-w-md bg-lavender-web/50 rounded-lg px-4 py-2">
          <p className="text-sm text-gray-600 italic text-center">
            {message.content}
          </p>
          <p className="text-xs text-gray-500 mt-1 text-center">
            — {message.type === 'ai_wingman' ? 'Social Wingman' : 'System'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[70%] rounded-2xl px-4 py-3 ${
        isOwn 
          ? 'bg-blue-eyes text-white' 
          : 'bg-white border border-lavender-web text-gray-700'
      }`}>
        {!isOwn && message.senderId?.displayName && (
          <p className="text-xs opacity-70 mb-1">
            {message.senderId.displayName}
          </p>
        )}
        <p className="text-sm">{message.content}</p>
        <p className={`text-xs mt-1 ${isOwn ? 'opacity-70' : 'text-gray-400'}`}>
          {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
        </p>
      </div>
    </div>
  );
}

function RatingSection({ connectionId, onRated }) {
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);

  const handleSubmit = async () => {
    if (rating === 0) return;
    setSubmitting(true);
    try {
      const { data } = await api.post(`/connections/${connectionId}/feedback`, {
        rating,
        feedback: feedback.trim() || undefined
      });
      onRated(data.data);
    } catch (err) {
      console.error('Failed to submit rating:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 bg-white rounded-lg border border-lavender-web">
      <p className="text-sm font-medium text-gray-700 mb-3">
        Rate this conversation
      </p>
      <div className="flex justify-center gap-1 mb-3">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            onClick={() => setRating(star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            className="text-2xl transition-transform hover:scale-110"
          >
            <span className={
              star <= (hoverRating || rating) 
                ? 'text-yellow-500' 
                : 'text-gray-300'
            }>
              ★
            </span>
          </button>
        ))}
      </div>
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="Share any additional thoughts (optional)"
        className="w-full px-3 py-2 border border-lavender-web rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-eyes"
        rows={2}
        maxLength={500}
      />
      <button
        onClick={handleSubmit}
        disabled={rating === 0 || submitting}
        className="mt-3 w-full px-4 py-2 bg-blue-eyes text-white text-sm font-medium rounded-lg hover:bg-opacity-90 disabled:opacity-50 transition"
      >
        {submitting ? 'Submitting...' : 'Submit Rating'}
      </button>
    </div>
  );
}
