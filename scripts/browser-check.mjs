// browser-check.mjs — ตรวจเว็บไซต์ด้วยเบราว์เซอร์จริง (Chromium ผ่าน playwright-core)
// รันด้วย: node scripts/browser-check.mjs
//
// ตรวจอะไร (ทั้งโหมดสว่างและโหมดมืด)
//   1) ทุกหน้าคืนสถานะ 200 และ favicon โหลดได้
//   2) ไม่มี console error และไม่มี page error (exception ที่หลุดจากสคริปต์ในหน้า)
//   3) ไม่มีคำขอใดที่ล้มเหลวหรือได้สถานะ 4xx/5xx (รวม favicon)
//   4) ไม่มี overflow แนวนอนที่ความกว้าง 360, 768 และ 1440 พิกเซล
//   5) คอนทราสต์ของข้อความทุกประเภทผ่านเกณฑ์ WCAG 2.2
//      (4.5:1 สำหรับข้อความปกติ, 3:1 สำหรับตัวใหญ่ ≥24px หรือตัวหนา ≥18.66px)
//   6) ปุ่มสลับธีมทำงานจริง: กดแล้วธีมเปลี่ยน บันทึกค่า และค่าเดิมอยู่หลังรีเฟรช
//   7) ธีมถูกตั้งก่อนวาดครั้งแรก (ตรวจที่ animation frame แรก ซึ่งเกิดก่อน paint)
//
// ตัวสคริปต์เสิร์ฟโฟลเดอร์ site/ ผ่าน HTTP เอง เพราะหน้าต่าง ๆ ดึงไฟล์ JSON
// ด้วย fetch() ซึ่งใช้ไม่ได้ถ้าเปิดด้วย file://
//
// ค่าเริ่มต้นของ playwright-core และ Chromium ชี้ไปที่ที่ติดตั้งไว้ในเครื่องนี้
// ถ้าย้ายที่ให้ตั้งสภาพแวดล้อม PLAYWRIGHT_CORE และ CHROME_PATH ทับ

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const site = path.join(root, 'site');

const PLAYWRIGHT_CORE = process.env.PLAYWRIGHT_CORE ||
  '/Users/ar677005/Documents/AI_workspaces/learns/kafka-simulator/node_modules/playwright-core/index.js';
const CHROME_PATH = process.env.CHROME_PATH ||
  '/Users/ar677005/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/' +
  'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

const WIDTHS = [360, 768, 1440];
const HEIGHT = 900;
const THEMES = ['light', 'dark'];
const THEME_KEY = 'ltk6.theme.v1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
};

/* ---------- 1) เสิร์ฟ site/ ผ่าน HTTP ---------- */

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  let rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  let target = path.join(site, rel);

  /* กัน path traversal ออกนอกโฟลเดอร์ site */
  if (!target.startsWith(site + path.sep) && target !== site) {
    res.writeHead(403).end('forbidden');
    return;
  }
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
    target = path.join(target, 'index.html');
    rel = path.join(rel, 'index.html');
  }
  if (!fs.existsSync(target)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('ไม่พบไฟล์: ' + rel);
    return;
  }
  const body = fs.readFileSync(target);
  res.writeHead(200, {
    'content-type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream',
    'content-length': body.length,
  });
  res.end(body);
});

const port = await new Promise((resolve) => {
  server.listen(0, '127.0.0.1', () => resolve(server.address().port));
});
const base = 'http://127.0.0.1:' + port;
console.log('เสิร์ฟ site/ ที่ ' + base + ' (พอร์ตสุ่ม ไม่ชนกับ mock server)');

/* ---------- 2) รวมรายชื่อหน้า ---------- */

function findAllHtml(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findAllHtml(full, acc);
    else if (entry.name.endsWith('.html')) acc.push(full);
  }
  return acc;
}

const pages = findAllHtml(site).sort().map((f) => '/' + path.relative(site, f).split(path.sep).join('/'));
console.log('พบหน้าทั้งหมด ' + pages.length + ' หน้า');
console.log('ตรวจที่ความกว้าง ' + WIDTHS.join(', ') + ' px × ' + THEMES.length + ' ธีม = ' +
  (pages.length * WIDTHS.length * THEMES.length) + ' ครั้ง');
console.log('');

/* ---------- 3) เปิดเบราว์เซอร์จริง ---------- */

const require = createRequire(import.meta.url);
const { chromium } = require(PLAYWRIGHT_CORE);
const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
const version = browser.version();
console.log('Chromium: ' + version);
console.log('Executable: ' + CHROME_PATH);
console.log('');
console.log('='.repeat(96));

/* ---------- ตัววัดคอนทราสต์ที่ฉีดเข้าไปในหน้า ---------- */
/* คำนวณจากสีที่เบราว์เซอร์คำนวณจริง ไม่ใช่ค่าที่ตั้งใจไว้ใน CSS
   พื้นหลังหาโดยไล่ขึ้นไปตามลำต้นไม้และ compositing ชั้นโปร่งแสงเข้าด้วยกัน */

const CONTRAST_PROBE = `(() => {
  function parseColor(c) {
    const m = String(c).match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const p = m[1].split(',').map((x) => parseFloat(x));
    if (p.length < 3 || p.some((v) => Number.isNaN(v))) return null;
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }
  function over(fg, bg) {
    const a = fg.a;
    return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 };
  }
  function effBg(el) {
    const layers = [];
    let cur = el;
    while (cur && cur.nodeType === 1) {
      const bg = parseColor(getComputedStyle(cur).backgroundColor);
      if (bg && bg.a > 0) {
        layers.push(bg);
        if (bg.a >= 1) break;
      }
      cur = cur.parentElement;
    }
    let out = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = layers.length - 1; i >= 0; i--) out = over(layers[i], out);
    return out;
  }
  function lum(c) {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }
  function ratio(a, b) {
    const l1 = lum(a), l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }
  function visible(el) {
    if (!el.getClientRects().length) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) === 0) return false;
    if ((el.textContent || '').trim() === '') return false;
    return true;
  }

  /* กลุ่มข้อความที่ต้องตรวจ — ผูกกับสิ่งที่ผู้ใช้เห็นจริงในหน้านี้ */
  const GROUPS = [
    { id: 'body',    label: 'ข้อความเนื้อความ',      sel: 'main p, main li, main dd, .check-item__text' },
    { id: 'secondary', label: 'ข้อความรอง',          sel: '.source-note, .muted, .section-meta, .chart-caption, .chart-foot, .eyebrow, .card__meta, .stat__label, .field .hint, .quiz-disclaimer, .chart-legend, .glossary-count, .slider-hint, .field .range-label, .four-word__th, .recall, .check-saved' },
    { id: 'link',    label: 'ลิงก์',                 sel: 'main a[href], .source-note a[href], footer a[href], .site-footer a[href]' },
    { id: 'codeblock', label: 'โค้ดในบล็อก',          sel: '.code-block pre code, .faq__symptom, .working, .anatomy-mark' },
    { id: 'thead',   label: 'หัวตาราง',              sel: 'table.data thead th, table.data caption' },
    { id: 'badge',   label: 'ป้ายในบล็อกเน้น',        sel: '.callout .label, .takeaways__title, .faq__tag, .label, .stat__value, .four-word__label' },
    { id: 'emph',    label: 'ใจความสำคัญ/จุดที่ต้องจำ', sel: '.takeaways li, .keypoint, .key-figure' },
    { id: 'cell',    label: 'ข้อความในตาราง',         sel: 'table.data tbody td' }
  ];
  const PER_GROUP_CAP = 40;
  const out = [];
  GROUPS.forEach((g) => {
    const nodes = Array.from(document.querySelectorAll(g.sel)).filter(visible).slice(0, PER_GROUP_CAP);
    if (!nodes.length) return;
    let worst = null;
    let checked = 0;
    nodes.forEach((el) => {
      const cs = getComputedStyle(el);
      const fg = parseColor(cs.color);
      if (!fg || fg.a === 0) return;
      const bg = effBg(el);
      const fgAbs = fg.a >= 1 ? fg : over(fg, bg);
      const r = ratio(fgAbs, bg);
      const px = parseFloat(cs.fontSize) || 16;
      const weight = parseInt(cs.fontWeight, 10) || 400;
      const isLarge = px >= 24 || (px >= 18.66 && weight >= 700);
      const need = isLarge ? 3 : 4.5;
      checked++;
      if (!worst || r < worst.ratio) {
        worst = {
          ratio: r, need, isLarge, px, weight,
          color: cs.color, bg: 'rgb(' + Math.round(bg.r) + ', ' + Math.round(bg.g) + ', ' + Math.round(bg.b) + ')',
          sample: (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 60),
          tag: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string'
            ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.') : '')
        };
      }
    });
    if (worst) out.push({ id: g.id, label: g.label, checked, worst });
  });
  return out;
})()`;

/* ---------- ตัววัดคอนทราสต์ของคอนโทรลที่ไม่ใช่ข้อความ ----------
   เกณฑ์ WCAG 1.4.11 (Non-text Contrast) คือ 3:1

   ทำไมต้องอ่านจากโทเคนที่เบราว์เซอร์คำนวณ ไม่ได้วัดจากพิกเซลที่วาด:
   Chromium ไม่คืนสไตล์ของ ::-webkit-slider-thumb ผ่าน getComputedStyle
   (คืนค่าเริ่มต้นที่สืบทอดมาจากตัวมันเอง ไม่ใช่ค่าที่เราตั้ง) จึงอ่านค่าโทเคน
   ที่เบราว์เซอร์แก้ var() ให้แล้วในธีมปัจจุบัน แล้ว compositing สีโปร่งแสง
   ของรางลงบนพื้นผิว — เป็นค่าสีชุดเดียวกับที่วาดจริง และตรวจซ้ำได้ทั้งสองธีม */

const UI_CONTRAST_PROBE = `(() => {
  function toRgb(value) {
    const v = String(value).trim();
    const hex = v.replace('#', '');
    if (/^[0-9a-f]{6}$/i.test(hex)) {
      return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16), a: 1 };
    }
    const m = v.match(/rgba?\\(\\s*([\\d.]+)\\s*,\\s*([\\d.]+)\\s*,\\s*([\\d.]+)\\s*(?:,\\s*([\\d.]+)\\s*)?\\)/);
    if (!m) return null;
    return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
  }
  function over(fg, bg) {
    return {
      r: fg.r * fg.a + bg.r * (1 - fg.a),
      g: fg.g * fg.a + bg.g * (1 - fg.a),
      b: fg.b * fg.a + bg.b * (1 - fg.a),
      a: 1
    };
  }
  function lum(c) {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }
  function ratio(a, b) {
    const l1 = lum(a), l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }
  function token(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
  function fmt(c) {
    return 'rgb(' + Math.round(c.r) + ', ' + Math.round(c.g) + ', ' + Math.round(c.b) + ')';
  }

  const accent = toRgb(token('--accent'));
  const surface = toRgb(token('--surface'));
  const pageBg = toRgb(token('--bg'));
  const trackRaw = toRgb(token('--border-strong'));
  if (!accent || !surface || !pageBg || !trackRaw) return { ok: false, reason: 'อ่านค่าโทเคนไม่ครบ' };

  /* รางของสไลเดอร์เป็นสีโปร่งแสงในโหมดมืด จึงต้องทับลงบนพื้นก่อนวัด */
  const track = trackRaw.a >= 1 ? trackRaw : over(trackRaw, pageBg);

  /* ตรวจว่ามีสไลเดอร์จริงในหน้านี้ และ CSS ที่ใช้คือชุดที่วัด */
  const sliders = document.querySelectorAll('.range').length;
  const rangeRule = Array.from(document.styleSheets).some((sheet) => {
    try {
      return Array.from(sheet.cssRules).some((r) => r.selectorText &&
        r.selectorText.indexOf('slider-thumb') !== -1 && /--accent/.test(r.style.background || r.style.backgroundColor || ''));
    } catch (e) { return false; }
  });

  return {
    ok: true,
    theme: document.documentElement.getAttribute('data-theme'),
    sliders,
    rangeRule,
    accent: fmt(accent),
    track: fmt(track),
    surface: fmt(surface),
    pageBg: fmt(pageBg),
    thumbVsTrack: ratio(accent, track),
    thumbVsPage: ratio(accent, pageBg),
    thumbVsSurface: ratio(accent, surface)
  };
})()`;

/* ---------- 4) ตรวจทุกหน้า × ทุกความกว้าง × ทั้งสองธีม ---------- */

const failures = [];
let totalNavigations = 0;
let totalConsoleErrors = 0;
let totalPageErrors = 0;
let totalBadRequests = 0;
let totalOverflow = 0;
let totalIconOk = 0;
let totalIconBad = 0;
let totalSidebarLinkOk = 0;
const sidebarLinkFailures = [];
const iconHrefs = new Set();
const icoRequests = [];
const contrastWorst = new Map(); /* 'theme|id' → { label, ratio, need, where, ... } */
const contrastChecked = new Map(); /* 'theme|id' → จำนวนจุดที่ตรวจ */
const contrastFailures = [];
const themeBgSeen = new Map(); /* theme → Set ของสีพื้นหลัง body ที่พบ */

for (const width of WIDTHS) {
  for (const themeName of THEMES) {
    const context = await browser.newContext({ viewport: { width, height: HEIGHT } });
    /* ตั้งค่าที่บันทึกไว้ก่อนสคริปต์ในหน้า เพื่อบังคับธีมให้แน่นอน
       (ไม่ใช้ colorScheme ของ context เพราะเราต้องการทดสอบเส้นทาง localStorage จริง) */
    await context.addInitScript(([key, value]) => {
      try { localStorage.setItem(key, value); } catch (e) { /* ไม่เป็นไร */ }
    }, [THEME_KEY, themeName]);

    for (const route of pages) {
      const page = await context.newPage();
      const consoleErrors = [];
      const pageErrors = [];
      const badRequests = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', (err) => pageErrors.push(String(err && err.message ? err.message : err)));
      page.on('requestfailed', (req) => {
        badRequests.push(req.url() + ' — ' + ((req.failure() || {}).errorText || 'ล้มเหลว'));
      });
      page.on('response', (res) => {
        if (res.status() >= 400) badRequests.push(res.url() + ' — HTTP ' + res.status());
      });
      page.on('request', (req) => {
        if (/\/favicon\.ico(\?|$)/.test(req.url())) icoRequests.push(route + ' ขอ ' + req.url());
      });

      let status = null;
      let overflow = 0;
      let icon = { href: null, status: null };
      let contrast = [];
      let bg = null;
      let sidebar = null;
      try {
        const res = await page.goto(base + route, { waitUntil: 'load', timeout: 20000 });
        status = res ? res.status() : null;
        /* รอให้สคริปต์ในหน้าทำงานจบ (ดึง JSON แล้ววาดกราฟ/ตาราง) */
        await page.waitForTimeout(400);
        overflow = await page.evaluate(() => {
          const doc = document.documentElement;
          const widest = Math.max(doc.scrollWidth, document.body ? document.body.scrollWidth : 0);
          return Math.max(0, widest - window.innerWidth);
        });
        /* ยืนยันว่าไอคอนที่หน้าประกาศไว้แก้พาธได้จริง และเซิร์ฟเวอร์ตอบ 200
           ไม่ใช่แค่ "ไม่มี 404" เพราะเบราว์เซอร์อาจไม่ยิงขอเลย */
        icon = await page.evaluate(async () => {
          const el = document.querySelector('link[rel="icon"]');
          if (!el) return { href: null, status: null };
          const href = el.getAttribute('href');
          try {
            const r = await fetch(href);
            return { href, status: r.status };
          } catch (e) {
            return { href, status: 'ERROR: ' + e.message };
          }
        });
        bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
        contrast = await page.evaluate(CONTRAST_PROBE);
        /* ลิงก์ไปงานจริงต้องอยู่ในเมนูของทุกหน้า (เมนูสร้างจาก GROUPS ชุดเดียวใน site.js) */
        sidebar = await page.evaluate(() => {
          const a = document.querySelector('#sidebar a[href$="workflow.html"]');
          if (!a) return null;
          const group = a.closest('.sidebar__group');
          const title = group ? (group.querySelector('.sidebar__title') || {}).textContent : null;
          return { href: a.getAttribute('href'), text: a.textContent.trim(), group: title ? title.trim() : null };
        });
      } catch (err) {
        status = 'ERROR: ' + err.message;
      }

      if (icon.href) iconHrefs.add(icon.href);
      if (icon.status === 200) totalIconOk++; else totalIconBad++;
      if (bg) {
        if (!themeBgSeen.has(themeName)) themeBgSeen.set(themeName, new Set());
        themeBgSeen.get(themeName).add(bg);
      }

      totalNavigations++;
      totalConsoleErrors += consoleErrors.length;
      totalPageErrors += pageErrors.length;
      totalBadRequests += badRequests.length;
      if (overflow > 0) totalOverflow++;

      /* เก็บผลคอนทราสต์: เกร็ดที่แย่ที่สุดต่อกลุ่ม ต่อธีม (ข้ามทุกหน้าและทุกความกว้าง) */
      const label = String(width).padStart(4) + 'px  ' + themeName.padEnd(5) + ' ' + route;
      for (const item of contrast) {
        const key = themeName + '|' + item.id;
        contrastChecked.set(key, (contrastChecked.get(key) || 0) + item.checked);
        const prev = contrastWorst.get(key);
        if (!prev || item.worst.ratio < prev.ratio) {
          contrastWorst.set(key, Object.assign({}, item.worst, {
            label: item.label, where: label,
          }));
        }
        if (item.worst.ratio < item.worst.need) {
          contrastFailures.push(label + ' · ' + item.label + ' → ' +
            item.worst.ratio.toFixed(2) + ':1 (ต้อง ≥ ' + item.worst.need + ':1) ' +
            '[' + item.worst.tag + ' ' + item.worst.px + 'px/' + item.worst.weight + ' ' +
            item.worst.color + ' บน ' + item.worst.bg + '] "' + item.worst.sample + '"');
        }
      }

      const problems = [];
      if (status !== 200) problems.push('สถานะไม่ใช่ 200 (' + status + ')');
      if (!icon.href) problems.push('ไม่พบ <link rel="icon"> ในหน้า');
      else if (icon.status !== 200) problems.push('favicon ' + icon.href + ' ตอบ ' + icon.status);
      for (const e of consoleErrors) problems.push('console error: ' + e);
      for (const e of pageErrors) problems.push('page error: ' + e);
      for (const e of badRequests) problems.push('คำขอล้มเหลว: ' + e);
      if (overflow > 0) problems.push('overflow แนวนอน ' + overflow + ' px');
      if (!sidebar) problems.push('เมนูด้านข้างไม่มีลิงก์ไป workflow.html');
      else if (sidebar.group !== 'ใช้งานจริง') {
        problems.push('ลิงก์ไป workflow.html ไม่ได้อยู่ในกลุ่ม "ใช้งานจริง" (พบกลุ่ม ' +
          JSON.stringify(sidebar.group) + ')');
      } else {
        totalSidebarLinkOk++;
      }

      if (problems.length === 0) {
        console.log('  ok   ' + label + '  → 200, favicon 200, ' +
          contrast.reduce((a, c) => a + c.checked, 0) + ' จุดคอนทราสต์, เมนูมีงานจริง, ไม่มี error, ไม่มี overflow');
      } else {
        console.log('  FAIL ' + label);
        for (const p of problems) console.log('         → ' + p);
        failures.push(label + ' → ' + problems.join(' | '));
        if (!sidebar || sidebar.group !== 'ใช้งานจริง') {
          sidebarLinkFailures.push(label + ' → เมนูไม่มีลิงก์ไป workflow.html ในกลุ่มใช้งานจริง');
        }
      }

      await page.close();
    }
    await context.close();
  }
}

/* ---------- 5) ปุ่มสลับธีมทำงานจริง และค่าเดิมอยู่หลังรีเฟรช ---------- */

console.log('');
console.log('='.repeat(96));
console.log('ตรวจปุ่มสลับธีม (กดจริง → บันทึกจริง → รีเฟรชแล้วยังอยู่) และการตั้งธีมก่อนวาด');
console.log('='.repeat(96));

const toggleFailures = [];
const toggleRows = [];

for (const route of pages) {
  /* context ใหม่ที่ยังไม่มีค่าใน localStorage เพื่อเริ่มจากค่าตามระบบ */
  const context = await browser.newContext({ viewport: { width: 1440, height: HEIGHT } });
  const page = await context.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message)));

  let row = { route, initial: null, afterClick: null, stored: null, afterReload: null,
    bgLight: null, bgDark: null, aria: null, ok: true, problems: [] };

  try {
    await page.goto(base + route, { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(250);

    row.initial = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    row.bgLight = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    const hasBtn = await page.$('#theme-toggle');
    if (!hasBtn) {
      row.ok = false;
      row.problems.push('ไม่พบปุ่ม #theme-toggle');
    } else {
      /* ขนาดเป้ากดจริง */
      const box = await hasBtn.boundingBox();
      if (!box || box.width < 24 || box.height < 24) {
        row.ok = false;
        row.problems.push('เป้ากดเล็กกว่า 24×24 CSS px (' +
          (box ? box.width.toFixed(1) + '×' + box.height.toFixed(1) : 'วัดไม่ได้') + ')');
      }
      row.aria = await page.evaluate(() => {
        const b = document.getElementById('theme-toggle');
        return { label: b.getAttribute('aria-label'), pressed: b.getAttribute('aria-pressed') };
      });
      if (!row.aria.label && !row.aria.pressed) {
        row.ok = false;
        row.problems.push('ปุ่มไม่มีทั้ง aria-label และ aria-pressed');
      }

      await page.click('#theme-toggle');
      await page.waitForTimeout(200);
      row.afterClick = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      row.stored = await page.evaluate((k) => localStorage.getItem(k), THEME_KEY);
      row.bgDark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

      if (row.afterClick !== 'dark') {
        row.ok = false;
        row.problems.push('กดครั้งแรกแล้ว data-theme = ' + JSON.stringify(row.afterClick) + ' (ต้องเป็น "dark")');
      }
      if (row.stored !== row.afterClick) {
        row.ok = false;
        row.problems.push('ค่าใน localStorage (' + JSON.stringify(row.stored) +
          ') ไม่ตรงกับธีมที่แสดง (' + JSON.stringify(row.afterClick) + ')');
      }
      if (row.bgLight === row.bgDark) {
        row.ok = false;
        row.problems.push('พื้นหลังไม่เปลี่ยนตามธีม (' + row.bgLight + ' เท่าเดิม)');
      }

      /* รีเฟรช: ค่าเดิมต้องกลับมาใช้ทันที */
      await page.reload({ waitUntil: 'load' });
      await page.waitForTimeout(200);
      row.afterReload = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      if (row.afterReload !== 'dark') {
        row.ok = false;
        row.problems.push('หลังรีเฟรชได้ data-theme = ' + JSON.stringify(row.afterReload) +
          ' (ค่าเดิมไม่ถูกนำกลับมาใช้)');
      }

      /* กดกลับเป็นโหมดสว่าง แล้วรีเฟรช ต้องคงเป็นสว่าง */
      await page.click('#theme-toggle');
      await page.waitForTimeout(200);
      const back = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      await page.reload({ waitUntil: 'load' });
      await page.waitForTimeout(200);
      const backReload = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      if (back !== 'light' || backReload !== 'light') {
        row.ok = false;
        row.problems.push('กดกลับเป็นโหมดสว่างไม่ติด (กด=' + JSON.stringify(back) +
          ', หลังรีเฟรช=' + JSON.stringify(backReload) + ')');
      }
    }
  } catch (err) {
    row.ok = false;
    row.problems.push('เกิดข้อผิดพลาด: ' + err.message);
  }
  if (errs.length) {
    row.ok = false;
    row.problems.push('page error: ' + errs.join(' | '));
  }

  toggleRows.push(row);
  if (!row.ok) toggleFailures.push(route + ' → ' + row.problems.join(' | '));
  await context.close();
}

for (const r of toggleRows) {
  console.log('  ' + (r.ok ? 'ok  ' : 'FAIL') + ' ' + r.route.padEnd(32) +
    ' เริ่ม=' + JSON.stringify(r.initial) + ' กด=' + JSON.stringify(r.afterClick) +
    ' เก็บ=' + JSON.stringify(r.stored) + ' รีเฟรช=' + JSON.stringify(r.afterReload) +
    ' พื้นหลัง ' + r.bgLight + ' → ' + r.bgDark);
}

/* ---------- 6) ธีมถูกตั้งก่อนวาด (animation frame แรก) ---------- */

console.log('');
console.log('='.repeat(96));
console.log('ตรวจว่าธีมถูกตั้งก่อนวาดครั้งแรก (บันทึกค่าที่ animation frame แรก ซึ่งเกิดก่อน paint)');
console.log('='.repeat(96));

const paintFailures = [];
for (const themeName of THEMES) {
  const context = await browser.newContext({ viewport: { width: 1440, height: HEIGHT } });
  /* รันก่อนสคริปต์ใด ๆ ในหน้า: ดักค่าที่ animation frame แรก
     ถ้าธีมถูกตั้งหลัง paint แรก ค่าที่จับได้จะยังว่างหรือเป็นค่าของระบบ */
  await context.addInitScript(([key, value]) => {
    try { localStorage.setItem(key, value); } catch (e) { /* ไม่เป็นไร */ }
    window.__firstFrame = new Promise((resolve) => {
      requestAnimationFrame(() => {
        resolve({
          attr: document.documentElement.getAttribute('data-theme'),
          bg: getComputedStyle(document.body).backgroundColor,
          readyState: document.readyState,
        });
      });
    });
  }, [THEME_KEY, themeName]);

  const page = await context.newPage();
  const samples = [];
  for (const route of pages) {
    await page.goto(base + route, { waitUntil: 'load', timeout: 20000 });
    const first = await page.evaluate(() => window.__firstFrame);
    samples.push({ route, first });
    if (first.attr !== themeName) {
      paintFailures.push(route + ' (' + themeName + ') → ที่เฟรมแรก data-theme = ' +
        JSON.stringify(first.attr));
    }
  }
  const bgs = [...new Set(samples.map((s) => s.first.bg))];
  console.log('  ' + (paintFailures.length ? 'FAIL' : 'ok  ') + ' ธีม ' + themeName.padEnd(5) +
    ' → ตรงทุกหน้า (' + pages.length + '/' + pages.length + '), พื้นหลังที่เฟรมแรก: ' + bgs.join(' | '));
  await context.close();
}

/* ---------- 7) สไลเดอร์คู่กับช่องกรอก: ลากจริง พิมพ์จริง คีย์บอร์ดจริง ---------- */

console.log('');
console.log('='.repeat(96));
console.log('ตรวจสไลเดอร์คู่กับช่องกรอก (ลากจริง → ช่องกรอกเปลี่ยน · พิมพ์ → สไลเดอร์ขยับ · ลูกศรใช้ได้)');
console.log('='.repeat(96));

const sliderFailures = [];
const sliderRows = [];
const uiContrastRows = [];
const uiContrastFailures = [];

for (const themeName of THEMES) {
  const context = await browser.newContext({ viewport: { width: 1440, height: HEIGHT } });
  await context.addInitScript(([key, value]) => {
    try { localStorage.setItem(key, value); } catch (e) { /* ไม่เป็นไร */ }
  }, [THEME_KEY, themeName]);

  const page = await context.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message)));

  const row = { theme: themeName, ok: true, problems: [], checks: 0 };

  function need(condition, message) {
    row.checks++;
    if (!condition) { row.ok = false; row.problems.push(message); }
    return condition;
  }

  try {
    await page.goto(base + '/tools/calculator.html', { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(350);

    /* --- 7.1 ทุกสไลเดอร์มี label ของตัวเอง และ aria-valuetext = ค่า + หน่วย --- */
    const aria = await page.evaluate(() => Array.from(document.querySelectorAll('#main .range')).map((r) => ({
      id: r.id,
      value: r.value,
      unit: r.getAttribute('data-unit'),
      valueText: r.getAttribute('aria-valuetext'),
      hasLabel: !!document.querySelector('label[for="' + r.id + '"]'),
      described: r.getAttribute('aria-describedby')
    })));
    need(aria.length === 11, 'พบสไลเดอร์ ' + aria.length + ' ตัว (ต้องมี 11)');
    const badAria = aria.filter((a) => !a.hasLabel || !a.valueText ||
      a.valueText !== a.value + ' ' + (a.unit || ''));
    need(badAria.length === 0,
      'สไลเดอร์ ' + badAria.length + ' ตัวมี label ไม่ครบ หรือ aria-valuetext ไม่ตรงกับค่า + หน่วย: ' +
      badAria.map((a) => a.id + '="' + a.valueText + '"').join(', '));

    /* --- 7.2 ลากจริงบนราง → ช่องกรอกเปลี่ยนตาม และผลลัพธ์คำนวณใหม่ --- */
    const before = await page.$eval('#sl-tps-N', (el) => el.value);
    const beforeOut = await page.$eval('#tps-output', (el) => el.textContent);
    const box = await page.locator('#sl-tps-N').boundingBox();
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width * 0.2, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.85, y, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(120);

    const afterDrag = await page.evaluate(() => ({
      slider: document.getElementById('sl-tps-N').value,
      input: document.getElementById('tps-N').value,
      valueText: document.getElementById('sl-tps-N').getAttribute('aria-valuetext'),
      out: document.getElementById('tps-output').textContent
    }));
    need(Number(afterDrag.slider) > Number(before),
      'ลากไปทางขวาแล้วค่าสไลเดอร์ไม่เพิ่ม (' + before + ' → ' + afterDrag.slider + ')');
    need(afterDrag.input === afterDrag.slider,
      'ลากสไลเดอร์แล้วช่องกรอกไม่ตรงกัน (สไลเดอร์ ' + afterDrag.slider + ' ช่องกรอก ' + afterDrag.input + ')');
    need(afterDrag.valueText === afterDrag.slider + ' VU',
      'aria-valuetext ไม่อัปเดตตามค่าที่ลาก (' + afterDrag.valueText + ')');
    need(afterDrag.out !== beforeOut && afterDrag.out.includes(afterDrag.slider + ' ÷ ('),
      'ผลลัพธ์ไม่ได้คำนวณใหม่ตามค่าที่ลาก');

    /* --- 7.3 พิมพ์ค่าลงช่อง → สไลเดอร์ขยับตาม --- */
    await page.fill('#tps-N', '250');
    await page.waitForTimeout(100);
    const afterType = await page.evaluate(() => ({
      slider: document.getElementById('sl-tps-N').value,
      valueText: document.getElementById('sl-tps-N').getAttribute('aria-valuetext'),
      out: document.getElementById('tps-output').textContent
    }));
    need(afterType.slider === '250', 'พิมพ์ 250 แล้วสไลเดอร์ไม่ขยับ (ได้ ' + afterType.slider + ')');
    need(afterType.valueText === '250 VU', 'aria-valuetext หลังพิมพ์เป็น ' + afterType.valueText);
    need(afterType.out.includes('250 ÷ ('), 'ผลลัพธ์ไม่ได้คำนวณใหม่ตามค่าที่พิมพ์');

    /* --- 7.4 พิมพ์ค่าที่อยู่นอกช่วงสไลเดอร์ → สไลเดอร์ไม่หนีบ ไม่เขียนกลับลงช่องกรอก --- */
    await page.fill('#tps-N', '900');
    await page.waitForTimeout(100);
    const far = await page.evaluate(() => ({
      input: document.getElementById('tps-N').value,
      slider: document.getElementById('sl-tps-N').value
    }));
    need(far.input === '900', 'ค่าที่พิมพ์นอกช่วงถูกแก้เป็น ' + far.input);
    need(far.slider === '250', 'สไลเดอร์หนีบ/ขยับทั้งที่ค่าอยู่นอกช่วง (ได้ ' + far.slider + ')');

    /* --- 7.5 ค่า 0 และค่าติดลบ: ข้อความเตือนต้องยังทำงานเหมือนเดิม --- */
    const invalid = [
      { id: 'tps-Rt', err: 'err-tps-Rt', value: '0' },
      { id: 'tps-Tt', err: 'err-tps-Tt', value: '-5' }
    ];
    for (const item of invalid) {
      const sliderBefore = await page.$eval('#sl-' + item.id, (el) => el.value);
      await page.fill('#' + item.id, item.value);
      await page.waitForTimeout(100);
      const state = await page.evaluate(([inputId, errId, sliderId]) => ({
        input: document.getElementById(inputId).value,
        slider: document.getElementById(sliderId).value,
        errHidden: document.getElementById(errId).hidden,
        errText: document.getElementById(errId).textContent,
        invalid: document.getElementById(inputId).getAttribute('aria-invalid')
      }), [item.id, item.err, 'sl-' + item.id]);
      need(state.input === item.value, item.id + ': ค่าที่พิมพ์ถูกแก้เป็น ' + state.input);
      need(state.slider === sliderBefore, item.id + ': สไลเดอร์ขยับทั้งที่ค่าไม่ผ่านการตรวจ');
      need(state.errHidden === false && state.errText.length > 0 && state.invalid === 'true',
        item.id + ': ข้อความเตือนไม่ปรากฏเมื่อค่าเป็น ' + item.value);
    }
    /* คืนค่าเดิมก่อนไปข้อถัดไป เพื่อไม่ให้ค่าที่ผิดค้างอยู่ */
    await page.fill('#tps-Rt', '54.25');
    await page.fill('#tps-Tt', '50');

    /* --- 7.6 คีย์บอร์ด: ลูกศรขวาเลื่อนตาม step, Home ไปขอบซ้าย, End ไปขอบขวา --- */
    await page.fill('#tps-R', '5');
    await page.focus('#sl-tps-R');
    const key0 = await page.$eval('#sl-tps-R', (el) => el.value);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(80);
    const key1 = await page.evaluate(() => ({
      slider: document.getElementById('sl-tps-R').value,
      input: document.getElementById('tps-R').value,
      valueText: document.getElementById('sl-tps-R').getAttribute('aria-valuetext')
    }));
    need(Number(key1.slider) === Number(key0) + 1,
      'ลูกศรขวาไม่ได้เลื่อนสไลเดอร์ขึ้น 1 step (' + key0 + ' → ' + key1.slider + ')');
    need(key1.input === key1.slider, 'กดลูกศรแล้วช่องกรอกไม่ตรงกับสไลเดอร์');
    need(key1.valueText === key1.slider + ' request ต่อ iteration',
      'aria-valuetext หลังกดลูกศรเป็น ' + key1.valueText);

    await page.keyboard.press('End');
    await page.waitForTimeout(80);
    const atEnd = await page.evaluate(() => ({
      slider: document.getElementById('sl-tps-R').value,
      input: document.getElementById('tps-R').value
    }));
    need(atEnd.slider === '20', 'กด End แล้วสไลเดอร์ไม่ไปขอบขวา (ได้ ' + atEnd.slider + ')');
    need(atEnd.input === atEnd.slider, 'กด End แล้วช่องกรอกไม่ตรงกับสไลเดอร์');

    /* --- 7.7 ปุ่ม "ใส่ค่าจากการรันจริง" ต้องดึงสไลเดอร์กลับมาด้วย --- */
    await page.click('#form-tps [data-example]');
    await page.waitForTimeout(150);
    const example = await page.evaluate(() => ({
      input: document.getElementById('tps-N').value,
      slider: document.getElementById('sl-tps-N').value,
      rt: document.getElementById('sl-tps-Rt').value,
      valueText: document.getElementById('sl-tps-Rt').getAttribute('aria-valuetext')
    }));
    need(example.input === example.slider, 'ปุ่มใส่ค่าตัวอย่างแล้วช่องกรอกกับสไลเดอร์ไม่ตรงกัน');
    need(example.rt === '54.25' && example.valueText === '54.25 มิลลิวินาที',
      'ปุ่มใส่ค่าตัวอย่างไม่ได้ดึงสไลเดอร์ Rt กลับมาที่ 54.25 (ได้ ' + example.rt + ')');

    /* --- 7.8 ปุ่มล้างค่าต้องดึงสไลเดอร์กลับมาที่ค่าตั้งต้นใน HTML --- */
    await page.click('#form-tps button[type="reset"]');
    await page.waitForTimeout(150);
    const reset = await page.evaluate(() => ({
      input: document.getElementById('tps-N').value,
      slider: document.getElementById('sl-tps-N').value
    }));
    need(reset.input === reset.slider && reset.slider === '10',
      'ปุ่มล้างค่าแล้วสไลเดอร์ไม่กลับมาที่ค่าตั้งต้น (ช่องกรอก ' + reset.input + ', สไลเดอร์ ' + reset.slider + ')');

    /* --- 7.9 คอนทราสต์ของ thumb/track และช่องทำเครื่องหมาย (เกณฑ์ 3:1) --- */
    const ui = await page.evaluate(UI_CONTRAST_PROBE);
    if (!ui.ok) {
      row.ok = false;
      row.problems.push('อ่านค่าโทเคนสำหรับวัดคอนทราสต์ไม่สำเร็จ: ' + ui.reason);
    } else {
      uiContrastRows.push(Object.assign({ theme: themeName }, ui));
      if (ui.sliders !== 11) need(false, 'พบสไลเดอร์ ' + ui.sliders + ' ตัวในหน้า (ต้องมี 11)');
      if (!ui.rangeRule) {
        need(false, 'ไม่พบกฎ CSS ที่ตั้งสีหัวเลื่อนด้วย var(--accent) — วัดจากสีอื่นอยู่');
      }
      const minRatio = 3;
      if (!(ui.thumbVsTrack >= minRatio)) {
        need(false, 'หัวเลื่อนตัดกับรางเพียง ' + ui.thumbVsTrack.toFixed(2) + ':1 (ต้อง ≥ 3:1)');
        uiContrastFailures.push(themeName + ' thumb/track = ' + ui.thumbVsTrack.toFixed(2) + ':1');
      }
      if (!(ui.thumbVsPage >= minRatio)) {
        need(false, 'หัวเลื่อนตัดกับพื้นหลังหน้าเพียง ' + ui.thumbVsPage.toFixed(2) + ':1 (ต้อง ≥ 3:1)');
        uiContrastFailures.push(themeName + ' thumb/พื้นหลัง = ' + ui.thumbVsPage.toFixed(2) + ':1');
      }
      if (!(ui.thumbVsSurface >= minRatio)) {
        need(false, 'หัวเลื่อนตัดกับพื้นผิวการ์ดเพียง ' + ui.thumbVsSurface.toFixed(2) + ':1 (ต้อง ≥ 3:1)');
        uiContrastFailures.push(themeName + ' thumb/พื้นผิว = ' + ui.thumbVsSurface.toFixed(2) + ':1');
      }
    }
  } catch (err) {
    row.ok = false;
    row.problems.push('เกิดข้อผิดพลาด: ' + err.message);
  }
  if (errs.length) {
    row.ok = false;
    row.problems.push('page error: ' + errs.join(' | '));
  }

  sliderRows.push(row);
  if (!row.ok) sliderFailures.push(themeName + ' → ' + row.problems.join(' | '));
  console.log('  ' + (row.ok ? 'ok  ' : 'FAIL') + ' ธีม ' + themeName.padEnd(5) +
    ' ตรวจ ' + row.checks + ' ข้อ' + (row.ok ? ' ผ่านทั้งหมด' : ''));
  for (const p of row.problems) console.log('         → ' + p);
  await context.close();
}

/* ---------- 8) เช็คลิสต์ก่อนกดรัน: ติ๊ก → รีเฟรชแล้วยังอยู่ → รีเซ็ตต้องถามก่อน ---------- */

console.log('');
console.log('='.repeat(96));
console.log('ตรวจเช็คลิสต์ก่อนกดรัน (ติ๊กจริง → รีเฟรชยังอยู่ → ปุ่มรีเซ็ตถามยืนยันก่อนล้าง)');
console.log('='.repeat(96));

const CHECK_KEY = 'ltk6.checklist.v1';
const checklistFailures = [];
let checklistChecks = 0;
const checklistProblems = [];

function needChecklist(condition, message) {
  checklistChecks++;
  if (!condition) checklistProblems.push(message);
  return condition;
}

{
  const context = await browser.newContext({ viewport: { width: 1440, height: HEIGHT } });
  const page = await context.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message)));

  let dialogMode = 'dismiss';
  let dialogCount = 0;
  let lastDialog = '';
  page.on('dialog', async (dlg) => {
    dialogCount++;
    lastDialog = dlg.message();
    if (dialogMode === 'accept') await dlg.accept();
    else await dlg.dismiss();
  });

  try {
    await page.goto(base + '/workflow.html', { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(300);

    const initial = await page.evaluate(() => ({
      boxes: document.querySelectorAll('#main .checklist input[type="checkbox"]').length,
      ticked: document.querySelectorAll('#main .checklist input[type="checkbox"]:checked').length,
      count: document.getElementById('check-count').textContent.trim(),
      now: document.getElementById('check-bar').getAttribute('aria-valuenow')
    }));
    needChecklist(initial.boxes === 8, 'พบ checkbox ' + initial.boxes + ' ตัว (ต้องมี 8)');
    needChecklist(initial.ticked === 0 && initial.count === 'ติ๊กแล้ว 0/8',
      'สถานะเริ่มต้นไม่ใช่ 0/8 (ได้ "' + initial.count + '")');
    needChecklist(initial.now === '0', 'aria-valuenow เริ่มต้นเป็น ' + initial.now);

    /* ติ๊ก 3 ข้อด้วยคีย์บอร์ดและเมาส์จริง */
    await page.click('label[for="ck-1"]');
    await page.focus('#ck-2');
    await page.keyboard.press('Space');
    await page.click('label[for="ck-5"]');
    await page.waitForTimeout(150);

    const afterTick = await page.evaluate((k) => {
      let stored = null;
      try { stored = JSON.parse(localStorage.getItem(k)); } catch (e) { stored = 'ERROR'; }
      return {
        count: document.getElementById('check-count').textContent.trim(),
        now: document.getElementById('check-bar').getAttribute('aria-valuenow'),
        fill: document.getElementById('check-fill').style.width,
        done: document.querySelectorAll('#main .check-item.is-done').length,
        stored: stored
      };
    }, CHECK_KEY);

    needChecklist(afterTick.count === 'ติ๊กแล้ว 3/8',
      'แถบความคืบหน้าไม่เป็น 3/8 (ได้ "' + afterTick.count + '")');
    needChecklist(afterTick.now === '3', 'aria-valuenow เป็น ' + afterTick.now + ' หลังติ๊ก 3 ข้อ');
    needChecklist(afterTick.fill === '37.5%', 'ความกว้างแถบเป็น ' + afterTick.fill + ' (คาด 37.5%)');
    needChecklist(afterTick.done === 3, 'จำนวนแถวที่ทำเครื่องหมายเป็น ' + afterTick.done);
    needChecklist(afterTick.stored && afterTick.stored.version === 1 &&
      Object.keys(afterTick.stored.checked || {}).length === 3,
      'ค่าใน localStorage (' + CHECK_KEY + ') ไม่ถูกต้อง: ' + JSON.stringify(afterTick.stored));

    /* รีเฟรชแล้วค่าต้องยังอยู่ */
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(300);
    const afterReload = await page.evaluate(() => ({
      ticked: document.querySelectorAll('#main .checklist input[type="checkbox"]:checked').length,
      count: document.getElementById('check-count').textContent.trim()
    }));
    needChecklist(afterReload.ticked === 3 && afterReload.count === 'ติ๊กแล้ว 3/8',
      'หลังรีเฟรชค่าหายไป (ติ๊กอยู่ ' + afterReload.ticked + ' ข้อ, "' + afterReload.count + '")');

    /* ปุ่มรีเซ็ต: กดแล้วต้องมี dialog ก่อน และการกด "ยกเลิก" ต้องไม่ล้าง */
    dialogMode = 'dismiss';
    const dialogsBefore = dialogCount;
    await page.click('#check-reset');
    await page.waitForTimeout(250);
    needChecklist(dialogCount === dialogsBefore + 1,
      'กดปุ่มรีเซ็ตแล้วไม่มีกล่องยืนยันขึ้นมา');
    needChecklist(/8/.test(lastDialog), 'ข้อความยืนยันไม่ได้บอกจำนวนข้อที่จะล้าง: "' + lastDialog + '"');
    const afterDismiss = await page.evaluate(() => ({
      ticked: document.querySelectorAll('#main .checklist input[type="checkbox"]:checked').length,
      stored: localStorage.getItem('ltk6.checklist.v1')
    }));
    needChecklist(afterDismiss.ticked === 3,
      'กดยกเลิกแล้วเครื่องหมายถูกล้างไปด้วย (เหลือ ' + afterDismiss.ticked + ' ข้อ)');
    needChecklist(afterDismiss.stored !== null, 'กดยกเลิกแล้วค่าใน localStorage ถูกลบ');

    /* ยืนยัน → ล้างจริง */
    dialogMode = 'accept';
    await page.click('#check-reset');
    await page.waitForTimeout(250);
    const afterAccept = await page.evaluate((k) => ({
      ticked: document.querySelectorAll('#main .checklist input[type="checkbox"]:checked').length,
      count: document.getElementById('check-count').textContent.trim(),
      now: document.getElementById('check-bar').getAttribute('aria-valuenow'),
      stored: localStorage.getItem(k)
    }), CHECK_KEY);
    needChecklist(afterAccept.ticked === 0 && afterAccept.count === 'ติ๊กแล้ว 0/8',
      'กดยืนยันแล้วยังไม่ล้าง (เหลือ ' + afterAccept.ticked + ' ข้อ, "' + afterAccept.count + '")');
    needChecklist(afterAccept.now === '0', 'aria-valuenow หลังล้างเป็น ' + afterAccept.now);
    needChecklist(afterAccept.stored === null || afterAccept.stored === '',
      'ล้างแล้วแต่ค่ายังอยู่ใน localStorage: ' + afterAccept.stored);

    /* คีย์ของเช็คลิสต์ต้องไม่ปนกับคีย์ความคืบหน้าของบทเรียน */
    const progressKeyTouched = await page.evaluate(() => localStorage.getItem('ltk6.progress.v1'));
    needChecklist(progressKeyTouched === null,
      'การติ๊กเช็คลิสต์ไปเขียนคีย์ ltk6.progress.v1 ของบทเรียน');
  } catch (err) {
    checklistProblems.push('เกิดข้อผิดพลาด: ' + err.message);
  }
  if (errs.length) checklistProblems.push('page error: ' + errs.join(' | '));

  const ok = checklistProblems.length === 0;
  if (!ok) checklistFailures.push(...checklistProblems);
  console.log('  ' + (ok ? 'ok  ' : 'FAIL') + ' ตรวจ ' + checklistChecks + ' ข้อ' +
    (ok ? ' ผ่านทั้งหมด' : ''));
  for (const p of checklistProblems) console.log('         → ' + p);
  await context.close();
}

/* ---------- 9) หน้ากายวิภาค: เครื่องหมายในโค้ดต้องตรงกับรายการคำอธิบาย ---------- */

console.log('');
console.log('='.repeat(96));
console.log('ตรวจกายวิภาคของสคริปต์ k6 (โค้ดที่แสดงมาจากไฟล์จริง และหมายเลขตรงกับคำอธิบาย)');
console.log('='.repeat(96));

const anatomyFailures = [];
{
  const context = await browser.newContext({ viewport: { width: 1440, height: HEIGHT } });
  const page = await context.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message)));
  const problems = [];
  let checks = 0;
  const need = (cond, msg) => { checks++; if (!cond) problems.push(msg); };

  try {
    await page.goto(base + '/examples.html', { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(800);
    const data = await page.evaluate(() => {
      const code = document.querySelector('#anatomy-block pre code');
      const marks = Array.from(document.querySelectorAll('#anatomy-block .anatomy-mark'));
      const list = Array.from(document.querySelectorAll('.anatomy-list > li .anatomy-mark'));
      /* ถอด <span class="anatomy-mark"> ออกแล้วข้อความที่เหลือต้องตรงกับไฟล์จริงทุกไบต์ */
      let stripped = '';
      let lineCount = 0;
      if (code) {
        const clone = code.cloneNode(true);
        clone.querySelectorAll('.anatomy-mark').forEach((m) => m.remove());
        stripped = clone.textContent;
        lineCount = stripped.split('\n').length;
      }
      return {
        hasCode: !!code,
        stripped: stripped,
        markCount: marks.length,
        markChars: marks.map((m) => m.textContent.trim()),
        listCount: list.length,
        listChars: list.map((m) => m.textContent.trim()),
        lineCount: lineCount
      };
    });
    need(data.hasCode, 'ไม่พบบล็อกโค้ดของกายวิภาคในหน้า');
    need(data.markCount >= 7, 'พบเครื่องหมายในโค้ด ' + data.markCount + ' ตัว (ต้องมีอย่างน้อย 7)');
    need(data.markCount === data.listCount,
      'จำนวนเครื่องหมายในโค้ด (' + data.markCount + ') ไม่เท่ากับจำนวนในรายการคำอธิบาย (' + data.listCount + ')');
    need(JSON.stringify(data.markChars) === JSON.stringify(data.listChars),
      'ชุดเครื่องหมายในโค้ดกับในรายการไม่ตรงกัน: ' + data.markChars.join('') + ' กับ ' + data.listChars.join(''));
    /* ข้อความโค้ดที่ถอดเครื่องหมายออกแล้วต้องตรงกับไฟล์จริง — พิสูจน์ว่าโค้ดที่แสดงรันได้จริง */
    const realFile = fs.readFileSync(path.join(site, 'examples', 'load.js'), 'utf8');
    need(data.stripped === realFile,
      'ถอดเครื่องหมายออกแล้วข้อความไม่ตรงกับไฟล์ examples/load.js (ยาว ' +
      data.stripped.length + ' กับ ' + realFile.length + ' อักขระ)');
    need(data.lineCount > 60, 'โค้ดที่แสดงสั้นผิดปกติ (' + data.lineCount + ' บรรทัด)');
  } catch (err) {
    problems.push('เกิดข้อผิดพลาด: ' + err.message);
  }
  if (errs.length) problems.push('page error: ' + errs.join(' | '));

  const ok = problems.length === 0;
  if (!ok) anatomyFailures.push(...problems);
  console.log('  ' + (ok ? 'ok  ' : 'FAIL') + ' ตรวจ ' + checks + ' ข้อ' + (ok ? ' ผ่านทั้งหมด' : ''));
  for (const p of problems) console.log('         → ' + p);
  await context.close();
}

await browser.close();
server.close();

/* ---------- สรุปผล ---------- */

console.log('');
console.log('='.repeat(96));
console.log('สรุปผลคอนทราสต์ — ค่าแย่ที่สุดของแต่ละกลุ่มข้อความ แยกตามธีม (รวมทุกหน้า ทุกความกว้าง)');
console.log('='.repeat(96));
console.log('  ' + 'กลุ่มข้อความ'.padEnd(24) + 'ธีม'.padEnd(7) + 'จุดที่ตรวจ'.padStart(10) +
  'แย่ที่สุด'.padStart(11) + 'ต้องได้'.padStart(9) + '   ตัวอย่างที่แย่ที่สุด');
console.log('  ' + '-'.repeat(94));

const CONTRAST_ORDER = ['body', 'secondary', 'link', 'codeblock', 'thead', 'badge', 'emph', 'cell'];
let contrastPass = true;
for (const themeName of THEMES) {
  for (const id of CONTRAST_ORDER) {
    const key = themeName + '|' + id;
    const w = contrastWorst.get(key);
    if (!w) continue;
    const ok = w.ratio >= w.need;
    if (!ok) contrastPass = false;
    console.log('  ' + (w.label || id).padEnd(24) + themeName.padEnd(7) +
      String(contrastChecked.get(key) || 0).padStart(10) +
      (w.ratio.toFixed(2) + ':1').padStart(11) +
      (w.need + ':1').padStart(9) + '   ' + (ok ? 'ok  ' : 'FAIL') + ' ' +
      w.tag + ' ' + w.px + 'px/' + w.weight + ' ' + w.color + ' บน ' + w.bg);
  }
  console.log('');
}
console.log('  เกณฑ์: 4.5:1 สำหรับข้อความปกติ · 3:1 สำหรับตัวใหญ่ ≥24px หรือตัวหนา ≥18.66px');

console.log('');
console.log('='.repeat(96));
console.log('สรุปผลคอนทราสต์ของคอนโทรลที่ไม่ใช่ข้อความ — เกณฑ์ WCAG 1.4.11 ขั้นต่ำ 3:1');
console.log('='.repeat(96));
console.log('  ' + 'ธีม'.padEnd(7) + 'หัวเลื่อน'.padStart(11) + 'ราง'.padStart(19) +
  'เทียบราง'.padStart(10) + 'เทียบพื้นหน้า'.padStart(13) + 'เทียบพื้นผิว'.padStart(13));

for (const row of uiContrastRows) {
  const ok = row.thumbVsTrack >= 3 && row.thumbVsPage >= 3 && row.thumbVsSurface >= 3;
  console.log('  ' + row.theme.padEnd(7) + row.accent.padStart(11) +
    row.track.padStart(19) +
    (row.thumbVsTrack.toFixed(2) + ':1').padStart(10) +
    (row.thumbVsPage.toFixed(2) + ':1').padStart(13) +
    (row.thumbVsSurface.toFixed(2) + ':1').padStart(13) + '   ' + (ok ? 'ok  ' : 'FAIL'));
}
console.log('  หมายเหตุ: อ่านค่าจากโทเคนที่เบราว์เซอร์แก้ var() แล้วในธีมนั้น และ compositing สีโปร่งแสงของรางลงบนพื้น');
console.log('            (Chromium ไม่คืนสไตล์ของ ::-webkit-slider-thumb ผ่าน getComputedStyle จึงวัดจากสีชุดเดียวกับที่วาดจริง)');

console.log('');
console.log('='.repeat(96));
console.log('สรุปผลการตรวจด้วยเบราว์เซอร์จริง');
console.log('  จำนวนหน้าที่ตรวจ        : ' + pages.length + ' หน้า × ' + WIDTHS.length +
  ' ความกว้าง × ' + THEMES.length + ' ธีม = ' + totalNavigations + ' ครั้ง');
console.log('  Chromium เวอร์ชัน        : ' + version);
console.log('  หน้าที่ไม่ใช่ 200        : ' + failures.filter((f) => f.includes('สถานะไม่ใช่ 200')).length);
console.log('  favicon ที่โหลดได้ 200   : ' + totalIconOk + ' จาก ' + (totalIconOk + totalIconBad) + ' ครั้ง');
console.log('  พาธ favicon ที่พบ        : ' + [...iconHrefs].join(', '));
console.log('  คำขอ /favicon.ico        : ' + icoRequests.length + (icoRequests.length ? ' → ' + icoRequests.join(' | ') : ' (ไม่มีเลย)'));
console.log('  console error ทั้งหมด     : ' + totalConsoleErrors);
console.log('  page error ทั้งหมด        : ' + totalPageErrors);
console.log('  คำขอที่ล้มเหลว/4xx-5xx    : ' + totalBadRequests);
console.log('  หน้าที่มี overflow แนวนอน : ' + totalOverflow);
console.log('  จุดคอนทราสต์ที่ตรวจ       : ' + [...contrastChecked.values()].reduce((a, b) => a + b, 0));
console.log('  คอนทราสต์ที่ไม่ผ่าน       : ' + contrastFailures.length);
console.log('  เมนูมีลิงก์งานจริง        : ' + totalSidebarLinkOk + ' จาก ' + totalNavigations + ' ครั้ง');
console.log('  สไลเดอร์ซิงก์/ธีม         : ' + sliderRows.filter((r) => r.ok).length + ' จาก ' + sliderRows.length + ' ธีม ผ่าน');
console.log('  เช็คลิสต์                 : ' + (checklistFailures.length === 0 ? 'ผ่าน ' + checklistChecks + ' ข้อ' : 'ไม่ผ่าน'));
console.log('  กายวิภาค                 : ' + (anatomyFailures.length === 0 ? 'ผ่าน' : 'ไม่ผ่าน'));
console.log('  คอนทราสต์ track/thumb     : ' + uiContrastFailures.length + ' รายการที่ไม่ผ่าน');
console.log('  ปุ่มสลับธีมที่ไม่ผ่าน     : ' + toggleFailures.length + ' จาก ' + pages.length + ' หน้า');
console.log('  หน้าที่ตั้งธีมไม่ทันก่อนวาด: ' + paintFailures.length);
console.log('  พื้นหลัง body ต่อธีม      : ' + THEMES.map((t) =>
  t + ' = ' + [...(themeBgSeen.get(t) || [])].join('/')).join(' · '));
console.log('  รวมหน้าที่มีปัญหา        : ' + failures.length);
console.log('');

/* เงื่อนไขผ่าน: ไม่มีปัญหาใด ๆ, favicon ทุกครั้งได้ 200, ไม่มีคำขอ /favicon.ico หลุดออกไป,
   คอนทราสต์ผ่านทุกกลุ่มทั้งสองธีม, ปุ่มสลับธีมทำงานจริงทุกหน้า และธีมถูกตั้งก่อนวาด */
const iconFailures = failures.filter((f) => f.includes('favicon') || f.includes('link rel'));
if (totalIconBad > 0) {
  console.log('ไม่ผ่าน: มี favicon ที่โหลดไม่ได้ ' + totalIconBad + ' ครั้ง');
  failures.push('favicon โหลดไม่ได้ ' + totalIconBad + ' ครั้ง');
}
if (icoRequests.length > 0) {
  console.log('ไม่ผ่าน: ยังมีคำขอ /favicon.ico ซึ่งแปลว่าบางหน้าไม่ได้ประกาศไอคอน');
  failures.push('มีคำขอ /favicon.ico ' + icoRequests.length + ' ครั้ง');
}
if (iconFailures.length > 0) console.log('ไม่ผ่าน: พบปัญหาเรื่องไอคอน ' + iconFailures.length + ' รายการ');
if (!contrastPass || contrastFailures.length > 0) {
  console.log('ไม่ผ่าน: คอนทราสต์ต่ำกว่าเกณฑ์ WCAG ' + contrastFailures.length + ' จุด');
  for (const f of contrastFailures.slice(0, 12)) {
    console.log('  - ' + f);
    failures.push('คอนทราสต์: ' + f);
  }
}
if (toggleFailures.length > 0) {
  console.log('ไม่ผ่าน: ปุ่มสลับธีมหรือการจำค่ามีปัญหา ' + toggleFailures.length + ' หน้า');
  for (const f of toggleFailures) {
    console.log('  - ' + f);
    failures.push('ปุ่มสลับธีม: ' + f);
  }
}
if (paintFailures.length > 0) {
  console.log('ไม่ผ่าน: มีหน้าที่ตั้งธีมไม่ทันก่อนวาด ' + paintFailures.length + ' หน้า');
  for (const f of paintFailures.slice(0, 10)) {
    console.log('  - ' + f);
    failures.push('ตั้งธีมก่อนวาด: ' + f);
  }
}
if (sidebarLinkFailures.length > 0) {
  console.log('ไม่ผ่าน: มีหน้าที่เมนูไม่มีลิงก์ไปงานจริง ' + sidebarLinkFailures.length + ' หน้า');
  for (const f of sidebarLinkFailures.slice(0, 10)) {
    console.log('  - ' + f);
    failures.push('เมนูไม่มีลิงก์งานจริง: ' + f);
  }
}
if (sliderFailures.length > 0) {
  console.log('ไม่ผ่าน: สไลเดอร์คู่กับช่องกรอกมีปัญหา ' + sliderFailures.length + ' ธีม');
  for (const f of sliderFailures) {
    console.log('  - ' + f);
    failures.push('สไลเดอร์: ' + f);
  }
}
if (checklistFailures.length > 0) {
  console.log('ไม่ผ่าน: เช็คลิสต์ก่อนกดรันมีปัญหา ' + checklistFailures.length + ' ข้อ');
  for (const f of checklistFailures) {
    console.log('  - ' + f);
    failures.push('เช็คลิสต์: ' + f);
  }
}
if (anatomyFailures.length > 0) {
  console.log('ไม่ผ่าน: กายวิภาคของสคริปต์มีปัญหา ' + anatomyFailures.length + ' ข้อ');
  for (const f of anatomyFailures) {
    console.log('  - ' + f);
    failures.push('กายวิภาค: ' + f);
  }
}
if (uiContrastFailures.length > 0) {
  console.log('ไม่ผ่าน: คอนทราสต์ของหัวเลื่อนสไลเดอร์ต่ำกว่า 3:1 ' + uiContrastFailures.length + ' รายการ');
  for (const f of uiContrastFailures) {
    console.log('  - ' + f);
    failures.push('คอนทราสต์สไลเดอร์: ' + f);
  }
}
console.log('');

if (failures.length === 0) {
  console.log('ผลลัพธ์: ผ่านทั้งหมด — ทุกหน้า 200 ไม่มี console/page error ไม่มี 404 ไม่มี overflow');
  console.log('         favicon.svg ตอบ 200 ทุกครั้ง ไม่มีคำขอ favicon.ico');
  console.log('         คอนทราสต์ผ่านเกณฑ์ WCAG ทั้งโหมดสว่างและโหมดมืด รวมหัวเลื่อนสไลเดอร์ (≥ 3:1)');
  console.log('         ปุ่มสลับธีมทำงานจริงทุกหน้า จำค่าได้หลังรีเฟรช และธีมถูกตั้งก่อนวาด');
  console.log('         ทุกหน้ามีลิงก์ไปงานจริงในเมนู · สไลเดอร์ซิงก์สองทาง · เช็คลิสต์จำค่าได้และถามก่อนล้าง');
  console.log('         กายวิภาคแสดงโค้ดจากไฟล์จริง และหมายเลขตรงกับคำอธิบายครบ');
} else {
  console.log('ผลลัพธ์: ไม่ผ่าน ' + failures.length + ' รายการ');
  for (const f of failures) console.log('  - ' + f);
}
console.log('');

process.exit(failures.length === 0 ? 0 : 1);
