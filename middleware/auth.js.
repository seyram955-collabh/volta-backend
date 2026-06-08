// ═══════════════════════════════════════════════════
//  Auth Middleware — JWT-based session management
//  Protects /api/alert/send and /api/alert/history
// ═══════════════════════════════════════════════════

const jwt = require('jsonwebtoken');

const JWT_SECRET  = process.env.JWT_SECRET  || 'change-this-secret-in-production';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '8h';

// ─── Roles ────────────────────────────────────────
// 'responder' — can send alerts (fishermen / field staff)
// 'admin'     — can send alerts AND view history/stats
const ROLE_PERMISSIONS = {
  responder: ['send'],
  admin:     ['send', 'history', 'stats', 'read'],
};

// ─── Generate token ───────────────────────────────
function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

// ─── Verify token middleware ──────────────────────
function requireAuth(req, res, next) {
  const header = req.headers['authorization'];
  const token  = header && header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required. Please log in.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Session expired. Please log in again.', expired: true });
    }
    return res.status(401).json({ success: false, error: 'Invalid token. Please log in again.' });
  }
}

// ─── Role check middleware ────────────────────────
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, error: 'Not authenticated' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Required role: ${roles.join(' or ')}. Your role: ${req.user.role}`
      });
    }
    next();
  };
}

module.exports = { generateToken, requireAuth, requireRole, JWT_SECRET, JWT_EXPIRES };
