// ═══════════════════════════════════════════════════
//  Database — SQLite via better-sqlite3
//  File is auto-created at DB_PATH on first run
// ═══════════════════════════════════════════════════

const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');

const DB_PATH = process.env.DB_PATH || './db/alerts.db';

// Ensure the db directory exists
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

let db;

// ─── Init ─────────────────────────────────────────
function initDB() {
  db = new Database(DB_PATH);

  // Enable WAL mode for better performance
  db.pragma('journal_mode = WAL');

  // Create alerts table
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
      phone       TEXT    NOT NULL,
      sms_status  TEXT    DEFAULT 'pending',
      sms_message TEXT,
      ip_address  TEXT,
      created_at  TEXT    DEFAULT (datetime('now', 'localtime'))
    );
  `);

  console.log(`✅ SQLite database ready at ${DB_PATH}`);
  return Promise.resolve();
}

// ─── Save an alert ────────────────────────────────
function saveAlert({ type, boatId, passenger, paxCount, vesselType, lat, lon, phone, smsStatus, smsMessage, ipAddress }) {
  const stmt = db.prepare(`
    INSERT INTO alerts
      (type, boat_id, passenger, pax_count, vessel_type, latitude, longitude, phone, sms_status, sms_message, ip_address)
    VALUES
      (@type, @boatId, @passenger, @paxCount, @vesselType, @lat, @lon, @phone, @smsStatus, @smsMessage, @ipAddress)
  `);

  const result = stmt.run({ type, boatId, passenger, paxCount, vesselType, lat, lon, phone, smsStatus, smsMessage, ipAddress });
  return result.lastInsertRowid;
}

// ─── Update SMS status after sending ─────────────
function updateSmsStatus(id, status) {
  db.prepare(`UPDATE alerts SET sms_status = ? WHERE id = ?`).run(status, id);
}

// ─── Get all alerts (newest first) ───────────────
function getAlerts({ limit = 50, offset = 0, type = null } = {}) {
  if (type) {
    return db.prepare(`
      SELECT * FROM alerts WHERE type = ? ORDER BY id DESC LIMIT ? OFFSET ?
    `).all(type, limit, offset);
  }
  return db.prepare(`
    SELECT * FROM alerts ORDER BY id DESC LIMIT ? OFFSET ?
  `).all(limit, offset);
}

// ─── Get a single alert by ID ─────────────────────
function getAlertById(id) {
  return db.prepare(`SELECT * FROM alerts WHERE id = ?`).get(id);
}

// ─── Stats ────────────────────────────────────────
function getStats() {
  const total   = db.prepare(`SELECT COUNT(*) as count FROM alerts`).get();
  const byType  = db.prepare(`SELECT type, COUNT(*) as count FROM alerts GROUP BY type`).all();
  const today   = db.prepare(`SELECT COUNT(*) as count FROM alerts WHERE date(created_at) = date('now', 'localtime')`).get();
  return { total: total.count, today: today.count, byType };
}

module.exports = { initDB, saveAlert, updateSmsStatus, getAlerts, getAlertById, getStats };
