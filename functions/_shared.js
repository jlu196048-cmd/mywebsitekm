// Shared helpers used by all Cloudflare Functions.
// Designed to mirror the behaviour of server/index.js so the same frontend works
// in either environment.

export function json(data, init = {}) {
  const headers = Object.assign(
    { 'Content-Type': 'application/json; charset=utf-8' },
    init.headers || {}
  );
  return new Response(JSON.stringify(data), Object.assign({}, init, { headers }));
}

export function err(message, status = 400) {
  return json({ message }, { status });
}

export function corsify(resp) {
  const h = new Headers(resp.headers);
  h.set('Access-Control-Allow-Origin', '*');
  h.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  h.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return new Response(resp.body, { status: resp.status, headers: h });
}

export async function handlePreflight(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    });
  }
  return null;
}

export async function readJsonBody(request) {
  const ct = request.headers.get('content-type') || '';
  if (!ct.includes('application/json')) return {};
  try { return await request.json(); }
  catch (e) { return {}; }
}

// --- KV / Storage layer -------------------------------------------------
// Posts + profile live in a single JSON blob in KV (cheaper than per-record items).
// Images live in R2 (optional). If you don't have R2 bound, image upload
// endpoints return a friendly error.

const KV_KEYS = {
  posts: 'posts.json',
  profile: 'profile.json',
  admin: 'admin.json',
  messages: 'messages.json',
};

export async function getPosts(env) {
  if (!env.MYWEBSITE_KV) return { items: [] };
  const v = await env.MYWEBSITE_KV.get(KV_KEYS.posts);
  return v ? JSON.parse(v) : { items: [] };
}
export async function savePosts(env, data) {
  if (!env.MYWEBSITE_KV) return;
  await env.MYWEBSITE_KV.put(KV_KEYS.posts, JSON.stringify(data));
}

export async function getProfile(env) {
  const fallback = {
    name: 'My Website',
    avatar: '',
    intro: { zh: '', en: '' },
    about: { zh: '', en: '' },
    contacts: [],
  };
  if (!env.MYWEBSITE_KV) return fallback;
  const v = await env.MYWEBSITE_KV.get(KV_KEYS.profile);
  return v ? JSON.parse(v) : fallback;
}
export async function saveProfile(env, data) {
  if (!env.MYWEBSITE_KV) return;
  await env.MYWEBSITE_KV.put(KV_KEYS.profile, JSON.stringify(data));
}

export async function getAdmin(env) {
  // Default password is "admin123". On Cloudflare Pages Workers we cannot
  // ship bcryptjs without bundling, so the default uses a salted SHA-256
  // hash with prefix "sha256:". The login/password routes understand both
  // formats (sha256: directly; bcrypt via optional bcryptjs module).
  const enc = new TextEncoder();
  const defaultHash = await sha256Prefixed(enc.encode('admin123:mywebsite-salt'));
  const fallback = {
    username: 'admin',
    passwordHash: 'sha256:' + defaultHash,
    passwordRotated: false,
  };
  if (!env.MYWEBSITE_KV) return fallback;
  const v = await env.MYWEBSITE_KV.get(KV_KEYS.admin);
  return v ? JSON.parse(v) : fallback;
}
export async function saveAdmin(env, data) {
  if (!env.MYWEBSITE_KV) return;
  await env.MYWEBSITE_KV.put(KV_KEYS.admin, JSON.stringify(data));
}

// SHA-256 helper used by the default admin hash + password fallback.
export async function sha256Prefixed(bytes) {
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

// Verify a password against a stored hash. Supports:
//   "sha256:<hex>"  — works without bcryptjs (CF Workers default path)
//   "$2a$..."       — requires bcryptjs to be bundled in
// Throws if the format is unknown.
export async function verifyPassword(password, hash) {
  if (!hash) return false;
  if (hash.startsWith('sha256:')) {
    const enc = new TextEncoder();
    const hex = await sha256Prefixed(enc.encode(password + ':mywebsite-salt'));
    return hash === 'sha256:' + hex;
  }
  if (hash.startsWith('$2a$') || hash.startsWith('$2b$')) {
    try {
      const bcrypt = await import('bcryptjs');
      return await bcrypt.compare(password, hash);
    } catch (e) { return false; }
  }
  return false;
}

// Hash a password for storage. Prefers bcrypt when bcryptjs is available;
// falls back to the salted sha256 scheme so the value can be verified
// without external deps.
export async function hashPassword(password) {
  try {
    const bcrypt = await import('bcryptjs');
    return await bcrypt.hash(password, 10);
  } catch (e) {
    const enc = new TextEncoder();
    return 'sha256:' + await sha256Prefixed(enc.encode(password + ':mywebsite-salt'));
  }
}

export async function getMessages(env) {
  if (!env.MYWEBSITE_KV) return { items: [] };
  const v = await env.MYWEBSITE_KV.get(KV_KEYS.messages);
  return v ? JSON.parse(v) : { items: [] };
}
export async function saveMessages(env, data) {
  if (!env.MYWEBSITE_KV) return;
  await env.MYWEBSITE_KV.put(KV_KEYS.messages, JSON.stringify(data));
}

// --- JWT (HS256) ---------------------------------------------------------
// Minimal implementation that uses Web Crypto only (no node deps in Workers).

function b64url(input) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 = btoa(bin);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function hmacSha256(secret, data) {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
  const sig = await crypto.subtle.sign('HMAC', k, enc.encode(data));
  return new Uint8Array(sig);
}

export async function issueJwt(secret, payload, expiresInSeconds = 7 * 24 * 3600) {
  const now = Math.floor(Date.now() / 1000);
  const body = Object.assign({}, payload, { iat: now, exp: now + expiresInSeconds });
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerEnc = b64url(JSON.stringify(header));
  const bodyEnc  = b64url(JSON.stringify(body));
  const data = headerEnc + '.' + bodyEnc;
  const sig = await hmacSha256(secret, data);
  return data + '.' + b64url(sig);
}

export async function verifyJwt(secret, token) {
  if (!token || token.indexOf('.') < 0) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const data = parts[0] + '.' + parts[1];
  const sig  = await hmacSha256(secret, data);
  const expected = b64url(sig);
  if (expected !== parts[2]) return null;
  try {
    const body = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (body.exp && Math.floor(Date.now()/1000) > body.exp) return null;
    return body;
  } catch (e) { return null; }
}

export function adminStatusFromRequest(request, secret) {
  const auth = request.headers.get('authorization') || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return { authenticated: false };
  // verify is async; resolve at the caller via this helper return
  return { token: m[1], secret, _pending: true };
}

export async function isAuthenticated(request, secret) {
  if (!secret || secret === 'mywebsite-dev-secret-change-me') {
    // No secret configured (or the publicly-known fallback). Refuse.
    // Cloudflare Pages requires the secret to be set in the dashboard.
    // The dev fallback is only honoured when ALLOW_DEV_JWT_SECRET=1.
    return false;
  }
  const auth = request.headers.get('authorization') || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return false;
  const payload = await verifyJwt(secret, m[1]);
  return !!(payload && payload.role === 'admin');
}

// Resolve the JWT secret for the current request. We accept:
//   1) context.env.JWT_SECRET                  — production secret
//   2) context.env.ALLOW_DEV_JWT_SECRET === '1' — dev/local override
//                                                 using the placeholder
// In any other case (placeholder set, no override) we return null so the
// caller can refuse the request with a clear error.
export function resolveJwtSecret(env) {
  const s = env.JWT_SECRET;
  if (s && s !== 'mywebsite-dev-secret-change-me') return s;
  if (env.ALLOW_DEV_JWT_SECRET === '1') return 'mywebsite-dev-secret-change-me';
  return null;
}
