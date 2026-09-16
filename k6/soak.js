// soak.js — Soak test (endurance test)
// จุดประสงค์: ถือภาระระดับปกติต่อเนื่องยาวนาน เพื่อหารอยรั่วหน่วยความจำ
//            connection ที่ไม่ถูกคืน ไฟล์ชั่วคราวที่โตขึ้น และการเสื่อมสภาพตามเวลา
// รัน:  k6 run soak.js
//       k6 run -e BASE_URL=https://test.k6.io -e VUS=5 -e HOLD=30m soak.js
//
// ปลายทางที่อนุญาต: localhost:8080 และ test.k6.io เท่านั้น
//
// สิ่งที่ต้องเฝ้าระหว่างรัน: ค่าของ http_req_duration ควร "แบน" ตลอดช่วง hold
// ถ้าค่อย ๆ ไต่ขึ้นเรื่อย ๆ นั่นคือสัญญาณของภาระที่สะสมค้างอยู่ในระบบ

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:8080').replace(/\/+$/, '');
// หมายเหตุ: ห้ามใช้ชื่อ PATH เพราะชนกับตัวแปร PATH ของระบบปฏิบัติการ
// (k6 มองเห็นตัวแปรสภาพแวดล้อมทั้งหมดของเชลล์ผ่าน __ENV)
const TARGET_PATH = __ENV.TARGET_PATH || '/api/items';
const VUS = Number(__ENV.VUS || 10);
const HOLD = __ENV.HOLD || '1h';

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
    soak: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: VUS },  // อุ่นเครื่อง
        { duration: HOLD, target: VUS },  // ถือภาระยาว — ช่วงที่ใช้หาปัญหาระยะยาว
        { duration: '2m', target: 0 },    // ผ่อนลง
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    // soak test ควรใช้เกณฑ์ที่เข้มกว่าปกติ เพราะระบบที่นิ่งจริงต้องไม่ค่อยพลาดเลย
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    checks: ['rate>0.99'],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}${TARGET_PATH}`);

  check(res, {
    'สถานะเป็น 200': (r) => r.status === 200,
    'ตอบภายใน 500 ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
