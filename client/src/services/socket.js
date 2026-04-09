import { io } from 'socket.io-client';
import { store } from '../store';

const DEPLOYED_SOCKET_URL = 'https://open-journal-server.vercel.app';

function isResolvableHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && !!parsed.hostname;
  } catch (_) {
    return false;
  }
}

function isEphemeralTunnelUrl(value) {
  try {
    const { hostname } = new URL(value);
    return (
      hostname.endsWith('trycloudflare.com') ||
      hostname.endsWith('ngrok-free.app') ||
      hostname.endsWith('ngrok.io')
    );
  } catch (_) {
    return false;
  }
}

function resolveSocketUrl() {
  const explicit = import.meta.env.VITE_API_URL?.trim();
  const allowTunnelInDev = import.meta.env.VITE_ALLOW_TUNNEL_URL === 'true';
  if (explicit && isResolvableHttpUrl(explicit)) {
    if (import.meta.env.PROD || allowTunnelInDev || !isEphemeralTunnelUrl(explicit)) {
      return explicit.replace('/api', '');
    }
  }
  if (import.meta.env.PROD) return DEPLOYED_SOCKET_URL;
  return 'http://localhost:5001';
}

const SOCKET_URL = resolveSocketUrl();

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
