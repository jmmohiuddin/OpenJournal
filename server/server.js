import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import app from './app.js';
import connectDB from './config/db.js';
import { initSocket } from './services/socketService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from server/.env first, then fall back to root .env for local workspace runs.
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = createServer(app);

// Initialize Socket.io
initSocket(server);

// Connect to database and start server
const startServer = async () => {
  try {
    await connectDB();
    
    server.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════════╗
║                                                   ║
║   🌟 Open Journal Server Running                  ║
║                                                   ║
║   📍 Port: ${PORT}                                  ║
║   🌐 API:  http://localhost:${PORT}/api             ║
║   💊 Health: http://localhost:${PORT}/api/health    ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
