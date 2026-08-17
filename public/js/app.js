// Common API + helper utilities used by both the public site and admin panel.

(function ensureBackendMeta() {
  if (document.querySelector('meta[name="mywebsite-backend"]')) return;
  var m = document.createElement('meta');
  m.setAttribute('name', 'mywebsite-backend');
  // Default: same machine on port 3001. Override in HTML <head> if needed.
  m.setAttribute('content', location.protocol + '//' + location.hostname + ':3001');
  document.head.appendChild(m);
})();

window.API = (function() {
  // Resolve the API base once on load. We try the same origin first
  // (works when IIS ARR proxies /api/* to Node). If that fails on a
  // GET /api/admin/status call with a network error or a 502/504 (ARR
  // misconfigured), we fall back to the direct Node port configured via
  // <meta name="mywebsite-backend" content="http://127.0.0.1:3001"> in
  // <head>. This lets the same pages run whether or not ARR is installed.
  const META = document.querySelector('meta[name="mywebsite-backend"]');
  const BACKEND = (META ? META.getAttribute('content') : '').trim().replace(/\/+$/, '');
  let BASE = ''; // ''  = same origin, BACKEND = cross-port to Node
  let BASE_RESOLVED = false;

  async function tryFetch(method, url, opts) {
    return await fetch(url, opts);
  }

  // Probe a base URL by hitting /api/admin/status. We accept ONLY a real
  // 200 + JSON { authenticated: bool, ... } response — anything else
  // (IIS 404 when ARR is absent, network error, CORS rejection, mis-
  // configured ARR returning 502/504 with HTML) means the base is bad.
  async function probe(testUrl) {
    try {
      const r = await tryFetch('GET', testUrl, { credentials: 'include' });
      if (r.status !== 200) return false;
      const text = await r.text();
      try {
        const data = JSON.parse(text);
        return data && typeof data === 'object' && 'authenticated' in data;
      } catch (e) { return false; }
    } catch (e) { return false; }
  }

  async function request(method, url, body, isForm) {
    const opts = { method, headers: {}, credentials: 'include' };
    const token = localStorage.getItem('admin_token');
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    if (body) {
      if (isForm) {
        opts.body = body; // FormData
      } else {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
      }
    }

    // Probe: pick whichever base works first. Once we know, cache it.
    // A base is "good" iff probe() returned true. Anything else (404
    // from IIS without ARR, 502/504 from misconfigured ARR, network
    // error, CORS rejection) means try the next base. We never trust a
    // 4xx here because IIS returns 404 for any /api/* path that isn't
    // statically served, and the JS client would otherwise lock onto
    // the wrong base.
    if (!BASE_RESOLVED) {
      const sameOk = await probe('/api/admin/status');
      if (sameOk) {
        BASE = '';
        BASE_RESOLVED = true;
      } else if (BACKEND) {
        const backendOk = await probe(BACKEND + '/api/admin/status');
        if (backendOk) {
          BASE = BACKEND;
          BASE_RESOLVED = true;
        }
      }
      if (!BASE_RESOLVED) {
        // Couldn't reach either base. Throw with a clear message so the
        // caller can show a friendly error instead of silently failing.
        throw new Error('Backend unreachable. Is the Node server running on port 3001?');
      }
    }

    const target = BASE + url;
    const res = await tryFetch(method, target, opts);

    // If we get a 502/504 from same-origin (ARR misconfigured) and we haven't
    // cached a base yet, fall back once.
    if ((res.status === 502 || res.status === 504) && BASE === '' && BACKEND) {
      const res2 = await tryFetch(method, BACKEND + url, opts);
      BASE = BACKEND;
      BASE_RESOLVED = true;
      return unwrap(res2);
    }
    return unwrap(res);
  }

  async function unwrap(res) {
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch(e) { data = text; }
    if (!res.ok) {
      const msg = (data && (data.message || data.error)) || ('HTTP ' + res.status);
      const err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  return {
    // Public
    getConfig:         ()        => request('GET',    '/api/config'),
    getProfile:        ()        => request('GET',    '/api/profile'),
    getPosts:          (params)  => request('GET',    '/api/posts' + qs(params)),
    getPost:           (id)      => request('GET',    '/api/posts/' + id),
    submitContact:     (body)    => request('POST',   '/api/contact', body),
    getImages:         ()        => request('GET',    '/api/images'),

    // Admin (auth)
    adminLogin:        (body)    => request('POST',   '/api/admin/login', body),
    adminLogout:       ()        => request('POST',   '/api/admin/logout'),
    adminStatus:       ()        => request('GET',    '/api/admin/status'),
    adminChangePwd:    (body)    => request('POST',   '/api/admin/password', body),

    // Admin (CRUD)
    adminCreatePost:   (body)    => request('POST',   '/api/admin/posts', body),
    adminUpdatePost:   (id, body)=> request('PUT',    '/api/admin/posts/' + id, body),
    adminDeletePost:   (id)      => request('DELETE', '/api/admin/posts/' + id),
    adminTogglePost:   (id)      => request('POST',   '/api/admin/posts/' + id + '/toggle'),
    adminUploadImage:  (form)    => request('POST',   '/api/admin/images', form, true),
    adminDeleteImage:  (name)    => request('DELETE', '/api/admin/images/' + encodeURIComponent(name)),
    adminUpdateProfile:(body)    => request('PUT',    '/api/admin/profile', body),

    // Admin (Messages)
    adminListMessages:   (params) => request('GET',    '/api/admin/messages' + qs(params)),
    adminGetMessage:     (id)     => request('GET',    '/api/admin/messages/' + id),
    adminMarkRead:       (id)     => request('POST',   '/api/admin/messages/' + id + '/read'),
    adminMarkUnread:     (id)     => request('POST',   '/api/admin/messages/' + id + '/unread'),
    adminReplyMessage:   (id, b)  => request('POST',   '/api/admin/messages/' + id + '/reply', b),
    adminDeleteMessage:  (id)     => request('DELETE', '/api/admin/messages/' + id),
    adminRestoreMessage: (id)     => request('POST',   '/api/admin/messages/' + id + '/restore'),
  };

  function qs(obj) {
    if (!obj) return '';
    const parts = [];
    Object.keys(obj).forEach(function(k) {
      if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') {
        parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(obj[k]));
      }
    });
    return parts.length ? '?' + parts.join('&') : '';
  }
})();

// Escape HTML to prevent XSS when injecting string data into innerHTML
window.escapeHTML = function(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

// Lightweight markdown -> HTML for post content (safe, no remote loading)
// Supports headings, bold/italic, links, images, lists, blockquotes, code.
window.renderMarkdown = function(md) {
  if (!md) return '';
  // Escape HTML first, then re-introduce safe tags via line transforms.
  let html = window.escapeHTML(md);

  // fenced code
  html = html.replace(/```([\s\S]*?)```/g, function(_, c) {
    return '<pre><code>' + c + '</code></pre>';
  });

  // images: ![alt](src)
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function(_, alt, src) {
    return '<img alt="' + alt + '" src="' + src + '">';
  });

  // links: [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function(_, text, url) {
    return '<a href="' + url + '" target="_blank" rel="noopener">' + text + '</a>';
  });

  // headings (#, ##, ###)
  html = html.replace(/^### (.*)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*)$/gm, '<h1>$1</h1>');

  // blockquotes
  html = html.replace(/^> (.*)$/gm, '<blockquote>$1</blockquote>');

  // bold / italic
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // unordered lists (group consecutive - items)
  html = html.replace(/(^|\n)((?:- [^\n]+\n?)+)/g, function(_, p, block) {
    const items = block.trim().split(/\n/).map(function(l) { return l.replace(/^- /, ''); });
    return p + '<ul>' + items.map(function(i) { return '<li>' + i + '</li>'; }).join('') + '</ul>';
  });

  // paragraphs: split on double newline, leave block-level tags intact
  const blocks = html.split(/\n{2,}/);
  html = blocks.map(function(b) {
    const trimmed = b.trim();
    if (!trimmed) return '';
    if (/^<(h\d|ul|ol|pre|blockquote|img|p)/.test(trimmed)) return trimmed;
    return '<p>' + trimmed.replace(/\n/g, '<br>') + '</p>';
  }).join('\n');

  return html;
};

// Simple date formatter (YYYY-MM-DD)
window.formatDate = function(d) {
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d || '';
    const pad = function(n) { return n < 10 ? '0' + n : '' + n; };
    return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate());
  } catch (e) { return d || ''; }
};

// Toast helper used by admin
window.toast = function(msg, type) {
  type = type || 'success';
  let bar = document.getElementById('status-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'status-bar';
    bar.className = 'status-bar';
    document.body.appendChild(bar);
  }
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  bar.appendChild(el);
  setTimeout(function() {
    el.style.opacity = '0';
    setTimeout(function() { el.remove(); }, 300);
  }, 2400);
};
