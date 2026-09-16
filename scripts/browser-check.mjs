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
    { id: 'body',    label: 'ข้อความเนื้อความ',      sel: 'main p, main li, main dd' },
    { id: 'secondary', label: 'ข้อความรอง',          sel: '.source-note, .muted, .section-meta, .chart-caption, .chart-foot, .eyebrow, .card__meta, .stat__label, .field .hint, .quiz-disclaimer, .chart-legend, .glossary-count' },
    { id: 'link',    label: 'ลิงก์',                 sel: 'main a[href], .source-note a[href], footer a[href], .site-footer a[href]' },
    { id: 'codeblock', label: 'โค้ดในบล็อก',          sel: '.code-block pre code, .faq__symptom, .working' },
    { id: 'thead',   label: 'หัวตาราง',              sel: 'table.data thead th, table.data caption' },
    { id: 'badge',   label: 'ป้ายในบล็อกเน้น',        sel: '.callout .label, .takeaways__title, .faq__tag, .label, .stat__value' },
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

/* ---------- 4) ตรวจทุกหน้า × ทุกความกว้าง × ทั้งสองธีม ---------- */

const failures = [];
let totalNavigations = 0;
let totalConsoleErrors = 0;
let totalPageErrors = 0;
let totalBadRequests = 0;
let totalOverflow = 0;
let totalIconOk = 0;
let totalIconBad = 0;
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

      if (problems.length === 0) {
        console.log('  ok   ' + label + '  → 200, favicon 200, ' +
          contrast.reduce((a, c) => a + c.checked, 0) + ' จุดคอนทราสต์, ไม่มี error, ไม่มี overflow');
      } else {
        console.log('  FAIL ' + label);
        for (const p of problems) console.log('         → ' + p);
        failures.push(label + ' → ' + problems.join(' | '));
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
console.log('');

if (failures.length === 0) {
  console.log('ผลลัพธ์: ผ่านทั้งหมด — ทุกหน้า 200 ไม่มี console/page error ไม่มี 404 ไม่มี overflow');
  console.log('         favicon.svg ตอบ 200 ทุกครั้ง ไม่มีคำขอ favicon.ico');
  console.log('         คอนทราสต์ผ่านเกณฑ์ WCAG ทั้งโหมดสว่างและโหมดมืด');
  console.log('         ปุ่มสลับธีมทำงานจริงทุกหน้า จำค่าได้หลังรีเฟรช และธีมถูกตั้งก่อนวาด');
} else {
  console.log('ผลลัพธ์: ไม่ผ่าน ' + failures.length + ' รายการ');
  for (const f of failures) console.log('  - ' + f);
}
console.log('');

process.exit(failures.length === 0 ? 0 : 1);
