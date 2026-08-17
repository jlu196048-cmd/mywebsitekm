// Posts helpers: business logic (CRUD, ordering, pagination) shared between
// the public read API and the admin write API.

const crypto = require('crypto');
const store = require('./store');

function nowISODate() { return new Date().toISOString().slice(0, 10); }
function generateId() { return crypto.randomBytes(6).toString('hex'); }

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function sortByDate(items, desc) {
  return items.slice().sort(function(a, b) {
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
  const slice = items.slice(start, start + limit);
  return { items: slice, total, totalPages, page: cur, limit };
}

function getAll() {
  const db = store.getPosts();
  return db.items || [];
}

function list({ status, sort, page, limit, all }) {
  let items = getAll();
  // status: 'published' | 'all' | 'draft' | 'hidden'
  if (status === 'all') {
    // keep all
  } else if (status) {
    items = items.filter(function(p) { return p.status === status; });
  } else {
    items = items.filter(function(p) { return p.status === 'published'; });
  }
  items = sortByDate(items, sort !== 'asc');
  const limitN = Math.min(50, Math.max(1, parseInt(limit || 10, 10)));
  return paginate(items, page, limitN);
}

function findById(id) {
  return getAll().find(function(p) { return p.id === id; });
}

function findBySlug(slug) {
  return getAll().find(function(p) { return p.slug === slug; });
}

function create(input, creator) {
  const items = getAll();
  const id = generateId();
  const date = input.date || nowISODate();
  const slug = input.slug || slugify((input.title && (input.title.zh || input.title.en)) || id);
  const post = {
    id: id,
    slug: slug,
    date: date,
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
  store.savePosts({ items: items });
  return post;
}

function update(id, patch) {
  const items = getAll();
  const idx = items.findIndex(function(p) { return p.id === id; });
  if (idx < 0) throw new Error('Post not found');
  const cur = items[idx];
  const merged = Object.assign({}, cur, patch, { updatedAt: new Date().toISOString() });
  // ensure nested objects stay intact when partially updated
  merged.title    = Object.assign({}, cur.title,    patch.title    || {});
  merged.summary  = Object.assign({}, cur.summary,  patch.summary  || {});
  merged.body     = Object.assign({}, cur.body,     patch.body     || {});
  merged.tags     = patch.tags || cur.tags;
  items[idx] = merged;
  store.savePosts({ items: items });
  return merged;
}

function remove(id) {
  const items = getAll();
  const next = items.filter(function(p) { return p.id !== id; });
  if (next.length === items.length) throw new Error('Post not found');
  store.savePosts({ items: next });
}

function toggle(id) {
  const items = getAll();
  const idx = items.findIndex(function(p) { return p.id === id; });
  if (idx < 0) throw new Error('Post not found');
  const cur = items[idx];
  // cycle: published -> hidden -> draft -> published
  let next = 'published';
  if (cur.status === 'published') next = 'hidden';
  else if (cur.status === 'hidden') next = 'draft';
  items[idx] = Object.assign({}, cur, { status: next, updatedAt: new Date().toISOString() });
  store.savePosts({ items: items });
  return items[idx];
}

module.exports = {
  list, findById, findBySlug, create, update, remove, toggle,
  slugify, generateId,
};
