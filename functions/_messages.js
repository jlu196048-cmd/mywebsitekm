// Pure (no I/O) message helpers — shared between the local Express server
// and the Cloudflare Pages Functions build. Mirrors server/messages.js.

function genId() {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0');
  return s;
}

function findById(items, id) {
  return (items || []).find(m => m.id === id);
}

export function listMessages(items, params = {}) {
  let out = (items || []).slice();
  if (!params.includeDeleted) out = out.filter(m => !m.deleted);
  if (params.status === 'unread') out = out.filter(m => !m.read);
  else if (params.status === 'read') out = out.filter(m => !!m.read);
  out = out.slice().sort((a, b) => {
    if (!!a.read !== !!b.read) return a.read ? 1 : -1;
    return new Date(b.receivedAt || 0).getTime() - new Date(a.receivedAt || 0).getTime();
  });
  const total = out.length;
  const unread = out.filter(m => !m.read).length;
  return { items: out, total, unread };
}

export function markRead(items, id, value) {
  const idx = items.findIndex(m => m.id === id);
  if (idx < 0) throw new Error('Message not found');
  items[idx] = { ...items[idx], read: !!value };
  return { items, message: items[idx] };
}

export function addReply(items, id, body, replier) {
  if (!body || !String(body).trim()) throw new Error('Reply body is required');
  const idx = items.findIndex(m => m.id === id);
  if (idx < 0) throw new Error('Message not found');
  const cur = items[idx];
  const reply = {
    id: genId(),
    repliedAt: new Date().toISOString(),
    repliedBy: replier || 'admin',
    body: String(body).slice(0, 4000),
  };
  const replies = (cur.replies || []).concat([reply]);
  items[idx] = { ...cur, replies, read: true };
  return { items, message: items[idx] };
}

export function softDelete(items, id) {
  const idx = items.findIndex(m => m.id === id);
  if (idx < 0) throw new Error('Message not found');
  items[idx] = { ...items[idx], deleted: true, read: true };
  return { items, message: items[idx] };
}

export function restore(items, id) {
  const idx = items.findIndex(m => m.id === id);
  if (idx < 0) throw new Error('Message not found');
  items[idx] = { ...items[idx], deleted: false };
  return { items, message: items[idx] };
}

export { findById };
