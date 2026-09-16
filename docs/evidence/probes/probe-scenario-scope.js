// probe-scenario-scope.js — เครื่องมือสร้างหลักฐาน: ตัดสินเฉพาะช่วงภาวะคงตัวจริง ๆ
//
// ปัญหาที่ไฟล์นี้ตอบ: ถ้าไม่ใช้ delayAbortEval แล้วจะตัดข้อมูลช่วงอุ่นเครื่อง
// ออกจากการตัดสิน threshold ได้อย่างไร
//
// คำตอบที่พิสูจน์ได้: แยกช่วงภาวะคงตัวออกเป็น scenario ของตัวเอง (มี startTime)
// แล้วตั้ง threshold แบบอ้างแท็ก scenario — k6 จะคิดค่าเปอร์เซ็นไทล์
// จากเฉพาะตัวอย่างของ scenario นั้น
//
// รัน (ต้องสตาร์ท mock server ก่อน):
//   k6 run --summary-trend-stats="avg,med,max,p(95)" docs/evidence/probes/probe-scenario-scope.js
//
// ผลที่ต้องได้: exit code 0 และในบล็อก THRESHOLDS เห็นสองบรรทัด
//   http_req_duration{scenario:steady}  ✓ 'p(95)<200'  p(95) ราว 40-50 ms
//   http_req_duration{scenario:warmup}  ✓ 'p(95)<2000' p(95) ราว 603 ms
// ขณะที่ค่า http_req_duration รวมทั้งการรันยังสูงราว 600 ms เพราะมีช่วงอุ่นเครื่องปนอยู่

import http from 'k6/http';
import { sleep } from 'k6';

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:8080').replace(/\/+$/, '');

export const options = {
  scenarios: {
    // ช่วงอุ่นเครื่อง: ปลายทางตอบช้า 600 ms คงที่
    warmup: { executor: 'constant-vus', vus: 1, duration: '8s', exec: 'warmup', startTime: '0s' },
    // ช่วงภาวะคงตัว: เริ่มหลังช่วงอุ่นเครื่องจบ สคริปต์นี้จึงไม่ต้องใช้ delayAbortEval เลย
    steady: { executor: 'constant-vus', vus: 1, duration: '8s', exec: 'steady', startTime: '8s' },
  },
  thresholds: {
    'http_req_duration{scenario:warmup}': ['p(95)<2000'],
    'http_req_duration{scenario:steady}': ['p(95)<200'],
  },
};

export function warmup() {
  http.get(`${BASE_URL}/api/items?delay=600`, { tags: { scenario: 'warmup' } });
  sleep(0.5);
}

export function steady() {
  http.get(`${BASE_URL}/api/items`, { tags: { scenario: 'steady' } });
  sleep(0.5);
}
