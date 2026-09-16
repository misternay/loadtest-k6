// probe-delay-abort-eval.js — เครื่องมือสร้างหลักฐานสำหรับคำอธิบาย delayAbortEval
//
// ไฟล์นี้ไม่ใช่สคริปต์สอน เก็บไว้ใน docs/evidence/probes/ เพื่อให้ตรวจซ้ำได้
// รันได้เองด้วยคำสั่งด้านล่าง (ต้องสตาร์ท mock server ก่อน)
//
//   node mock-server/server.mjs &
//
//   # 1) ไม่มี abortOnFail, ไม่มี delayAbortEval — รันจบครบ 20 วินาที
//   k6 run --summary-trend-stats="avg,med,max,p(90),p(95),p(99)" \
//     -e PROBE_ABORT=0 -e PROBE_DELAY_EVAL=0 docs/evidence/probes/probe-delay-abort-eval.js
//
//   # 2) ไม่มี abortOnFail, มี delayAbortEval — รันจบครบ 20 วินาทีเช่นกัน
//   k6 run --summary-trend-stats="avg,med,max,p(90),p(95),p(99)" \
//     -e PROBE_ABORT=0 -e PROBE_DELAY_EVAL=1 docs/evidence/probes/probe-delay-abort-eval.js
//
//   # 3) มี abortOnFail, ไม่มี delayAbortEval — ถูกตัดจบเร็ว
//   k6 run -e PROBE_ABORT=1 -e PROBE_DELAY_EVAL=0 docs/evidence/probes/probe-delay-abort-eval.js
//
//   # 4) มี abortOnFail, มี delayAbortEval '12s' — ถูกตัดจบแต่ช้าลง
//   k6 run -e PROBE_ABORT=1 -e PROBE_DELAY_EVAL=1 docs/evidence/probes/probe-delay-abort-eval.js
//
// สิ่งที่การทดลองนี้แยกให้เห็น
//
//   PROBE_ABORT=0 (ข้อ 1 กับ 2)
//     ทั้งสองรันยาวเท่ากัน เก็บตัวอย่างเท่ากัน และ k6 รายงาน p(95) เท่ากัน
//     ทั้งที่รันที่ 2 มี delayAbortEval → สรุปได้ว่า delayAbortEval
//     "ไม่ได้ตัดข้อมูลช่วงอุ่นเครื่องออกจากการคำนวณ threshold"
//
//   PROBE_ABORT=1 (ข้อ 3 กับ 4)
//     ทั้งสองรันถูกตัดจบ แต่เวลาที่ถูกตัดต่างกันชัดเจน
//     → สรุปได้ว่า delayAbortEval เลื่อน "การตัดสินใจหยุดการรัน" ได้จริง
//
// กลไกของ "ช่วงอุ่นเครื่องที่ช้า" ใช้พารามิเตอร์ ?delay=N ของ mock server
// ซึ่งเป็นค่าคงที่ ไม่มีการสุ่ม จึงเทียบผลระหว่างการรันได้ตรงไปตรงมา

import http from 'k6/http';
import { sleep } from 'k6';

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:8080').replace(/\/+$/, '');
const WARMUP_SECONDS = Number(__ENV.WARMUP_SECONDS || 10);
const WARMUP_DELAY_MS = Number(__ENV.WARMUP_DELAY_MS || 600);
const USE_ABORT = String(__ENV.PROBE_ABORT || '0') === '1';
const USE_DELAY_EVAL = String(__ENV.PROBE_DELAY_EVAL || '0') === '1';
const DELAY_EVAL = __ENV.PROBE_DELAY_EVAL_AT || '12s';

const base = { threshold: 'p(95)<200' };
const latencyThreshold = USE_ABORT
  ? (USE_DELAY_EVAL
    ? Object.assign({}, base, { abortOnFail: true, delayAbortEval: DELAY_EVAL })
    : Object.assign({}, base, { abortOnFail: true }))
  : (USE_DELAY_EVAL
    ? Object.assign({}, base, { delayAbortEval: DELAY_EVAL })
    : base);

export const options = {
  vus: 1,
  duration: '20s',
  thresholds: {
    // เกณฑ์นี้ตั้งใจให้ "ไม่ผ่าน" เพื่อให้เห็นทั้งค่า p(95) จริงและพฤติกรรมการหยุด
    http_req_duration: [latencyThreshold],
  },
};

let startMs = null;

export default function () {
  if (startMs === null) startMs = Date.now();
  const elapsedSec = (Date.now() - startMs) / 1000;
  const query = elapsedSec < WARMUP_SECONDS ? '?delay=' + WARMUP_DELAY_MS : '';
  http.get(`${BASE_URL}/api/items${query}`);
  sleep(0.5);
}
