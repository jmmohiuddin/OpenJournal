import axios from 'axios';

function resolveApiUrl() {
  const explicit = import.meta.env.VITE_API_URL;
  if (explicit) return explicit;

  // In production, force explicit env to avoid accidental localhost calls.
  if (import.meta.env.PROD) {
    return '/api';
  }

  return 'http://localhost:5000/api';
}

const API_URL = resolveApiUrl();

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
