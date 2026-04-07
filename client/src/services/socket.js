import { io } from 'socket.io-client';
import { store } from '../store';

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5001';

const socket = io(SOCKET_URL, {
  autoConnect: false,
  auth: {}
});

// Connect with auth token
export const connectSocket = () => {
  const token = store.getState().auth.token;
  if (token) {
    socket.auth = { token };
    socket.connect();
  }
};

// Disconnect
export const disconnectSocket = () => {
  socket.disconnect();
};

// Listen for connection events
socket.on('connect', () => {
  console.log('Socket connected:', socket.id);
});

socket.on('disconnect', (reason) => {
  console.log('Socket disconnected:', reason);
});

socket.on('connect_error', (error) => {
  console.error('Socket connection error:', error.message);
});

export default socket;
