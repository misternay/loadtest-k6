// test-calc.mjs — ชุดทดสอบฟังก์ชันคำนวณใน site/assets/js/calc.js
// ไม่ใช้ framework ใด ๆ รันด้วย: node scripts/test-calc.mjs
//
// ทุกเคสมีค่าที่คำนวณด้วยมือล่วงหน้าแล้ว ค่าคาดหวังเขียนไว้ในตัวทดสอบโดยตรง
// ถ้าผลไม่ตรงจะรายงานเป็น FAIL พร้อมค่าที่ได้จริง แล้วจบด้วย exit code 1

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

/* โหลด calc.js เข้า globalThis แบบเดียวกับที่เบราว์เซอร์ทำ */
await import(path.join(root, 'site/assets/js/calc.js'));
const calc = globalThis.LTK6.calc;

const samples = JSON.parse(
  fs.readFileSync(path.join(root, 'site/assets/data/latency-samples.json'), 'utf8')
);
const sorted = samples.sample;

/* ---------- ตัวช่วยทดสอบ ---------- */

const results = [];

function closeTo(expected, actual, eps = 0.005) {
  if (!Number.isFinite(actual)) return false;
  return Math.abs(expected - actual) <= eps;
}

/* เกณฑ์ยอมรับสำหรับค่าเปอร์เซ็นไทล์ที่เทียบกับตัวเลขของ k6
   k6 ใช้ตัวประมาณค่าของตัวเอง ผลจึงต่างจากการเทียบสัดส่วนบนข้อมูลดิบได้เล็กน้อย
   จากการตรวจจริง ค่าสูงสุดที่ต่างกันคือ 0.006 ms (ที่ p90) จึงตั้งเกณฑ์ไว้ 0.01 ms */
const PERCENTILE_TOLERANCE = 0.01;

function checkPercentile(name, expected, actual, note) {
  results.push({
    name,
    expected,
    actual,
    pass: closeTo(expected, actual, PERCENTILE_TOLERANCE),
    note: note || ''
  });
}

function check(name, expected, actual, note) {
  let pass;
  if (typeof expected === 'number' && typeof actual === 'number') {
    pass = closeTo(expected, actual);
  } else {
    pass = JSON.stringify(expected) === JSON.stringify(actual);
  }
  results.push({ name, expected, actual, pass, note: note || '' });
}

function checkTrue(name, condition, detail) {
  results.push({ name, expected: true, actual: !!condition, pass: !!condition, note: detail || '' });
}

function fmtNum(v) {
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return String(v);
    return Number.isInteger(v) ? String(v) : String(Math.round(v * 1e6) / 1e6);
  }
  if (v && typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/* ---------- 1. TPS calculator: เคสคำนวณมือ 3 เคส ---------- */

{
  // เคส 1: N=10, R=1, Rt=100, Tt=0 → dur=100 ms, ips=100, TPS=100
  const r = calc.tpsCalculator({ N: 10, R: 1, Rt: 100, Tt: 0 });
  checkTrue('เคส 1: คำนวณสำเร็จ', r.ok, 'ต้องไม่มีข้อผิดพลาด');
  check('เคส 1: iteration_duration (ms)', 100, r.iterationDurationMs, '(1 × 100) + 0');
  check('เคส 1: iterations/s', 100, r.iterationsPerSecond, '10 ÷ 0.100');
  check('เคส 1: TPS', 100, r.tps, '100 × 1');
  check('เคส 1: TPS ต่อ VU', 10, r.tpsPerVu, '1 × 1000 ÷ 100');
}

{
  // เคส 2: N=10, R=1, Rt=100, Tt=200 → dur=300 ms, ips=33.3333, TPS=33.3333
  const r = calc.tpsCalculator({ N: 10, R: 1, Rt: 100, Tt: 200 });
  check('เคส 2: iteration_duration (ms)', 300, r.iterationDurationMs, '(1 × 100) + 200');
  check('เคส 2: iterations/s', 33.333333, r.iterationsPerSecond, '10 ÷ 0.300');
  check('เคส 2: TPS', 33.333333, r.tps, 'think time ทำให้เหลือหนึ่งในสาม');
}

{
  // เคส 3: N=10, R=3, Rt=50, Tt=100 → dur=250 ms, ips=40, TPS=120
  const r = calc.tpsCalculator({ N: 10, R: 3, Rt: 50, Tt: 100 });
  check('เคส 3: iteration_duration (ms)', 250, r.iterationDurationMs, '(3 × 50) + 100');
  check('เคส 3: iterations/s', 40, r.iterationsPerSecond, '10 ÷ 0.250');
  check('เคส 3: TPS', 120, r.tps, '40 × 3 = 120');
  check('เคส 3: จำนวนขั้นตอนวิธีคิด', 4, r.steps.length, 'ต้องมี 4 ขั้น');
}

/* ---------- 2. เคสจากผลการรันจริง (Rt=54.25, Tt=50) ---------- */

{
  const r = calc.tpsCalculator({ N: 10, R: 1, Rt: 54.25, Tt: 50 });
  check('ค่าจริง: iteration_duration (ms)', 104.25, r.iterationDurationMs, '54.25 + 50');
  check('ค่าจริง: iterations/s', 95.923263, r.iterationsPerSecond, '10 ÷ 0.10425');
  check('ค่าจริง: TPS', 95.923263, r.tps, 'เทียบกับ k6 ที่รายงาน 93.44/s');
  check('ค่าจริง: ถ้าคิดจาก response time อย่างเดียว', 184.331797, r.tpsIfResponseOnly,
    '10 ÷ 0.05425 ซึ่งสูงเกินจริง');
  check('ค่าจริง: ตัวคูณที่สูงเกินจริง', 1.921659, r.overestimateFactor, '104.25 ÷ 54.25');
}

/* ---------- 3. VU calculator: คำนวณย้อนกลับ ---------- */

{
  // เป้าหมาย 500 RPS, R=1, Rt=50, Tt=150 → dur=200, perVu=5 → 100 VUs
  const r = calc.vuCalculator({ targetTps: 500, R: 1, Rt: 50, Tt: 150 });
  check('ย้อนกลับ 500 RPS: iteration_duration (ms)', 200, r.iterationDurationMs, '50 + 150');
  check('ย้อนกลับ 500 RPS: TPS ต่อ VU', 5, r.tpsPerVu, '1 × 1000 ÷ 200');
  check('ย้อนกลับ 500 RPS: VU ที่ต้องใช้', 100, r.vusRequired, '⌈500 ÷ 5⌉');
  check('ย้อนกลับ 500 RPS: ค่าไม่ปัดเศษ', 100, r.exactVus, 'หารลงตัวพอดี');
}

{
  // เป้าหมาย 300 RPS, R=2, Rt=80, Tt=40 → dur=200, perVu=10 → 30 VUs
  const r = calc.vuCalculator({ targetTps: 300, R: 2, Rt: 80, Tt: 40 });
  check('ย้อนกลับ 300 RPS: iteration_duration (ms)', 200, r.iterationDurationMs, '(2 × 80) + 40');
  check('ย้อนกลับ 300 RPS: TPS ต่อ VU', 10, r.tpsPerVu, '2 × 1000 ÷ 200');
  check('ย้อนกลับ 300 RPS: VU ที่ต้องใช้', 30, r.vusRequired, '⌈300 ÷ 10⌉');
}

{
  // ปัดขึ้น: 101 RPS, perVu=5 → exact 20.2 → 21 VUs
  const r = calc.vuCalculator({ targetTps: 101, R: 1, Rt: 50, Tt: 150 });
  check('ปัดขึ้น: ค่าไม่ปัดเศษ', 20.2, r.exactVus, '101 ÷ 5');
  check('ปัดขึ้น: VU ที่ต้องใช้', 21, r.vusRequired, '⌈20.2⌉ = 21');
  checkTrue('ปัดขึ้น: ต้องไม่ต่ำกว่าค่าไม่ปัดเศษ', r.vusRequired >= r.exactVus,
    'ปัดขึ้นเสมอเพราะ VU มีเศษไม่ได้');
}

/* ---------- 4. กฎของ Little ---------- */

{
  // tps=93.44, R=1, Rt=54.25, Tt=50 → dur=104.25
  const l = calc.littlesLaw({ tps: 93.44, R: 1, Rt: 54.25, Tt: 50 });
  check('Little: iterations/s', 93.44, l.itersPerSec, 'tps ÷ R');
  check('Little: iteration_duration (ms)', 104.25, l.iterationDurationMs, '54.25 + 50');
  check('Little: VU ที่ต้องใช้', 9.74112, l.vusRequired, '93.44 × 0.10425');
  check('Little: request ลอยพร้อมกัน', 5.06912, l.requestsInFlight, '93.44 × 0.05425');
  check('Little: สัดส่วนเวลาที่ถูกจอง', 0.520384, l.busyRatio, '54.25 ÷ 104.25');
}

{
  // tps=120, R=3, Rt=50, Tt=100 → iters=40, dur=250 → vus=10, inflight=2
  const l = calc.littlesLaw({ tps: 120, R: 3, Rt: 50, Tt: 100 });
  check('Little 2: iterations/s', 40, l.itersPerSec, '120 ÷ 3');
  check('Little 2: VU ที่ต้องใช้', 10, l.vusRequired, '40 × 0.25 = 10');
  check('Little 2: request ลอยพร้อมกัน', 2, l.requestsInFlight, '40 × 0.05 = 2');
  check('Little 2: สัดส่วนเวลาที่ถูกจอง', 0.6, l.busyRatio, '3 × 50 ÷ 250');
}

/* ---------- 5. การตรวจสอบอินพุต ---------- */

{
  const e1 = calc.validateInputs({ N: 0, R: 1, Rt: 100, Tt: 0 });
  checkTrue('ตรวจอินพุต: N=0 ต้องมีข้อผิดพลาด', e1.length === 1 && e1[0].field === 'N',
    'ข้อความ: ' + (e1[0] ? e1[0].message : '—'));
  checkTrue('ตรวจอินพุต: N=0 ต้องมีวิธีแก้', !!(e1[0] && e1[0].fix), e1[0] ? e1[0].fix : '—');
}

{
  const e2 = calc.validateInputs({ N: -5, R: 0, Rt: -1, Tt: -1 });
  const fields = e2.map((e) => e.field).sort().join(',');
  check('ตรวจอินพุต: ติดลบทั้งสี่ช่อง', 'N,R,Rt,Tt', fields,
    'ทุกช่องต้องรายงานข้อผิดพลาด');
}

{
  const e3 = calc.validateInputs({ Rt: 0 });
  checkTrue('ตรวจอินพุต: Rt=0 ต้องผิดพลาด', e3.length === 1 && e3[0].field === 'Rt',
    e3[0] ? e3[0].message : '—');
}

{
  const e4 = calc.validateInputs({ Tt: 0 });
  check('ตรวจอินพุต: Tt=0 ต้องผ่าน', 0, e4.length, 'think time เป็น 0 ได้');
}

{
  const e5 = calc.validateInputs({ N: 10.5 });
  checkTrue('ตรวจอินพุต: N มีเศษต้องผิดพลาด',
    e5.length === 1 && e5[0].field === 'N' && /จำนวนเต็ม/.test(e5[0].message),
    e5[0] ? e5[0].message : '—');
}

{
  const e6 = calc.validateInputs({ N: '', Rt: 'abc' });
  check('ตรวจอินพุต: ช่องว่างและค่าที่ไม่ใช่ตัวเลข', 'N,Rt',
    e6.map((e) => e.field).sort().join(','), 'ต้องจับได้ทั้งสองช่อง');
}

{
  const e7 = calc.validateInputs({ N: 10, R: 1, Rt: 54.25, Tt: 50 });
  check('ตรวจอินพุต: ค่าที่ถูกต้องต้องไม่มีข้อผิดพลาด', 0, e7.length, 'ใช้ค่าจากการรันจริง');
}

{
  const r = calc.tpsCalculator({ N: 0, R: 1, Rt: 100, Tt: 0 });
  checkTrue('เครื่องคำนวณ: N=0 ต้องไม่ให้ผลลัพธ์', r.ok === false && r.errors.length > 0,
    r.ok ? 'ให้ผลลัพธ์ทั้งที่ควรปฏิเสธ' : r.errors[0].message);
}

/* ---------- 6. เปอร์เซ็นไทล์ ---------- */

{
  // ชุดข้อมูลตัวอย่าง 10 ค่า ที่ใช้ในบทที่ 4
  // ค่าดัชนีเริ่มจาก 0 ดังนั้น "ตำแหน่ง 4.5" คือกึ่งกลางระหว่าง index 4 (=30) กับ index 5 (=34)
  const small = [12, 18, 21, 25, 30, 34, 41, 52, 68, 120];
  check('เปอร์เซ็นไทล์: p50 ของชุด 10 ค่า', 32, calc.percentile(small, 50),
    'ตำแหน่ง 4.5 ระหว่าง 30 กับ 34');
  check('เปอร์เซ็นไทล์: p90 ของชุด 10 ค่า', 73.2, calc.percentile(small, 90),
    'ตำแหน่ง 8.1 ระหว่าง 68 กับ 120');
  check('เปอร์เซ็นไทล์: p95 ของชุด 10 ค่า', 96.6, calc.percentile(small, 95),
    'ตำแหน่ง 8.55 ระหว่าง 68 กับ 120');
  check('เปอร์เซ็นไทล์: p0 ของชุด 10 ค่า', 12, calc.percentile(small, 0), 'ค่าต่ำสุด');
  check('เปอร์เซ็นไทล์: p100 ของชุด 10 ค่า', 120, calc.percentile(small, 100), 'ค่าสูงสุด');

  const mean = calc.mean(small);
  check('เปอร์เซ็นไทล์: ค่าเฉลี่ยของชุด 10 ค่า', 42.1, mean, 'ผลรวม 421 ÷ 10');
  check('เปอร์เซ็นไทล์: p50 ต่ำกว่าค่าเฉลี่ย', 0.76,
    Math.round(calc.percentile(small, 50) / mean * 100) / 100,
    '32 ÷ 42.1 = 0.76 แสดงว่าหางดึงค่าเฉลี่ยขึ้น');

  const step = calc.percentileStep(small, 90);
  check('เปอร์เซ็นไทล์: ตำแหน่งของ p90', 8.1, step.index, '0.9 × (10 − 1)');
  check('เปอร์เซ็นไทล์: ค่าล่างของ p90 (index 8)', 68, step.lowerValue, 'ค่าในดัชนีที่ 8');
  check('เปอร์เซ็นไทล์: ค่าบนของ p90 (index 9)', 120, step.upperValue, 'ค่าในดัชนีที่ 9');
  check('เปอร์เซ็นไทล์: เศษที่ใช้เทียบสัดส่วน', 0.1, step.fraction, 'ค่าทศนิยมที่เหลือ');

  const step50 = calc.percentileStep(small, 50);
  check('เปอร์เซ็นไทล์: ตำแหน่งของ p50', 4.5, step50.index, '0.5 × 9');
  check('เปอร์เซ็นไทล์: ค่าล่างของ p50 (index 4)', 30, step50.lowerValue, 'ค่าในดัชนีที่ 4');
  check('เปอร์เซ็นไทล์: ค่าบนของ p50 (index 5)', 34, step50.upperValue, 'ค่าในดัชนีที่ 5');
}

{
  // ค่าจริงจากไฟล์ข้อมูล n = 1155
  // หมายเหตุ: ค่าเปอร์เซ็นไทล์ที่ k6 รายงานมาจากตัวประมาณค่าของ k6 เอง
  // ซึ่งต่างจากการเทียบสัดส่วนบนข้อมูลดิบได้เล็กน้อย จึงใช้เกณฑ์ยอมรับ 0.01 ms
  const TOL = PERCENTILE_TOLERANCE;
  check('ข้อมูลจริง: จำนวนค่า', 1155, sorted.length, 'ตรงกับค่า n ที่ประกาศไว้');
  checkPercentile('ข้อมูลจริง: p50', samples.percentiles.p50, calc.percentile(sorted, 50),
    'ต่างจาก k6 ไม่เกิน ' + TOL + ' ms');
  checkPercentile('ข้อมูลจริง: p75', samples.percentiles.p75, calc.percentile(sorted, 75), '');
  checkPercentile('ข้อมูลจริง: p90', samples.percentiles.p90, calc.percentile(sorted, 90),
    'ต่างจาก k6 ' + (calc.percentile(sorted, 90) - samples.percentiles.p90).toFixed(4) + ' ms');
  checkPercentile('ข้อมูลจริง: p95', samples.percentiles.p95, calc.percentile(sorted, 95), '');
  checkPercentile('ข้อมูลจริง: p99', samples.percentiles.p99, calc.percentile(sorted, 99), '');
  check('ข้อมูลจริง: ค่าเฉลี่ย', samples.mean, calc.mean(sorted), '');

  const d = calc.describe(sorted);
  check('ข้อมูลจริง: ค่าต่ำสุด', samples.min, d.min, '');
  check('ข้อมูลจริง: ค่าสูงสุด', samples.max, d.max, '');

  /* ค่าเฉลี่ยต้องถูกกลบด้วยหาง นี่คือประเด็นหลักของบทที่ 4 */
  checkTrue('ข้อมูลจริง: p50 ต่ำกว่าค่าเฉลี่ย', d.p50 < d.mean,
    'p50 = ' + d.p50.toFixed(2) + ' ms, mean = ' + d.mean.toFixed(2) + ' ms');
  checkTrue('ข้อมูลจริง: p99 สูงกว่าค่าเฉลี่ยหลายเท่า', d.p99 / d.mean > 8,
    'p99 ÷ mean = ' + (d.p99 / d.mean).toFixed(2) + ' เท่า');
}

/* ---------- 7. แนะนำรูปแบบการทดสอบ ---------- */

{
  const p1 = calc.recommendProfile({ targetTps: 1, p95Ms: 120, thinkTimeMs: 0 });
  check('แนะนำรูปแบบ: 1 RPS', 'smoke', p1.profile, 'อัตราต่ำมากใช้ยืนยันความพร้อม');
  checkTrue('แนะนำรูปแบบ: smoke ต้องมี stages', p1.stages.length >= 1,
    'ได้ ' + p1.stages.length + ' stages');
}

{
  const p2 = calc.recommendProfile({ targetTps: 500, p95Ms: 200, thinkTimeMs: 100 });
  check('แนะนำรูปแบบ: 500 RPS', 'load', p2.profile, 'อยู่ในช่วงที่วัดได้จริง');
  check('แนะนำรูปแบบ: TPS ต่อ VU', 3.333333, p2.tpsPerVu, '1 × 1000 ÷ 300');
  check('แนะนำรูปแบบ: VU อ้างอิง', 150, p2.vus, '⌈500 ÷ 3.3333⌉');
  checkTrue('แนะนำรูปแบบ: stages ต้องขึ้นลงเป็นขั้น',
    p2.stages[0].target < p2.stages[2].target && p2.stages[p2.stages.length - 1].target === 0,
    JSON.stringify(p2.stages.map((s) => s.target)));
  checkTrue('แนะนำรูปแบบ: ต้องมี snippets ให้คัดลอก', /ramping-vus/.test(p2.optionsSnippet),
    'มี executor ในโค้ดตัวอย่าง');
}

{
  const p3 = calc.recommendProfile({ targetTps: 5000, p95Ms: 300, thinkTimeMs: 200 });
  check('แนะนำรูปแบบ: 5000 RPS', 'stress', p3.profile, 'ต้องใช้ VU มากพอที่เครื่องทดสอบจะเป็นคอขวด');
  check('แนะนำรูปแบบ: VU อ้างอิงของ stress', 2500, p3.vus, '⌈5000 ÷ 2⌉');
}

{
  /* หน้าเว็บส่งค่าเข้ามาด้วยชื่อ Tt เพราะ id ของช่องกรอกคือ prof-Tt
     ต้องรับได้ทั้ง Tt และ thinkTimeMs มิฉะนั้นช่องนั้นจะกลายเป็น undefined
     แล้วการตรวจสอบอินพุตจะปฏิเสธทั้งฟอร์มโดยที่ผู้ใช้ไม่ได้กรอกอะไรผิด */
  const withTt = calc.recommendProfile({ targetTps: 150, p95Ms: 180, Tt: 60 });
  checkTrue('ชื่อฟิลด์: รับ Tt ได้เหมือน thinkTimeMs', withTt.ok === true,
    withTt.ok ? 'ผลลัพธ์: ' + withTt.profile : 'ถูกปฏิเสธเพราะ ' + withTt.errors[0].message);

  const withFull = calc.recommendProfile({ targetTps: 150, p95Ms: 180, thinkTimeMs: 60 });
  checkTrue('ชื่อฟิลด์: รับ thinkTimeMs ได้เหมือนเดิม', withFull.ok === true,
    withFull.ok ? 'ผลลัพธ์: ' + withFull.profile : 'ถูกปฏิเสธ');

  check('ชื่อฟิลด์: ทั้งสองชื่อให้ผลตรงกัน', withFull.tpsPerVu, withTt.tpsPerVu,
    'TPS ต่อ VU ต้องเท่ากัน');
  check('ชื่อฟิลด์: Tt=60 ให้ VU อ้างอิงเท่าที่คำนวณด้วยมือ', 36, withTt.vus,
    'iteration_duration = 240 ms → 4.1667 ต่อ VU → ⌈150 ÷ 4.1667⌉');

  /* ลำดับความสำคัญ: ถ้าใส่มาทั้งคู่ ให้ใช้ thinkTimeMs */
  const both = calc.recommendProfile({ targetTps: 150, p95Ms: 180, Tt: 0, thinkTimeMs: 60 });
  check('ชื่อฟิลด์: ใส่ทั้งคู่ให้ใช้ thinkTimeMs', withTt.tpsPerVu, both.tpsPerVu,
    'thinkTimeMs มีลำดับความสำคัญสูงกว่า');
}

{
  const bad = calc.recommendProfile({ targetTps: 0, p95Ms: -1, Tt: 0 });
  checkTrue('แนะนำรูปแบบ: อินพุตผิดต้องไม่ให้ผลลัพธ์', bad.ok === false && bad.errors.length === 2,
    bad.ok ? 'ให้ผลลัพธ์ทั้งที่ควรปฏิเสธ' : bad.errors.map((e) => e.field).join(','));

  const missing = calc.recommendProfile({ targetTps: 150, p95Ms: 180 });
  checkTrue('แนะนำรูปแบบ: ไม่ส่ง think time มาต้องแจ้งว่ายังไม่ได้กรอก',
    missing.ok === false && /ยังไม่ได้กรอก/.test(missing.errors[0].message),
    missing.ok ? 'ให้ผลลัพธ์ทั้งที่ควรปฏิเสธ' : missing.errors[0].message);
}

/* ---------- 8. ตัวช่วยสถิติอื่น ---------- */

{
  const cdf = calc.cdfPoints(sorted, 1200);
  checkTrue('cdfPoints: จุดแรกเป็นค่าต่ำสุด', cdf[0].x === sorted[0],
    'x = ' + cdf[0].x + ', y = ' + cdf[0].y.toFixed(4));
  checkTrue('cdfPoints: จุดสุดท้ายเป็นค่าสูงสุดที่ 100%',
    cdf[cdf.length - 1].x === sorted[sorted.length - 1] &&
    Math.abs(cdf[cdf.length - 1].y - 100) < 1e-9,
    'x = ' + cdf[cdf.length - 1].x + ', y = ' + cdf[cdf.length - 1].y);
  checkTrue('cdfPoints: ค่า y ต้องไม่ลดลงเลย',
    cdf.every((p, i) => i === 0 || p.y >= cdf[i - 1].y),
    'ตรวจ ' + cdf.length + ' จุด');
}

{
  const bins = samples.bins;
  const sum = bins.reduce((a, b) => a + b.count, 0);
  check('bins: ผลรวมจำนวนต้องเท่ากับ n', samples.n, sum, 'ตรวจความสอดคล้องของฮิสโตแกรม');
  checkTrue('bins: ช่วงสุดท้ายต้องเป็นหางเปิด', bins[bins.length - 1].to === null,
    'from = ' + bins[bins.length - 1].from + ', to = ' + bins[bins.length - 1].to);
}

{
  check('round: ปัดทศนิยมสองตำแหน่ง', 54.25, calc.round(54.2549, 2), '');
  check('round: ปัดขึ้นที่หลักสุดท้าย', 0.13, calc.round(0.1251, 2), '');
  checkTrue('toNumber: ค่าว่างคืน NaN', Number.isNaN(calc.toNumber('')), '');
  checkTrue('toNumber: ข้อความตัวเลขใช้ได้', calc.toNumber(' 42.5 ') === 42.5, '');
}

/* ---------- รายงานผล ---------- */

const THAI_ZERO_WIDTH = /[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/;

function displayWidth(s) {
  const text = String(s);
  let w = 0;
  for (const ch of text) {
    if (THAI_ZERO_WIDTH.test(ch)) continue;
    w += 1;
  }
  return w;
}

function pad(s, width, alignRight) {
  const text = String(s);
  const padLen = Math.max(0, width - displayWidth(text));
  return alignRight ? ' '.repeat(padLen) + text : text + ' '.repeat(padLen);
}

const cols = { no: 4, name: 46, expected: 22, actual: 22 };
const header = [
  pad('#', cols.no),
  pad('เคสทดสอบ', cols.name),
  pad('ค่าที่คำนวณด้วยมือ', cols.expected),
  pad('ค่าที่โปรแกรมให้', cols.actual),
  'ผล'
].join('  ');

const line = '-'.repeat(displayWidth(header));
const rows = results.map((r, i) => [
  pad(i + 1, cols.no),
  pad(r.name, cols.name),
  pad(fmtNum(r.expected), cols.expected),
  pad(fmtNum(r.actual), cols.actual),
  r.pass ? 'PASS' : 'FAIL'
].join('  '));

console.log('');
console.log('ชุดทดสอบฟังก์ชันคำนวณ — site/assets/js/calc.js');
console.log(line);
console.log(header);
console.log(line);
rows.forEach((row) => console.log(row));
console.log(line);

const failed = results.filter((r) => !r.pass);
const passed = results.length - failed.length;

console.log('เคสทั้งหมด ' + results.length + ' · ผ่าน ' + passed + ' · ไม่ผ่าน ' + failed.length);

if (failed.length) {
  console.log('');
  console.log('เคสที่ไม่ผ่าน:');
  failed.forEach((r, i) => {
    const n = results.indexOf(r) + 1;
    console.log('  ' + (i + 1) + ') เคสที่ ' + n + ' — ' + r.name);
    console.log('     คาดหวัง: ' + fmtNum(r.expected));
    console.log('     ได้จริง : ' + fmtNum(r.actual));
    if (r.note) console.log('     หมายเหตุ: ' + r.note);
  });
}

/* ตรวจว่าโหลดไฟล์ข้อมูลจริงได้ และจำนวนตัวอย่างตรงกับที่ประกาศ */
console.log('');
console.log('ข้อมูลอ้างอิง: site/assets/data/latency-samples.json — n = ' + sorted.length +
  ' ค่า, mean = ' + samples.mean + ' ms, p95 = ' + samples.percentiles.p95 + ' ms, p99 = ' +
  samples.percentiles.p99 + ' ms');

process.exit(failed.length ? 1 : 0);
