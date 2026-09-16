// spike.js — Spike test
// จุดประสงค์: ดูว่าระบบรับภาระที่กระโดดขึ้นกะทันหันได้ไหม และฟื้นตัวเร็วแค่ไหนหลังภาระลดลง
// รัน:  k6 run spike.js
//       k6 run -e BASE_URL=https://test.k6.io spike.js
//
// ปลายทางที่อนุญาต: localhost:8080 และ test.k6.io เท่านั้น
//
// สิ่งที่ต้องดูหลังรัน: ไม่ใช่แค่ throughput ระหว่าง spike แต่คือ
//   - error rate ระหว่าง spike สูงแค่ไหน
//   - หลังลดภาระลงแล้ว latency กลับสู่ระดับเดิมภายในกี่วินาที
//   - คิวที่ค้างอยู่ระบายหมดหรือไม่ (ดูจาก http_req_duration ที่ยังสูงต่อหลัง spike จบ)

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:8080').replace(/\/+$/, '');
// หมายเหตุ: ห้ามใช้ชื่อ PATH เพราะชนกับตัวแปร PATH ของระบบปฏิบัติการ
// (k6 มองเห็นตัวแปรสภาพแวดล้อมทั้งหมดของเชลล์ผ่าน __ENV)
const TARGET_PATH = __ENV.TARGET_PATH || '/api/items';
const NORMAL_VUS = Number(__ENV.NORMAL_VUS || 5);
const SPIKE_VUS = Number(__ENV.SPIKE_VUS || 50);

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
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: NORMAL_VUS }, // เข้าสู่ภาวะปกติ
        { duration: '3m', target: NORMAL_VUS }, // ปล่อยให้ระบบนิ่งก่อน
        { duration: '20s', target: SPIKE_VUS }, // กระชากขึ้นในเวลาสั้น
        { duration: '1m', target: SPIKE_VUS },  // ถือไว้สั้น ๆ
        { duration: '20s', target: NORMAL_VUS },// ลดลงกลับสู่ภาวะปกติ
        { duration: '3m', target: NORMAL_VUS }, // ช่วงฟื้นตัว — จับตาว่า latency กลับมาไหม
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    // รับความผิดพลาดได้มากกว่า load test เพราะเจตนาสร้างภาวะสุดโต่ง
    http_req_failed: ['rate<0.10'],
    http_req_duration: ['p(95)<3000'],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}${TARGET_PATH}`);

  check(res, {
    'ยังตอบสนองได้': (r) => r.status >= 200 && r.status < 400,
    'ไม่หมดเวลา': (r) => r.timings.duration < 3000,
  });

  sleep(1);
}
