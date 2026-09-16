// verify-site.mjs — ตรวจคุณภาพเว็บไซต์แบบคงที่ (static) ก่อนส่งงาน
// รันด้วย: node scripts/verify-site.mjs
// ไม่ใช้ dependency ภายนอก และไม่แก้ไฟล์ใด ๆ
//
// การตรวจทั้ง 8 กลุ่ม
//   1) ไฟล์ที่ต้องมีอยู่จริง และทุกหน้าอ้าง CSS กับ JS หลัก
//   2) ลิงก์ภายในทุกตัวชี้ไปไฟล์ที่มีอยู่จริง
//   3) ไม่มี asset ภายนอก (src/href ของ CSS, JS, รูป, url() ใน CSS)
//   4) ไม่มีข้อความต้องห้ามที่ผู้ใช้เห็น
//   5) html lang="th" ทุกหน้า มี title กับ meta description และมี favicon ครบ
//   6) ไม่มีอักขระ emoji ในหน้าเว็บ
//   7) สคริปต์ในหน้าและไฟล์ JS ทั้งหมดต้องผ่านการตรวจไวยากรณ์
//   8) ความสอดคล้องของไฟล์ข้อมูลกับหน้าที่อ่านมัน

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const site = path.join(root, 'site');

/* ---------- โครงสร้างผลการตรวจ ---------- */

const groups = [];
let current = null;

function group(id, title) {
  current = { id, title, checks: [], errors: [], notes: [] };
  groups.push(current);
  return current;
}

function pass(message, detail) {
  current.checks.push({ ok: true, message, detail: detail || '' });
}

function fail(message, detail) {
  current.checks.push({ ok: false, message, detail: detail || '' });
  current.errors.push(message + (detail ? ' — ' + detail : ''));
}

function note(message) {
  current.notes.push(message);
}

function check(condition, okMessage, failMessage, detail) {
  if (condition) pass(okMessage, detail); else fail(failMessage, detail);
  return condition;
}

/* ---------- ตัวช่วยอ่านไฟล์ ---------- */

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function findAllHtml(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      findAllHtml(full, acc);
    } else if (entry.name.endsWith('.html')) {
      acc.push(full);
    }
  }
  return acc;
}

/* ตัดบล็อก script, style และคอมเมนต์ HTML ออกก่อนตรวจลิงก์
   เพราะในสคริปต์มีการประกอบที่อยู่ด้วยเทมเพลตสตริง ซึ่งไม่ใช่ลิงก์จริงในเอกสาร */
function stripNonMarkup(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ');
}

/* ---------- 1) ไฟล์ที่ต้องมีอยู่จริง ---------- */

const REQUIRED = [
  'site/index.html',
  'site/lessons/01-tps.html',
  'site/lessons/02-vu.html',
  'site/lessons/03-metrics.html',
  'site/lessons/04-percentiles.html',
  'site/lessons/05-load-profiles.html',
  'site/lessons/06-read-results.html',
  'site/tools/calculator.html',
  'site/tools/latency.html',
  'site/quiz.html',
  'site/progress.html',
  'site/glossary.html',
  'site/troubleshooting.html',
  'site/examples.html',
  'site/favicon.svg',
  'site/assets/css/main.css',
  'site/assets/js/site.js',
  'site/assets/js/storage.js',
  'site/assets/js/calc.js',
  'site/assets/js/quiz.js',
  'site/assets/js/charts.js',
  'site/assets/data/latency-samples.json',
  'site/assets/data/metrics.json',
  'site/examples/smoke.js',
  'site/examples/load.js',
  'site/examples/stress.js',
  'site/examples/spike.js',
  'site/examples/soak.js',
  'scripts/test-calc.mjs',
  'scripts/verify-site.mjs',
  'scripts/browser-check.mjs',
  'scripts/word-count.mjs'
];

grid1: {
  group('files', '1. ไฟล์ที่ต้องมีและโครงสร้างหน้าเว็บ');

  const missing = REQUIRED.filter((rel) => !exists(rel));
  check(missing.length === 0,
    'ไฟล์ที่กำหนดไว้มีครบทั้ง ' + REQUIRED.length + ' ไฟล์',
    'ไฟล์ที่ขาดหาย',
    missing.join(', '));

  /* ไฟล์สคริปต์และข้อมูลต้องไม่ว่าง */
  const emptyFiles = ['site/examples/smoke.js', 'site/examples/load.js', 'site/examples/stress.js',
    'site/examples/spike.js', 'site/examples/soak.js', 'site/assets/data/metrics.json',
    'site/assets/data/latency-samples.json'
  ].filter((rel) => !exists(rel) || read(rel).trim().length < 50);
  check(emptyFiles.length === 0,
    'ไฟล์สคริปต์และไฟล์ข้อมูลมีเนื้อหาจริง ไม่มีไฟล์ว่าง',
    'พบไฟล์ที่ว่างหรือสั้นผิดปกติ',
    emptyFiles.join(', '));

  const htmlFiles = findAllHtml(site).sort();
  const expectedHtmlCount = REQUIRED.filter((r) => r.endsWith('.html')).length;
  check(htmlFiles.length === expectedHtmlCount,
    'พบไฟล์ HTML ทั้งหมด ' + htmlFiles.length + ' หน้า ตรงตามที่กำหนด',
    'จำนวนไฟล์ HTML ไม่ตรงกับที่กำหนด',
    'พบ ' + htmlFiles.length + ' แต่ต้องมี ' + expectedHtmlCount);

  /* ทุกหน้าต้องอ้าง main.css และ site.js ด้วยพาธที่ถูกต้อง */
  const wrongRefs = [];
  for (const file of htmlFiles) {
    const rel = path.relative(root, file);
    const depth = rel.split('/').length - 2; /* site/ นับเป็น 0 */
    const prefix = '../'.repeat(depth);
    const html = fs.readFileSync(file, 'utf8');
    if (!html.includes('href="' + prefix + 'assets/css/main.css"')) {
      wrongRefs.push(rel + ' ไม่ได้อ้าง ' + prefix + 'assets/css/main.css');
    }
    if (!html.includes('src="' + prefix + 'assets/js/site.js"')) {
      wrongRefs.push(rel + ' ไม่ได้อ้าง ' + prefix + 'assets/js/site.js');
    }
  }
  check(wrongRefs.length === 0,
    'ทุกหน้าอ้าง assets/css/main.css และ assets/js/site.js ครบ',
    'พบบางหน้าที่อ้างไฟล์หลักไม่ครบหรือใช้พาธผิด',
    wrongRefs.join(' | '));
}

/* ---------- 2) ลิงก์ภายใน ---------- */

group('links', '2. ลิงก์ภายในทุกตัวต้องชี้ไปไฟล์ที่มีอยู่จริง');

{
  const htmlFiles = findAllHtml(site);
  const broken = [];
  const externalLinks = new Set();
  let internalTotal = 0;

  for (const file of htmlFiles) {
    const rel = path.relative(root, file);
    const html = stripNonMarkup(fs.readFileSync(file, 'utf8'));
    const dir = path.dirname(file);

    const hrefRe = /<a\b[^>]*\shref\s*=\s*"([^"]*)"/gi;
    let m;
    while ((m = hrefRe.exec(html)) !== null) {
      const href = m[1].trim();
      if (href === '') continue;
      if (/^(https?:)?\/\//i.test(href)) { externalLinks.add(href); continue; }
      if (/^(mailto:|tel:|data:|javascript:)/i.test(href)) continue;
      if (href.startsWith('#')) continue;

      const [pathPart] = href.split('#');
      if (pathPart === '') continue;
      internalTotal++;

      const target = path.resolve(dir, pathPart);
      const inSite = target.startsWith(site + path.sep);
      /* อนุญาตให้ลิงก์ออกไปยังไฟล์อื่นในโปรเจกต์ เช่น docs/evidence ได้ */
      const inProject = target.startsWith(root + path.sep);

      if (!inProject) {
        broken.push(rel + ' → ' + href + ' (ออกนอกโปรเจกต์)');
      } else if (!fs.existsSync(target)) {
        broken.push(rel + ' → ' + href + ' (ไม่พบไฟล์)');
      } else if (inSite && fs.statSync(target).isDirectory() &&
                 !fs.existsSync(path.join(target, 'index.html'))) {
        broken.push(rel + ' → ' + href + ' (โฟลเดอร์ไม่มี index.html)');
      }
    }
  }

  check(broken.length === 0,
    'ลิงก์ภายในทั้งหมด ' + internalTotal + ' ลิงก์ชี้ไปไฟล์ที่มีอยู่จริง',
    'พบลิงก์ภายในที่เสีย',
    broken.slice(0, 12).join(' | '));

  check(externalLinks.size > 0,
    'มีลิงก์ไปเอกสารทางการ ' + externalLinks.size + ' แห่ง ซึ่งได้รับอนุญาตให้เป็นลิงก์ภายนอกได้',
    'ไม่พบลิงก์ไปเอกสารทางการเลย');

  const outbound = [...externalLinks];
  const notK6 = outbound.filter((u) => !/grafana\.com|k6\.io/.test(u));
  check(notK6.length === 0,
    'ลิงก์ภายนอกทุกแห่งชี้ไปที่เอกสารทางการของ k6',
    'พบลิงก์ภายนอกที่นอกเหนือจากเอกสารทางการ',
    notK6.join(', '));
}

/* ---------- 3) ไม่มี asset ภายนอก ---------- */

group('assets', '3. ต้องไม่มี asset ภายนอกที่ถูกโหลดเข้ามา');

{
  const htmlFiles = findAllHtml(site);
  const offenders = [];

  const attrRe = /<(link|script|img|source|iframe|video|audio|embed|object|track)\b[^>]*>/gi;
  for (const file of htmlFiles) {
    const rel = path.relative(root, file);
    const html = fs.readFileSync(file, 'utf8');
    let m;
    while ((m = attrRe.exec(html)) !== null) {
      const tag = m[0];
      const tagName = m[1].toLowerCase();
      const urlAttr = tagName === 'link' || tagName === 'object'
        ? /\shref\s*=\s*"([^"]*)"/i
        : /\ssrc\s*=\s*"([^"]*)"/i;
      const um = tag.match(urlAttr);
      if (!um) continue;
      const url = um[1].trim();
      if (url.startsWith('#') || url.startsWith('data:')) continue;
      if (/^(https?:)?\/\//i.test(url)) {
        offenders.push(rel + ' → <' + tagName + '> ' + url);
      }
    }
  }

  check(offenders.length === 0,
    'ไม่มีการโหลด CSS, JS, รูป หรือ iframe จากภายนอกเลย',
    'พบ asset ภายนอกที่ถูกโหลด',
    offenders.join(' | '));

  /* ตรวจ url() และ @import ในไฟล์ CSS */
  const css = read('site/assets/css/main.css');
  const cssUrls = [...css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)].map((x) => x[1].trim());
  const badCssUrls = cssUrls.filter((u) => !u.startsWith('data:') && !u.startsWith('#'));
  check(badCssUrls.length === 0,
    'ไม่มี url() ที่อ้างไฟล์ภายนอกใน CSS' + (cssUrls.length ? ' (พบ url() ทั้งหมด ' + cssUrls.length + ' จุด)' : ''),
    'พบ url() ที่อ้างไฟล์ภายนอกใน CSS',
    badCssUrls.join(', '));

  const hasImport = /@import/i.test(css);
  check(!hasImport, 'ไม่มี @import ใน CSS', 'พบ @import ซึ่งอาจโหลดฟอนต์หรือสไตล์จากภายนอก');

  const hasFontFace = /@font-face/i.test(css);
  check(!hasFontFace, 'ไม่มี @font-face ใช้ฟอนต์ของระบบตามที่กำหนด',
    'พบ @font-face ซึ่งอาจเป็นการโหลดฟอนต์จากภายนอก');
}

/* ---------- 4) คำต้องห้าม ---------- */

group('wording', '4. ไม่มีข้อความต้องห้ามในหน้าที่ผู้ใช้เห็น');

{
  const FORBIDDEN = [
    { re: /\blorem\b/i, label: 'lorem' },
    { re: /\bTODO\b/, label: 'TODO' },
    { re: /placeholder\s+text/i, label: 'placeholder text' },
    { re: /feature\s+one/i, label: 'feature one' },
    { re: /\bTBD\b/, label: 'TBD' },
    { re: /\bFIXME\b/, label: 'FIXME' },
    { re: /ข้อความตัวอย่าง/, label: 'ข้อความตัวอย่าง' },
    { re: /coming\s+soon/i, label: 'coming soon' }
  ];

  const hits = [];
  const files = [
    ...findAllHtml(site),
    path.join(site, 'assets/css/main.css'),
    path.join(site, 'assets/js/site.js'),
    path.join(site, 'assets/js/storage.js'),
    path.join(site, 'assets/js/calc.js'),
    path.join(site, 'assets/js/quiz.js'),
    path.join(site, 'assets/js/charts.js')
  ];

  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const rel = path.relative(root, file);
    const text = fs.readFileSync(file, 'utf8');
    text.split('\n').forEach((lineText, i) => {
      for (const f of FORBIDDEN) {
        if (f.re.test(lineText)) {
          hits.push(rel + ':' + (i + 1) + ' มีคำว่า "' + f.label + '"');
        }
      }
    });
  }

  check(hits.length === 0,
    'ไม่พบข้อความต้องห้ามทั้ง ' + FORBIDDEN.length + ' รูปแบบ',
    'พบข้อความต้องห้าม',
    hits.slice(0, 10).join(' | '));
}

/* ---------- 5) lang, title, meta description ---------- */

group('meta', '5. ภาษาของหน้า ชื่อเรื่อง และคำอธิบาย');

{
  const htmlFiles = findAllHtml(site);
  const problems = [];

  for (const file of htmlFiles) {
    const rel = path.relative(root, file);
    const html = fs.readFileSync(file, 'utf8');

    if (!/<html\b[^>]*\blang\s*=\s*"th"/i.test(html)) {
      problems.push(rel + ': ไม่ได้ตั้ง lang="th"');
    }
    const title = html.match(/<title>([\s\S]*?)<\/title>/i);
    if (!title || title[1].trim().length < 10) {
      problems.push(rel + ': ไม่มี title หรือสั้นเกินไป');
    }
    const desc = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
    if (!desc || desc[1].trim().length < 40) {
      problems.push(rel + ': ไม่มี meta description หรือสั้นเกินไป');
    }
    if (!/<meta\s+name="viewport"/i.test(html)) {
      problems.push(rel + ': ไม่มี meta viewport');
    }
    if (!/<meta\s+charset="utf-8"/i.test(html)) {
      problems.push(rel + ': ไม่มี meta charset utf-8');
    }
  }

  check(problems.length === 0,
    'ทุกหน้า (' + htmlFiles.length + ' หน้า) มี lang="th", title, meta description, viewport และ charset ครบ',
    'พบหน้าที่ข้อมูลส่วนหัวไม่ครบ',
    problems.slice(0, 10).join(' | '));

  /* favicon — ทุกหน้าต้องอ้าง site/favicon.svg ด้วยพาธสัมพัทธ์ที่ถูกกับระดับโฟลเดอร์
     และตัวไฟล์ต้องเป็นไอคอนเส้นสีหลักของเว็บ ไม่มี gradient และไม่ดึงอะไรจากภายนอก
     กันปัญหา 404 favicon.ico ที่เบราว์เซอร์ยิงเองเมื่อหน้าไม่ประกาศไอคอน */
  const iconProblems = [];
  for (const file of htmlFiles) {
    const rel = path.relative(root, file);
    const html = fs.readFileSync(file, 'utf8');
    const depth = rel.split('/').length - 2; /* site/ นับเป็น 0 */
    const prefix = '../'.repeat(depth);
    const expected = '<link rel="icon" type="image/svg+xml" href="' + prefix + 'favicon.svg">';
    if (!html.includes(expected)) {
      iconProblems.push(rel + ' ต้องมี ' + expected);
    }
  }
  check(iconProblems.length === 0,
    'ทุกหน้า (' + htmlFiles.length + ' หน้า) ประกาศ favicon เป็น SVG ด้วยพาธสัมพัทธ์ที่ถูกต้อง',
    'พบหน้าที่ไม่ได้ประกาศ favicon หรือใช้พาธผิด',
    iconProblems.slice(0, 10).join(' | '));

  const iconPath = path.join(site, 'favicon.svg');
  if (!fs.existsSync(iconPath)) {
    fail('ไม่พบไฟล์ site/favicon.svg');
  } else {
    const svg = fs.readFileSync(iconPath, 'utf8');
    const svgProblems = [];
    if (!/<svg\b[^>]*\bxmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(svg)) {
      svgProblems.push('ไม่มี xmlns ของ SVG');
    }
    if (!/viewBox="0 0 32 32"/.test(svg)) svgProblems.push('ไม่มี viewBox="0 0 32 32"');
    if (!/#1f4e79/i.test(svg)) svgProblems.push('ไม่ได้ใช้สี #1f4e79');
    if (/Gradient|<image\b|<script\b|<foreignObject\b/i.test(svg)) {
      svgProblems.push('มี gradient, รูปฝัง หรือสคริปต์');
    }
    if (/https?:\/\//i.test(svg.replace(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/, ''))) {
      svgProblems.push('อ้างทรัพยากรภายนอก');
    }
    if (/<text\b/i.test(svg)) svgProblems.push('ใช้ <text> ซึ่งขึ้นกับฟอนต์ของเครื่อง');
    if (!/<path\b|<circle\b|<rect\b|<polyline\b|<line\b/i.test(svg)) {
      svgProblems.push('ไม่มีรูปทรงเส้น');
    }
    check(svgProblems.length === 0,
      'ไฟล์ favicon.svg เป็นไอคอนเส้น SVG ขนาด 32×32 ใช้สี #1f4e79 ไม่มี gradient และไม่ดึงของภายนอก',
      'ไฟล์ favicon.svg ไม่ตรงตามข้อกำหนด',
      svgProblems.join(' | '));
  }
}

/* ---------- 6) ไม่มี emoji ---------- */

group('emoji', '6. ต้องไม่มีอักขระ emoji ในหน้าเว็บ');

{
  /* ช่วงรหัสของอักขระที่เป็น emoji และสัญลักษณ์ตกแต่ง
     ไม่รวมลูกศร (U+2190–U+21FF) และเครื่องหมายคณิตศาสตร์ เพราะไม่ใช่ emoji */
  const EMOJI_RANGES = [
    [0x1F000, 0x1F0FF], [0x1F100, 0x1F1FF], [0x1F200, 0x1F2FF],
    [0x1F300, 0x1F5FF], [0x1F600, 0x1F64F], [0x1F650, 0x1F67F],
    [0x1F680, 0x1F6FF], [0x1F700, 0x1F77F], [0x1F780, 0x1F7FF],
    [0x1F800, 0x1F8FF], [0x1F900, 0x1F9FF], [0x1FA00, 0x1FAFF],
    [0x2600, 0x26FF], [0x2700, 0x27BF], [0x2B00, 0x2BFF],
    [0xFE0F, 0xFE0F], [0x1F1E6, 0x1F1FF], [0x2190, 0x2190]
  ];

  function findEmoji(text) {
    const found = [];
    const lines = text.split('\n');
    lines.forEach((lineText, lineNo) => {
      for (const ch of lineText) {
        const cp = ch.codePointAt(0);
        for (const [lo, hi] of EMOJI_RANGES) {
          if (cp >= lo && cp <= hi) {
            found.push({ line: lineNo + 1, char: ch, cp: 'U+' + cp.toString(16).toUpperCase() });
            break;
          }
        }
      }
    });
    return found;
  }

  const files = [...findAllHtml(site), path.join(site, 'assets/css/main.css'),
    path.join(site, 'assets/js/site.js'), path.join(site, 'assets/js/quiz.js'),
    path.join(site, 'assets/js/charts.js'), path.join(site, 'favicon.svg')];

  const hits = [];
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const rel = path.relative(root, file);
    const found = findEmoji(fs.readFileSync(file, 'utf8'));
    found.slice(0, 5).forEach((f) => {
      hits.push(rel + ':' + f.line + ' มี ' + f.cp);
    });
  }

  check(hits.length === 0,
    'ไม่พบอักขระ emoji ในหน้าเว็บและไฟล์สไตล์/สคริปต์',
    'พบอักขระ emoji',
    hits.slice(0, 10).join(' | '));

  /* ตรวจว่ามีการใช้ inline SVG เป็นไอคอนจริง */
  const svgCount = findAllHtml(site).reduce((acc, f) => {
    const html = fs.readFileSync(f, 'utf8');
    return acc + (html.match(/<svg\b/gi) || []).length;
  }, 0);
  const iconCount = (read('site/assets/js/site.js').match(/<path\b|<circle\b|<rect\b/g) || []).length;
  check(svgCount > 0 && iconCount > 0,
    'ใช้ inline SVG เป็นไอคอน (ในหน้าเว็บ ' + svgCount + ' จุด และในชุดไอคอนของ site.js อีก ' + iconCount + ' รูป)',
    'ไม่พบการใช้ inline SVG เป็นไอคอน');

  /* ต้องไม่มีการใช้ตัวอักษรยูนิโคด mark เป็นไอคอนแทน SVG */
  const markLike = findAllHtml(site).filter((f) => /[\u2713\u2714\u2717\u2718\u2605\u2606]/.test(fs.readFileSync(f, 'utf8')));
  check(markLike.length === 0,
    'ไม่ใช้เครื่องหมายถูก กากบาท หรือดาว เป็นไอคอน',
    'พบเครื่องหมายที่ใช้แทนไอคอน',
    markLike.map((f) => path.relative(root, f)).join(', '));
}

/* ---------- 7) ไวยากรณ์ของ JavaScript ---------- */

group('syntax', '7. ไวยากรณ์ของ JavaScript ทุกไฟล์และทุกสคริปต์ในหน้า');

{
  const jsFiles = [
    'site/assets/js/site.js',
    'site/assets/js/storage.js',
    'site/assets/js/calc.js',
    'site/assets/js/quiz.js',
    'site/assets/js/charts.js'
  ].filter(exists);

  const bad = [];
  for (const rel of jsFiles) {
    try {
      /* ตรวจด้วยการคอมไพล์ใน sandbox ไม่ได้รันโค้ดจริง */
      new vm.Script(read(rel), { filename: rel });
    } catch (err) {
      bad.push(rel + ': ' + err.message);
    }
  }
  check(bad.length === 0,
    'ไฟล์ JavaScript ทั้ง ' + jsFiles.length + ' ไฟล์ผ่านการตรวจไวยากรณ์',
    'พบไฟล์ JavaScript ที่มีปัญหาไวยากรณ์',
    bad.join(' | '));

  /* สคริปต์ที่ฝังในหน้า ต้องตรวจด้วยเช่นกัน */
  const inlineBad = [];
  let inlineCount = 0;
  for (const file of findAllHtml(site)) {
    const rel = path.relative(root, file);
    const html = fs.readFileSync(file, 'utf8');
    const re = /<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
    let m;
    let i = 0;
    while ((m = re.exec(html)) !== null) {
      i++;
      inlineCount++;
      const code = m[1];
      if (code.trim() === '') continue;
      try {
        new vm.Script(code, { filename: rel + ' inline script #' + i });
      } catch (err) {
        inlineBad.push(rel + ' สคริปต์ที่ ' + i + ': ' + err.message);
      }
    }
  }
  check(inlineBad.length === 0,
    'สคริปต์ที่ฝังในหน้าเว็บ ' + inlineCount + ' ชุดผ่านการตรวจไวยากรณ์ทั้งหมด',
    'พบสคริปต์ในหน้าที่มีปัญหาไวยากรณ์',
    inlineBad.slice(0, 8).join(' | '));

  /* ทุกหน้าที่เรียกใช้ API ของโมดูลใด ต้องโหลดไฟล์โมดูลนั้นจริง
     กันปัญหาที่หน้าเว็บเรียก LTK6.calc แต่ลืมใส่ script tag ของ calc.js */
  const MODULE_REQUIREMENTS = [
    { module: 'calc', file: 'assets/js/calc.js', uses: /\bcalc\.(tpsCalculator|vuCalculator|recommendProfile|percentile|percentileStep|cdfPoints|describe|mean|round|toNumber|validateInputs)\b|LTK6\.calc\b/ },
    { module: 'charts', file: 'assets/js/charts.js', uses: /\bcharts\.(histogram|cdf|histogramTable)\b|LTK6\.charts\b/ },
    { module: 'quiz', file: 'assets/js/quiz.js', uses: /LTK6\.quiz\b/ },
    { module: 'storage', file: 'assets/js/storage.js', uses: /LTK6\.storage\b/ }
  ];

  const missingModules = [];
  for (const file of findAllHtml(site)) {
    const rel = path.relative(root, file);
    const html = fs.readFileSync(file, 'utf8');
    const depth = rel.split('/').length - 2;
    const prefix = '../'.repeat(depth);

    /* ตรวจเฉพาะสคริปต์ที่ฝังในหน้า เพราะนั่นคือโค้ดที่เรียกใช้โมดูลโดยตรง */
    const inlineCode = [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
      .map((m) => m[1]).join('\n');
    if (inlineCode.trim() === '') continue;

    for (const req of MODULE_REQUIREMENTS) {
      if (!req.uses.test(inlineCode)) continue;
      if (!html.includes('src="' + prefix + req.file + '"')) {
        missingModules.push(rel + ' เรียกใช้ ' + req.module + ' แต่ไม่ได้โหลด ' + prefix + req.file);
      }
    }
  }
  check(missingModules.length === 0,
    'ทุกหน้าที่เรียกใช้โมดูล ได้โหลดไฟล์ของโมดูลนั้นครบ (ตรวจ calc, charts, quiz, storage)',
    'พบหน้าที่เรียกใช้โมดูลแต่ไม่ได้โหลดไฟล์',
    missingModules.join(' | '));

  /* ไฟล์สคริปต์ k6 ต้องเป็น JS ที่แยกวิเคราะห์ได้ และไม่ใช้ require() */
  const k6Files = ['site/examples/smoke.js', 'site/examples/load.js', 'site/examples/stress.js',
    'site/examples/spike.js', 'site/examples/soak.js'].filter(exists);
  const k6Bad = [];
  for (const rel of k6Files) {
    const code = read(rel);
    try {
      /* ตรวจแบบโมดูล เพราะสคริปต์ k6 ใช้ import/export */
      new vm.SourceTextModule
        ? await new vm.SourceTextModule(code, { identifier: rel })
        : null;
    } catch (err) {
      if (err instanceof SyntaxError) k6Bad.push(rel + ': ' + err.message);
    }
    if (/\brequire\s*\(/.test(code)) k6Bad.push(rel + ': ใช้ require() ซึ่ง k6 ไม่รองรับ');
    if (!/export\s+default/.test(code)) k6Bad.push(rel + ': ไม่มี export default');
    if (!/export\s+const\s+options/.test(code)) k6Bad.push(rel + ': ไม่มี export const options');
    if (!/ALLOWED_HOSTS/.test(code)) k6Bad.push(rel + ': ไม่มีกลไกตรวจปลายทางที่อนุญาต');
  }
  check(k6Bad.length === 0,
    'สคริปต์ k6 ทั้ง ' + k6Files.length + ' ไฟล์มี export default, export const options และกลไกตรวจปลายทางครบ',
    'พบปัญหในสคริปต์ k6',
    k6Bad.join(' | '));
}

/* ---------- 8) ความสอดคล้องของข้อมูล ---------- */

group('data', '8. ความสอดคล้องของไฟล์ข้อมูลกับหน้าที่อ่านมัน');

grid1: {
  const metrics = JSON.parse(read('site/assets/data/metrics.json'));
  const samples = JSON.parse(read('site/assets/data/latency-samples.json'));

  const totalGlossary = metrics.metrics.length + metrics.terms.length;
  check(totalGlossary >= 40,
    'อภิธานศัพท์มีทั้งหมด ' + totalGlossary + ' คำ (metric ' + metrics.metrics.length +
    ' + ศัพท์ ' + metrics.terms.length + ') เกินเกณฑ์ 40 คำ',
    'อภิธานศัพท์มีไม่ถึง 40 คำ',
    'มี ' + totalGlossary + ' คำ');

  const ids = [...metrics.metrics.map((m) => m.id), ...metrics.terms.map((t) => t.id)];
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  check(dupes.length === 0, 'รหัสของ metric และศัพท์ไม่ซ้ำกัน',
    'พบรหัสซ้ำในไฟล์ metric', dupes.join(', '));

  const n = samples.sample.length;
  const binSum = samples.bins.reduce((a, b) => a + b.count, 0);
  check(n === samples.n && binSum === samples.n,
    'ไฟล์ข้อมูล latency สอดคล้องกัน: sample ' + n + ' ค่า, ผลรวม bins ' + binSum +
    ' ค่า, ค่า n ที่ประกาศ ' + samples.n,
    'จำนวนข้อมูลในไฟล์ latency ไม่ตรงกัน',
    'sample=' + n + ', bins=' + binSum + ', n=' + samples.n);

  const sortedOk = samples.sample.every((v, i) => i === 0 || v >= samples.sample[i - 1]);
  check(sortedOk, 'ข้อมูลในไฟล์ latency เรียงจากน้อยไปมากแล้ว ทำให้ตรวจสอบด้วยมือได้',
    'ข้อมูลในไฟล์ latency ไม่ได้เรียงลำดับ');

  /* ตัวเลขที่บทเรียนอ้างถึงต้องตรงกับไฟล์ข้อมูล */
  const lesson01 = read('site/lessons/01-tps.html');
  const claims = [
    { text: '1,155 request', ok: lesson01.includes('1,155') },
    { text: '93.44 request/s', ok: lesson01.includes('93.44') },
    { text: 'iteration_duration 105.38 ms', ok: lesson01.includes('105.38') },
    { text: 'http_req_duration 54.25 ms', ok: lesson01.includes('54.25') }
  ];
  const badClaims = claims.filter((c) => !c.ok).map((c) => c.text);
  check(badClaims.length === 0,
    'ตัวเลขสำคัญในบทที่ 1 ตรงกับไฟล์ข้อมูล (' + claims.length + ' ค่า)',
    'ตัวเลขในบทที่ 1 ไม่ตรงกับไฟล์ข้อมูล',
    badClaims.join(', '));

  const lesson04 = read('site/lessons/04-percentiles.html');
  const pctClaims = ['44.40', '54.69', '65.31', '74.53', '466.29', '584.70', '54.25']
    .filter((v) => !lesson04.includes(v));
  check(pctClaims.length === 0,
    'ตัวเลข p50, p75, p90, p95, p99, max และค่าเฉลี่ยในบทที่ 4 ตรงกับไฟล์ข้อมูล',
    'ตัวเลขเปอร์เซ็นไทล์ในบทที่ 4 ไม่ตรงกับไฟล์ข้อมูล',
    pctClaims.join(', '));

  /* ตารางข้อมูลทุกตัวต้องอยู่ใน .table-wrap เพื่อให้เลื่อนแนวนอนได้บนจอมือถือ
     (ด่านนี้เพิ่มหลังพบบั๊กจริง: lessons/06-read-results.html มี <div> เปล่าครอบตาราง
      ทำให้หน้าเว็บล้นแนวนอน 213px ที่จอ 360px และ 101px ที่จอ 768px) */
  const unwrappedTables = [];
  for (const file of findAllHtml(site)) {
    const rel = path.relative(root, file).split(path.sep).join('/');
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (!line.includes('<table class="data">')) return;
      if (line.includes('class="table-wrap"')) return;
      const prev = i > 0 ? lines[i - 1] : '';
      if (!prev.includes('class="table-wrap"')) unwrappedTables.push(rel + ':' + (i + 1));
    });
  }
  check(unwrappedTables.length === 0,
    'ตารางข้อมูลทุกตัวถูกครอบด้วย .table-wrap (จึงเลื่อนแนวนอนได้บนจอมือถือ)',
    'พบบางตารางข้อมูลที่ไม่ได้อยู่ใน .table-wrap จะทำให้หน้าเว็บล้นแนวนอนบนจอมือถือ',
    unwrappedTables.join(', '));

  /* ปุ่มดาวน์โหลดในหน้า examples ต้องชี้ไปไฟล์ที่มีอยู่จริง */
  const examplesPage = read('site/examples.html');
  const dlBad = ['smoke.js', 'load.js', 'stress.js', 'spike.js', 'soak.js']
    .filter((f) => !examplesPage.includes("' + s.file + '") && !examplesPage.includes(f))
    .map((f) => f);
  check(dlBad.length === 0, 'หน้า examples อ้างถึงสคริปต์ทั้งห้าไฟล์',
    'หน้า examples อ้างสคริปต์ไม่ครบ', dlBad.join(', '));

  /* คณะคำถามในคลังแบบทดสอบ */
  const quizSrc = read('site/assets/js/quiz.js');
  const setCount = (quizSrc.match(/lessonId:\s*'/g) || []).length;
  check(setCount === 6, 'คลังแบบทดสอบมี 6 ชุด ตรงกับจำนวนบทเรียน',
    'จำนวนชุดแบบทดสอบไม่ใช่ 6 ชุด', 'พบ ' + setCount + ' ชุด');

  const questionCount = (quizSrc.match(/^\s*q:\s*'/gm) || []).length;
  check(questionCount >= 30,
    'แบบทดสอบมีทั้งหมด ' + questionCount + ' ข้อ (ชุดละ ' + (questionCount / 6) + ' ข้อ)',
    'จำนวนข้อในแบบทดสอบน้อยกว่าที่กำหนด',
    'พบ ' + questionCount + ' ข้อ');

  /* ไฟล์สำเนาสคริปต์ต้องตรงกับต้นฉบับใน k6/ */
  const copyBad = [];
  for (const f of ['smoke.js', 'load.js', 'stress.js', 'spike.js', 'soak.js']) {
    const a = path.join(root, 'k6', f);
    const b = path.join(site, 'examples', f);
    if (!fs.existsSync(a) || !fs.existsSync(b)) {
      copyBad.push(f + ' หายไปจากที่ใดที่หนึ่ง');
      continue;
    }
    if (fs.readFileSync(a, 'utf8') !== fs.readFileSync(b, 'utf8')) {
      copyBad.push(f + ' เนื้อหาไม่ตรงกันระหว่าง k6/ กับ site/examples/');
    }
  }
  check(copyBad.length === 0,
    'สำเนาสคริปต์ใน site/examples/ ตรงกับต้นฉบับใน k6/ ทั้งห้าไฟล์',
    'สำเนาสคริปต์ไม่ตรงกับต้นฉบับ',
    copyBad.join(' | '));
}

/* ---------- 9) ธีมสว่าง/มืด ---------- */

group('theme', '9. ธีมสว่าง/มืด: สคริปต์ตั้งธีมก่อนวาด ปุ่มสลับ และโทเคนครบทั้งสองธีม');

{
  const htmlFiles = findAllHtml(site).sort();

  /* (ก) ทุกหน้าต้องมีสคริปต์ตั้งธีมอยู่ใน <head> ก่อนลิงก์ CSS และต้องเป็นสคริปต์ซิงโครนัส
     ถ้าใช้ defer/async หรือวางไว้หลัง CSS ผู้ใช้จะเห็นจอกะพริบขาวก่อนธีมเข้าที่ */
  const themeScriptBad = [];
  for (const file of htmlFiles) {
    const rel = path.relative(root, file).split(path.sep).join('/');
    const html = fs.readFileSync(file, 'utf8');
    const headEnd = html.search(/<\/head>/i);
    const head = headEnd === -1 ? '' : html.slice(0, headEnd);
    if (head === '') { themeScriptBad.push(rel + ' ไม่พบ </head>'); continue; }

    const scripts = [...head.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
    const hit = scripts.find((m) => m[2].includes('ltk6.theme.v1') && m[2].includes('data-theme'));
    if (!hit) { themeScriptBad.push(rel + ' ไม่มีสคริปต์ตั้งธีมใน <head>'); continue; }
    if (/\b(defer|async)\b/i.test(hit[1] || '')) {
      themeScriptBad.push(rel + ' สคริปต์ตั้งธีมใช้ defer/async');
    }
    if (!/try\s*\{[\s\S]*catch/.test(hit[2])) {
      themeScriptBad.push(rel + ' สคริปต์ตั้งธีมไม่ได้กันกรณี localStorage ถูกปิด');
    }
    const cssIdx = head.search(/<link[^>]+rel="stylesheet"/i);
    if (cssIdx === -1) themeScriptBad.push(rel + ' ไม่พบลิงก์ CSS ใน <head>');
    else if (head.indexOf(hit[0]) > cssIdx) {
      themeScriptBad.push(rel + ' สคริปต์ตั้งธีมอยู่หลังลิงก์ CSS จึงกันจอกะพริบไม่ได้');
    }
  }
  check(themeScriptBad.length === 0,
    'ทุกหน้า (' + htmlFiles.length + ' หน้า) มีสคริปต์ตั้งธีมใน <head> ก่อนลิงก์ CSS และเป็นสคริปต์ซิงโครนัส',
    'พบหน้าที่สคริปต์ตั้งธีมวางผิดที่หรือผิดรูปแบบ',
    themeScriptBad.slice(0, 8).join(' | '));

  /* ปุ่มสลับธีม — ตรวจว่ามีการสร้างปุ่มจริงและมี label ภาษาไทยที่อ่านออกเสียงได้
     ตัวปุ่มถูกสร้างด้วย site.js จึงตรวจที่ site.js ไม่ใช่ที่ HTML */
  const siteJs = read('site/assets/js/site.js');
  /* ตัดคอมเมนต์ CSS ออกก่อนค้นหาตัวเลือก เพราะคอมเมนต์ของไฟล์นี้พูดถึง
     [data-theme="dark"] ไว้ด้วย ถ้าไม่ตัดจะไปโดนคอมเมนต์แทนตัวกฎจริง */
  const css = read('site/assets/css/main.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const toggleProblems = [];
  if (!/id="theme-toggle"/.test(siteJs)) toggleProblems.push('site.js ไม่ได้สร้างปุ่ม id="theme-toggle"');
  if (!/class="theme-toggle"/.test(siteJs)) toggleProblems.push('site.js ไม่ได้ใส่คลาส theme-toggle ให้ปุ่ม');
  if (!/aria-label/.test(siteJs) || !/เปลี่ยนเป็นโหมด/.test(siteJs)) {
    toggleProblems.push('ปุ่มสลับธีมไม่มี aria-label ภาษาไทยที่บอกการกระทำ');
  }
  if (!/themeBtn\.addEventListener\('click'/.test(siteJs)) {
    toggleProblems.push('ปุ่มสลับธีมไม่ได้ผูกเหตุการณ์คลิก');
  }
  if (!/localStorage\.setItem\(THEME_KEY/.test(siteJs)) {
    toggleProblems.push('การเลือกธีมไม่ได้ถูกบันทึกลง localStorage คีย์ ltk6.theme.v1');
  }
  if (!/localStorage\.getItem\(THEME_KEY/.test(siteJs)) {
    toggleProblems.push('ไม่ได้อ่านค่าธีมที่บันทึกไว้กลับมาใช้');
  }
  if (!/\.theme-toggle\{/.test(css)) toggleProblems.push('CSS ไม่มีกฎ .theme-toggle');
  const minSize = css.match(/\.theme-toggle\{[\s\S]*?min-width:(\d+)px;min-height:(\d+)px/);
  if (!minSize || Number(minSize[1]) < 24 || Number(minSize[2]) < 24) {
    toggleProblems.push('เป้ากดของปุ่มสลับธีมเล็กกว่า 24×24 CSS px');
  }
  if (!/\.theme-toggle:hover/.test(css)) toggleProblems.push('ปุ่มสลับธีมไม่มีสถานะ hover');
  if (!/\.theme-toggle:active/.test(css)) toggleProblems.push('ปุ่มสลับธีมไม่มีสถานะ active');
  check(toggleProblems.length === 0,
    'ปุ่มสลับธีมเป็น <button> จริง มี aria-label ภาษาไทย มี hover/active และเป้ากด ≥ 24×24 px',
    'ปุ่มสลับธีมยังไม่ครบข้อกำหนด',
    toggleProblems.join(' | '));

  /* สถานะ focus-visible ของปุ่มมาจากกฎรวมของปุ่มทั้งเว็บ */
  check(/button:focus-visible/.test(css),
    'ปุ่มทั้งเว็บมีสถานะ focus-visible (คุมปุ่มสลับธีมด้วย)',
    'ไม่พบกฎ focus-visible สำหรับปุ่ม');

  /* ---------- (ข) โทเคนของทั้งสองธีม ---------- */

  const REQUIRED_TOKENS = [
    '--bg', '--bg-alt', '--surface', '--fg', '--fg-soft', '--muted',
    '--border', '--border-strong', '--accent', '--accent-soft', '--on-accent',
    '--signal', '--signal-soft', '--ok', '--warn', '--danger',
    '--ok-soft', '--warn-soft', '--danger-soft',
    '--chart-1', '--chart-2', '--chart-3', '--chart-4'
  ];

  /* ดึงเนื้อในบล็อกปีกกาที่เริ่มจากหัวเรื่องที่กำหนด แล้วคืนค่าเป็น map ของโทเคน */
  function tokenMap(source, startIndex) {
    const open = source.indexOf('{', startIndex);
    if (open === -1) return null;
    let depth = 0;
    let end = -1;
    for (let i = open; i < source.length; i++) {
      if (source[i] === '{') depth++;
      else if (source[i] === '}') {
        depth--;
        if (depth === 0) { end = i; break; }
      }
    }
    if (end === -1) return null;
    const body = source.slice(open + 1, end);
    const map = {};
    for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
      map[m[1].trim()] = m[2].trim();
    }
    return { body, map };
  }

  const rootIdx = css.indexOf(':root{');
  const light = rootIdx === -1 ? null : tokenMap(css, rootIdx);
  const darkIdx = css.indexOf('[data-theme="dark"]');
  const dark = darkIdx === -1 ? null : tokenMap(css, darkIdx);

  if (!light) fail('ไม่พบบล็อกโทเคน :root ของโหมดสว่าง');
  if (!dark) fail('ไม่พบบล็อกโทเคน [data-theme="dark"] ของโหมดมืด');

  if (light && dark) {
    const missingLight = REQUIRED_TOKENS.filter((t) => !(t in light.map));
    const missingDark = REQUIRED_TOKENS.filter((t) => !(t in dark.map));
    check(missingLight.length === 0 && missingDark.length === 0,
      'โทเคนครบทั้ง ' + REQUIRED_TOKENS.length + ' ตัวในทั้ง :root และ [data-theme="dark"]',
      'โทเคนไม่ครบ',
      'ขาดใน :root → ' + (missingLight.join(', ') || 'ไม่มี') +
      ' · ขาดใน dark → ' + (missingDark.join(', ') || 'ไม่มี'));

    /* media query สำรอง: ผู้ใช้ที่ยังไม่เลือกต้องได้ค่าตามระบบ */
    const mqIdx = css.search(/@media\s*\(prefers-color-scheme\s*:\s*dark\)/);
    const mqBlock = mqIdx === -1 ? null : tokenMap(css, mqIdx);
    const mqHasSelector = mqIdx !== -1 &&
      /:root:not\(\[data-theme="light"\]\)/.test(css.slice(mqIdx, mqIdx + 400));
    const mqMissing = mqBlock ? REQUIRED_TOKENS.filter((t) => !(t in mqBlock.map)) : REQUIRED_TOKENS;
    check(mqIdx !== -1 && mqHasSelector && mqMissing.length === 0,
      'มี media query prefers-color-scheme: dark เป็นค่าตั้งต้นตามระบบ พร้อมโทเคนครบ ' +
      REQUIRED_TOKENS.length + ' ตัว',
      'media query สำรองสำหรับค่าตามระบบยังไม่ครบ',
      (mqIdx === -1 ? 'ไม่พบ @media (prefers-color-scheme: dark)' :
        (!mqHasSelector ? 'ไม่พบตัวเลือก :root:not([data-theme="light"])' :
          'ขาดโทเคน ' + mqMissing.join(', '))));

    /* โหมดมืดต้องออกแบบใหม่ ไม่ใช่กลับสีของโหมดสว่าง */
    const designProblems = [];
    const flat = (v) => String(v).replace(/\s/g, '').toLowerCase();
    const isBlack = (v) => /^#(000|000000)$/.test(flat(v)) || /^rgb\(0,0,0\)$/.test(flat(v));
    const isWhite = (v) => /^#(fff|ffffff)$/.test(flat(v)) || /^rgb\(255,255,255\)$/.test(flat(v));
    if (isBlack(dark.map['--bg'])) designProblems.push('--bg ของโหมดมืดใช้ดำสนิท');
    if (isWhite(dark.map['--fg'])) designProblems.push('--fg ของโหมดมืดใช้ขาวสนิท');
    if (!/^rgba\(/.test(flat(dark.map['--border']))) {
      designProblems.push('--border ของโหมดมืดไม่ใช่เส้นโปร่งแสง (ต้องเป็น rgba)');
    }
    if (!/^rgba\(/.test(flat(dark.map['--border-strong']))) {
      designProblems.push('--border-strong ของโหมดมืดไม่ใช่เส้นโปร่งแสง (ต้องเป็น rgba)');
    }

    /* --accent ของโหมดมืดต้องสว่างขึ้นจริง เพื่อให้ลิงก์ผ่านคอนทราสต์บนพื้นเข้ม */
    function luminance(value) {
      const hex = String(value).trim().replace('#', '');
      if (!/^[0-9a-f]{6}$/i.test(hex)) return NaN;
      const parts = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
      return 0.2126 * parts[0] + 0.7152 * parts[1] + 0.0722 * parts[2];
    }
    function contrast(a, b) {
      const la = luminance(a);
      const lb = luminance(b);
      if (Number.isNaN(la) || Number.isNaN(lb)) return NaN;
      return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    }

    const accentLight = luminance(light.map['--accent']);
    const accentDark = luminance(dark.map['--accent']);
    if (!(accentDark > accentLight)) {
      designProblems.push('--accent ของโหมดมืดไม่ได้สว่างขึ้นกว่าโหมดสว่าง');
    }
    const accentOnDarkBg = contrast(dark.map['--accent'], dark.map['--bg']);
    if (!(accentOnDarkBg >= 4.5)) {
      designProblems.push('--accent ของโหมดมืดตัดกับ --bg ของโหมดมืดเพียง ' +
        (Number.isNaN(accentOnDarkBg) ? '?' : accentOnDarkBg.toFixed(2)) + ':1 ซึ่งต่ำกว่า 4.5:1');
    }
    const fgOnBg = contrast(dark.map['--fg'], dark.map['--bg']);
    if (!(fgOnBg >= 4.5)) {
      designProblems.push('--fg ของโหมดมืดตัดกับ --bg เพียง ' + fgOnBg.toFixed(2) + ':1');
    }

    check(designProblems.length === 0,
      'โหมดมืดออกแบบใหม่สำหรับพื้นเข้ม: ไม่ใช้ดำ/ขาวสนิท ขอบเป็นเส้นโปร่งแสง และ --accent สว่างขึ้นจนผ่าน 4.5:1 (accent/bg = ' +
      (Number.isNaN(accentOnDarkBg) ? '?' : accentOnDarkBg.toFixed(2)) + ':1, fg/bg = ' + fgOnBg.toFixed(2) + ':1)',
      'โหมดมืดยังไม่ผ่านข้อกำหนดการออกแบบ',
      designProblems.join(' | '));

    note('โทเคนโหมดสว่างประกาศที่ :root · โหมดมืดประกาศซ้ำสองที่ (เมื่อผู้ใช้เลือก และเมื่อระบบเป็นค่าตั้งต้น)');
  }

  /* ---------- (ค) ไม่มี hex ฮาร์ดโค้ดใน charts.js ----------
     สีของกราฟต้องอ่านจาก CSS variable เพื่อให้เปลี่ยนตามธีมได้ */
  const chartsJs = read('site/assets/js/charts.js');
  const chartHex = [...chartsJs.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0]);
  const chartRgb = [...chartsJs.matchAll(/\brgba?\(\s*\d+/g)].map((m) => m[0]);
  const chartNamed = [...chartsJs.matchAll(/['"](?:color|fill|stroke)['"]\s*:\s*['"](black|white|red|blue|green|gray|grey)['"]/gi)]
    .map((m) => m[0]);
  check(chartHex.length === 0 && chartRgb.length === 0 && chartNamed.length === 0,
    'charts.js ไม่มีสีฮาร์ดโค้ดเลย — สีกราฟ (' +
    (chartsJs.match(/var\(--/g) || []).length + ' จุด) อ่านจาก CSS variable ทั้งหมด',
    'พบสีฮาร์ดโค้ดใน charts.js ซึ่งจะไม่เปลี่ยนตามธีม',
    [...chartHex, ...chartRgb, ...chartNamed].slice(0, 10).join(', '));

  /* สคริปต์อื่นก็ไม่ควรมีสีฮาร์ดโค้ดเช่นกัน */
  const otherBad = [];
  for (const rel of ['site/assets/js/site.js', 'site/assets/js/calc.js',
    'site/assets/js/quiz.js', 'site/assets/js/storage.js']) {
    if (!exists(rel)) continue;
    const hex = [...read(rel).matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0]);
    if (hex.length) otherBad.push(rel + ': ' + hex.join(', '));
  }
  check(otherBad.length === 0,
    'ไฟล์ JavaScript อื่น ๆ ก็ไม่มีสีฮาร์ดโค้ดเช่นกัน',
    'พบสีฮาร์ดโค้ดในไฟล์ JavaScript อื่น', otherBad.join(' | '));
}

/* ---------- 10) ส่วนเน้นและใจความสำคัญ ---------- */

group('emphasis', '10. บล็อก "ใจความสำคัญ" และจุดที่ต้องจำในหน้าเนื้อหา');

{
  const LESSON_PAGES = [
    'site/lessons/01-tps.html', 'site/lessons/02-vu.html', 'site/lessons/03-metrics.html',
    'site/lessons/04-percentiles.html', 'site/lessons/05-load-profiles.html',
    'site/lessons/06-read-results.html', 'site/troubleshooting.html'
  ];

  const problems = [];
  const summary = [];

  for (const rel of LESSON_PAGES) {
    if (!exists(rel)) { problems.push(rel + ' ไม่พบไฟล์'); continue; }
    const html = read(rel);

    /* ใจความสำคัญต้องอยู่ในเนื้อหาหลัก และอยู่ก่อนหัวข้อใหญ่หัวข้อแรก */
    const idx = html.indexOf('class="takeaways"');
    if (idx === -1) { problems.push(rel + ' ไม่มีบล็อกใจความสำคัญ'); continue; }
    const mainStart = html.indexOf('<main');
    const firstH2 = html.indexOf('<h2');
    if (mainStart === -1) problems.push(rel + ' ไม่พบ <main>');
    else if (idx < mainStart) problems.push(rel + ' บล็อกใจความสำคัญอยู่นอกเนื้อหาหลัก');
    else if (firstH2 !== -1 && idx > firstH2) {
      problems.push(rel + ' บล็อกใจความสำคัญไม่ได้อยู่บนสุดของเนื้อหา (ไปอยู่หลัง <h2> แล้ว)');
    }

    const block = html.slice(idx, html.indexOf('</div>', html.indexOf('<ol', idx)));
    const items = (block.match(/<li>/g) || []).length;
    if (items < 3 || items > 5) {
      problems.push(rel + ' บล็อกใจความสำคัญมี ' + items + ' ข้อ ต้องมี 3–5 ข้อ');
    }
    /* ต้องเป็นประโยคบอกสาระ ไม่ใช่คำโปรยสั้น ๆ */
    const itemTexts = [...block.matchAll(/<li>([\s\S]*?)<\/li>/g)]
      .map((m) => m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
    const tooShort = itemTexts.filter((t) => t.length < 30);
    if (tooShort.length) {
      problems.push(rel + ' มีข้อที่สั้นเกินกว่าจะเป็นประโยคบอกสาระ ' + tooShort.length + ' ข้อ');
    }
    if (itemTexts.some((t) => /^(บทนี้|หน้านี้|เราจะ|ต่อไป|ในบทนี้จะ)/.test(t))) {
      problems.push(rel + ' ข้อความใจความสำคัญมีข้อที่เป็นคำโปรยบอกว่าจะพูดถึงอะไร');
    }

    /* จุดที่ต้องจำ และตัวเลข/สูตรที่ต้องจำ ต้องถูกใช้จริงในหน้านั้น */
    if (!/class="keypoint/.test(html)) problems.push(rel + ' ไม่ได้ใช้คลาส keypoint เลย');
    if (!/class="key-figure/.test(html)) problems.push(rel + ' ไม่ได้ใช้คลาส key-figure เลย');

    summary.push(path.basename(rel) + ' ' + items + ' ข้อ');
  }

  check(problems.length === 0,
    'หน้าเนื้อหาทั้ง ' + LESSON_PAGES.length + ' หน้ามีบล็อกใจความสำคัญ 3–5 ข้อบนสุดของเนื้อหา ' +
    'พร้อมคลาส keypoint และ key-figure (' + summary.join(' · ') + ')',
    'บล็อกใจความสำคัญหรือจุดที่ต้องจำยังไม่ครบ',
    problems.slice(0, 10).join(' | '));

  /* คลาสที่เพิ่มเข้ามาต้องมีนิยามใน CSS จริง และต้องไม่สร้างการ์ดมุมโค้ง + ขอบซ้ายสี */
  const css = read('site/assets/css/main.css');
  const classProblems = [];
  for (const cls of ['.takeaways', '.keypoint', '.key-figure', '.read-progress']) {
    if (!css.includes(cls + '{') && !css.includes(cls + ' ') && !css.includes(cls + ',')) {
      classProblems.push('CSS ไม่มีนิยามของ ' + cls);
    }
  }
  if (!/font-variant-numeric:tabular-nums/.test(css.slice(css.indexOf('.key-figure')))) {
    classProblems.push('.key-figure ไม่ได้ใช้ font-variant-numeric: tabular-nums');
  }
  /* บล็อกใจความสำคัญต้องไม่มี border-left และไม่มี border-radius (กันหน้าตาแบบการ์ด AI dashboard) */
  const tkBlock = css.slice(css.indexOf('.takeaways{'), css.indexOf('.takeaways ol'));
  if (/border-left/.test(tkBlock)) classProblems.push('.takeaways ใช้ขอบซ้ายสี ซึ่งเป็นรูปแบบที่ห้าม');
  if (/border-radius/.test(tkBlock)) classProblems.push('.takeaways ใช้มุมโค้ง ซึ่งเป็นรูปแบบที่ห้าม');
  check(classProblems.length === 0,
    'คลาสของส่วนเน้นมีนิยามครบ ใช้ tabular-nums กับตัวเลขที่ต้องจำ และไม่ใช้การ์ดมุมโค้ง/ขอบซ้ายสี',
    'คลาสของส่วนเน้นยังไม่ถูกต้อง',
    classProblems.join(' | '));

  /* แถบความคืบหน้าการอ่านต้องอ่านสีจากโทเคน ไม่ใช่สีตายตัว */
  const rpBlock = css.slice(css.indexOf('.read-progress{'), css.indexOf('.read-progress{') + 260);
  check(/background:var\(--/.test(rpBlock),
    'แถบความคืบหน้าการอ่านใช้สีจาก CSS variable จึงเปลี่ยนตามธีมได้',
    'แถบความคืบหน้าการอ่านใช้สีตายตัว');
}

/* ---------- 11) สาระที่ต้องอยู่ครบหลังการตัดสำนวน ----------
   ด่านนี้คือสัญญาว่าการตัดสำนวนจะไม่ลบข้อเท็จจริง ตัวอย่าง หรือหัวข้อใดออก
   ทุกข้อผูกกับเกณฑ์ส่งมอบของบทเรียนชุดนี้ ไม่ใช่แค่ "หน้าสั้นลง" */

group('substance', '11. สาระครบตามเกณฑ์ส่งมอบหลังตัดสำนวน');

{
  const problems = [];

  /* ต้องมีอยู่และต้องอยู่คนละส่วนของเนื้อหา — ระบุเป็นข้อความที่ห้ามหาย */
  const REQUIRED = [
    { rel: 'site/lessons/01-tps.html', what: 'สูตร TPS', need: ['TPS ='] },
    { rel: 'site/lessons/01-tps.html', what: 'ตัวอย่างคิดทีละขั้นครบ 3 เคส',
      need: ['ตัวอย่างที่ 1', 'ตัวอย่างที่ 2', 'ตัวอย่างที่ 3'] },
    { rel: 'site/lessons/01-tps.html', what: 'คำนวณย้อนกลับหา VU',
      need: ['คำนวณย้อนกลับ', 'ต้องใช้ VU'] },
    { rel: 'site/lessons/01-tps.html', what: 'กฎของ Little', need: ['Little'] },
    { rel: 'site/lessons/01-tps.html', what: 'ข้อผิดพลาดที่พบบ่อย', need: ['ข้อผิดพลาดที่พบบ่อย'] },
    { rel: 'site/lessons/01-tps.html', what: 'หลักฐานจากการรันจริง',
      need: ['12.36', '105.38', '54.25', '93.44', '1,155'] },

    { rel: 'site/lessons/02-vu.html', what: 'แนวคิด VU ครบ',
      need: ['วงจรชีวิต', 'executor', 'think time', 'connection pool', 'อิ่มตัว', 'ต้นทุน'] },

    { rel: 'site/lessons/03-metrics.html', what: 'แคตตาล็อก metric ที่สร้างจากไฟล์ข้อมูลจริง',
      need: ['assets/data/metrics.json'] },
    { rel: 'site/lessons/03-metrics.html', what: 'metric หลักพร้อมหน่วย',
      need: ['http_reqs', 'http_req_duration', 'http_req_blocked', 'http_req_connecting',
        'http_req_tls_handshaking', 'http_req_sending', 'http_req_waiting', 'http_req_receiving',
        'http_req_failed', 'iterations', 'iteration_duration', 'vus', 'vus_max', 'data_sent',
        'checks', 'dropped_iterations'] },
    { rel: 'site/lessons/03-metrics.html', what: 'กับดักของ expected_response',
      need: ['expected_response'] },

    { rel: 'site/lessons/04-percentiles.html', what: 'วิธีคิดเปอร์เซ็นไทล์ทีละขั้น',
      need: ['เปอร์เซ็นไทล์', 'คำนวณเปอร์เซ็นไทล์ด้วยมือ'] },
    { rel: 'site/lessons/04-percentiles.html', what: 'กราฟการกระจายและ CDF',
      need: ['ฮิสโตแกรม', 'CDF'] },
    { rel: 'site/lessons/04-percentiles.html', what: 'ตัวเลขเปอร์เซ็นไทล์จากการรันจริง',
      need: ['44.40', '54.69', '65.31', '74.53', '466.29', '584.70', '54.25'] },

    { rel: 'site/lessons/05-load-profiles.html', what: 'ประเภทการทดสอบทั้งหกแบบ',
      need: ['smoke', 'load', 'stress', 'spike', 'soak', 'breakpoint'] },
    { rel: 'site/lessons/05-load-profiles.html', what: 'จุดอิ่มตัวและวิธีหา',
      need: ['จุดอิ่มตัว'] },
    { rel: 'site/lessons/05-load-profiles.html', what: 'threshold และ abort',
      need: ['threshold', 'abort', 'delayAbortEval'] },

    { rel: 'site/lessons/06-read-results.html', what: 'วิธีอ่าน summary ครบทุกบล็อก',
      need: ['EXECUTION', 'THRESHOLDS', 'checks', 'HTTP', 'NETWORK'] },
    { rel: 'site/lessons/06-read-results.html', what: 'การส่งออกผลและ smoke test ก่อนเสมอ',
      need: ['smoke', '--summary-export'] },

    { rel: 'site/troubleshooting.html', what: 'คำถามแก้ปัญหาครบ 20 ข้อ',
      need: [] }
  ];

  for (const req of REQUIRED) {
    if (!exists(req.rel)) { problems.push(req.rel + ' ไม่พบไฟล์'); continue; }
    const text = read(req.rel);
    const missing = req.need.filter((s) => !text.includes(s));
    if (missing.length) {
      problems.push(req.rel + ' ขาด ' + req.what + ' → ' + missing.join(', '));
    }
  }

  check(problems.length === 0,
    'สาระตามเกณฑ์ส่งมอบอยู่ในหน้าเนื้อหาครบ (' + REQUIRED.length + ' หัวข้อ)',
    'สาระบางส่วนหายไปหลังการตัดสำนวน',
    problems.join(' | '));

  /* ทางลัดของแต่ละกลุ่มอาการถูกแยกออกเป็นหัวข้อตามบท ไม่ใช่การเขียนทับด้วยบทความเดียว
     ต้องคงจำนวน 6 บทเรียน + ลำดับ pager ที่ใช้ site.js เป็นแหล่งข้อมูลกลาง */
  const lessonCount = findAllHtml(path.join(site, 'lessons')).length;
  check(lessonCount === 6,
    'บทเรียนมี 6 หน้าเท่าเดิม',
    'จำนวนบทเรียนเปลี่ยนไป', 'พบ ' + lessonCount + ' หน้า');

  /* อภิธานศัพท์ต้องครบ 69 คำตามเกณฑ์ส่งมอบ */
  const metrics = JSON.parse(read('site/assets/data/metrics.json'));
  const totalGlossary = metrics.metrics.length + metrics.terms.length;
  check(totalGlossary === 69,
    'อภิธานศัพท์ครบ 69 คำ (metric ' + metrics.metrics.length + ' + ศัพท์ ' + metrics.terms.length + ')',
    'จำนวนอภิธานศัพท์ไม่ใช่ 69 คำ', 'พบ ' + totalGlossary + ' คำ');

  /* หน้า glossary ต้องแสดงผลจากไฟล์ข้อมูลจริง ไม่ได้ฝังข้อความไว้ในหน้า */
  const glossaryPage = read('site/glossary.html');
  check(glossaryPage.includes('assets/data/metrics.json'),
    'หน้าอภิธานศัพท์สร้างจาก assets/data/metrics.json จึงครบทุกคำโดยอัตโนมัติ',
    'หน้าอภิธานศัพท์ไม่ได้อ่านจากไฟล์ข้อมูล');

  /* troubleshooting 20 ข้อ แต่ละข้อต้องมีสามส่วนครบ (อาการ/สัญญาณ, สาเหตุ, วิธีแก้) */
  const ts = read('site/troubleshooting.html');
  const faqBlocks = ts.split('<details class="faq"').slice(1);
  /* การแบ่งกลุ่มบนหน้านี้ใช้หัวข้อ <h2> ไม่ใช่ตัวครอบ จึงนับจากหัวข้อ "กลุ่มที่ …" */
  const faqGroups = (ts.match(/<h2[^>]*>กลุ่มที่ /g) || []).length;
  const faqBad = [];
  faqBlocks.forEach((block, i) => {
    const tags = [...block.matchAll(/<span class="faq__tag">([^<]*)<\/span>/g)].map((m) => m[1].trim());
    const title = ((block.match(/<summary>([^<]*)/) || [])[1] || '').trim().slice(0, 40);
    if (tags.length !== 3) {
      faqBad.push('ข้อ ' + (i + 1) + ' (' + title + ') มี ' + tags.length + ' ส่วน ต้องมี 3 ส่วน');
    }
    /* สองส่วนหลังต้องเป็นสาเหตุและวิธีแก้เสมอ ส่วนแรกบอกอาการหรือสัญญาณที่ผิดปกติได้ทั้งคู่ */
    if (tags[1] !== 'สาเหตุที่เป็นไปได้') faqBad.push('ข้อ ' + (i + 1) + ' ส่วนที่ 2 ไม่ใช่ "สาเหตุที่เป็นไปได้"');
    if (tags[2] !== 'วิธีแก้') faqBad.push('ข้อ ' + (i + 1) + ' ส่วนที่ 3 ไม่ใช่ "วิธีแก้"');
  });
  const causeTotal = (ts.match(/faq__tag">สาเหตุที่เป็นไปได้/g) || []).length;
  const fixTotal = (ts.match(/faq__tag">วิธีแก้/g) || []).length;
  check(faqBlocks.length === 20 && faqBad.length === 0 && causeTotal === 20 && fixTotal === 20 &&
        faqGroups === 5,
    'หน้าปัญหาที่พบบ่อยมี 20 ข้อ แบ่งเป็น ' + faqGroups +
    ' กลุ่มตามอาการ แต่ละข้อมีครบทั้งอาการ/สัญญาณ สาเหตุที่เป็นไปได้ และวิธีแก้',
    'จำนวนหรือโครงสร้างของคำถามแก้ปัญหาเปลี่ยนไป',
    faqBad.slice(0, 6).join(' | '));

  /* แบบทดสอบ 36 ข้อ ต้องมีเฉลยและคำอธิบายครบทุกข้อ */
  const quizSrc = read('site/assets/js/quiz.js');
  const qCount = (quizSrc.match(/^\s*q:\s*'/gm) || []).length;
  const answerCount = (quizSrc.match(/^\s*answer:\s*\d+/gm) || []).length;
  const explainCount = (quizSrc.match(/^\s*explain:\s*'/gm) || []).length;
  const setCount2 = (quizSrc.match(/lessonId:\s*'/g) || []).length;
  check(qCount === 36 && answerCount === 36 && explainCount === 36 && setCount2 === 6,
    'แบบทดสอบยังมี 36 ข้อใน 6 ชุด พร้อมเฉลยและคำอธิบายครบทุกข้อ',
    'จำนวนข้อ เฉลย หรือคำอธิบายของแบบทดสอบเปลี่ยนไป',
    'ข้อ=' + qCount + ', เฉลย=' + answerCount + ', อธิบาย=' + explainCount + ', ชุด=' + setCount2);
}

/* ---------- รายงานผล ---------- */

const totalChecks = groups.reduce((a, g) => a + g.checks.length, 0);
const totalErrors = groups.reduce((a, g) => a + g.errors.length, 0);

console.log('');
console.log('การตรวจสอบเว็บไซต์ — loadtest-k6/site');
console.log('='.repeat(84));

for (const g of groups) {
  const failed = g.checks.filter((c) => !c.ok).length;
  const status = failed === 0 ? 'ผ่าน' : 'ไม่ผ่าน';
  console.log('');
  console.log('[' + status + '] ' + g.title);
  for (const c of g.checks) {
    console.log('   ' + (c.ok ? 'ok  ' : 'FAIL') + ' ' + c.message);
    if (!c.ok && c.detail) console.log('        → ' + c.detail);
  }
  for (const n of g.notes) console.log('   หมายเหตุ: ' + n);
}

console.log('');
console.log('='.repeat(84));
console.log('ผลรวม: ตรวจ ' + totalChecks + ' รายการ · ผ่าน ' + (totalChecks - totalErrors) +
  ' · ไม่ผ่าน ' + totalErrors);

if (totalErrors > 0) {
  console.log('');
  console.log('รายการที่ไม่ผ่าน:');
  let i = 0;
  for (const g of groups) {
    for (const c of g.checks) {
      if (c.ok) continue;
      i++;
      console.log('  ' + i + ') ' + c.message);
      if (c.detail) console.log('     → ' + c.detail);
    }
  }
}

console.log('');
process.exit(totalErrors ? 1 : 0);
