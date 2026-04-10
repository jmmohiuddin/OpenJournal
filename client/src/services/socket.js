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
  const explicit        = import.meta.env.VITE_API_URL?.trim();
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
  auth:        {}
});

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/** Connect with the stored JWT token */
export const connectSocket = () => {
  const token = store.getState().auth.token;
  if (token) {
    socket.auth = { token };
    socket.connect();
  }
};

/** Disconnect the socket */
export const disconnectSocket = () => {
  socket.disconnect();
};

// ---------------------------------------------------------------------------
// Event subscription helpers
//
// These return an unsubscribe function so components can clean up in
// useEffect return callbacks without storing the raw listener reference.
// ---------------------------------------------------------------------------

/**
 * Subscribe to incoming `resonance` events (new pending connection).
 * @param {Function} callback - called with the full resonance payload
 * @returns {Function} unsubscribe
 */
export const onResonance = (callback) => {
  socket.on('resonance', callback);
  return () => socket.off('resonance', callback);
};

/**
 * Subscribe to `connection_enriched` events (AI bridge message is ready).
 * @param {Function} callback - called with { connectionId, bridgeMessage, summary }
 * @returns {Function} unsubscribe
 */
export const onConnectionEnriched = (callback) => {
  socket.on('connection_enriched', callback);
  return () => socket.off('connection_enriched', callback);
};

/**
 * Subscribe to `connection_accepted` events.
 * @param {Function} callback
 * @returns {Function} unsubscribe
 */
export const onConnectionAccepted = (callback) => {
  socket.on('connection_accepted', callback);
  return () => socket.off('connection_accepted', callback);
};

// ---------------------------------------------------------------------------
// Core lifecycle logs
// ---------------------------------------------------------------------------
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
