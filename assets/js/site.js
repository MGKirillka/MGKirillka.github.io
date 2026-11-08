/* Site dynamics: client-side search, lightbox, theme toggle, back-to-top.
   Fully static: works on GitHub Pages, no server required. */
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  /* ================= Theme toggle ================= */
  function initTheme() {
    var html = document.documentElement;
    try {
      if (localStorage.getItem('site-theme') === 'dark') {
        html.classList.add('dark-theme');
      }
    } catch (e) {}

    var btn = document.createElement('button');
    btn.id = 'site-theme-btn';
    btn.type = 'button';
    btn.title = 'Сменить тему';
    btn.setAttribute('aria-label', 'Сменить тему');
    btn.textContent = html.classList.contains('dark-theme') ? '☀' : '☾';
    btn.addEventListener('click', function () {
      html.classList.toggle('dark-theme');
      var dark = html.classList.contains('dark-theme');
      btn.textContent = dark ? '☀' : '☾';
      try { localStorage.setItem('site-theme', dark ? 'dark' : 'light'); } catch (e) {}
    });
    document.body.appendChild(btn);
  }

  /* ================= Back to top ================= */
  function initTopButton() {
    var btn = document.createElement('button');
    btn.id = 'site-top-btn';
    btn.type = 'button';
    btn.title = 'Наверх';
    btn.setAttribute('aria-label', 'Наверх');
    btn.textContent = '↑';
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    document.body.appendChild(btn);
    window.addEventListener('scroll', function () {
      btn.classList.toggle('visible', window.scrollY > 300);
    }, { passive: true });
  }

  /* ================= Search ================= */
  function initSearch() {
    var btn = document.createElement('button');
    btn.id = 'site-search-btn';
    btn.type = 'button';
    btn.title = 'Поиск по сайту';
    btn.setAttribute('aria-label', 'Поиск по сайту');
    btn.textContent = '🔍';

    var panel = document.createElement('div');
    panel.id = 'site-search-panel';
    panel.innerHTML =
      '<input id="site-search-input" type="search" placeholder="Поиск по сайту…" autocomplete="off">' +
      '<div id="site-search-results"></div>';

    document.body.appendChild(btn);
    document.body.appendChild(panel);

    var input = panel.querySelector('#site-search-input');
    var results = panel.querySelector('#site-search-results');
    var index = null;
    var loading = false;

    function loadIndex(cb) {
      if (index) return cb(index);
      if (loading) return;
      loading = true;
      fetch('/search-index.json')
        .then(function (r) { return r.json(); })
        .then(function (data) { index = data; loading = false; cb(index); })
        .catch(function () { loading = false; results.innerHTML = '<div id="site-search-empty">Индекс поиска недоступен</div>'; });
    }

    function esc(s) {
      return s.replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }

    function highlight(text, q) {
      var out = '', low = text.toLowerCase(), ql = q.toLowerCase(), i = 0, p;
      while ((p = low.indexOf(ql, i)) !== -1 && out.length < 400) {
        out += esc(text.slice(i, p)) + '<mark>' + esc(text.slice(p, p + ql.length)) + '</mark>';
        i = p + ql.length;
      }
      out += esc(text.slice(i, i + 220));
      return out;
    }

    function snippetAround(text, q) {
      var p = text.toLowerCase().indexOf(q.toLowerCase());
      if (p === -1) return text.slice(0, 160);
      var start = Math.max(0, p - 60);
      return (start > 0 ? '…' : '') + text.slice(start, start + 160) + '…';
    }

    function render(q) {
      if (!q || q.length < 2) { results.innerHTML = ''; return; }
      loadIndex(function (idx) {
        var ql = q.toLowerCase();
        var hits = idx.filter(function (e) {
          return e.title.toLowerCase().indexOf(ql) !== -1 || e.text.toLowerCase().indexOf(ql) !== -1;
        }).slice(0, 8);
        if (!hits.length) {
          results.innerHTML = '<div id="site-search-empty">Ничего не найдено</div>';
          return;
        }
        results.innerHTML = hits.map(function (h) {
          return '<a class="search-result-item" href="' + h.url + '">' +
            '<div class="r-title">' + highlight(h.title, q) + '</div>' +
            '<div class="r-snippet">' + highlight(snippetAround(h.text, q), q) + '</div>' +
            '</a>';
        }).join('');
      });
    }

    var t;
    input.addEventListener('input', function () {
      clearTimeout(t);
      var v = input.value.trim();
      t = setTimeout(function () { render(v); }, 180);
    });

    btn.addEventListener('click', function () {
      var open = panel.classList.toggle('open');
      if (open) { input.focus(); loadIndex(function () {}); }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') panel.classList.remove('open');
      if (e.key === '/' && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) {
        e.preventDefault();
        panel.classList.add('open');
        input.focus();
        loadIndex(function () {});
      }
    });

    document.addEventListener('click', function (e) {
      if (panel.classList.contains('open') && !panel.contains(e.target) && e.target !== btn) {
        panel.classList.remove('open');
      }
    });
  }

  /* ================= Lightbox ================= */
  function initLightbox() {
    var imgs = Array.prototype.slice.call(
      document.querySelectorAll('main img, .wp-block-image img, .wp-block-cover img, .wp-block-gallery img, figure img')
    );
    imgs = imgs.filter(function (im) { return im.naturalWidth === 0 || im.naturalWidth > 250; });
    if (!imgs.length) return;

    var lb = document.createElement('div');
    lb.id = 'site-lightbox';
    lb.innerHTML =
      '<button class="lb-close" type="button" aria-label="Закрыть">✕</button>' +
      '<button class="lb-btn lb-prev" type="button" aria-label="Назад">‹</button>' +
      '<img alt="">' +
      '<button class="lb-btn lb-next" type="button" aria-label="Вперёд">›</button>' +
      '<div class="lb-caption"></div>';
    document.body.appendChild(lb);

    var lbImg = lb.querySelector('img');
    var lbCap = lb.querySelector('.lb-caption');
    var cur = 0;

    function bestSrc(im) {
      if (im.srcset) {
        var parts = im.srcset.split(',').map(function (s) { return s.trim().split(/\s+/); });
        var best = parts[0], bestW = 0;
        parts.forEach(function (p) {
          var w = parseInt(p[1], 10) || 0;
          if (w > bestW) { bestW = w; best = p; }
        });
        return best[0];
      }
      return im.src;
    }

    function show(i) {
      cur = (i + imgs.length) % imgs.length;
      var im = imgs[cur];
      lbImg.src = bestSrc(im);
      lbImg.alt = im.alt || '';
      lbCap.textContent = (im.alt || '') + '  (' + (cur + 1) + '/' + imgs.length + ')';
    }

    function open(i) { show(i); lb.classList.add('open'); document.body.style.overflow = 'hidden'; }
    function close() { lb.classList.remove('open'); document.body.style.overflow = ''; }

    imgs.forEach(function (im, i) {
      // Click target: for cover/background images the overlay sits on top,
      // so bind the click to the wrapping block instead of the img itself.
      var target = im.closest('.wp-block-cover') || im.closest('figure') || im;
      target.style.cursor = 'zoom-in';
      target.addEventListener('click', function (e) {
        if (e.target.closest('a')) return; // don't steal link clicks
        open(i);
      });
    });
    lb.querySelector('.lb-close').addEventListener('click', close);
    lb.querySelector('.lb-prev').addEventListener('click', function () { show(cur - 1); });
    lb.querySelector('.lb-next').addEventListener('click', function () { show(cur + 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(cur - 1);
      if (e.key === 'ArrowRight') show(cur + 1);
    });
  }

  ready(function () {
    initTheme();
    initTopButton();
    initSearch();
    initLightbox();
  });
})();
