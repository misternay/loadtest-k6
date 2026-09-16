// server.mjs — mock server สำหรับฝึกโหลดเทสต์ (ไม่ใช้ dependency ภายนอก)
// รัน:  node mock-server/server.mjs            (ฟังที่พอร์ต 8080)
//       PORT=8098 node mock-server/server.mjs   (เปลี่ยนพอร์ต)
//
// ตั้งใจให้มี latency จริงเล็กน้อย เพื่อให้ตัวเลขที่วัดได้ดูสมจริง
// และมี endpoint พิเศษสำหรับทดลองสถานการณ์ที่ต่างกัน
//
// ค่าเริ่มต้นของเซิร์ฟเวอร์นี้คือ "ประพฤติดี" (well-behaved): ทุกคำขอตอบภายใน
// ประมาณ 6-46 ms ไม่มีหางยาว จึงใช้เป็นปลายทางที่มั่นคงสำหรับ smoke test ได้
// (ดูเหตุผลใน k6/smoke.js — smoke ทำหน้าที่ "ยืนยันว่าทำงานได้" ไม่ใช่ตัดสิน SLO)
//
// หางยาวเปิดเฉพาะเมื่อสั่งผ่านสภาพแวดล้อม เพื่อสาธิตว่าเปอร์เซ็นไทล์ตอบสนองต่อ
// หางยาวอย่างไร (ใช้ในบทที่ 4 และในโจทย์ท้ายบท):
//   TAIL_RATE=0.03 node mock-server/server.mjs            # 3% ของคำขอช้าลง 150-570 ms
//   TAIL_RATE=0.03 TAIL_MS_MAX=2000 node mock-server/server.mjs
//
// อย่าเปิดหางยาวขณะใช้ smoke หรือ load เป็นตัวกั้น (gate) เพราะเกณฑ์ของสคริปต์
// เหล่านั้นตั้งไว้สำหรับปลายทางที่ประพฤติดี ถ้าต้องรันกับปลายทางที่มีหางยาวจริง
// ให้ผ่อนเกณฑ์ตามที่เอกสารใน docs/ อธิบายไว้

import http from 'node:http';

const PORT = Number(process.env.PORT || 8080);

function clampNum(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

/* หางยาว: ค่าเริ่มต้นปิด (TAIL_RATE=0) */
const TAIL_RATE = clampNum(process.env.TAIL_RATE, 0, 1, 0);
const TAIL_MS_MIN = clampNum(process.env.TAIL_MS_MIN, 0, 10000, 150);
const TAIL_MS_MAX = clampNum(process.env.TAIL_MS_MAX, 0, 10000, 570);
const ITEMS = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  sku: 'SKU-' + String(i + 1).padStart(4, '0'),
  name: 'สินค้าตัวอย่างลำดับที่ ' + (i + 1),
  price: Number((100 + i * 7.5).toFixed(2)),
}));

let slowMode = false;
let failureRate = 0;

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

/* หน่วงเวลาตอบกลับ: ฐาน 6-46 ms เสมอ และบวกหางยาวเพิ่มเมื่อเปิด TAIL_RATE
   (ค่าเริ่มต้นปิดหางยาว เซิร์ฟเวอร์จึงตอบสม่ำเสมอและใช้เป็นปลายทางอ้างอิงได้)

   พารามิเตอร์ ?delay=N (มิลลิวินาที, 0-3000) ใช้แทนเวลาฐานด้วยค่าคงที่
   เพื่อให้สร้าง "ช่วงอุ่นเครื่องที่ช้า" ได้อย่างแน่นอน ไม่ขึ้นกับความสุ่ม
   ใช้ในบทที่ 5 และใน docs/evidence/k6-delay-abort-eval.txt */
function simulateLatency(fixedDelayMs) {
  const base = fixedDelayMs > 0 ? fixedDelayMs : 6 + Math.random() * 40;
  const isTail = TAIL_RATE > 0 && Math.random() < TAIL_RATE;
  const extra = isTail ? TAIL_MS_MIN + Math.random() * (TAIL_MS_MAX - TAIL_MS_MIN) : 0;
  return new Promise((r) => setTimeout(r, Math.round(base + extra)));
}

/* อ่าน ?delay=N จาก URL คืน 0 เมื่อไม่ส่งมาหรือค่าอยู่นอกช่วง */
function readDelay(url) {
  const raw = url.searchParams.get('delay');
  if (raw === null || raw === '') return 0;
  return clampNum(raw, 0, 3000, 0);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  const path = url.pathname;

  if (path === '/health') {
    return json(res, 200, {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      tailRate: TAIL_RATE,
      tailMs: TAIL_RATE > 0 ? [TAIL_MS_MIN, TAIL_MS_MAX] : null,
    });
  }

  if (path === '/api/items') {
    await simulateLatency(readDelay(url));
    if (slowMode) await new Promise((r) => setTimeout(r, 400));
    if (failureRate > 0 && Math.random() < failureRate) {
      return json(res, 503, { error: 'simulated overload', path });
    }
    return json(res, 200, { count: ITEMS.length, items: ITEMS });
  }

  const itemMatch = path.match(/^\/api\/items\/(\d+)$/);
  if (itemMatch) {
    await simulateLatency(readDelay(url));
    const id = Number(itemMatch[1]);
    const item = ITEMS.find((it) => it.id === id);
    if (!item) return json(res, 404, { error: 'ไม่พบสินค้ารหัส ' + id });
    return json(res, 200, item);
  }

  // endpoint สำหรับทดลอง: /api/always-404 ให้ทดสอบแท็ก expected_response
  if (path === '/api/always-404') {
    return json(res, 404, { error: 'endpoint นี้ตั้งใจให้ตอบ 404 ทุกครั้ง' });
  }

  // endpoint สำหรับทดลอง: /api/toggle-slow, /api/toggle-fail?rate=0.2
  if (path === '/api/toggle-slow') {
    slowMode = !slowMode;
    return json(res, 200, { slowMode });
  }
  if (path === '/api/toggle-fail') {
    const rate = Number(url.searchParams.get('rate') || 0);
    failureRate = Math.min(Math.max(rate, 0), 1);
    return json(res, 200, { failureRate });
  }

  return json(res, 404, { error: 'ไม่พบเส้นทางนี้', path });
});

server.listen(PORT, () => {
  console.log('mock server ทำงานที่ http://localhost:' + PORT);
  console.log('  GET /health                    ตรวจว่ายังทำงานอยู่ (รายงานค่า TAIL_RATE ด้วย)');
  console.log('  GET /api/items                 รายการสินค้า 20 ชิ้น');
  console.log('  GET /api/items/{id}            สินค้ารายชิ้น');
  console.log('  GET /api/always-404            ตอบ 404 ทุกครั้ง (สำหรับทดสอบ expected_response)');
  console.log('  GET /api/toggle-slow           สลับโหมดช้า (+400 ms)');
  console.log('  GET /api/toggle-fail?rate=0.2  ตั้งอัตราความล้มเหลวจำลอง (0 ถึง 1)');
  console.log('  ?delay=N                       หน่วงคำตอบคงที่ N ms (0 ถึง 3000) ใช้สร้างช่วงอุ่นเครื่องที่ช้า');
  if (TAIL_RATE > 0) {
    console.log('');
    console.log('โหมดหางยาวเปิดอยู่: ' + (TAIL_RATE * 100).toFixed(1) + '% ของคำขอจะช้าลง ' +
      TAIL_MS_MIN + '-' + TAIL_MS_MAX + ' ms');
    console.log('  ใช้สำหรับสาธิตเปอร์เซ็นไทล์ในบทที่ 4 เท่านั้น');
    console.log('  อย่าใช้ปลายทางนี้เป็นตัวกั้น smoke/load เพราะเกณฑ์ตั้งไว้สำหรับปลายทางที่ประพฤติดี');
  } else {
    console.log('');
    console.log('หางยาวปิดอยู่ (ค่าเริ่มต้น): ตอบทุกคำขอในราว 6-46 ms');
    console.log('  เปิดได้ด้วย TAIL_RATE=0.03 node mock-server/server.mjs');
  }
});
