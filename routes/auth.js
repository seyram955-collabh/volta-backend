// ═══════════════════════════════════════════════════
//  Auth Routes
//  POST /api/auth/login    → Get JWT token
//  GET  /api/auth/me       → Get current user info
//  POST /api/auth/logout   → Client-side token removal
//  POST /api/auth/change-password → Update password
// ═══════════════════════════════════════════════════

const express  = require('express');
const router   = express.Router();
const rateLimit = require('express-rate-limit');

const { generateToken, requireAuth } = require('../middleware/auth');
const { validateLogin, updatePassword, getAllUsers, createUser } = require('../db/users');

// Strict rate limit on login — 10 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'Too many login attempts. Please wait 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── POST /api/auth/login ─────────────────────────
router.post('/login', loginLimiter, (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username and password are required.' });
  }

  const user = validateLogin(username.trim().toLowerCase(), password);

  if (!user) {
    // Deliberate vague message — don't reveal which field is wrong
    return res.status(401).json({ success: false, error: 'Invalid username or password.' });
  }

  const token = generateToken(user);

  console.log(`🔐 Login: ${user.username} (${user.role}) from ${req.ip}`);

  res.json({
    success: true,
    token,
    user: {
      id:       user.id,
      username: user.username,
      role:     user.role,
      fullName: user.fullName,
    },
    expiresIn: process.env.JWT_EXPIRES || '8h',
  });
});

// ─── GET /api/auth/me ─────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  res.json({
    success: true,
    user: {
      id:       req.user.id,
      username: req.user.username,
      role:     req.user.role,
    },
  });
});

// ─── POST /api/auth/logout ────────────────────────
// JWT is stateless — logout is handled client-side by deleting the token
// This endpoint exists for logging purposes
router.post('/logout', requireAuth, (req, res) => {
  console.log(`👋 Logout: ${req.user.username}`);
  res.json({ success: true, message: 'Logged out successfully.' });
});

// ─── POST /api/auth/change-password ──────────────
router.post('/change-password', requireAuth, (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ success: false, error: 'Password must be at least 8 characters.' });
  }
  updatePassword(req.user.id, newPassword);
  console.log(`🔑 Password changed: ${req.user.username}`);
  res.json({ success: true, message: 'Password updated. Please log in again.' });
});

// ─── GET /api/auth/users (admin only) ────────────
router.get('/users', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Admin access required.' });
  }
  res.json({ success: true, users: getAllUsers() });
});

// ─── POST /api/auth/users (admin only — create user) ──
router.post('/users', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Admin access required.' });
  }
  const { username, password, role, fullName } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username and password required.' });
  }
  const result = createUser({ username: username.trim().toLowerCase(), password, role: role || 'responder', fullName });
  if (!result.success) return res.status(409).json(result);
  res.json({ success: true, message: `User '${username}' created.` });
});

module.exports = router;
