// Bilingual dictionary used by the public site
// Each key has { zh, en } translations.
window.I18N = {
  // Navigation
  'nav.home':    { zh: '首页',     en: 'Home' },
  'nav.about':   { zh: '关于',     en: 'About' },
  'nav.blog':    { zh: '博客',     en: 'Blog' },
  'nav.contact': { zh: '联系',     en: 'Contact' },
  'nav.admin':   { zh: '管理后台', en: 'Admin' },

  // Home intro
  'home.hello':        { zh: '你好',           en: 'Hello' },
  'home.latestPosts':  { zh: '最新文章',       en: 'Latest Posts' },
  'home.viewAll':      { zh: '查看所有文章 →', en: 'View All Posts →' },
  'home.readMore':     { zh: '继续阅读 →',     en: 'Read More →' },
  'home.back':         { zh: '← 返回首页',     en: '← Back to Home' },

  // About
  'about.title':   { zh: '关于我',  en: 'About Me' },
  'about.contact': { zh: '联系方式',en: 'Get in Touch' },

  // Blog list
  'blog.title':      { zh: '博客',          en: 'Blog' },
  'blog.empty':      { zh: '暂无文章，敬请期待。', en: 'No posts yet. Check back soon.' },
  'blog.pagePrev':   { zh: '← 上一页',     en: '← Previous' },
  'blog.pageNext':   { zh: '下一页 →',     en: 'Next →' },
  'blog.tagged':     { zh: '标签：',        en: 'Tags:' },
  'blog.inCat':      { zh: '分类：',        en: 'Category:' },

  // Contact
  'contact.title':  { zh: '联系',          en: 'Contact' },
  'contact.name':   { zh: '您的称呼',      en: 'Your Name' },
  'contact.email':  { zh: '邮箱地址',      en: 'Email Address' },
  'contact.msg':    { zh: '留言内容',      en: 'Your Message' },
  'contact.send':   { zh: '发送',          en: 'Send Message' },
  'contact.success':{ zh: '感谢留言！我会尽快回复您。', en: 'Thanks! I\'ll get back to you soon.' },
  'contact.fail':   { zh: '发送失败，请稍后重试。', en: 'Failed to send. Please try again later.' },

  // Footer (now hardcoded in layout.js — keys removed)

  // Misc
  'draft.label':   { zh: '草稿',            en: 'Draft' },
  'hidden.label':  { zh: '已隐藏',          en: 'Hidden' },
  'published.label': { zh: '已发布',        en: 'Published' },
};

// Apply translations for all elements with [data-i18n] attribute.
// Also update the [lang] attribute on <html>.
window.applyI18n = function(lang) {
  if (!['zh', 'en'].includes(lang)) lang = 'zh';
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  document.querySelectorAll('[data-i18n]').forEach(function(el) {
    var key = el.getAttribute('data-i18n');
    if (window.I18N[key] && window.I18N[key][lang]) {
      el.textContent = window.I18N[key][lang];
    }
  });
  document.querySelectorAll('[data-i18n-attr]').forEach(function(el) {
    var spec = el.getAttribute('data-i18n-attr'); // "placeholder:contact.name"
    var parts = spec.split(':');
    var attr = parts[0];
    var key = parts[1];
    if (window.I18N[key] && window.I18N[key][lang]) {
      el.setAttribute(attr, window.I18N[key][lang]);
    }
  });
  // Toggle active state on language switcher
  document.querySelectorAll('.lang-switcher button').forEach(function(b) {
    b.classList.toggle('active', b.dataset.lang === lang);
  });
  localStorage.setItem('site_lang', lang);
  window.dispatchEvent(new CustomEvent('langchange', { detail: { lang: lang }}));
};

window.getLang = function() {
  var saved = localStorage.getItem('site_lang');
  if (saved && ['zh', 'en'].includes(saved)) return saved;
  // Detect by browser language as a fallback
  var browser = (navigator.language || 'zh').toLowerCase();
  return browser.startsWith('en') ? 'en' : 'zh';
};
