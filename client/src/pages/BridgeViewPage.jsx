import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { formatDistanceToNow } from 'date-fns';
import api from '../services/api';
import { useSocket } from '../hooks/useSocket';

export default function BridgeViewPage() {
  const { connectionId }              = useParams();
  const { user }                      = useSelector(state => state.auth);
  const { socket, joinChat, sendMessage } = useSocket();

  const [connection,    setConnection]    = useState(null);
  const [messages,      setMessages]      = useState([]);
  const [newMessage,    setNewMessage]    = useState('');
  const [loading,       setLoading]       = useState(true);
  const [sending,       setSending]       = useState(false);
  const [showContext,   setShowContext]    = useState(false); // mobile context sheet
  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);

  // ── Merge messages deduped ────────────────────────────────────────────────
  const mergeUniqueMessages = (incoming) => {
    const map = new Map();
    incoming.forEach(msg => { if (msg?._id) map.set(msg._id, msg); });
    return Array.from(map.values()).sort(
      (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
    );
  };

  // ── Load data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    loadConnection();
    loadMessages();
  }, [connectionId]);

  useEffect(() => {
    if (!connectionId) return;
    const pollId = setInterval(() => loadMessages({ silent: true }), 4000);
    return () => clearInterval(pollId);
  }, [connectionId]);

  useEffect(() => {
    if (socket && connectionId) {
      joinChat(connectionId);
      socket.on('message', handleNewMessage);
      return () => socket.off('message', handleNewMessage);
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
      setMessages(prev =>
        silent
          ? mergeUniqueMessages([...prev, ...data.data])
          : mergeUniqueMessages(data.data)
      );
    } catch (err) { console.error('Failed to load messages:', err); }
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
      const { data } = await api.post(`/connections/${connectionId}/messages`, { content });
      if (data?.data) setMessages(prev => mergeUniqueMessages([...prev, data.data]));
      sendMessage(connectionId, content);
    } catch {
      sendMessage(connectionId, content);
    } finally {
      setSending(false);
    }
  };

  const handleMarkHelpful = async (helpful) => {
    try {
      const { data } = await api.post(`/connections/${connectionId}/feedback`, { helpful });
      setConnection(data.data);
    } catch (err) { console.error('Failed to submit feedback:', err); }
  };

  // ── Loading / Error states ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-alice-blue">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-2 border-blue-eyes border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400 animate-pulse">Opening the bridge…</p>
        </div>
      </div>
    );
  }

  if (!connection) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-alice-blue px-4">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Connection not found</p>
          <Link to="/connections" className="text-blue-eyes hover:underline">← Back to connections</Link>
        </div>
      </div>
    );
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const getId = (v) => {
    if (!v) return null;
    if (typeof v === 'string') return v;
    return (v._id || v.id)?.toString?.() || null;
  };
  const currentUserId = getId(user?._id || user?.id || user);
  const seeker        = connection.seekerId   || connection.user1Id;
  const sage          = connection.sageId     || connection.user2Id;
  const isSeeker      = getId(seeker) === currentUserId;
  const otherUser     = isSeeker ? sage : seeker;
  const myEntry       = isSeeker ? connection.problemEntryId   : connection.solutionEntryId;
  const theirEntry    = isSeeker ? connection.solutionEntryId  : connection.problemEntryId;
  const otherName     = otherUser?.displayName || 'Anonymous';
  const matchPct      = Math.round((connection.similarityScore || 0.9) * 100);

  // ── Context Panel content (shared between desktop sidebar and mobile sheet)
  const ContextPanel = () => (
    <div className="flex-1 overflow-y-auto p-4 space-y-5">
      {/* My Entry */}
      <div>
        <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-2">Your Entry</p>
        <div className="rounded-xl p-4" style={{ background: 'rgba(237,242,251,0.7)', border: '1px solid rgba(215,227,252,0.5)' }}>
          <p className="font-journal text-sm text-gray-700 line-clamp-6">
            {myEntry?.content || 'Entry content'}
          </p>
          {myEntry?.themes?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {myEntry.themes.slice(0, 3).map(t => (
                <span key={t} className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: 'rgba(215,227,252,0.7)', color: '#4B6FAA' }}>{t}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Their Entry */}
      <div>
        <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-2">
          {isSeeker ? 'Their Insight' : 'Their Challenge'}
        </p>
        <div className="rounded-xl p-4" style={{ background: 'rgba(214,234,223,0.4)', border: '1px solid rgba(157,196,176,0.35)' }}>
          <p className="font-journal text-sm text-gray-700 line-clamp-6">
            {theirEntry?.content || 'Entry content'}
          </p>
          {theirEntry?.themes?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {theirEntry.themes.slice(0, 3).map(t => (
                <span key={t} className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: 'rgba(214,234,223,0.6)', color: '#2d6a4f' }}>{t}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bridge message */}
      <div className="rounded-xl p-4" style={{ background: 'rgba(215,227,252,0.45)', border: '1px solid rgba(171,196,255,0.35)' }}>
        <p className="font-journal text-sm text-gray-600 italic">&ldquo;{connection.bridgeMessage}&rdquo;</p>
        <p className="text-xs text-gray-400 mt-2 font-system">— The Guide</p>
      </div>

      {/* Feedback */}
      {isSeeker && connection.status === 'accepted' && connection.markedHelpful === null && (
        <div className="rounded-xl p-4 bg-white/50 border border-lavender-web">
          <p className="text-sm font-medium text-gray-700 mb-3">Was this connection helpful?</p>
          <div className="flex gap-2">
            <button onClick={() => handleMarkHelpful(true)}  className="btn-success flex-1 text-sm">✓ Yes!</button>
            <button onClick={() => handleMarkHelpful(false)} className="btn-ghost flex-1 text-sm border border-gray-200">Not really</button>
          </div>
        </div>
      )}

      {/* Resolved badge */}
      {connection.status === 'resolved' && (
        <div className="rounded-xl p-4 text-center" style={{ background: '#D6EADF' }}>
          <span className="text-green-700 font-medium text-sm">✓ Marked as Helpful</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="h-[calc(100dvh-56px)] lg:h-screen flex flex-col lg:flex-row bg-alice-blue">

      {/* ── Desktop Context Panel (left sidebar) ────────────────────────── */}
      <div className="hidden lg:flex w-80 xl:w-96 bg-white border-r border-lavender-web flex-col flex-shrink-0">
        <div className="p-4 border-b border-lavender-web flex items-center gap-3">
          <Link to="/connections" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1.5">
            <span>←</span><span>Back</span>
          </Link>
          <h2 className="font-semibold text-gray-800 text-sm ml-1">Context</h2>
        </div>
        <ContextPanel />
      </div>

      {/* ── Chat Panel ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Chat header */}
        <div className="p-3 sm:p-4 border-b border-lavender-web bg-white flex items-center gap-3">
          {/* Mobile: back + context toggle */}
          <Link to="/connections" className="lg:hidden touch-target text-gray-500 hover:text-gray-700 rounded-xl -ml-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </Link>

          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-eyes to-lavender-web flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-semibold text-white">{otherName.charAt(0).toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-gray-800 text-sm truncate">{otherName}</h1>
            <p className="text-xs text-gray-500">{matchPct}% resonance</p>
          </div>

          {/* Mobile: show context sheet button */}
          <button
            onClick={() => setShowContext(true)}
            className="lg:hidden touch-target rounded-xl text-sm font-medium transition-all"
            style={{ background: 'rgba(215,227,252,0.5)', border: '1px solid rgba(171,196,255,0.35)', color: '#4B6FAA', padding: '0 12px' }}
            aria-label="View context"
          >
            Context
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
          {messages.map(msg => (
            <MessageBubble
              key={msg._id}
              message={msg}
              isOwn={msg.senderId?._id === user?._id || msg.senderId === user?._id}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Message input */}
        <form
          onSubmit={handleSend}
          className="p-3 sm:p-4 bg-white border-t border-lavender-web"
          style={{ paddingBottom: `calc(0.75rem + env(safe-area-inset-bottom))` }}
        >
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message…"
              className="flex-1 px-4 py-3 border border-lavender-web rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-eyes text-base bg-white/70"
              style={{ fontSize: '1rem' }}  /* prevents iOS zoom */
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || sending}
              className="btn-primary px-4 sm:px-6 disabled:opacity-50 flex-shrink-0"
            >
              {sending ? '…' : 'Send'}
            </button>
          </div>
        </form>
      </div>

      {/* ── Mobile Context Bottom Sheet ──────────────────────────────────── */}
      {showContext && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-40 lg:hidden"
            style={{ background: 'rgba(31,38,135,0.2)', backdropFilter: 'blur(3px)' }}
            onClick={() => setShowContext(false)}
            aria-hidden="true"
          />
          {/* Sheet */}
          <div
            className="bottom-sheet lg:hidden bg-white z-50"
            role="dialog"
            aria-label="Connection context"
          >
            {/* Handle bar */}
            <div className="bottom-sheet-handle" />

            {/* Sheet header */}
            <div className="flex items-center justify-between px-5 pb-3 border-b border-lavender-web">
              <h3 className="font-semibold text-gray-800">Context</h3>
              <button
                onClick={() => setShowContext(false)}
                className="touch-target rounded-xl text-gray-400 hover:text-gray-700"
                aria-label="Close context"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Context content reused */}
            <ContextPanel />
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Message Bubble
// ─────────────────────────────────────────────────────────────────────────────
function MessageBubble({ message, isOwn }) {
  if (message.type === 'ai_wingman' || message.type === 'system') {
    return (
      <div className="flex justify-center">
        <div
          className="max-w-[90%] sm:max-w-md rounded-2xl px-4 py-2.5 text-center"
          style={{ background: 'rgba(215,227,252,0.5)', border: '1px solid rgba(171,196,255,0.3)' }}
        >
          <p className="text-sm text-gray-600 italic font-journal">{message.content}</p>
          <p className="text-xs text-gray-400 mt-1 font-system">— {message.type === 'ai_wingman' ? 'Social Wingman' : 'System'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-3 ${
          isOwn
            ? 'bg-blue-eyes text-white'
            : 'bg-white border border-lavender-web text-gray-700'
        }`}
      >
        {!isOwn && message.senderId?.displayName && (
          <p className="text-xs opacity-60 mb-1 font-system">{message.senderId.displayName}</p>
        )}
        <p className="text-sm leading-relaxed">{message.content}</p>
        <p className={`text-[10px] mt-1.5 ${isOwn ? 'opacity-60' : 'text-gray-400'}`}>
          {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
        </p>
      </div>
    </div>
  );
}
