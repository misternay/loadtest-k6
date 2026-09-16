// load.js — Load test
// จุดประสงค์: วัดพฤติกรรมที่ภาวะการใช้งานตามที่คาดไว้ (expected peak) แล้วเทียบกับ SLO
// รัน:  k6 run load.js
//       k6 run -e BASE_URL=https://test.k6.io -e PEAK_VUS=20 load.js
//
// ปลายทางที่อนุญาต: localhost:8080 และ test.k6.io เท่านั้น
//
// สคริปต์นี้สาธิตสี่อย่างที่บทเรียนพูดถึง
//   1) ค่อย ๆ ไต่ขึ้น (ramp-up) เพื่อให้ cache/JIT/connection pool อุ่นเครื่อง
//   2) ช่วง steady state ที่ข้อมูลมีความหมาย
//   3) think time ด้วย sleep() ซึ่งต้องถูกนับใน iteration_duration
//   4) custom metric และ group() สำหรับวัดเฉพาะขั้นตอน

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:8080').replace(/\/+$/, '');
// หมายเหตุ: ห้ามใช้ชื่อ PATH เพราะชนกับตัวแปร PATH ของระบบปฏิบัติการ
// (k6 มองเห็นตัวแปรสภาพแวดล้อมทั้งหมดของเชลล์ผ่าน __ENV)
const TARGET_PATH = __ENV.TARGET_PATH || '/api/items';
const PEAK_VUS = Number(__ENV.PEAK_VUS || 10);

const ALLOWED_HOSTS = ['localhost:8080', '127.0.0.1:8080', 'test.k6.io', 'www.test.k6.io'];

(function assertSafeTarget() {
  const host = BASE_URL.replace(/^https?:\/\//, '').split('/')[0];
  if (ALLOWED_HOSTS.indexOf(host) !== -1) return;
  if (String(__ENV.ALLOW_ANY_TARGET) === '1') {
    console.warn('คำเตือน: กำลังยิงไปที่ ' + host + ' ซึ่งไม่อยู่ในรายการอนุญาต');
    return;
  }
  throw new Error('ปฏิเสธการรัน: ' + host + ' ไม่อยู่ในรายการปลายทางที่อนุญาต');
})();

// custom metric — ตั้งชื่อให้ระบุหน่วยชัดเจนเพื่อไม่ให้ชนกับ metric ของ k6
const listDuration = new Trend('items_list_duration', true); // true = แสดงเป็น ms
const payloadOk = new Rate('items_payload_ok');

export const options = {
  scenarios: {
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: Math.max(1, Math.round(PEAK_VUS * 0.25)) }, // ramp-up
        { duration: '2m', target: Math.max(1, Math.round(PEAK_VUS * 0.6)) },
        { duration: '5m', target: PEAK_VUS },  // steady state — ช่วงที่ข้อมูลมีความหมายที่สุด
        { duration: '3m', target: PEAK_VUS },
        { duration: '1m', target: 0 },         // ramp-down
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    // แปลง SLO เป็นเกณฑ์: p95 ต่ำกว่า 500 ms, p99 ต่ำกว่า 1500 ms, ความผิดพลาดต่ำกว่า 1%
    http_req_duration: [
      // รูปแบบยาว (long format) เพื่อใช้ delayAbortEval คู่กับ abortOnFail
      // delayAbortEval เลื่อนเฉพาะ "การตัดสินใจหยุดการรัน" ให้พ้นช่วง ramp-up
      // มันไม่ได้ตัดข้อมูลช่วง ramp-up ออกจากการคิด p95 — ค่า p95 ที่ k6
      // รายงานท้ายการรันยังคำนวณจากทุกตัวอย่างรวมช่วง ramp-up
      // (ยืนยันด้วยการรันจริง ดู docs/evidence/k6-delay-abort-eval.txt)
      { threshold: 'p(95)<500', abortOnFail: true, delayAbortEval: '60s' },
      { threshold: 'p(99)<1500' },
    ],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
    items_payload_ok: ['rate>0.99'],
  },
};

export default function () {
  group('ดึงรายการ', function () {
    const res = http.get(`${BASE_URL}${TARGET_PATH}`, {
      tags: { name: 'GET /api/items' }, // ใช้ tag name เพื่อจัดกลุ่ม URL ที่มีพารามิเตอร์ต่างกัน
    });

    listDuration.add(res.timings.duration);

    const ok = check(res, {
      'สถานะเป็น 200': (r) => r.status === 200,
      'ตอบภายใน 500 ms': (r) => r.timings.duration < 500,
    });
    payloadOk.add(ok);
  });

  // think time — เลียนแบบผู้ใช้ที่อ่านข้อมูลก่อนกดอะไรต่อไป
  // ค่านี้ถูกนับรวมใน iteration_duration จึงต้องนำไปคำนวณ TPS ด้วย
  sleep(1);
}
