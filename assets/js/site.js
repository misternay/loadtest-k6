/* ==========================================================================
   site.js — เปลือกของเว็บ: topbar, sidebar (drawer), TOC scrollspy,
   ปุ่มคัดลอกโค้ด, เครื่องหมาย "อ่านแล้ว", pager, footer, การจัดรูปตัวเลข
   ไม่มี dependency ภายนอก ทำงานร่วมกับ storage.js
   ========================================================================== */
(function () {
  'use strict';

  var ROOT = typeof globalThis !== 'undefined' ? globalThis : this;
  ROOT.LTK6 = ROOT.LTK6 || {};

  var SITE_UPDATED = '2026-09-16';
  var SITE_NAME = 'Load Testing ด้วย k6';

  /* ---------- แผนผังเว็บ (แหล่งข้อมูลเดียวของเมนู) ---------- */

  var GROUPS = [
    { id: 'start', title: 'เริ่มต้น', pages: ['home'] },
    { id: 'lessons', title: 'บทเรียน', pages: ['01-tps', '02-vu', '03-metrics', '04-percentiles', '05-load-profiles', '06-read-results'] },
    { id: 'workflow', title: 'ใช้งานจริง', pages: ['workflow'] },
    { id: 'tools', title: 'เครื่องมือ', pages: ['calculator', 'latency'] },
    { id: 'practice', title: 'แบบฝึกหัด', pages: ['quiz', 'progress'] },
    { id: 'ref', title: 'อ้างอิง', pages: ['glossary', 'troubleshooting', 'examples'] }
  ];

  var PAGES = {
    'home': { title: 'ภาพรวมและเส้นทางการอ่าน', file: 'index.html', group: 'start' },
    '01-tps': { title: '1. คำนวณ TPS / RPS', file: 'lessons/01-tps.html', group: 'lessons', lesson: 1 },
    '02-vu': { title: '2. VU ทำงานอย่างไร', file: 'lessons/02-vu.html', group: 'lessons', lesson: 2 },
    '03-metrics': { title: '3. แคตตาล็อก metric', file: 'lessons/03-metrics.html', group: 'lessons', lesson: 3 },
    '04-percentiles': { title: '4. p95 / p99', file: 'lessons/04-percentiles.html', group: 'lessons', lesson: 4 },
    '05-load-profiles': { title: '5. รูปแบบการทดสอบ', file: 'lessons/05-load-profiles.html', group: 'lessons', lesson: 5 },
    '06-read-results': { title: '6. อ่านผลลัพธ์', file: 'lessons/06-read-results.html', group: 'lessons', lesson: 6 },
    'workflow': { title: 'งานจริงของทีม', file: 'workflow.html', group: 'workflow' },
    'calculator': { title: 'เครื่องคำนวณ TPS/VU', file: 'tools/calculator.html', group: 'tools' },
    'latency': { title: 'สำรวจ latency จริง', file: 'tools/latency.html', group: 'tools' },
    'quiz': { title: 'แบบทดสอบท้ายบท', file: 'quiz.html', group: 'practice' },
    'progress': { title: 'ความคืบหน้าของฉัน', file: 'progress.html', group: 'practice' },
    'glossary': { title: 'อภิธานศัพท์', file: 'glossary.html', group: 'ref' },
    'troubleshooting': { title: 'แก้ปัญหาที่พบบ่อย', file: 'troubleshooting.html', group: 'ref' },
    'examples': { title: 'สคริปต์ตัวอย่าง 5 แบบ', file: 'examples.html', group: 'ref' }
  };

  var ORDER = GROUPS.reduce(function (acc, g) { return acc.concat(g.pages); }, []);
  var LESSON_ORDER = ['01-tps', '02-vu', '03-metrics', '04-percentiles', '05-load-profiles', '06-read-results'];

  /* ---------- ไอคอน (inline SVG, stroke 1.6–1.8, currentColor) ---------- */

  var PATHS = {
    menu: '<path d="M3 6h14M3 10h14M3 14h14"/>',
    close: '<path d="M4.5 4.5l11 11M15.5 4.5l-11 11"/>',
    check: '<circle cx="10" cy="10" r="7.2"/><path d="M6.9 10.2l2.1 2.1 4.1-4.4"/>',
    circle: '<circle cx="10" cy="10" r="7.2"/>',
    book: '<path d="M3.5 4.2h4.3c1.2 0 2.2.9 2.2 2.1v9.5c0-.9-.8-1.6-1.8-1.6H3.5z"/><path d="M16.5 4.2h-4.3c-1.2 0-2.2.9-2.2 2.1v9.5c0-.9.8-1.6 1.8-1.6h4.7z"/>',
    gauge: '<path d="M3.4 14.2a7 7 0 1 1 13.2 0"/><path d="M10 11.4l3.4-3.6"/>',
    calc: '<rect x="4.2" y="2.8" width="11.6" height="14.4" rx="1.4"/><path d="M7 6.4h6M7.4 10h.01M10 10h.01M12.6 10h.01M7.4 13h.01M10 13h.01M12.6 13h.01"/>',
    chart: '<path d="M3.2 16.4V3.8"/><path d="M3.2 16.4h13.6"/><path d="M6.6 16.4v-4.6M10 16.4V8.2M13.4 16.4v-6"/>',
    search: '<circle cx="8.8" cy="8.8" r="5"/><path d="M12.6 12.6l3.6 3.6"/>',
    info: '<circle cx="10" cy="10" r="7.2"/><path d="M10 9.2v4.3M10 6.7h.01"/>',
    warn: '<path d="M10 3.4l6.9 12H3.1z"/><path d="M10 8.2v3.4M10 13.6h.01"/>',
    stop: '<circle cx="10" cy="10" r="7.2"/><path d="M7.4 7.4l5.2 5.2M12.6 7.4l-5.2 5.2"/>',
    copy: '<rect x="7" y="7" width="9" height="9.4" rx="1.2"/><path d="M12.6 5.1V4.2A1.2 1.2 0 0 0 11.4 3H4.8A1.2 1.2 0 0 0 3.6 4.2v6.6a1.2 1.2 0 0 0 1.2 1.2h.9"/>',
    download: '<path d="M10 3.4v8.2"/><path d="M6.8 8.7L10 11.9l3.2-3.2"/><path d="M3.8 15.2v.6a1.2 1.2 0 0 0 1.2 1.2h10a1.2 1.2 0 0 0 1.2-1.2v-.6"/>',
    upload: '<path d="M10 11.6V3.4"/><path d="M6.8 6.6L10 3.4l3.2 3.2"/><path d="M3.8 15.2v.6a1.2 1.2 0 0 0 1.2 1.2h10a1.2 1.2 0 0 0 1.2-1.2v-.6"/>',
    reset: '<path d="M16.2 8.4A6.4 6.4 0 1 0 16 12"/><path d="M16.4 3.9v4.6H12"/>',
    prev: '<path d="M12.4 5.2L7.6 10l4.8 4.8"/>',
    next: '<path d="M7.6 5.2L12.4 10l-4.8 4.8"/>',
    home: '<path d="M3.4 9.2L10 3.8l6.6 5.4"/><path d="M5.2 8.6v7.6h9.6V8.6"/>',
    clock: '<circle cx="10" cy="10" r="7.2"/><path d="M10 6.2V10l2.6 1.6"/>',
    target: '<circle cx="10" cy="10" r="6.6"/><circle cx="10" cy="10" r="2.6"/>',
    list: '<path d="M7.4 5.6h9M7.4 10h9M7.4 14.4h9"/><path d="M3.8 5.6h.01M3.8 10h.01M3.8 14.4h.01"/>',
    sum: '<path d="M4.4 4.4h11.2L10 10l5.6 5.6H4.4"/>',
    shield: '<path d="M10 3.2l6 2.2v4.4c0 3.3-2.4 5.9-6 7-3.6-1.1-6-3.7-6-7V5.4z"/>',
    layers: '<path d="M10 3.6l6.2 3.2-6.2 3.2L3.8 6.8z"/><path d="M3.8 10.4L10 13.6l6.2-3.2"/><path d="M3.8 13.6L10 16.8l6.2-3.2"/>',
    sun: '<circle cx="10" cy="10" r="3.5"/><path d="M10 2.3v1.9M10 15.8v1.9M2.3 10h1.9M15.8 10h1.9M4.6 4.6l1.3 1.3M14.1 14.1l1.3 1.3M15.4 4.6l-1.3 1.3M5.9 14.1l-1.3 1.3"/>',
    moon: '<path d="M16.4 12.3A6.7 6.7 0 0 1 7.7 3.6a6.9 6.9 0 1 0 8.7 8.7z"/>'
  };

  function icon(name, className) {
    var d = PATHS[name] || PATHS.circle;
    return '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"' +
      (className ? ' class="' + className + '"' : '') + '>' + d + '</svg>';
  }

  /* ---------- ธีมสว่าง/มืด ----------
     ค่าที่เลือกไว้ตั้ง data-theme บน <html> แล้วสคริปต์สั้น ๆ ใน <head> ของทุกหน้า
     จะอ่านค่าซ้ำก่อน CSS ถูกวาด จึงไม่กะพริบจอขาวตอนโหลด
     ถ้าผู้ใช้ยังไม่เคยเลือก ปล่อย <html> ว่างไว้ ให้ media query ใน CSS เป็นตัวตัดสินตามระบบ */

  var THEME_KEY = 'ltk6.theme.v1';

  var theme = {
    stored: function () {
      try {
        var v = localStorage.getItem(THEME_KEY);
        return v === 'dark' || v === 'light' ? v : null;
      } catch (err) {
        return null;
      }
    },
    system: function () {
      try {
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark' : 'light';
      } catch (err) {
        return 'light';
      }
    },
    /* ค่าที่กำลังแสดงผลจริง — ใช้ data-theme ถ้ามี ไม่งั้นถามระบบ */
    current: function () {
      var attr = document.documentElement.getAttribute('data-theme');
      if (attr === 'dark' || attr === 'light') return attr;
      return theme.system();
    },
    apply: function (next) {
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem(THEME_KEY, next); } catch (err) { /* เก็บไม่ได้ก็ยังเปลี่ยนธีมได้ */ }
      syncThemeButton();
    },
    toggle: function () {
      theme.apply(theme.current() === 'dark' ? 'light' : 'dark');
    }
  };

  function syncThemeButton() {
    var btn = document.getElementById('theme-toggle');
    if (!btn) return;
    var isDark = theme.current() === 'dark';
    /* ปุ่มบอก "สิ่งที่กดแล้วจะได้" จึงใช้ label ที่อ่านออกเสียงแล้วเข้าใจทันที */
    var label = isDark ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด';
    btn.setAttribute('aria-label', label);
    btn.setAttribute('title', label);
    btn.innerHTML = icon(isDark ? 'sun' : 'moon');
  }

  /* ---------- ตัวช่วยจัดรูปตัวเลข (tabular) ---------- */

  function withSeparators(str) {
    var parts = str.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }

  var format = {
    number: function (value, digits) {
      var d = digits === undefined ? 2 : digits;
      var n = Number(value);
      if (!Number.isFinite(n)) return '—';
      return withSeparators(n.toFixed(d));
    },
    int: function (value) {
      var n = Number(value);
      if (!Number.isFinite(n)) return '—';
      return withSeparators(Math.round(n).toString());
    },
    ms: function (value, digits) {
      return format.number(value, digits === undefined ? 2 : digits) + ' ms';
    },
    pct: function (value, digits) {
      return format.number(value, digits === undefined ? 2 : digits) + '%';
    },
    rate: function (value, digits) {
      return format.number(value, digits === undefined ? 2 : digits) + '/s';
    },
    bytes: function (value) {
      var n = Number(value);
      if (!Number.isFinite(n)) return '—';
      var units = ['B', 'kB', 'MB', 'GB'];
      var i = 0;
      while (Math.abs(n) >= 1000 && i < units.length - 1) { n /= 1000; i++; }
      return format.number(n, i === 0 ? 0 : 1) + ' ' + units[i];
    },
    duration: function (seconds) {
      var s = Number(seconds);
      if (!Number.isFinite(s)) return '—';
      if (s < 60) return format.number(s, 2) + ' s';
      var m = Math.floor(s / 60);
      var rem = s - m * 60;
      return m + ' นาที ' + format.number(rem, 1) + ' s';
    }
  };

  /* ---------- สร้าง topbar / sidebar / footer ---------- */

  function buildTopbar(ctx) {
    var host = document.getElementById('topbar');
    if (!host) return;
    var read = ctx.storage ? ctx.storage.lessonsReadCount() : 0;
    host.innerHTML =
      '<div class="topbar__inner">' +
        '<button class="btn btn--icon" id="menu-toggle" type="button" aria-expanded="false" ' +
          'aria-controls="sidebar" aria-label="เปิดเมนูหลัก">' + icon('menu') + '</button>' +
        '<a class="brand" href="' + ctx.root + 'index.html">' +
          '<span class="brand__mark">' + icon('gauge') + '</span>' +
          '<span class="brand__name">' + SITE_NAME + '<span> · บทเรียนภาษาไทย</span></span>' +
        '</a>' +
        '<span class="topbar__spacer"></span>' +
        '<button class="theme-toggle" id="theme-toggle" type="button"></button>' +
        '<a class="progress-badge" href="' + ctx.root + 'progress.html" ' +
          'title="ดูความคืบหน้าและการบันทึกข้อมูล">' +
          icon('check') +
          '<span class="progress-badge__label">อ่านแล้ว</span>' +
          '<span id="progress-count" class="num">' + read + '/' + LESSON_ORDER.length + '</span>' +
          '<span class="progress-badge__label">บท</span>' +
        '</a>' +
      '</div>';
    host.querySelector('#menu-toggle').addEventListener('click', function () {
      toggleDrawer(ctx, this.getAttribute('aria-expanded') !== 'true');
    });
    var themeBtn = host.querySelector('#theme-toggle');
    if (themeBtn) themeBtn.addEventListener('click', function () { theme.toggle(); });
    /* วาดไอคอนและ label ให้ตรงกับธีมที่กำลังแสดงอยู่ */
    syncThemeButton();
  }

  /* ---------- แถบความคืบหน้าการอ่าน ----------
     สร้างด้วย JavaScript เพราะเป็นของประดับที่ทุกหน้าได้เหมือนกัน
     ไม่ต้องฝัง markup ซ้ำในทุกไฟล์ HTML */

  function wireReadProgress() {
    var bar = document.getElementById('read-progress');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'read-progress';
      bar.id = 'read-progress';
      bar.setAttribute('aria-hidden', 'true');
      document.body.appendChild(bar);
    }
    var ticking = false;

    function update() {
      ticking = false;
      var doc = document.documentElement;
      var scrollable = doc.scrollHeight - window.innerHeight;
      var ratio = scrollable > 0 ? window.scrollY / scrollable : 1;
      if (ratio < 0) ratio = 0;
      if (ratio > 1) ratio = 1;
      bar.style.width = (ratio * 100).toFixed(2) + '%';
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  }

  function buildSidebar(ctx) {
    var host = document.getElementById('sidebar');
    if (!host) return;
    var html = '<div class="drawer-head">' +
      '<span class="drawer-head__title">เมนูทั้งหมด</span>' +
      '<button class="btn btn--small" type="button" id="menu-close">' + icon('close') + 'ปิด</button>' +
      '</div><div class="sidebar__inner">';

    GROUPS.forEach(function (group) {
      html += '<div class="sidebar__group"><p class="sidebar__title">' + group.title + '</p><ul class="sidebar__list">';
      group.pages.forEach(function (id) {
        var page = PAGES[id];
        var isActive = id === ctx.pageId;
        var isRead = ctx.storage ? ctx.storage.isRead(id) : false;
        var mark = id === 'home'
          ? icon('home', 'sidebar__mark')
          : (isRead ? icon('check', 'sidebar__mark is-done') : icon('circle', 'sidebar__mark'));
        html += '<li><a class="sidebar__link' + (isActive ? ' is-active' : '') + '" ' +
          'data-page-id="' + id + '" ' +
          'href="' + ctx.root + page.file + '"' +
          (isActive ? ' aria-current="page"' : '') + '>' +
          mark + '<span>' + page.title + '</span></a></li>';
      });
      html += '</ul></div>';
    });

    html += '</div>';
    host.innerHTML = html;

    var closeBtn = host.querySelector('#menu-close');
    if (closeBtn) closeBtn.addEventListener('click', function () { toggleDrawer(ctx, false); });
  }

  function buildFooter(ctx) {
    var host = document.getElementById('footer');
    if (!host) return;
    host.innerHTML =
      '<div class="site-footer__inner">' +
        '<div>' +
          '<h2>เกี่ยวกับบทเรียนชุดนี้</h2>' +
          '<p class="footer-note">บทเรียน k6 ภาษาไทย เนื้อหาอ้างอิงจากการรัน k6 v2.2.0 จริง ' +
          'ตัวเลขทุกตัวในบทเรียนมาจากผลการรันที่บันทึกไว้ในไฟล์ข้อมูลของเว็บไซต์นี้ ไม่ใช่ค่าประมาณ</p>' +
        '</div>' +
        '<div>' +
          '<h2>เอกสาร k6 ทางการ</h2>' +
          '<ul>' +
            '<li><a href="https://grafana.com/docs/k6/latest/" rel="noopener">คู่มือ k6 (grafana.com)</a></li>' +
            '<li><a href="https://grafana.com/docs/k6/latest/using-k6/metrics/" rel="noopener">metric คืออะไร และมีชนิดใดบ้าง</a></li>' +
            '<li><a href="https://grafana.com/docs/k6/latest/using-k6/metrics/reference/" rel="noopener">นิยาม metric รายตัว (metrics reference)</a></li>' +
            '<li><a href="https://grafana.com/docs/k6/latest/using-k6/thresholds/" rel="noopener">thresholds และ delayAbortEval</a></li>' +
            '<li><a href="https://grafana.com/docs/k6/latest/using-k6/scenarios/" rel="noopener">scenarios และแบบจำลองโหลด</a></li>' +
            '<li><a href="https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/" rel="noopener">executors ทั้ง 6 แบบ</a></li>' +
          '</ul>' +
        '</div>' +
        '<div>' +
          '<h2>ในเว็บนี้</h2>' +
          '<ul>' +
            '<li><a href="' + ctx.root + 'glossary.html">อภิธานศัพท์</a></li>' +
            '<li><a href="' + ctx.root + 'workflow.html">งานจริงของทีม</a></li>' +
            '<li><a href="' + ctx.root + 'troubleshooting.html">แก้ปัญหาที่พบบ่อย</a></li>' +
            '<li><a href="' + ctx.root + 'examples.html">สคริปต์ตัวอย่าง</a></li>' +
            '<li><a href="' + ctx.root + 'progress.html">ความคืบหน้า</a></li>' +
          '</ul>' +
        '</div>' +
        '<div>' +
          '<h2>หมายเหตุ</h2>' +
          '<p class="footer-note">รันโหลดเทสต์เฉพาะกับระบบที่คุณมีสิทธิ์ทดสอบ ' +
          'ตัวอย่างในเว็บนี้ชี้ไปที่ localhost และ test.k6.io เท่านั้น<br>' +
          'ปรับปรุงล่าสุด: <time datetime="' + SITE_UPDATED + '">' + SITE_UPDATED + '</time></p>' +
        '</div>' +
      '</div>';
  }

  /* ---------- drawer ---------- */

  function getBackdrop() {
    var b = document.querySelector('.drawer-backdrop');
    if (!b) {
      b = document.createElement('button');
      b.className = 'drawer-backdrop';
      b.type = 'button';
      b.hidden = true;
      b.setAttribute('aria-label', 'ปิดเมนูหลัก');
      b.addEventListener('click', function () { toggleDrawer(window.LTK6.__ctx, false); });
      document.body.appendChild(b);
    }
    return b;
  }

  function toggleDrawer(ctx, open) {
    var sidebar = document.getElementById('sidebar');
    var toggle = document.getElementById('menu-toggle');
    var backdrop = getBackdrop();
    if (!sidebar || !toggle) return;
    sidebar.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'ปิดเมนูหลัก' : 'เปิดเมนูหลัก');
    backdrop.hidden = !open;
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) {
      var first = sidebar.querySelector('a.sidebar__link');
      if (first) first.focus();
    } else {
      toggle.focus();
    }
  }

  function wireDrawer(ctx) {
    document.addEventListener('keydown', function (evt) {
      var sidebar = document.getElementById('sidebar');
      if (!sidebar || !sidebar.classList.contains('is-open')) return;
      if (evt.key === 'Escape') {
        evt.preventDefault();
        toggleDrawer(ctx, false);
        return;
      }
      if (evt.key === 'Tab') {
        var focusables = sidebar.querySelectorAll('a[href], button:not([disabled])');
        if (!focusables.length) return;
        var first = focusables[0];
        var last = focusables[focusables.length - 1];
        if (evt.shiftKey && document.activeElement === first) {
          evt.preventDefault(); last.focus();
        } else if (!evt.shiftKey && document.activeElement === last) {
          evt.preventDefault(); first.focus();
        }
      }
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 759) {
        var sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.classList.contains('is-open')) toggleDrawer(ctx, false);
      }
    });

    /* ปิด drawer เมื่อกดลิงก์ (เฉพาะจอเล็ก) */
    var sidebar = document.getElementById('sidebar');
    if (sidebar) {
      sidebar.addEventListener('click', function (evt) {
        if (evt.target.closest('a.sidebar__link') && window.innerWidth <= 759) {
          toggleDrawer(ctx, false);
        }
      });
    }
  }

  /* ---------- TOC + scrollspy ---------- */

  function slugify(text, index) {
    var s = text.toLowerCase().replace(/[^a-z0-9ก-๙]+/g, '-').replace(/^-+|-+$/g, '');
    if (!s || /^[0-9]/.test(s)) s = 'sec-' + (index + 1) + (s ? '-' + s : '');
    return s;
  }

  function buildToc(ctx) {
    var host = document.getElementById('toc');
    var article = document.getElementById('main');
    if (!host || !article) return;

    /* ถ้าเคยสร้างไว้แล้ว ให้ถอดตัวดักฟังเดิมออกก่อน กันการทำงานซ้ำ */
    if (tocCtx.onScroll) {
      window.removeEventListener('scroll', tocCtx.onScroll);
      window.removeEventListener('resize', tocCtx.onScroll);
      tocCtx.onScroll = null;
    }

    var heads = article.querySelectorAll('h2, h3');
    if (!heads.length) { host.innerHTML = ''; return; }

    var used = {};
    var items = [];
    Array.prototype.forEach.call(heads, function (h, i) {
      if (h.hasAttribute('data-no-toc')) return;
      if (!h.id) {
        var base = slugify(h.textContent, i);
        var id = base, n = 2;
        while (used[id] || document.getElementById(id)) { id = base + '-' + n++; }
        h.id = id;
      }
      used[h.id] = true;
      items.push({ id: h.id, text: h.textContent.trim(), level: h.tagName === 'H3' ? 3 : 2, el: h });
    });

    if (items.length < 2) { host.innerHTML = ''; return; }

    var html = '<p class="toc__title">ในหน้านี้</p><ul class="toc__list">';
    items.forEach(function (it) {
      html += '<li><a class="toc__link' + (it.level === 3 ? ' is-sub' : '') + '" ' +
        'href="#' + it.id + '">' + it.text + '</a></li>';
    });
    html += '</ul>';
    host.innerHTML = html;

    var links = host.querySelectorAll('.toc__link');
    var current = -1;
    var ticking = false;

    function update() {
      ticking = false;
      var offset = (parseInt(getComputedStyle(document.documentElement).getPropertyValue('--topbar-h'), 10) || 58) + 24;
      var idx = 0;
      for (var i = 0; i < items.length; i++) {
        if (items[i].el.getBoundingClientRect().top <= offset) idx = i;
      }
      /* ถ้าเลื่อนถึงล่างสุด ให้ไฮไลต์รายการสุดท้าย */
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) idx = items.length - 1;
      if (idx === current) return;
      current = idx;
      Array.prototype.forEach.call(links, function (a, i) {
        a.classList.toggle('is-current', i === idx);
        if (i === idx) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }

    tocCtx.onScroll = onScroll;
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  }

  var tocCtx = { onScroll: null };

  /* ---------- ปุ่มคัดลอก ---------- */

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', 'readonly');
        ta.style.position = 'fixed';
        ta.style.top = '-1000px';
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        ok ? resolve() : reject(new Error('copy failed'));
      } catch (err) {
        reject(err);
      }
    });
  }

  function wireCopyButtons() {
    /* 1) code blocks */
    var blocks = document.querySelectorAll('.code-block');
    Array.prototype.forEach.call(blocks, function (block) {
      var pre = block.querySelector('pre');
      if (!pre) return;
      var head = block.querySelector('.code-block__head');
      if (!head) {
        head = document.createElement('div');
        head.className = 'code-block__head';
        var t = document.createElement('span');
        t.className = 'code-block__title';
        t.textContent = 'โค้ด';
        head.appendChild(t);
        block.insertBefore(head, block.firstChild);
      }
      head.appendChild(makeCopyButton(function () { return pre.innerText; }, 'คัดลอกโค้ด'));
    });

    /* 2) ปุ่มคัดลอกแบบกำหนดเอง: data-copy-target="#selector" */
    Array.prototype.forEach.call(document.querySelectorAll('[data-copy-target]'), function (btn) {
      var sel = btn.getAttribute('data-copy-target');
      btn.appendChild(makeCopyButton(function () {
        var src = document.querySelector(sel);
        if (!src) return '';
        return src.innerText;
      }, btn.getAttribute('data-copy-label') || 'คัดลอกผลลัพธ์'));
    });
  }

  function makeCopyButton(getText, label) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'copy-btn';
    btn.innerHTML = icon('copy') + '<span class="copy-btn__text">' + label + '</span>';
    var timer = null;
    btn.addEventListener('click', function () {
      var text = getText();
      var labelEl = btn.querySelector('.copy-btn__text');
      if (!text) {
        labelEl.textContent = 'ไม่มีข้อมูลให้คัดลอก';
        return;
      }
      copyText(text).then(function () {
        btn.classList.add('is-copied');
        labelEl.textContent = 'คัดลอกแล้ว';
      }).catch(function () {
        labelEl.textContent = 'คัดลอกไม่สำเร็จ';
      }).then(function () {
        if (timer) clearTimeout(timer);
        timer = setTimeout(function () {
          btn.classList.remove('is-copied');
          labelEl.textContent = label;
        }, 1800);
      });
    });
    return btn;
  }

  /* ---------- เครื่องหมายอ่านแล้ว + pager ---------- */

  function buildReadAndPager(ctx) {
    var article = document.getElementById('main');
    if (!article) return;
    var page = PAGES[ctx.pageId];
    if (!page || ctx.pageId === 'home') return;

    var isLesson = LESSON_ORDER.indexOf(ctx.pageId) !== -1;

    if (isLesson && ctx.storage) {
      var readAt = ctx.storage.readAt(ctx.pageId);
      var row = document.createElement('div');
      row.className = 'read-row';
      row.innerHTML =
        '<p class="read-row__text">จบบทนี้แล้วหรือยัง? ทำเครื่องหมายไว้เพื่อให้แถบความคืบหน้าจำได้</p>' +
        '<button class="btn btn--small btn--primary" type="button" id="read-toggle">' +
          icon('check') + '<span id="read-toggle-text">ทำเครื่องหมายว่าอ่านแล้ว</span></button>' +
        '<span class="read-row__status" id="read-status"></span>';
      article.appendChild(row);
      syncReadRow(ctx);
      row.querySelector('#read-toggle').addEventListener('click', function () {
        if (ctx.storage.isRead(ctx.pageId)) {
          ctx.storage.unmarkRead(ctx.pageId);
        } else {
          ctx.storage.markRead(ctx.pageId);
        }
        syncReadRow(ctx);
        refreshProgressBadge(ctx);
        refreshSidebarMarks(ctx);
      });
      void readAt;
    }

    var idx = ORDER.indexOf(ctx.pageId);
    var prev = idx > 0 ? ORDER[idx - 1] : null;
    var next = idx >= 0 && idx < ORDER.length - 1 ? ORDER[idx + 1] : null;
    var nav = document.createElement('nav');
    nav.className = 'pager';
    nav.setAttribute('aria-label', 'บทก่อนหน้าและบทถัดไป');
    var html = '';
    if (prev) {
      html += '<a class="pager__prev" href="' + ctx.root + PAGES[prev].file + '">' +
        '<span class="pager__dir">' + icon('prev') + ' ก่อนหน้า</span>' +
        '<span class="pager__title">' + PAGES[prev].title + '</span></a>';
    } else {
      html += '<span class="pager__empty"></span>';
    }
    if (next) {
      html += '<a class="pager__next" href="' + ctx.root + PAGES[next].file + '">' +
        '<span class="pager__dir">ถัดไป ' + icon('next') + '</span>' +
        '<span class="pager__title">' + PAGES[next].title + '</span></a>';
    } else {
      html += '<span class="pager__empty"></span>';
    }
    nav.innerHTML = html;
    article.appendChild(nav);
  }

  function syncReadRow(ctx) {
    var article = document.getElementById('main');
    if (!article) return;
    var row = article.querySelector('.read-row');
    if (!row) return;
    var isRead = ctx.storage.isRead(ctx.pageId);
    row.classList.toggle('is-read', isRead);
    var btnText = row.querySelector('#read-toggle-text');
    var status = row.querySelector('#read-status');
    var btn = row.querySelector('#read-toggle');
    if (isRead) {
      if (btnText) btnText.textContent = 'อ่านแล้ว — กดเพื่อยกเลิก';
      btn.classList.remove('btn--primary');
      var at = ctx.storage.readAt(ctx.pageId);
      status.innerHTML = icon('check') + (at
        ? 'บันทึกเมื่อ ' + ctx.storage.formatDateTime(at)
        : 'บันทึกไว้แล้ว');
    } else {
      if (btnText) btnText.textContent = 'ทำเครื่องหมายว่าอ่านแล้ว';
      btn.classList.add('btn--primary');
      status.textContent = 'ยังไม่ได้ทำเครื่องหมาย';
    }
  }

  function refreshProgressBadge(ctx) {
    var el = document.getElementById('progress-count');
    if (!el || !ctx.storage) return;
    el.textContent = ctx.storage.lessonsReadCount() + '/' + LESSON_ORDER.length;
  }

  function refreshSidebarMarks(ctx) {
    var sidebar = document.getElementById('sidebar');
    if (!sidebar || !ctx.storage) return;
    Array.prototype.forEach.call(sidebar.querySelectorAll('a.sidebar__link'), function (a) {
      var id = a.getAttribute('data-page-id');
      if (!id || id === 'home') return;
      var mark = a.querySelector('.sidebar__mark');
      if (!mark) return;
      var isRead = ctx.storage.isRead(id);
      mark.classList.toggle('is-done', isRead);
      mark.innerHTML = isRead ? PATHS.check : PATHS.circle;
    });
  }

  /* ---------- แจ้งเตือนเมื่อบันทึกไม่ได้ ---------- */

  function storageNotice(ctx) {
    if (!ctx.storage || ctx.storage.available) return;
    var article = document.getElementById('main');
    if (!article || article.querySelector('.storage-notice')) return;
    var div = document.createElement('div');
    div.className = 'callout callout--warn storage-notice';
    div.innerHTML =
      '<div class="callout__head">' + icon('warn') +
        '<span class="label">บันทึกความคืบหน้าไม่ได้</span></div>' +
      '<p>เบราว์เซอร์นี้ไม่อนุญาตให้เว็บไซต์เก็บข้อมูลไว้ในเครื่องคุณ (' +
      ctx.storage.unavailableReason + ') ' +
      'คุณยังอ่านบทเรียนและทำแบบทดสอบได้ตามปกติ แต่คะแนนและเครื่องหมาย "อ่านแล้ว" ' +
      'จะหายไปเมื่อปิดแท็บ</p>' +
      '<p>วิธีแก้: เปิดโหมดปกติ (ไม่ใช่หน้าต่างส่วนตัว) หรืออนุญาตคุกกี้/ที่เก็บข้อมูลไซต์สำหรับหน้านี้</p>';
    article.insertBefore(div, article.firstChild);
  }

  /* ---------- โหลดไฟล์ข้อมูลร่วม ---------- */

  function loadJSON(path) {
    return fetch(path, { cache: 'no-cache' }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + res.statusText);
      return res.json();
    });
  }

  /* ---------- init ---------- */

  function init() {
    var body = document.body;
    var pageId = body.getAttribute('data-page') || 'home';
    var root = body.getAttribute('data-root') || '';

    var ctx = {
      pageId: pageId,
      root: root,
      storage: ROOT.LTK6.storage || null,
      PAGES: PAGES,
      GROUPS: GROUPS,
      ORDER: ORDER,
      LESSON_ORDER: LESSON_ORDER,
      SITE_UPDATED: SITE_UPDATED,
      icon: icon,
      format: format,
      loadJSON: loadJSON
    };
    ROOT.LTK6.__ctx = ctx;
    ROOT.LTK6.page = PAGES[pageId] || null;

    buildTopbar(ctx);
    buildSidebar(ctx);
    buildFooter(ctx);
    buildToc(ctx);
    wireCopyButtons();
    wireDrawer(ctx);
    wireReadProgress();
    buildReadAndPager(ctx);
    storageNotice(ctx);

    /* ถ้าผู้ใช้ยังไม่เคยเลือกธีม ให้ตามการเปลี่ยนแปลงของระบบไปเรื่อย ๆ */
    try {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var onSystemChange = function () {
        if (!theme.stored()) syncThemeButton();
      };
      if (mq.addEventListener) mq.addEventListener('change', onSystemChange);
      else if (mq.addListener) mq.addListener(onSystemChange);
    } catch (err) { /* เบราว์เซอร์เก่าที่ไม่มี matchMedia ก็ข้ามไป */ }

    /* หน้าที่สร้างหัวข้อใหม่ด้วย JavaScript (เช่น หน้า examples) สั่งสร้างสารบัญใหม่ได้ */
    document.addEventListener('ltk6:toc-refresh', function () { buildToc(ctx); });

    /* เปิดให้หน้าอื่น ๆ เรียกใช้หลังบันทึกข้อมูล */
    ROOT.LTK6.refreshShell = function () {
      refreshProgressBadge(ctx);
      refreshSidebarMarks(ctx);
      syncReadRow(ctx);
      storageNotice(ctx);
    };

    document.dispatchEvent(new CustomEvent('ltk6:ready', { detail: ctx }));
  }

  ROOT.LTK6.format = format;
  ROOT.LTK6.icon = icon;
  ROOT.LTK6.copyButton = makeCopyButton;
  ROOT.LTK6.theme = theme;
  ROOT.LTK6.SITE = { PAGES: PAGES, GROUPS: GROUPS, ORDER: ORDER, LESSON_ORDER: LESSON_ORDER, UPDATED: SITE_UPDATED };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
