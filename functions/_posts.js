// Pure (no I/O) post helpers — shared between the local Express server
// and the Cloudflare Pages Functions build. Mirrors server/posts.js.

export function nowISODate() { return new Date().toISOString().slice(0, 10); }

function genId() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0');
  return s;
}

export function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function sortByDate(items, desc) {
  return items.slice().sort((a, b) => {
    const da = new Date(a.date || a.createdAt).getTime();
    const db = new Date(b.date || b.createdAt).getTime();
    return desc ? db - da : da - db;
  });
}

function paginate(items, page, limit) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const cur = Math.min(Math.max(1, page || 1), totalPages);
  const start = (cur - 1) * limit;
  return { items: items.slice(start, start + limit), total, totalPages, page: cur, limit };
}

export function listPosts(records, params, authed) {
  let items = (records.items || []).slice();
  const status = params.status;
  if (status === 'all') {
    // keep all (admin only — non-authed requests get only published)
    if (!authed) items = items.filter(p => p.status === 'published');
  } else if (status) {
    items = items.filter(p => p.status === status);
  } else {
    items = items.filter(p => p.status === 'published');
  }
  items = sortByDate(items, params.sort !== 'asc');
  const limit = Math.min(50, Math.max(1, parseInt(params.limit || '10', 10)));
  return paginate(items, parseInt(params.page || '1', 10), limit);
}

export function findPostById(records, id) {
  return (records.items || []).find(p => p.id === id) || null;
}

export function createPost(records, input, creator) {
  const items = (records.items || []).slice();
  const id = genId();
  const date = input.date || nowISODate();
  const slug = input.slug || slugify((input.title && (input.title.zh || input.title.en)) || id);
  const post = {
    id,
    slug,
    date,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: input.status || 'published',
    cover: input.cover || '',
    category: input.category || '',
    tags: input.tags || [],
    title: input.title || { zh: '', en: '' },
    summary: input.summary || { zh: '', en: '' },
    body: input.body || { zh: '', en: '' },
    author: creator || 'admin',
  };
  items.push(post);
  return { items, post };
}

export function updatePost(records, id, patch) {
  const items = (records.items || []).slice();
  const idx = items.findIndex(p => p.id === id);
  if (idx < 0) throw new Error('Post not found');
  const cur = items[idx];
  const merged = Object.assign({}, cur, patch, { updatedAt: new Date().toISOString() });
  merged.title    = Object.assign({}, cur.title,    patch.title    || {});
  merged.summary  = Object.assign({}, cur.summary,  patch.summary  || {});
  merged.body     = Object.assign({}, cur.body,     patch.body     || {});
  merged.tags     = patch.tags || cur.tags;
  items[idx] = merged;
  return { items, post: merged };
}

export function deletePost(records, id) {
  const items = (records.items || []).slice();
  const next = items.filter(p => p.id !== id);
  if (next.length === items.length) throw new Error('Post not found');
  return { items: next };
}

export function togglePost(records, id) {
  const items = (records.items || []).slice();
  const idx = items.findIndex(p => p.id === id);
  if (idx < 0) return { items, post: null };
  const cur = items[idx];
  let next = 'published';
  if (cur.status === 'published') next = 'hidden';
  else if (cur.status === 'hidden') next = 'draft';
  items[idx] = Object.assign({}, cur, { status: next, updatedAt: new Date().toISOString() });
  return { items, post: items[idx] };
}
