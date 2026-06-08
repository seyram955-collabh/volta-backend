// ═══════════════════════════════════════════════════
//  User Database — stored in the same SQLite DB
// ═══════════════════════════════════════════════════

const Database = require('better-sqlite3');
const crypto   = require('crypto');
const path     = require('path');

const DB_PATH = process.env.DB_PATH || './db/alerts.db';
let db;

function getUserDB() {
  if (!db) db = new Database(DB_PATH);
  return db;
}

// ─── Init users table ─────────────────────────────
function initUsersTable() {
  const d = getUserDB();
  d.exec(`
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

  // Seed default accounts if none exist
  const count = d.prepare('SELECT COUNT(*) as n FROM users').get();
  if (count.n === 0) {
    console.log('👤 Seeding default users...');
    createUser({ username: 'admin',     password: 'VoltaAdmin2026!',  role: 'admin',     fullName: 'System Admin' });
    createUser({ username: 'responder', password: 'VoltaRespond2026!',role: 'responder', fullName: 'Field Responder' });
    console.log('');
    console.log('   ┌─────────────────────────────────────────┐');
    console.log('   │  DEFAULT ACCOUNTS (change in production) │');
    console.log('   │  admin     / VoltaAdmin2026!             │');
    console.log('   │  responder / VoltaRespond2026!           │');
    console.log('   └─────────────────────────────────────────┘');
    console.log('');
  }
}

// ─── Hash password ────────────────────────────────
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const attempt = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(attempt, 'hex'));
}

// ─── Create user ──────────────────────────────────
function createUser({ username, password, role = 'responder', fullName = '' }) {
  const d    = getUserDB();
  const hash = hashPassword(password);
  try {
    d.prepare(`
      INSERT INTO users (username, password, role, full_name)
      VALUES (?, ?, ?, ?)
    `).run(username, hash, role, fullName);
    return { success: true };
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return { success: false, error: 'Username already exists' };
    }
    throw err;
  }
}

// ─── Find user by username ────────────────────────
function findUser(username) {
  return getUserDB().prepare('SELECT * FROM users WHERE username = ? AND active = 1').get(username);
}

// ─── Validate login ───────────────────────────────
function validateLogin(username, password) {
  const user = findUser(username);
  if (!user) return null;
  if (!verifyPassword(password, user.password)) return null;

  // Update last login timestamp
  getUserDB().prepare(`UPDATE users SET last_login = datetime('now','localtime') WHERE id = ?`).run(user.id);

  return { id: user.id, username: user.username, role: user.role, fullName: user.full_name };
}

// ─── Get all users (admin only) ───────────────────
function getAllUsers() {
  return getUserDB().prepare(
    'SELECT id, username, role, full_name, active, created_at, last_login FROM users ORDER BY id'
  ).all();
}

// ─── Update password ──────────────────────────────
function updatePassword(userId, newPassword) {
  const hash = hashPassword(newPassword);
  getUserDB().prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, userId);
}

module.exports = { initUsersTable, createUser, findUser, validateLogin, getAllUsers, updatePassword };
