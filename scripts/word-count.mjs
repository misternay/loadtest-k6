// word-count.mjs — นับจำนวนคำของหน้าเนื้อหา เพื่อพิสูจน์ว่าการตัดสำนวนไม่ถูกย้อนกลับ
// รันด้วย: node scripts/word-count.mjs [--before <โฟลเดอร์ site>] [--after <โฟลเดอร์ site>]
//
// นับเฉพาะข้อความที่ผู้ใช้เห็นจริงใน <body> ตัด <script>, <style> และคอมเมนต์ HTML ออก
// แล้วแบ่งคำภาษาไทยด้วย Intl.Segmenter (ตัวแบ่งคำของ ICU) ไม่ใช่การนับช่องว่าง
// เพราะภาษาไทยเขียนติดกันโดยไม่มีช่องว่าง การนับช่องว่างจะให้ตัวเลขที่ไม่มีความหมาย
//
// รายงานสองค่า
//   คำในเนื้อความ  = ตัด <pre>, <table>, <code> ออกด้วย (ตัวเลข/ตาราง/โค้ดไม่นับเป็นสำนวน)
//   คำที่มองเห็น    = ไม่ตัด <pre>/<table>/<code> (นับทุกอย่างที่ตาเห็น)
//
// ตัวตรวจที่สอง: "โทเคนทางเทคนิคต้องไม่หาย" — ดึงตัวเลข แฟล็กบรรทัดคำสั่ง ชื่อ metric
// การอ้างเปอร์เซ็นไทล์ โมดูล k6 และพาธไฟล์จากทั้งไฟล์ แล้วบังคับว่าค่าอ้างอิงต้องอยู่ครบ
//
// ==========================================================================
// ประวัติเกณฑ์
//
// รอบที่ 1 (การตัดสำนวน, 16 ก.ย. 2026) — เกณฑ์ "ลด 25–35% ต่อหน้า"
//                                              เทียบกับสำเนา site/ ก่อนแก้
//   ผลที่วัดได้จริง: 16,501 → 12,064 คำในเนื้อความ (ลด 4,437 คำ = 26.9%)
//   ต่อหน้า: 01-tps 2576→1884 (26.9%) · 02-vu 1877→1381 (26.4%) ·
//            03-metrics 1456→1054 (27.6%) · 04-percentiles 2637→1929 (26.8%) ·
//            05-load-profiles 2167→1578 (27.2%) · 06-read-results 2597→1923 (26.0%) ·
//            troubleshooting 3191→2315 (27.5%)
//   หลักฐาน: docs/evidence/word-count-before-after.txt
//
// รอบที่ 3 (เพิ่มโมดูลใหม่, 16 ก.ย. 2026) — งานรอบนี้ "เพิ่ม" โมดูลใหม่โดยเจตนา
//   (สี่คำที่ต้องจำ + บรรทัดอ้างกลับในบทเรียน 01–06 + สไลเดอร์ + กายวิภาค + หน้างานจริง)
//   จึงเปลี่ยนเกณฑ์จาก "ต้องลด 25–35% จากค่าเดิม" เป็น "ต้องไม่คลาดจากค่าที่ตั้งไว้"
//   ค่าอ้างอิงใหม่ = ค่าที่วัดได้จริงหลังเพิ่มโมดูล (ตาราง REFERENCE_PROSE ด้านล่าง)
//   เกณฑ์ปัจจุบัน: ต่อหน้า "โตได้ไม่เกิน 5% และหดได้ไม่เกิน 10%" จากค่าอ้างอิงใหม่
//   เหตุผลที่ยอมให้โต 5%: บรรทัดอ้างกลับในบทเรียนเป็นเนื้อหาที่ตั้งใจเพิ่ม (~11 คำ/หน้า)
//   และยอมให้หด 10% เพราะยังควรตัดสำนวนเพิ่มได้ แต่ต้องไม่ลบสาระทิ้ง
//
// ด่านโทเคนทางเทคนิคยังเข้มเท่าเดิม: ค่าอ้างอิงทั้งชุดต้องอยู่ครบเหมือนเดิม
// ==========================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

/* หน้าที่ยังใช้ตัวเลขจริงและต้องอ่านง่าย — หน้าเนื้อหาทั้งหมดที่ต้องลดสำนวน */
const PAGES = [
  'lessons/01-tps.html',
  'lessons/02-vu.html',
  'lessons/03-metrics.html',
  'lessons/04-percentiles.html',
  'lessons/05-load-profiles.html',
  'lessons/06-read-results.html',
  'troubleshooting.html'
];

/* เกณฑ์ปัจจุบัน (รอบที่ 3): เทียบค่าอ้างอิงใหม่ ไม่ใช่เทียบสำเนาก่อนตัดสำนวน */
const GROWTH_MAX = 5;   /* โตได้ไม่เกิน 5% ต่อหน้า */
const SHRINK_MAX = 10;  /* หดได้ไม่เกิน 10% ต่อหน้า */

/* ---------- ค่าอ้างอิงของรอบที่ 1 (ก่อนการตัดสำนวน) — เก็บไว้เป็นหลักฐาน ----------
   โปรเจกต์นี้ไม่มี git สำเนา site/ ก่อนแก้จึงถูกลบหลังวัดเสร็จ
   ค่าต่อไปนี้คือค่าที่วัดได้จริงจากสำเนานั้น บันทึกไว้เพื่อให้ตรวจซ้ำได้ตลอดไป
   โดยไม่ต้องมีสำเนา — ใช้รายงานผลการตัดสำนวนรอบที่ 1 ในโหมด --history

   PROSE_BEFORE_TRIM = จำนวน "คำในเนื้อความ" ต่อหน้าก่อนการตัดสำนวน
   FROZEN_TOKENS = เซตของโทเคนทางเทคนิคก่อนการตัดสำนวน (union ข้ามทั้ง 7 หน้า)

   หมายเหตุเรื่อง FROZEN_TOKENS: รูปแบบ --[a-z][a-z0-9-]{2,} จับทั้งแฟล็กบรรทัดคำสั่งจริง
   เช่น --summary-export และส่วนต่อท้ายแบบ BEM ในชื่อคลาส เช่น callout--evidence
   ทั้งสองอย่างถูกตรึงไว้เหมือนกัน เพราะเป็นข้อความที่การตัดสำนวนไม่ควรแตะ
   ถ้ามีการเปลี่ยนชื่อคลาสแบบ BEM อย่างตั้งใจ ต้องอัปเดตรายการนี้พร้อมกัน */

const PROSE_BEFORE_TRIM = {
  'lessons/01-tps.html': 2576,
  'lessons/02-vu.html': 1877,
  'lessons/03-metrics.html': 1456,
  'lessons/04-percentiles.html': 2637,
  'lessons/05-load-profiles.html': 2167,
  'lessons/06-read-results.html': 2597,
  'troubleshooting.html': 3191
};

/* ---------- ค่าอ้างอิงใหม่ (รอบที่ 3) — วัดเมื่อ 2026-09-16 หลังเพิ่มโมดูลครบ ----------
   คอลัมน์ "ก่อนตัดสำนวน" คือ PROSE_BEFORE_TRIM ด้านบน
   คอลัมน์ "หลังตัดสำนวน" คือค่าที่ใช้เป็น REFERENCE_PROSE ในโหมด --check

   หน้า                           ก่อนตัดสำนวน   หลังตัดสำนวน   ลดลง
   lessons/01-tps.html                    2576          1895    26.4%
   lessons/02-vu.html                     1877          1392    25.8%
   lessons/03-metrics.html                1456          1065    26.9%
   lessons/04-percentiles.html            2637          1940    26.4%
   lessons/05-load-profiles.html          2167          1589    26.7%
   lessons/06-read-results.html           2597          1934    25.5%
   troubleshooting.html                   3191          2315    27.5%   (ไม่ถูกแตะในรอบที่ 3)
   ----------------------------------------------------------------------
   รวม                                   16501         12130    26.5%

   เทียบกับค่าที่รายงานในรอบที่ 1 (16,501 → 12,064): รอบนี้เพิ่มขึ้น 66 คำ
   ซึ่งตรงกับบรรทัดอ้างกลับ "ย้อนดู: สี่คำที่ต้องจำ (VU · RPS · RT · Budget)"
   ในบทเรียน 01–06 หน้าละ 11 คำ (6 × 11 = 66) — ไม่มีสำนวนอื่นเพิ่มเลย
   ========================================================================== */

const REFERENCE_PROSE = {
  'lessons/01-tps.html': 1895,
  'lessons/02-vu.html': 1392,
  'lessons/03-metrics.html': 1065,
  'lessons/04-percentiles.html': 1940,
  'lessons/05-load-profiles.html': 1589,
  'lessons/06-read-results.html': 1934,
  'troubleshooting.html': 2315
};

/* ชื่อเดิมก่อนรอบที่ 3 — คงไว้ให้โค้ดส่วนอื่นและเอกสารอ้างถึงได้ไม่พัง */
const FROZEN_PROSE = PROSE_BEFORE_TRIM;

const REFERENCE_DATE = '2026-09-16';

const FROZEN_TOKENS = [
  "--accent", "--border-strong", "--chart-1", "--chart-3", "--danger", "--evidence", "--fg-soft", "--insecure-skip-tls-verify",
  "--muted", "--no-connection-reuse", "--note", "--signal", "--summary-export", "--summary-mode", "--summary-trend-stats",
  "--warn", "0", "0.0", "0.00", "0.0000", "0.006", "0.0097", "0.01", "0.02", "0.0231", "0.03", "0.0328",
  "0.04", "0.05", "0.054", "0.0541", "0.05425", "0.06", "0.08", "0.1", "0.10", "0.100", "0.10538", "0.11",
  "0.15", "0.17", "0.172", "0.1723", "0.18", "0.2", "0.250", "0.300", "0.32", "0.3585", "0.4", "0.5",
  "0.50", "0.55", "0.5987", "0.6415", "0.76", "0.7738", "0.8145", "0.82", "0.90", "0.9025", "0.95", "0.985",
  "0.99", "00", "0000", "0001", "0012", "0015", "0042", "01", "02", "03", "04", "05", "06", "1", "1.0",
  "1.00", "1.01", "1.1", "1.13", "1.2", "1.20", "1.30", "1.37", "1.4", "1.5", "1.6", "1.7", "1.74", "1.8",
  "1.80", "1.94", "10", "10.0", "10.2", "10.4", "10.5", "10.77", "10.78", "100", "100.00", "1000", "10000",
  "104.25", "105.38", "105.3892", "105.39", "1054.25", "11", "11.2", "11.4", "11.6", "114197.5", "114207.1",
  "1155", "117.67", "12", "12.36", "12.4", "12.50", "12.6", "120", "120.00", "1200", "121.72", "121724.5",
  "123.60", "125", "127.0", "127.39", "13", "13.2", "13.4", "13.6", "138", "14", "14.2", "14.4", "15",
  "150", "1500", "155", "16", "16.4", "16.5", "16.8", "160", "168175", "168206.5", "17", "170", "18",
  "18.04", "18.2", "18.43", "180", "184", "184.33", "19", "195", "196", "2", "2.1", "2.2", "2.29", "2.4",
  "2.6", "2.8", "2.82", "20", "20.1", "200", "200.7", "201", "21", "212520", "213", "22.6", "220", "222152.5",
  "222205.9", "24", "240", "25", "250", "256", "26", "260", "267", "27", "276130", "276204.6", "278",
  "28.39", "28.6", "280.32", "3", "3.1", "3.2", "3.20", "3.3", "3.4", "3.5", "3.6", "3.7", "3.8", "30",
  "30.55", "300", "301", "32", "32.73", "320", "33.3", "33.33", "330", "330107.5", "330203.3", "34",
  "340.00", "3465", "35.09", "36", "37", "37.68", "374", "384", "384200.7", "38485", "39.5", "392", "4",
  "4.1", "4.10", "4.2", "4.21", "4.3", "4.4", "4.5", "4.6", "4.7", "4.9", "40", "401", "403", "404",
  "41", "42.1", "42.94", "421", "429", "438194.3", "43867", "44.34", "44.40", "44.84", "45", "45.10",
  "46", "46.35", "46.91", "465", "466", "466.29", "47.79", "47.94", "48.5", "480.00", "49.4", "49.58",
  "492175", "49253.5", "5", "5.0", "5.07", "5.2", "5.4", "5.6", "5.9", "50", "50.00", "50.7", "500",
  "5000", "503", "509", "51", "51.13", "51.5", "52", "520.00", "54", "54.02", "54.0254", "54.03", "54.246",
  "54.25", "54.2518", "54.28", "54.43", "54.69", "546130", "54646.8", "554.25", "570", "58", "584", "584.64",
  "584.70", "6", "6.2", "6.4", "6.6", "6.7", "6.8", "6.9", "60", "60.00", "600", "60044.5", "60052.9",
  "602.49", "60207.1", "60220", "603.32", "620", "62660.934", "63.4", "634.81", "64", "64.2", "65", "65.02",
  "65.30", "65.31", "65535", "660", "68", "7", "7.15", "7.2", "7.4", "702.10", "71.20", "73.2", "74",
  "74.08", "74.53", "75", "76", "79", "8", "8.1", "8.2", "8.55", "8.6", "8.60", "8.7", "8.8", "80", "8080",
  "8420", "85", "9", "9.2", "9.49", "9.5", "9.59", "9.8", "90", "91", "91245", "92.3", "93.44", "93.45",
  "94", "94.89", "95", "95.40", "95.5", "95.92", "96.3", "96.6", "97", "98.5", "99", "99.4", "99.58",
  "99.9", "999999", "BASE_URL", "TAIL_RATE", "data/latency-samples.js", "data/metrics.js", "data_received",
  "data_sent", "dropped_iterations", "examples/load.js", "examples/smoke.js", "expected_response", "http_req_blocked",
  "http_req_connecting", "http_req_duration", "http_req_failed", "http_req_receiving", "http_req_sending",
  "http_req_tls_handshaking", "http_req_waiting", "http_reqs", "iteration_duration", "js/calc.js", "js/charts.js",
  "js/site.js", "js/storage.js", "k6/crypto", "k6/http", "k6/js", "k6/latest", "k6/metrics", "k6/smoke",
  "order_processing_time_ms", "order_success_rate", "orders_completed_total", "p(0.05)", "p(1)", "p(50)",
  "p(90)", "p(95)", "p(95.5)", "p(99)", "p(99.9)", "scripts/test-calc.mjs", "server/server.mjs", "steady_traffic",
  "time_total", "tls_handshaking", "vus_max", "worker_queue_depth"
];

const ENTITIES = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&times;': '×',
  '&divide;': '÷',
  '&minus;': '−',
  '&hellip;': '…'
};

const segmenter = new Intl.Segmenter('th', { granularity: 'word' });

function bodyOf(html) {
  const m = html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i);
  return m ? m[1] : html;
}

/* ตัดบล็อกที่ไม่ใช่ข้อความในเนื้อความออก แล้วแปลงแท็กที่เหลือเป็นช่องว่าง
   ลำดับสำคัญ: ตัด <script>/<style> ก่อน เพื่อไม่ให้โค้ดที่มีเครื่องหมาย < หลุดออกมา */
function textOf(html, { keepTables }) {
  let s = bodyOf(html);
  s = s.replace(/<!--[\s\S]*?-->/g, ' ');
  s = s.replace(/<script\b[\s\S]*?<\/script>/gi, ' ');
  s = s.replace(/<style\b[\s\S]*?<\/style>/gi, ' ');
  s = s.replace(/<pre\b[\s\S]*?<\/pre>/gi, ' ');
  if (!keepTables) {
    s = s.replace(/<table\b[\s\S]*?<\/table>/gi, ' ');
    s = s.replace(/<code\b[\s\S]*?<\/code>/gi, ' ');
  }
  /* แท็กที่เหลือกลายเป็นช่องว่าง กันคำสองคำติดกันข้ามแท็ก */
  s = s.replace(/<[^>]+>/g, ' ');
  for (const [ent, ch] of Object.entries(ENTITIES)) s = s.split(ent).join(ch);
  return s;
}

function countWords(text) {
  let n = 0;
  for (const part of segmenter.segment(text)) {
    if (part.isWordLike) n++;
  }
  return n;
}

function measure(siteDir, rel) {
  const file = path.join(siteDir, rel);
  const html = fs.readFileSync(file, 'utf8');
  const proseText = textOf(html, { keepTables: false });
  const visibleText = textOf(html, { keepTables: true });
  return {
    proseWords: countWords(proseText),
    visibleWords: countWords(visibleText),
    proseChars: proseText.replace(/\s+/g, '').length,
    numbers: numbersOf(html)
  };
}

/* ---------- ดึง "โทเคนทางเทคนิค" ทุกตัวจากทั้งไฟล์ ----------
   ไม่ใช่แค่ตัวเลข แต่รวมแฟล็กบรรทัดคำสั่ง ชื่อ metric ที่มีขีดล่าง การอ้างเปอร์เซ็นไทล์
   โมดูลของ k6 และพาธไฟล์ในโปรเจกต์ เพราะสิ่งเหล่านี้คือ "ข้อเท็จจริง" ที่การตัดสำนวนห้ามแตะ
   ตัวเลขจัดรูปให้เทียบกันได้โดยตัดเครื่องหมายคั่นหลักพันออก (1,155 กับ 1155 คือค่าเดียวกัน) */
function numbersOf(html) {
  const set = new Set();
  const patterns = [
    /\d[\d,]*(?:\.\d+)?/g,
    /--[a-z][a-z0-9-]{2,}/g,
    /[a-z][a-z0-9]*(?:_[a-z0-9]+)+/gi,
    /p\(\d+(?:\.\d+)?\)/g,
    /\bk6\/[a-z]+/g,
    /\b[a-z]+\/[a-z-]+\.(?:js|mjs|json)/g
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(html)) !== null) {
      const raw = m[0].replace(/,/g, '').replace(/\.$/, '');
      if (raw === '' || raw === '.') continue;
      set.add(raw);
    }
  }
  return set;
}

/* ---------- อ่านอาร์กิวเมนต์ ---------- */

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : null;
}

const beforeArg = argValue('--before');
const afterArg = argValue('--after');
const singleArg = argValue('--site');

function resolveSite(p) {
  if (!p) return null;
  const abs = path.isAbsolute(p) ? p : path.resolve(root, p);
  if (!fs.existsSync(abs)) throw new Error('ไม่พบโฟลเดอร์: ' + abs);
  return abs;
}

/* ---------- โหมด --check: เทียบกับค่าอ้างอิงใหม่ (ไม่ต้องมีสำเนาเดิม) ----------
   เกณฑ์รอบที่ 3: ต่อหน้า โตได้ไม่เกิน GROWTH_MAX% และหดได้ไม่เกิน SHRINK_MAX%
   จากค่าอ้างอิงที่วัดหลังเพิ่มโมดูล — ไม่ใช่ "ต้องลด 25–35%" แบบรอบที่ 1 อีกแล้ว
   เพราะรอบนี้เป็นการเพิ่มโมดูลใหม่โดยเจตนา */

if (process.argv.includes('--check')) {
  const dir = resolveSite(singleArg || 'site');
  console.log('');
  console.log('ตรวจจำนวนคำเทียบค่าอ้างอิงรอบที่ 3 (' + REFERENCE_DATE + ') — ' + dir);
  console.log('เกณฑ์: ต่อหน้าโตได้ไม่เกิน ' + GROWTH_MAX + '% และหดได้ไม่เกิน ' + SHRINK_MAX +
    '% จากค่าอ้างอิง');
  console.log('='.repeat(100));
  console.log('  ' + 'หน้า'.padEnd(28) + 'อ้างอิง'.padStart(8) + 'ตอนนี้'.padStart(8) +
    'ต่าง'.padStart(8) + '%'.padStart(9) + '   สถานะ');
  console.log('='.repeat(100));

  let wordsOk = true;
  let sumRef = 0;
  let sumNow = 0;
  for (const rel of PAGES) {
    const ref = REFERENCE_PROSE[rel];
    const now = measure(dir, rel).proseWords;
    const pct = ref ? ((now - ref) / ref) * 100 : 0;
    const ok = pct <= GROWTH_MAX && pct >= -SHRINK_MAX;
    if (!ok) wordsOk = false;
    sumRef += ref;
    sumNow += now;
    const delta = now - ref;
    console.log('  ' + rel.padEnd(28) + String(ref).padStart(8) + String(now).padStart(8) +
      String((delta >= 0 ? '+' : '') + delta).padStart(8) +
      ((pct >= 0 ? '+' : '') + pct.toFixed(1) + '%').padStart(9) +
      '   ' + (ok ? 'ผ่าน' : 'ไม่ผ่าน'));
  }
  const totalPct = ((sumNow - sumRef) / sumRef) * 100;
  const totalOk = totalPct <= GROWTH_MAX && totalPct >= -SHRINK_MAX;
  console.log('='.repeat(100));
  console.log('  ' + 'รวม'.padEnd(28) + String(sumRef).padStart(8) + String(sumNow).padStart(8) +
    String((sumNow - sumRef >= 0 ? '+' : '') + (sumNow - sumRef)).padStart(8) +
    ((totalPct >= 0 ? '+' : '') + totalPct.toFixed(1) + '%').padStart(9) +
    '   ' + (totalOk ? 'ผ่าน' : 'ไม่ผ่าน'));

  /* เทียบกับผลการตัดสำนวนรอบที่ 1 เพื่อโชว์ว่าการตัดสำนวนยังอยู่ ไม่ได้ถูกลบทีหลัง */
  const beforeTrim = Object.keys(PROSE_BEFORE_TRIM).reduce((a, k) => a + PROSE_BEFORE_TRIM[k], 0);
  const trimPct = ((beforeTrim - sumNow) / beforeTrim) * 100;
  console.log('');
  console.log('เทียบกับค่าก่อนการตัดสำนวนรอบที่ 1 (เก็บไว้เป็นหลักฐาน)');
  console.log('  ก่อนตัดสำนวน ' + beforeTrim + ' คำ → ตอนนี้ ' + sumNow + ' คำ ' +
    '(ลด ' + (beforeTrim - sumNow) + ' คำ = ' + trimPct.toFixed(1) + '%)');
  console.log('  ค่าที่รายงานในรอบที่ 1 คือ 16,501 → 12,064 คำ (ลด 26.9%) · ' +
    'รอบนี้เพิ่มขึ้น ' + (sumNow - 12064) + ' คำ จากบรรทัดอ้างกลับในบทเรียน 01–06');

  /* โทเคนทางเทคนิคในปัจจุบันต้องครอบคลุมค่าอ้างอิงครบทุกตัว */
  const nowTokens = new Set();
  for (const rel of PAGES) {
    for (const t of measure(dir, rel).numbers) nowTokens.add(t);
  }
  const lost = FROZEN_TOKENS.filter((t) => !nowTokens.has(t));
  const added = [...nowTokens].filter((t) => !FROZEN_TOKENS.includes(t));

  console.log('');
  console.log('ด่านโทเคนทางเทคนิคเทียบค่าอ้างอิง');
  console.log('  อ้างอิง ' + FROZEN_TOKENS.length + ' ค่า · ตอนนี้ ' + nowTokens.size + ' ค่า');
  if (lost.length === 0) {
    console.log('  ผ่าน — โทเคนอ้างอิงอยู่ครบทุกตัว' +
      (added.length ? ' (มีโทเคนใหม่เพิ่ม ' + added.length + ' ค่า ซึ่งไม่ผิด)' : ''));
  } else {
    console.log('  ไม่ผ่าน — โทเคนอ้างอิงที่หายไป ' + lost.length + ' ค่า:');
    console.log('    ' + lost.slice(0, 40).join(', '));
  }
  console.log('');
  console.log('ผลลัพธ์: ' + (wordsOk && totalOk ? 'จำนวนคำยังอยู่ในเกณฑ์' : 'จำนวนคำหลุดเกณฑ์') +
    ' · ' + (lost.length === 0 ? 'โทเคนครบถ้วน' : 'มีโทเคนหายไป'));
  console.log('');
  process.exit(wordsOk && totalOk && lost.length === 0 ? 0 : 1);
}

/* ---------- โหมดนับเดี่ยว (ใช้วัด before ก่อนเริ่มแก้) ---------- */

if (!beforeArg && !afterArg) {
  const dir = resolveSite(singleArg || 'site');
  console.log('นับคำในเนื้อหา — ' + dir);
  console.log('-'.repeat(72));
  let tw = 0;
  let tc = 0;
  for (const rel of PAGES) {
    const r = measure(dir, rel);
    tw += r.proseWords;
    tc += r.proseChars;
    console.log('  ' + rel.padEnd(30) + ' คำในเนื้อความ ' + String(r.proseWords).padStart(5) +
      '   คำที่มองเห็น ' + String(r.visibleWords).padStart(5) +
      '   อักขระ ' + String(r.proseChars).padStart(6));
  }
  console.log('-'.repeat(72));
  console.log('  รวม'.padEnd(32) + ' คำในเนื้อความ ' + String(tw).padStart(5) +
    '   อักขระ ' + String(tc).padStart(6));
  process.exit(0);
}

/* ---------- โหมดเทียบ before/after ----------
   ใช้เมื่อมีสำเนา site/ ก่อนแก้จริง ๆ (เช่นตอนทำการตัดสำนวนรอบใหม่)
   เกณฑ์ของโหมดนี้ยังเป็น "ลด 25–35% ต่อหน้า" เพราะเป็นการเทียบกับสำเนาก่อนตัดสำนวน
   ต่างจากโหมด --check ที่เทียบกับค่าอ้างอิงที่ตรึงไว้ (เกณฑ์ ±5%/10%) */

const TRIM_TARGET_MIN = 25;
const TRIM_TARGET_MAX = 35;

const beforeDir = resolveSite(beforeArg);
const afterDir = resolveSite(afterArg || 'site');

console.log('');
console.log('นับคำในเนื้อหา (ตัด script/style/pre/table/code และคอมเมนต์ออก)');
console.log('  before: ' + beforeDir);
console.log('  after : ' + afterDir);
console.log('');
console.log('ตัวแบ่งคำ: Intl.Segmenter("th", word) — ตัวแบ่งคำภาษาไทยของ ICU');
console.log('เกณฑ์: ลดคำในเนื้อความ 25–35% ต่อหน้า โดยไม่เสียข้อเท็จจริง ตัวอย่าง ตัวเลข หรือแถวตาราง');
console.log('');
console.log('='.repeat(104));
console.log('  ' + 'หน้า'.padEnd(26) + 'before'.padStart(8) + 'after'.padStart(8) +
  'ลดลง'.padStart(9) + '%'.padStart(8) + '   ' + 'มองเห็น before→after'.padEnd(22) + 'สถานะ');
console.log('='.repeat(104));

const rows = [];
let sumB = 0;
let sumA = 0;
let sumVB = 0;
let sumVA = 0;
let allPass = true;
const numberFailures = [];

for (const rel of PAGES) {
  const b = measure(beforeDir, rel);
  const a = measure(afterDir, rel);
  const delta = b.proseWords - a.proseWords;
  const pct = b.proseWords ? (delta / b.proseWords) * 100 : 0;
  const pass = pct >= TRIM_TARGET_MIN && pct <= TRIM_TARGET_MAX;
  if (!pass) allPass = false;

  /* ตัวเลขที่หายไปหลังตัดสำนวน — ต้องว่างเปล่าเสมอ */
  const lost = [...b.numbers].filter((x) => !a.numbers.has(x));
  if (lost.length) numberFailures.push({ rel, lost });

  sumB += b.proseWords;
  sumA += a.proseWords;
  sumVB += b.visibleWords;
  sumVA += a.visibleWords;
  rows.push({ rel, b, a, delta, pct, pass, lost });

  console.log('  ' + rel.padEnd(26) + String(b.proseWords).padStart(8) + String(a.proseWords).padStart(8) +
    String('-'.repeat(1) + delta).padStart(9) + (pct.toFixed(1) + '%').padStart(8) + '   ' +
    (b.visibleWords + '→' + a.visibleWords).padEnd(22) +
    (pass ? 'ผ่าน' : 'ไม่ผ่าน') + (lost.length ? ' · ตัวเลขหาย ' + lost.length : ''));
}

const totalPct = sumB ? ((sumB - sumA) / sumB) * 100 : 0;
const visiblePct = sumVB ? ((sumVB - sumVA) / sumVB) * 100 : 0;

console.log('='.repeat(104));
console.log('  ' + 'รวมทั้ง 7 หน้า'.padEnd(26) + String(sumB).padStart(8) + String(sumA).padStart(8) +
  String('-' + (sumB - sumA)).padStart(9) + (totalPct.toFixed(1) + '%').padStart(8) + '   ' +
  (sumVB + '→' + sumVA).padEnd(22) + (totalPct >= TRIM_TARGET_MIN && totalPct <= TRIM_TARGET_MAX ? 'ผ่าน' : 'ไม่ผ่าน'));
console.log('');
console.log('  คำในเนื้อความรวม : ' + sumB + ' → ' + sumA + '  (ลด ' + (sumB - sumA) + ' คำ, ' + totalPct.toFixed(1) + '%)');
console.log('  คำที่มองเห็นรวม  : ' + sumVB + ' → ' + sumVA + '  (ลด ' + visiblePct.toFixed(1) + '%)');
console.log('');

/* ---------- ด่านตัวเลขต้องไม่หาย ---------- */

const beforeNumbers = new Set();
const afterNumbers = new Set();
for (const rel of PAGES) {
  for (const x of measure(beforeDir, rel).numbers) beforeNumbers.add(x);
  for (const x of measure(afterDir, rel).numbers) afterNumbers.add(x);
}
const lostNumbers = [...beforeNumbers].filter((x) => !afterNumbers.has(x));

console.log('ด่านโทเคนทางเทคนิค: ตัวเลข แฟล็กบรรทัดคำสั่ง ชื่อ metric การอ้างเปอร์เซ็นไทล์ โมดูล k6 และพาธไฟล์');
console.log('  before ' + beforeNumbers.size + ' ค่า → after ' + afterNumbers.size + ' ค่า');
if (lostNumbers.length === 0) {
  console.log('  ผ่าน — ไม่มีโทเคนทางเทคนิคใดหายไปเลย (after เป็น superset ของ before ครบทุกค่า)');
} else {
  console.log('  ไม่ผ่าน — โทเคนที่หายไป ' + lostNumbers.length + ' ค่า:');
  for (const f of numberFailures) {
    console.log('    ' + f.rel + ': ' + f.lost.join(', '));
  }
}
console.log('');

const wordsOk = allPass && totalPct >= TRIM_TARGET_MIN && totalPct <= TRIM_TARGET_MAX;
const numbersOk = lostNumbers.length === 0;
console.log('ผลลัพธ์: ' + (wordsOk ? 'การตัดสำนวนผ่านเกณฑ์' : 'การตัดสำนวนยังหลุดเกณฑ์') +
  ' · ' + (numbersOk ? 'ตัวเลขครบถ้วน' : 'มีตัวเลขหายไป'));
console.log('');

process.exit(wordsOk && numbersOk ? 0 : 1);
