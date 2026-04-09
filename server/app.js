import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import entryRoutes from './routes/entries.js';
import connectionRoutes from './routes/connections.js';
import aiRoutes from './routes/ai.js';
import circleRoutes from './routes/circles.js';
import matchingRoutes from './routes/matching.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { initializeAI } from './services/aiService.js';

const app = express();

// Initialize AI backend
initializeAI().catch(err => console.error('AI init error:', err));

// CORS configuration - allow both localhost and public tunnel
const allowedOrigins = [
  'http://localhost:5173',
  'https://bring-acer-replaced-erik.trycloudflare.com',
  process.env.CLIENT_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV 
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/entries', entryRoutes);
app.use('/api/connections', connectionRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/circles', circleRoutes);
app.use('/api/matching', matchingRoutes);

// Error handling
app.use(notFound);
app.use(errorHandler);

export default app;
