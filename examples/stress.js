// stress.js — Stress test
// จุดประสงค์: ไต่ภาระขึ้นเรื่อย ๆ จนเลยภาวะใช้งานปกติ เพื่อหาจุดอิ่มตัวและดูว่าระบบพังแบบไหน
// รัน:  k6 run stress.js
//       k6 run -e BASE_URL=https://test.k6.io -e BASE_VUS=5 stress.js
//
// ปลายทางที่อนุญาต: localhost:8080 และ test.k6.io เท่านั้น
//
// หมายเหตุด้านความปลอดภัย: stress test เป็นรูปแบบที่ทำลายระบบได้มากที่สุด
// ควรใช้กับสภาพแวดล้อมทดสอบเท่านั้น และควรมี abortOnFail เพื่อหยุดเมื่อระบบเริ่มพังจริง

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:8080').replace(/\/+$/, '');
// หมายเหตุ: ห้ามใช้ชื่อ PATH เพราะชนกับตัวแปร PATH ของระบบปฏิบัติการ
// (k6 มองเห็นตัวแปรสภาพแวดล้อมทั้งหมดของเชลล์ผ่าน __ENV)
const TARGET_PATH = __ENV.TARGET_PATH || '/api/items';
const BASE_VUS = Number(__ENV.BASE_VUS || 10);

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

export const options = {
  scenarios: {
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: BASE_VUS },        // ระดับปกติ
        { duration: '5m', target: BASE_VUS * 2 },    // เริ่มเลยภาวะปกติ
        { duration: '5m', target: BASE_VUS * 4 },    // หาจุดอิ่มตัว
        { duration: '3m', target: BASE_VUS * 4 },    // ยืนยันว่าที่จุดนั้นเป็นอย่างไร
        { duration: '2m', target: 0 },               // ผ่อนลงอย่างเป็นขั้นตอน
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    http_req_failed: [{
      threshold: 'rate<0.05',
      // หยุดการทดสอบเมื่อความผิดพลาดเกิน 5% เพื่อไม่ทำร้ายระบบที่กำลังพัง
      abortOnFail: true,
      // delayAbortEval เลื่อน "การตัดสินใจหยุด" ออกไป 90 วินาที
      // เพื่อไม่ให้ช่วง ramp-up ทำให้ถูกตัดจบเร็วเกินไป
      // ข้อควรรู้: มันไม่ตัดข้อมูลช่วง ramp-up ออกจากการคิดค่า threshold
      // ค่า rate<0.05 ที่ k6 รายงานท้ายการรันยังคิดจากทุกตัวอย่างรวมช่วง ramp-up
      delayAbortEval: '90s',
    }],
    http_req_duration: ['p(95)<2000'],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}${TARGET_PATH}`);

  check(res, {
    'ยังตอบสนองได้': (r) => r.status >= 200 && r.status < 400,
    'ไม่ได้ถูกปฏิเสธเพราะโหลดเกิน': (r) => r.status !== 429 && r.status !== 503,
  });

  sleep(1);
}
