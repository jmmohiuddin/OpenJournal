import { useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useSelector, useDispatch } from 'react-redux';
import { addResonance } from '../store/connectionsSlice';

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

export function useSocket() {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const { token } = useSelector(state => state.auth);
  const dispatch = useDispatch();

  useEffect(() => {
    if (!token) return;

    const newSocket = io(SOCKET_URL, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    newSocket.on('connect', () => {
      console.log('Socket connected');
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
      setConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
    });

    // Listen for resonance notifications
    newSocket.on('resonance', (data) => {
      dispatch(addResonance(data));
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [token, dispatch]);

  const joinChat = useCallback((connectionId) => {
    if (socket) {
      socket.emit('join_chat', connectionId);
    }
  }, [socket]);

  const sendMessage = useCallback((connectionId, content) => {
    if (socket) {
      socket.emit('send_message', { connectionId, content });
    }
  }, [socket]);

  const startTyping = useCallback((connectionId) => {
    if (socket) {
      socket.emit('typing', connectionId);
    }
  }, [socket]);

  const stopTyping = useCallback((connectionId) => {
    if (socket) {
      socket.emit('stop_typing', connectionId);
    }
  }, [socket]);

  return { 
    socket, 
    connected, 
    joinChat, 
    sendMessage,
    startTyping,
    stopTyping
  };
}
