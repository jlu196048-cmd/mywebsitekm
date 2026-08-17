// Express server for mywebsite.
// Serves the public site + admin SPA, plus the JSON/JSON API.
// Designed to mirror a Cloudflare Pages Functions layout (see /functions).

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const store = require('./store');
const auth = require('./auth');
const posts = require('./posts');
const messages = require('./messages');

const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const IMG_DIR  = path.join(PUBLIC_DIR, 'images');

const PORT = process.env.PORT || 3000;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

const app = express();
app.use(bodyParser.json({ limit: '2mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// ------------ Image upload (multer) ------------
if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) { cb(null, IMG_DIR); },
    filename: function (req, file, cb) {
      const ext = path.extname(file.originalname).toLowerCase().slice(0, 8) || '.bin';
      const base = crypto.randomBytes(8).toString('hex');
      cb(null, base + ext);
    }
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const ok = /^image\/(jpeg|jpg|png|gif|webp|svg\+xml|svg)$/i.test(file.mimetype)
      || /\.(jpe?g|png|gif|webp|svg)$/i.test(file.originalname);
    if (!ok) return cb(new Error('Only image files are allowed'));
    cb(null, true);
  }
});

// ------------ CORS ------------
// When the same origin can fetch /api/* (recommended: IIS ARR reverse proxy
// in front of this Node process), CORS isn't needed. When the static site is
// hosted on a different port (default IIS = 8080, Node = 3001), the browser
// blocks cross-origin POSTs unless we explicitly allow them.
//
// ALLOW_ORIGIN accepts a comma-separated list of origins, e.g.
//   ALLOW_ORIGIN="http://localhost:8080,http://127.0.0.1:8080"
// Defaults to permissive '*' in development; tighten in production.
const ALLOW_ORIGIN = (process.env.ALLOW_ORIGIN || '*').split(',').map(s => s.trim()).filter(Boolean);
app.use(function (req, res, next) {
  const origin = req.headers.origin;
  if (origin && (ALLOW_ORIGIN.indexOf('*') >= 0 || ALLOW_ORIGIN.indexOf(origin) >= 0)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }
  next();
});

// Ensure default admin exists (uses stored hash; env override allows rotation)
(function ensureAdmin() {
  const admin = store.getAdmin();
  if (ADMIN_USERNAME && ADMIN_PASSWORD && (process.env.FORCE_ADMIN_RESET === '1')) {
    (async () => {
      const bcrypt = require('bcryptjs');
      admin.username = ADMIN_USERNAME;
      admin.passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
      admin.passwordRotated = true;
      store.saveAdmin(admin);
      console.log('[mywebsite] Admin credentials reset from env');
    })();
  }
})();

// ------------ API: Profile (public) ------------
app.get('/api/profile', function (req, res) {
  res.json(store.getProfile());
});

app.get('/api/images', function (req, res) {
  try {
    const files = fs.readdirSync(IMG_DIR).filter(function(f){ return !f.startsWith('.'); });
    const items = files.map(function(name) {
      const ext = path.extname(name).toLowerCase();
      return {
        name: name,
        url: '/images/' + encodeURIComponent(name),
        size: (function(){ try { return fs.statSync(path.join(IMG_DIR, name)).size; } catch(e){ return 0; }})(),
        ext: ext,
      };
    });
    res.json({ items: items });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ------------ API: Posts (public) ------------
app.get('/api/posts', function (req, res) {
  try {
    const { status, sort, page, limit } = req.query;
    const data = posts.list({ status, sort, page, limit });
    res.json(data);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.get('/api/posts/:id', function (req, res) {
  const p = posts.findById(req.params.id);
  if (!p) return res.status(404).json({ message: 'Post not found' });
  // Hide hidden posts from public unless authenticated admin
  if (p.status !== 'published' && !auth.adminStatus(req).authenticated) {
    return res.status(404).json({ message: 'Post not found' });
  }
  res.json(p);
});

// ------------ API: Contact form ------------
app.post('/api/contact', async function (req, res) {
  const { name, email, message } = req.body || {};
  if (!name || !email || !message) return res.status(400).json({ message: 'All fields are required' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email))) return res.status(400).json({ message: 'Invalid email' });

  // Optional Cloudflare Turnstile verification. Only enforced when
  // TURNSTILE_SECRET_KEY is set; in dev or pre-configured deploys we
  // silently skip so the form still works.
  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
  const turnstileToken = (req.body || {})['cf-turnstile-response'];
  if (turnstileSecret) {
    if (!turnstileToken) return res.status(400).json({ message: 'Captcha is required' });
    try {
      const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'secret=' + encodeURIComponent(turnstileSecret) +
              '&response=' + encodeURIComponent(turnstileToken) +
              (req.ip ? '&remoteip=' + encodeURIComponent(req.ip) : ''),
      });
      const data = await r.json();
      if (!data.success) return res.status(400).json({ message: 'Captcha verification failed' });
    } catch (e) {
      return res.status(502).json({ message: 'Captcha verification unavailable' });
    }
  }

  const list = store.getMessages();
  list.items = list.items || [];
  list.items.push({
    id: crypto.randomBytes(4).toString('hex'),
    receivedAt: new Date().toISOString(),
    name: String(name).slice(0, 200),
    email: String(email).slice(0, 200),
    message: String(message).slice(0, 4000),
    ip: req.ip,
    read: false,
    deleted: false,
    replies: [],
  });
  // Keep only the latest 200 messages to keep JSON small.
  if (list.items.length > 200) list.items = list.items.slice(-200);
  store.saveMessages(list);
  // We don't send mail from the local server; messages are persisted in data/messages.json
  // and can be wired up to SMTP / Cloudflare Email Workers later if desired.
  res.json({ ok: true });
});

// ------------ API: Public config (Turnstile site key etc.) ------------
app.get('/api/config', function (req, res) {
  res.json({
    turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || '',
  });
});

// ------------ API: Admin ------------
app.post('/api/admin/login', async function (req, res) {
  try {
    const { username, password } = req.body || {};
    const result = await auth.login(username, password);
    res.json(result);
  } catch (e) {
    res.status(401).json({ message: e.message || 'Login failed' });
  }
});

app.post('/api/admin/logout', function (req, res) {
  // JWT is stateless — client just deletes the token.
  res.json({ ok: true });
});

app.get('/api/admin/status', function (req, res) {
  res.json(auth.adminStatus(req));
});

app.post('/api/admin/password', async function (req, res) {
  if (!auth.requireAdmin(req, res)) return;
  try {
    const { currentPassword, newPassword } = req.body || {};
    await auth.changePassword(currentPassword, newPassword);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// Profile write
app.put('/api/admin/profile', function (req, res) {
  if (!auth.requireAdmin(req, res)) return;
  try {
    const cur = store.getProfile();
    const patch = req.body || {};
    const next = Object.assign({}, cur, patch, {
      intro: Object.assign({}, cur.intro, patch.intro || {}),
      about: Object.assign({}, cur.about, patch.about || {}),
    });
    if (!Array.isArray(next.contacts)) next.contacts = cur.contacts || [];
    store.saveProfile(next);
    res.json(next);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// Posts write
app.post('/api/admin/posts', function (req, res) {
  if (!auth.requireAdmin(req, res)) return;
  try {
    const post = posts.create(req.body || {}, req.admin && req.admin.username);
    res.json(post);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

app.put('/api/admin/posts/:id', function (req, res) {
  if (!auth.requireAdmin(req, res)) return;
  try {
    const post = posts.update(req.params.id, req.body || {});
    res.json(post);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

app.delete('/api/admin/posts/:id', function (req, res) {
  if (!auth.requireAdmin(req, res)) return;
  try {
    posts.remove(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

app.post('/api/admin/posts/:id/toggle', function (req, res) {
  if (!auth.requireAdmin(req, res)) return;
  try {
    const p = posts.toggle(req.params.id);
    res.json(p);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// Image write
app.post('/api/admin/images', upload.single('file'), function (req, res) {
  if (!auth.requireAdmin(req, res)) return;
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  res.json({
    name: req.file.filename,
    url: '/images/' + encodeURIComponent(req.file.filename),
    size: req.file.size,
    ext: path.extname(req.file.filename),
  });
});

app.delete('/api/admin/images/:name', function (req, res) {
  if (!auth.requireAdmin(req, res)) return;
  try {
    const name = path.basename(req.params.name);
    if (!name || name === '..' || name === '.') throw new Error('Invalid name');
    const fp = path.join(IMG_DIR, name);
    if (!fs.existsSync(fp)) return res.status(404).json({ message: 'File not found' });
    fs.unlinkSync(fp);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// ------------ API: Admin — Contact Messages ------------
app.get('/api/admin/messages', function (req, res) {
  if (!auth.requireAdmin(req, res)) return;
  try {
    const status = (req.query.status || 'all').toLowerCase();
    const result = messages.list({ status: status });
    res.json(result);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

app.get('/api/admin/messages/:id', function (req, res) {
  if (!auth.requireAdmin(req, res)) return;
  try {
    const m = messages.findById(req.params.id);
    if (!m) return res.status(404).json({ message: 'Message not found' });
    res.json(m);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

app.post('/api/admin/messages/:id/read', function (req, res) {
  if (!auth.requireAdmin(req, res)) return;
  try {
    const m = messages.markRead(req.params.id, true);
    res.json(m);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

app.post('/api/admin/messages/:id/unread', function (req, res) {
  if (!auth.requireAdmin(req, res)) return;
  try {
    const m = messages.markRead(req.params.id, false);
    res.json(m);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

app.post('/api/admin/messages/:id/reply', function (req, res) {
  if (!auth.requireAdmin(req, res)) return;
  try {
    const body = (req.body && req.body.body) || '';
    const admin = (req.admin && req.admin.username) || 'admin';
    const m = messages.addReply(req.params.id, body, admin);
    res.json(m);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

app.delete('/api/admin/messages/:id', function (req, res) {
  if (!auth.requireAdmin(req, res)) return;
  try {
    messages.softDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

app.post('/api/admin/messages/:id/restore', function (req, res) {
  if (!auth.requireAdmin(req, res)) return;
  try {
    const m = messages.restore(req.params.id);
    res.json(m);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// ------------ Static + SPA fallback ------------
app.use('/images', express.static(IMG_DIR, { maxAge: '1h' }));
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));

// SPA fallback for /admin/*  (serve dashboard.html, login.html)
app.get(/^\/admin(\/.*)?$/, function (req, res) {
  res.sendFile(path.join(PUBLIC_DIR, 'admin', 'dashboard.html'));
});
app.get(/^\/admin\/?$/, function (req, res) {
  res.sendFile(path.join(PUBLIC_DIR, 'admin', 'index.html'));
});
app.get(/^\/admin\/dashboard\.html$/, function (req, res) {
  res.sendFile(path.join(PUBLIC_DIR, 'admin', 'dashboard.html'));
});

// Generic fallback to index.html for clean URLs (/)
app.get('*', function (req, res) {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// ------------ Error handler ------------
app.use(function (err, req, res, next) {
  console.error('[mywebsite]', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ message: err.message || 'Internal error' });
});

if (require.main === module) {
  app.listen(PORT, function () {
    console.log('[mywebsite] listening on http://localhost:' + PORT);
    console.log('[mywebsite] admin: ' + path.join('http://localhost:' + PORT, 'admin'));
    console.log('[mywebsite] default admin login: ' + ADMIN_USERNAME + ' / ' + ADMIN_PASSWORD + '   (change in admin > Account after first login)');
  });
}

module.exports = app;
