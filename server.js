// ═══════════════════════════════════════════════════
//  Volta Lake Emergency Response System — Server
// ═══════════════════════════════════════════════════
 
require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const helmet   = require('helmet');
const morgan   = require('morgan');
const rateLimit = require('express-rate-limit');
 
const alertRoutes = require('./routes/alert');
const authRoutes  = require('./routes/auth');
const { initDB }  = require('./db/database');
const { initUsersTable } = require('./db/users');
 
const app  = express();
const PORT = process.env.PORT || 3000;
 
// ─── Security middleware ──────────────────────────
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
 
// CORS — fully open for now
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
 
// Handle preflight
app.options('*', cors());
 
// ─── Rate limiting ────────────────────────────────
// Max 10 alerts per IP per 15 minutes (prevents spam)
const alertLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'Too many alerts sent. Please wait before trying again.' },
});
app.use('/api/alert', alertLimiter);
 
// ─── Routes ───────────────────────────────────────
app.use('/api/auth',  authRoutes);
app.use('/api/alert', alertRoutes);
 
// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    system: 'Volta Lake Emergency Response System',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});
 
// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});
 
// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});
 
// ─── Start ────────────────────────────────────────
async function start() {
  try {
    await initDB();
    initUsersTable();
    console.log('✅ Database initialized');
 
    app.listen(PORT, () => {
      console.log('');
      console.log('🚤 ═══════════════════════════════════════════');
      console.log('   Volta Lake Emergency Response System');
      console.log(`   Server running on http://localhost:${PORT}`);
      console.log(`   Environment: ${process.env.NODE_ENV}`);
      console.log('   ─────────────────────────────────────────');
      console.log(`   POST /api/alert/send     → Send emergency alert`);
      console.log(`   GET  /api/alert/history  → Fetch alert history`);
      console.log(`   GET  /health             → Server health check`);
      console.log('🚤 ═══════════════════════════════════════════');
      console.log('');
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}
 
start();
