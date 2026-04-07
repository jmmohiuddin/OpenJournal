import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { formatDistanceToNow } from 'date-fns';
import { 
  UserGroupIcon, 
  ArrowLeftIcon,
  PaperAirplaneIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline';
import api from '../services/api';
import socket from '../services/socket';

export default function CircleViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useSelector(state => state.auth);
  const [circle, setCircle] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadCircle();
    loadMessages();

    // Join socket room
    socket.emit('join_circle', id);

    // Listen for new messages
    socket.on('circle_message', (data) => {
      if (data.circleId === id) {
        setMessages(prev => [...prev, data.message]);
      }
    });

    socket.on('circle_member_joined', (data) => {
      if (data.circleId === id) {
        // Refresh circle data
        loadCircle();
      }
    });

    return () => {
      socket.emit('leave_circle', id);
      socket.off('circle_message');
      socket.off('circle_member_joined');
    };
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadCircle = async () => {
    try {
      const { data } = await api.get(`/circles/${id}`);
      setCircle(data.data);
      
      if (!data.data.isMember) {
        navigate('/circles');
      }
    } catch (err) {
      console.error('Failed to load circle:', err);
      navigate('/circles');
    }
  };

  const loadMessages = async () => {
    try {
      const { data } = await api.get(`/circles/${id}/messages`);
      setMessages(data.data || []);
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      const { data } = await api.post(`/circles/${id}/messages`, {
        content: newMessage.trim()
      });
      setMessages(prev => [...prev, data.data]);
      setNewMessage('');
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleLeave = async () => {
    if (!confirm('Are you sure you want to leave this circle?')) return;
    
    try {
      await api.post(`/circles/${id}/leave`);
      navigate('/circles');
    } catch (err) {
      console.error('Failed to leave circle:', err);
    }
  };

  if (loading || !circle) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-eyes border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-alice-blue">
      {/* Header */}
      <div className="bg-white border-b border-lavender-web px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/circles" className="text-gray-500 hover:text-gray-700">
              <ArrowLeftIcon className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-gray-800">{circle.name}</h1>
              <p className="text-sm text-gray-500">{circle.topic}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <UserGroupIcon className="w-5 h-5" />
              {circle.members?.length || 0} members
            </div>
            <button
              onClick={handleLeave}
              className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition"
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5" />
              Leave
            </button>
          </div>
        </div>
      </div>

      {/* Members sidebar (collapsed on mobile) */}
      <div className="flex flex-1 overflow-hidden">
        {/* Messages area */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((msg, index) => (
              <MessageBubble 
                key={msg._id || index} 
                message={msg}
                isOwn={msg.senderId?._id === user?.id || msg.senderId === user?.id}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="bg-white border-t border-lavender-web p-4">
            <div className="flex gap-3">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Share your thoughts..."
                className="flex-1 px-4 py-3 border border-lavender-web rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-eyes"
              />
              <button
                onClick={handleSend}
                disabled={!newMessage.trim() || sending}
                className="px-4 py-3 bg-blue-eyes text-white rounded-xl hover:bg-opacity-90 disabled:opacity-50 transition"
              >
                <PaperAirplaneIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Members panel */}
        <div className="hidden md:block w-64 bg-white border-l border-lavender-web p-4">
          <h3 className="font-medium text-gray-700 mb-4">Members</h3>
          <div className="space-y-3">
            {circle.members?.map(member => (
              <div key={member.userId._id} className="flex items-center gap-3">
                {member.userId.photoURL ? (
                  <img
                    src={member.userId.photoURL}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-lavender-web flex items-center justify-center">
                    <span className="text-sm font-medium text-gray-600">
                      {member.userId.displayName?.[0]}
                    </span>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    {member.userId.displayName}
                  </p>
                  {member.role === 'initiator' && (
                    <span className="text-xs text-gray-500">Initiator</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message, isOwn }) {
  const isSystem = ['ai_facilitator', 'system', 'join', 'leave'].includes(message.type);

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="max-w-md bg-lavender-web/50 rounded-lg px-4 py-2">
          <p className="text-sm text-gray-600 italic text-center">
            {message.content}
          </p>
          {message.type === 'ai_facilitator' && (
            <p className="text-xs text-gray-500 mt-1 text-center">— Facilitator</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[70%] ${isOwn ? '' : 'flex gap-3'}`}>
        {!isOwn && (
          <div className="flex-shrink-0">
            {message.senderId?.photoURL ? (
              <img
                src={message.senderId.photoURL}
                alt=""
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-lavender-web flex items-center justify-center">
                <span className="text-sm font-medium text-gray-600">
                  {message.senderId?.displayName?.[0]}
                </span>
              </div>
            )}
          </div>
        )}
        <div className={`rounded-2xl px-4 py-3 ${
          isOwn 
            ? 'bg-blue-eyes text-white' 
            : 'bg-white border border-lavender-web text-gray-700'
        }`}>
          {!isOwn && (
            <p className="text-xs text-gray-500 mb-1">
              {message.senderId?.displayName}
            </p>
          )}
          <p className="text-sm">{message.content}</p>
          <p className={`text-xs mt-1 ${isOwn ? 'opacity-70' : 'text-gray-400'}`}>
            {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
          </p>
        </div>
      </div>
    </div>
  );
}
