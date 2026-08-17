// Persistent JSON storage layer.
// Each "table" lives in its own file under /data.

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function filePath(name) {
  return path.join(DATA_DIR, name + '.json');
}

function readJson(name, fallback) {
  ensureDir();
  const fp = filePath(name);
  if (!fs.existsSync(fp)) return fallback;
  try {
    const raw = fs.readFileSync(fp, 'utf8');
    if (!raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.error('readJson(' + name + ') failed:', e.message);
    return fallback;
  }
}

function writeJson(name, data) {
  ensureDir();
  const fp = filePath(name);
  const tmp = fp + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, fp);
}

// ---- Posts ----
function getPosts() { return readJson('posts', { items: [] }); }
function savePosts(data) { writeJson('posts', data); }

// ---- Profile ----
function getProfile() {
  return readJson('profile', {
    name: 'My Website',
    avatar: '',
    intro: { zh: '', en: '' },
    about: { zh: '', en: '' },
    contacts: [],
  });
}
function saveProfile(data) { writeJson('profile', data); }

// ---- Admin account ----
function getAdmin() {
  return readJson('admin', {
    username: 'admin',
    // bcrypt hash of default password "admin123" - rotated on first login if forced.
    passwordHash: '$2a$10$FnR0a7cx7o8zlQIjJy.jguQsHoTO5F4s4esyvrXnl6z1RslB8eFni',
    passwordRotated: false,
  });
}
function saveAdmin(data) { writeJson('admin', data); }

// ---- Contact messages ----
function getMessages() { return readJson('messages', { items: [] }); }
function saveMessages(data) { writeJson('messages', data); }

module.exports = {
  dataDir: DATA_DIR,
  getPosts, savePosts,
  getProfile, saveProfile,
  getAdmin, saveAdmin,
  getMessages, saveMessages,
};
