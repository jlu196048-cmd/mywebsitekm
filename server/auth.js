// Authentication helpers: bcrypt password hashing + JWT issuing/validating.

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const store = require('./store');

// In production set this via env. For local dev we fall back to a stable dev secret.
const SECRET = process.env.JWT_SECRET || 'mywebsite-dev-secret-change-me';

function issueToken(payload, expiresIn) {
  return jwt.sign(payload, SECRET, { expiresIn: expiresIn || '7d' });
}

function verifyToken(token) {
  try { return jwt.verify(token, SECRET); }
  catch (e) { return null; }
}

function adminStatus(req) {
  const auth = req.headers.authorization || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return { authenticated: false };
  const payload = verifyToken(m[1]);
  if (!payload || payload.role !== 'admin') return { authenticated: false };
  return { authenticated: true, username: payload.username };
}

function requireAdmin(req, res, next) {
  const s = adminStatus(req);
  if (!s.authenticated) {
    res.status(401).json({ message: 'Unauthorized' });
    return false;
  }
  req.admin = s;
  return true;
}

async function login(username, password) {
  const admin = store.getAdmin();
  if (!username || !password) throw new Error('Username and password are required');
  if (username !== admin.username) throw new Error('Invalid credentials');
  const ok = await bcrypt.compare(password, admin.passwordHash);
  if (!ok) throw new Error('Invalid credentials');
  const token = issueToken({ role: 'admin', username: admin.username });
  return { token, username: admin.username, passwordRotated: !!admin.passwordRotated };
}

async function changePassword(currentPassword, newPassword) {
  if (!currentPassword || !newPassword) throw new Error('Both passwords are required');
  if (newPassword.length < 6) throw new Error('New password must be at least 6 characters');
  const admin = store.getAdmin();
  const ok = await bcrypt.compare(currentPassword, admin.passwordHash);
  if (!ok) throw new Error('Current password is incorrect');
  admin.passwordHash = await bcrypt.hash(newPassword, 10);
  admin.passwordRotated = true;
  store.saveAdmin(admin);
}

module.exports = {
  login,
  changePassword,
  issueToken,
  verifyToken,
  adminStatus,
  requireAdmin,
};
