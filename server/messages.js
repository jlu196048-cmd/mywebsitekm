// Contact messages helpers: list, mark read/unread, add reply, soft-delete,
// restore. Mirrors the style of posts.js for consistency.

const crypto = require('crypto');
const store = require('./store');

function generateId() { return crypto.randomBytes(4).toString('hex'); }

function getAll() {
  const db = store.getMessages();
  return db.items || [];
}

function saveAll(items) {
  store.saveMessages({ items: items });
}

// status: 'all' | 'unread' | 'read' (default: 'all')
// Excludes soft-deleted messages unless includeDeleted is true.
function list({ status, includeDeleted } = {}) {
  let items = getAll();
  if (!includeDeleted) items = items.filter(function(m) { return !m.deleted; });
  if (status === 'unread') items = items.filter(function(m) { return !m.read; });
  else if (status === 'read') items = items.filter(function(m) { return !!m.read; });

  // Sort: unread first, then by receivedAt desc
  items = items.slice().sort(function(a, b) {
    if (!!a.read !== !!b.read) return a.read ? 1 : -1;
    const da = new Date(a.receivedAt || 0).getTime();
    const db = new Date(b.receivedAt || 0).getTime();
    return db - da;
  });

  const total = items.length;
  const unread = items.filter(function(m) { return !m.read; }).length;
  return { items: items, total: total, unread: unread };
}

function findById(id) {
  return getAll().find(function(m) { return m.id === id; });
}

function markRead(id, value) {
  const items = getAll();
  const idx = items.findIndex(function(m) { return m.id === id; });
  if (idx < 0) throw new Error('Message not found');
  const cur = items[idx];
  const next = Object.assign({}, cur, { read: !!value });
  items[idx] = next;
  saveAll(items);
  return next;
}

function addReply(id, body, replier) {
  if (!body || !String(body).trim()) throw new Error('Reply body is required');
  const items = getAll();
  const idx = items.findIndex(function(m) { return m.id === id; });
  if (idx < 0) throw new Error('Message not found');
  const cur = items[idx];
  const reply = {
    id: generateId(),
    repliedAt: new Date().toISOString(),
    repliedBy: replier || 'admin',
    body: String(body).slice(0, 4000),
  };
  const replies = (cur.replies || []).concat([reply]);
  const next = Object.assign({}, cur, {
    replies: replies,
    read: true, // replying implicitly marks as read
  });
  items[idx] = next;
  saveAll(items);
  return next;
}

function softDelete(id) {
  const items = getAll();
  const idx = items.findIndex(function(m) { return m.id === id; });
  if (idx < 0) throw new Error('Message not found');
  const cur = items[idx];
  const next = Object.assign({}, cur, { deleted: true, read: true });
  items[idx] = next;
  saveAll(items);
  return next;
}

function restore(id) {
  const items = getAll();
  const idx = items.findIndex(function(m) { return m.id === id; });
  if (idx < 0) throw new Error('Message not found');
  const cur = items[idx];
  const next = Object.assign({}, cur, { deleted: false });
  items[idx] = next;
  saveAll(items);
  return next;
}

module.exports = {
  list,
  findById,
  markRead,
  addReply,
  softDelete,
  restore,
};
