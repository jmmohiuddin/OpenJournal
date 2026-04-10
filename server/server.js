import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import app from './app.js';
import connectDB from './config/db.js';
import { initSocket } from './services/socketService.js';
import { runPassiveMatching } from './services/passiveMatchingService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Load env from server/.env first, then fall back to root .env for local workspace runs.
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const PORT = process.env.PORT || 5000;

// How often (ms) to run the background global matching sweep.
// Default: every 10 minutes. Override with env var MATCH_INTERVAL_MS.
const MATCH_INTERVAL_MS = parseInt(process.env.MATCH_INTERVAL_MS || '600000', 10);

/**
 * Run one global passive-matching sweep.
 * All errors are caught so they never crash the scheduler loop.
 */
async function runGlobalMatchingSweep() {
  try {
    console.log('⏳ Background matching sweep started...');
    const result = await runPassiveMatching({ limit: 500 });
    console.log(
      `✅ Background matching sweep done: ` +
      `${result.entriesProcessed} entries scanned, ` +
      `${result.connectionsCreated} connections created`
    );
  } catch (err) {
    console.error('❌ Background matching sweep error:', err.message);
  }
}

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

    // --- Background passive matching ---
    // Run once immediately on startup so existing users/entries get matched
    // without waiting for the first interval tick.
    // Small delay to let DB indexes settle and avoid racing with boot queries.
    setTimeout(runGlobalMatchingSweep, 5000);

    // Then repeat on the configured interval.
    setInterval(runGlobalMatchingSweep, MATCH_INTERVAL_MS);
    console.log(`🔄 Background matching scheduler started (every ${MATCH_INTERVAL_MS / 1000}s)`);

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
