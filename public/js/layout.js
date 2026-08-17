// Renders the navbar + footer + theme toggle into a page.
// Inject this before other page scripts on the public site.
(function() {
  function renderLayout(activeNav, profile) {
    profile = profile || {};
    const lang = window.getLang();

    const navbarHtml = `
      <header class="navbar">
        <div class="container">
          <a href="/" class="brand" data-profile-name>${window.escapeHTML(profile.name || 'My Website')}</a>
          <nav>
            <a href="/" data-nav="home">${window.I18N['nav.home'][lang]}</a>
            <a href="/about.html" data-nav="about">${window.I18N['nav.about'][lang]}</a>
            <a href="/blog.html" data-nav="blog">${window.I18N['nav.blog'][lang]}</a>
            <a href="/contact.html" data-nav="contact">${window.I18N['nav.contact'][lang]}</a>
          </nav>
          <div class="toolbar">
            <div class="lang-switcher">
              <button data-lang="zh" class="icon-btn ${lang==='zh'?'active':''}" title="中文">中</button>
              <button data-lang="en" class="icon-btn ${lang==='en'?'active':''}" title="English">EN</button>
            </div>
            <button id="theme-toggle" class="icon-btn" title="Toggle theme">◐</button>
          </div>
        </div>
      </header>
    `;

    const footerHtml = `
      <footer class="site-footer">
        <p>© 2026 My Website · All rights reserved</p>
      </footer>
    `;

    const headerEl = document.getElementById('site-header');
    if (headerEl) headerEl.innerHTML = navbarHtml;
    const footerEl = document.getElementById('site-footer');
    if (footerEl) footerEl.innerHTML = footerHtml;

    // mark active nav
    document.querySelectorAll('[data-nav]').forEach(function(a) {
      if (a.dataset.nav === activeNav) a.classList.add('active');
    });

    // language switcher
    document.querySelectorAll('.lang-switcher button').forEach(function(b) {
      b.addEventListener('click', function() {
        window.applyI18n(b.dataset.lang);
        window.location.reload(); // simple approach: reload for full re-render
      });
    });

    // theme toggle
    const tgl = document.getElementById('theme-toggle');
    if (tgl) {
      const saved = localStorage.getItem('site_theme') || 'light';
      if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
      tgl.addEventListener('click', function() {
        const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
        const next = cur === 'dark' ? 'light' : 'dark';
        if (next === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
        else document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('site_theme', next);
      });
    }

    // initial translation pass
    window.applyI18n(lang);
  }

  // Load profile then render layout. Exposed for individual pages.
  window.initLayout = function(activeNav) {
    // Fetch profile + public config (Turnstile site key etc.) in parallel.
    // The Turnstile site key is exposed via <meta name="cf-turnstile-sitekey">.
    const profileP = fetch('/api/profile').then(function(r) { return r.ok ? r.json() : {}; })
      .catch(function() { return {}; });
    const configP = fetch('/api/config').then(function(r) { return r.ok ? r.json() : {}; })
      .catch(function() { return {}; });
    return Promise.all([profileP, configP]).then(function(arr) {
      const profile = arr[0], cfg = arr[1];
      if (cfg && cfg.turnstileSiteKey) {
        let meta = document.querySelector('meta[name="cf-turnstile-sitekey"]');
        if (!meta) {
          meta = document.createElement('meta');
          meta.setAttribute('name', 'cf-turnstile-sitekey');
          document.head.appendChild(meta);
        }
        meta.setAttribute('content', cfg.turnstileSiteKey);
      }
      renderLayout(activeNav, profile);
    });
  };
})();
