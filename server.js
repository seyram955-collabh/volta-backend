// ═══════════════════════════════════════════════════
//  Volta Lake Emergency Response System — Server
//  Single file, no external auth dependencies
// ═══════════════════════════════════════════════════
 
require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const morgan    = require('morgan');
const jwt       = require('jsonwebtoken');
const crypto    = require('crypto');
const Database  = require('better-sqlite3');
const path      = require('path');
const fs        = require('fs');
 
const app  = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'volta-lake-secret-2026';
 
// ─── Database setup ───────────────────────────────
const DB_DIR = './db';
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
 
const db = new Database('./db/alerts.db');
db.pragma('journal_mode = WAL');
 
db.exec(`
  CREATE TABLE IF NOT EXISTS alerts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    type        TEXT    NOT NULL,
    boat_id     TEXT    NOT NULL,
    passenger   TEXT    NOT NULL,
    pax_count   TEXT    DEFAULT 'Unknown',
    vessel_type TEXT    DEFAULT 'Unknown',
    latitude    REAL    NOT NULL,
    longitude   REAL    NOT NULL,
    phone       TEXT,
    sms_status  TEXT    DEFAULT 'pending',
    created_at  TEXT    DEFAULT (datetime('now','localtime'))
  );
 
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT    NOT NULL UNIQUE,
    password   TEXT    NOT NULL,
    role       TEXT    NOT NULL DEFAULT 'responder',
    full_name  TEXT,
    active     INTEGER DEFAULT 1,
    created_at TEXT    DEFAULT (datetime('now','localtime')),
    last_login TEXT
  );
`);
 
// ─── Seed default users ───────────────────────────
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}
 
function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const attempt = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(attempt, 'hex'));
  } catch { return false; }
}
 
const userCount = db.prepare('SELECT COUNT(*) as n FROM users').get();
if (userCount.n === 0) {
  db.prepare('INSERT INTO users (username, password, role, full_name) VALUES (?, ?, ?, ?)').run(
    'admin', hashPassword('VoltaAdmin2026!'), 'admin', 'System Admin'
  );
  db.prepare('INSERT INTO users (username, password, role, full_name) VALUES (?, ?, ?, ?)').run(
    'responder', hashPassword('VoltaRespond2026!'), 'responder', 'Field Responder'
  );
  console.log('');
  console.log('   DEFAULT ACCOUNTS:');
  console.log('   admin     / VoltaAdmin2026!');
  console.log('   responder / VoltaRespond2026!');
  console.log('');
}
 
// ─── Middleware ───────────────────────────────────
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(cors({ origin: '*', methods: ['GET','POST','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));
app.options('*', cors());
 
// ─── Auth helper ──────────────────────────────────
function requireAuth(req, res, next) {
  const header = req.headers['authorization'];
  const token  = header && header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ success: false, error: 'Authentication required' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Session expired. Please log in again.', expired: true });
  }
}
 
// ─── ROUTES ───────────────────────────────────────
 
// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', system: 'Volta Lake Emergency Response System', timestamp: new Date().toISOString() });
});
 
// Login
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ success: false, error: 'Username and password required.' });
 
  const user = db.prepare('SELECT * FROM users WHERE username = ? AND active = 1').get(username.trim().toLowerCase());
  if (!user || !verifyPassword(password, user.password)) {
    return res.status(401).json({ success: false, error: 'Invalid username or password.' });
  }
 
  db.prepare("UPDATE users SET last_login = datetime('now','localtime') WHERE id = ?").run(user.id);
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
 
  console.log(`Login: ${user.username} (${user.role})`);
  res.json({ success: true, token, user: { id: user.id, username: user.username, role: user.role }, expiresIn: '8h' });
});
 
 
// Register new responder account
app.post('/api/auth/register', (req, res) => {
  const { username, password, fullName } = req.body;
 
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username and password are required.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ success: false, error: 'Password must be at least 6 characters.' });
  }
  if (username.length < 3) {
    return res.status(400).json({ success: false, error: 'Username must be at least 3 characters.' });
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return res.status(400).json({ success: false, error: 'Username can only contain letters, numbers and underscores.' });
  }
 
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username.toLowerCase());
  if (existing) {
    return res.status(409).json({ success: false, error: 'Username already taken. Please choose another.' });
  }
 
  const hash = hashPassword(password);
  const result = db.prepare(
    'INSERT INTO users (username, password, role, full_name) VALUES (?, ?, ?, ?)'
  ).run(username.toLowerCase(), hash, 'responder', fullName || username);
 
  const token = jwt.sign(
    { id: result.lastInsertRowid, username: username.toLowerCase(), role: 'responder' },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
 
  console.log('New account: ' + username + ' (responder)');
 
  res.status(201).json({
    success: true,
    token,
    user: { id: result.lastInsertRowid, username: username.toLowerCase(), role: 'responder' },
    expiresIn: '8h'
  });
});
 
// Get current user
app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ success: true, user: req.user });
});
 
// Logout
app.post('/api/auth/logout', requireAuth, (req, res) => {
  console.log(`Logout: ${req.user.username}`);
  res.json({ success: true });
});
 
// Change password
app.post('/api/auth/change-password', requireAuth, (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) return res.status(400).json({ success: false, error: 'Password must be 8+ characters.' });
  const hash = hashPassword(newPassword);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, req.user.id);
  res.json({ success: true, message: 'Password updated.' });
});
 
// Send alert
app.post('/api/alert/send', requireAuth, (req, res) => {
  const { type, boatId, passenger, paxCount = 'Unknown', vesselType = 'Unknown', lat, lon, phone = '' } = req.body;
 
  if (!type || !boatId || !passenger || lat === undefined || lon === undefined) {
    return res.status(400).json({ success: false, error: 'Missing required fields: type, boatId, passenger, lat, lon' });
  }
 
  const validTypes = ['SOS EMERGENCY', 'FIRE ALERT', 'MEDICAL EMERGENCY', 'BOAT SINKING ALERT'];
  if (!validTypes.includes(type)) return res.status(400).json({ success: false, error: 'Invalid alert type' });
 
  const result = db.prepare(`
    INSERT INTO alerts (type, boat_id, passenger, pax_count, vessel_type, latitude, longitude, phone, sms_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(type, boatId, passenger, paxCount, vesselType, parseFloat(lat), parseFloat(lon), phone, 'pending');
 
  console.log(`Alert #${result.lastInsertRowid}: ${type} — Boat ${boatId}`);
 
  res.json({
    success: true,
    alertId: result.lastInsertRowid,
    type, boatId, passenger, paxCount, vesselType,
    lat: parseFloat(lat), lon: parseFloat(lon),
    sms: { sent: false, message: 'SMS integration pending' },
    timestamp: new Date().toISOString()
  });
});
 
// Get alert history
app.get('/api/alert/history', requireAuth, (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = parseInt(req.query.offset) || 0;
  const alerts = db.prepare('SELECT * FROM alerts ORDER BY id DESC LIMIT ? OFFSET ?').all(limit, offset);
  res.json({ success: true, count: alerts.length, alerts });
});
 
// Get stats
app.get('/api/alert/stats', requireAuth, (req, res) => {
  const total  = db.prepare('SELECT COUNT(*) as count FROM alerts').get();
  const today  = db.prepare("SELECT COUNT(*) as count FROM alerts WHERE date(created_at) = date('now','localtime')").get();
  const byType = db.prepare('SELECT type, COUNT(*) as count FROM alerts GROUP BY type').all();
  res.json({ success: true, total: total.count, today: today.count, byType });
});
 
// Get single alert
app.get('/api/alert/:id', requireAuth, (req, res) => {
  const alert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(parseInt(req.params.id));
  if (!alert) return res.status(404).json({ success: false, error: 'Alert not found' });
  res.json({ success: true, alert });
});
 
// 404
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});
 
// ─── Start ────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('🚤 Volta Lake Emergency Response System');
  console.log(`   Running on port ${PORT}`);
  console.log(`   Health: /health`);
  console.log('');
});
 
