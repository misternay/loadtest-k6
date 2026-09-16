# loadtest-k6 — บทเรียน Load Testing ด้วย k6 (ภาษาไทย)

โปรเจกต์นี้เป็น **เว็บไซต์บทเรียนแบบ static** สอนการทำ load testing ด้วย [k6](https://k6.io/)
ภาษาไทย พร้อม **สคริปต์ k6 ที่รันได้จริง** **mock server สำหรับฝึก** และ **ชุดตัวตรวจอัตโนมัติ**
ที่ใช้ยืนยันคุณภาพก่อนส่งมอบ

จุดยืนของโปรเจกต์นี้: ตัวเลขทุกตัวที่บทเรียนอ้างถึงต้องตรวจสอบย้อนกลับได้
ไม่ใช่ตัวเลขที่เขียนขึ้นให้ดูสวย ทุกค่ามาจากการรันจริงหรือคำนวณจากไฟล์ข้อมูลที่เก็บไว้
และมีชุดทดสอบคอยยืนยันว่าตัวเลขบนหน้าเว็บยังตรงกับไฟล์ข้อมูลเสมอ

## 0. สถานะปัจจุบัน (16 กันยายน 2026)

| รายการ | สถานะ | หลักฐาน |
|---|---|---|
| `node scripts/test-calc.mjs` | ผ่าน 95/95, exit 0 | `docs/evidence/test-calc.txt` |
| `node scripts/verify-site.mjs` | ผ่าน 50/50, exit 0 | `docs/evidence/verify-site.txt` |
| `node scripts/browser-check.mjs` | ผ่าน 84/84 การเปิดหน้า (14 หน้า × 3 ความกว้าง × 2 ธีม), exit 0 · คอนทราสต์ 10,944 จุด ผ่านทุกจุดทั้งสองธีม | `docs/evidence/browser-check.txt` |
| `node scripts/word-count.mjs` | ลดคำในเนื้อความ 26.9% (16,501 → 12,064 คำ) โดยโทเคนทางเทคนิค 440 ค่าครบทุกตัว | `docs/evidence/word-count-before-after.txt` |
| โหมดสว่าง/มืด | ปุ่มสลับธีมทำงานทุกหน้า จำค่าได้หลังรีเฟรช และตั้งธีมก่อนวาดทุกหน้า | `docs/evidence/redesign-light-dark.txt` |
| `k6 run k6/smoke.js` | **ผ่าน 30/30 การรันติดกัน** (exit 0 ทุกครั้ง) | `docs/evidence/k6-smoke-repeatability.txt` |
| โปรไฟล์เต็ม `load.js` (12 นาที) | **ผ่านทุก threshold · exit 0 · 12m01s** (4,776 รอบ, 0 interrupted) | `docs/evidence/k6-load-full.txt` |
| โปรไฟล์เต็ม `stress.js` (17 นาที) | **ผ่านทุก threshold · exit 0 · 17m00s** (22,250 รอบ, max 40 VU) | `docs/evidence/k6-stress-full.txt` |
| โปรไฟล์เต็ม `spike.js` (9 นาที) | **ข้ามตามคำสั่งผู้ใช้ (16 ก.ย. 2026)** — ไม่มีผลโปรไฟล์เต็ม | – |
| โปรไฟล์เต็ม `soak.js` (1 ชม. 4 นาที) | **ข้ามตามคำสั่งผู้ใช้ (16 ก.ย. 2026)** — ไม่มีผลโปรไฟล์เต็ม | – |
| **axe / Lighthouse** | **ยังไม่ได้รัน** — ไม่มีการยืนยัน accessibility หรือ performance ด้วยเครื่องมือเหล่านั้น (คอนทราสต์ถูกตรวจด้วยสคริปต์ของโปรเจกต์เองแล้ว ดู `docs/evidence/redesign-light-dark.txt`) | – |

อ่านสถานะโดยละเอียดและงานที่ยังค้างได้ที่ [`docs/HANDOFF.md`](docs/HANDOFF.md)

---

## 1. โครงสร้างโฟลเดอร์

```
loadtest-k6/
├── README.md                     ไฟล์นี้
├── site/                         เว็บไซต์ static ทั้งหมด (อัปโหลดโฟลเดอร์นี้ขึ้นโฮสต์)
│   ├── favicon.svg               ไอคอนเว็บ (ไอคอนเส้น SVG สี #1f4e79)
│   ├── index.html                หน้าแรก + สารบัญบทเรียน
│   ├── lessons/                  บทเรียน 6 บท
│   │   ├── 01-tps.html           คำนวณ TPS / RPS
│   │   ├── 02-vu.html            virtual user และ lifecycle
│   │   ├── 03-metrics.html       แคตตาล็อก metric ของ k6
│   │   ├── 04-percentiles.html   เปอร์เซ็นไทล์ p95 / p99
│   │   ├── 05-load-profiles.html รูปแบบการทดสอบและโหลดโปรไฟล์
│   │   └── 06-read-results.html  อ่านผลลัพธ์และปัญหาที่พบบ่อย
│   ├── tools/
│   │   ├── calculator.html       เครื่องคำนวณ TPS / VU
│   │   └── latency.html          สำรวจข้อมูล latency (ฮิสโตแกรม + CDF)
│   ├── quiz.html                 แบบทดสอบ 6 ชุด ชุดละ 6 ข้อ
│   ├── progress.html             ความคืบหน้าการเรียน (เก็บใน localStorage)
│   ├── glossary.html             อภิธานศัพท์ 69 คำ
│   ├── troubleshooting.html      แก้ปัญหาที่พบบ่อย 20 ข้อ
│   ├── examples.html             หน้าดูสคริปต์ตัวอย่าง + ปุ่มดาวน์โหลด
│   ├── examples/                 สำเนาสคริปต์ k6 สำหรับดาวน์โหลด (ต้องตรงกับ k6/)
│   └── assets/
│       ├── css/main.css          โทเคนสีสองธีม (:root = สว่าง, [data-theme="dark"] = มืด)
│       ├── js/                   site.js, calc.js, charts.js, quiz.js, storage.js
│       └── data/                 metrics.json, latency-samples.json  ← ข้อมูลจริง ห้ามแก้
├── k6/                           สคริปต์ k6 ต้นฉบับ 5 แบบ
│   ├── smoke.js  load.js  stress.js  spike.js  soak.js
├── mock-server/server.mjs        ปลายทางจำลองสำหรับฝึก (ไม่ใช้ dependency ภายนอก)
│                                 ค่าเริ่มต้น "ประพฤติดี" — เปิดหางยาวด้วย TAIL_RATE
├── scripts/
│   ├── test-calc.mjs             ทดสอบสูตรคำนวณและข้อมูล (95 เคส)
│   ├── verify-site.mjs           ตรวจคุณภาพเว็บไซต์แบบ static (50 รายการ)
│   ├── browser-check.mjs         ตรวจด้วย Chromium จริง (84 การเปิดหน้า ทั้งสองธีม)
│   └── word-count.mjs            นับคำ before/after + ด่านโทเคนทางเทคนิคต้องไม่หาย
└── docs/
    ├── DEPLOY.md                 ขั้นตอน deploy + rollback
    ├── RUNBOOK.md                คู่มือปฏิบัติการ
    ├── CONTENT_REVIEW.md         บันทึกทบทวนความถูกต้องของเนื้อหา
    ├── REFERENCES.md             แหล่งอ้างอิงทั้งหมด
    ├── HANDOFF.md                บันทึกส่งมอบ
    └── evidence/                 หลักฐานผลการรันจริง (ข้อความดิบจากคำสั่ง)
        └── probes/               สคริปต์ทดลองที่ใช้สร้างหลักฐาน (ไม่ใช่สคริปต์สอน)
```

**สำคัญ:** `site/examples/*.js` ต้องเหมือน `k6/*.js` ทุกไบต์ เพราะมีตัวตรวจคอยเทียบ
ถ้าแก้ที่ใดที่หนึ่งต้องคัดลอกไปอีกที่หนึ่งด้วย ไม่งั้น `verify-site.mjs` จะไม่ผ่าน

---

## 2. สิ่งที่ต้องมี

| สิ่งที่ต้องมี | เวอร์ชันที่ใช้พัฒนาและทดสอบ | หมายเหตุ |
|---|---|---|
| **k6** | **v2.2.0** | จำเป็นสำหรับการรันสคริปต์ใน `k6/` บทเรียนอ้างอิงเวอร์ชันนี้ |
| **Node.js** | v22.22.3 | ใช้รัน mock server และชุดทดสอบ ไม่ต้องติดตั้ง dependency ใด ๆ |
| Docker | 27.4.0 | ไม่บังคับ ใช้เฉพาะกรณีไม่ต้องการติดตั้ง k6 ลงเครื่อง |
| Chromium (ผ่าน playwright-core) | Chromium 153 | ไม่บังคับ ใช้เฉพาะ `scripts/browser-check.mjs` |

โปรเจกต์นี้ **ไม่มี `package.json` และไม่มี dependency ของ Node** โดยเจตนา
ทุกสคริปต์ใช้เฉพาะโมดูลมาตรฐานของ Node (`node:fs`, `node:http`, `node:vm` ฯลฯ)

ตรวจเวอร์ชันก่อนเริ่ม:

```bash
k6 version          # ต้องได้ k6 v2.2.0 ขึ้นไป (บทเรียนอ้างอิง v2.2.0)
node --version      # ต้องได้ v18 ขึ้นไป (พัฒนาด้วย v22.22.3)
```

---

## 3. เปิดเว็บในเครื่อง

เว็บต้อง **เสิร์ฟผ่าน HTTP ไม่ใช่เปิดด้วย `file://`** เพราะหน้า `tools/latency.html`,
`lessons/03-metrics.html`, `glossary.html` ดึงข้อมูลด้วย `fetch()` จาก
`assets/data/*.json` ซึ่งเบราว์เซอร์จะบล็อกด้วยนโยบาย same-origin เมื่อเปิดจาก `file://`
(อาการที่เห็นคือตารางและกราฟว่างเปล่า และมี error ใน console)

### วิธีที่ 1 — ใช้ Node (ไม่ต้องติดตั้งอะไรเพิ่ม)

```bash
cd loadtest-k6
node -e "const h=require('node:http'),f=require('node:fs'),p=require('node:path');h.createServer((q,s)=>{let u=decodeURIComponent(new URL(q.url,'http://x').pathname);let t=p.join('site',u==='/'?'index.html':u.slice(1));if(!f.existsSync(t)||f.statSync(t).isDirectory()){s.writeHead(404).end('404');return}const m={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml'};s.writeHead(200,{'content-type':m[p.extname(t)]||'application/octet-stream'});s.end(f.readFileSync(t))}).listen(8000,()=>console.log('http://localhost:8000'))"
```

### วิธีที่ 2 — ใช้ Python

```bash
cd loadtest-k6/site
python3 -m http.server 8000
```

### วิธีที่ 3 — ใช้ `npx serve`

```bash
cd loadtest-k6/site
npx --yes serve -l 8000 .
```

จากนั้นเปิด <http://localhost:8000>

> ถ้าจะตรวจหลายหน้าพร้อมกันให้เปิดผ่าน `scripts/browser-check.mjs` ได้เลย
> ตัวนั้นเสิร์ฟ HTTP ให้เองและตรวจทุกหน้าอัตโนมัติ (ดูหัวข้อ 5)

---

## 4. รันสคริปต์ k6

สคริปต์ทุกตัวมี **กลไกกันการยิงผิดปลายทาง**: ถ้า `BASE_URL` ไม่ใช่ `localhost:8080`,
`127.0.0.1:8080` หรือ `test.k6.io` สคริปต์จะหยุดทันทีตั้งแต่บริบท init
ถ้ามีสิทธิ์ทดสอบระบบอื่นจริงจึงค่อยตั้ง `ALLOW_ANY_TARGET=1`

### 4.1 เตรียม mock server

```bash
cd loadtest-k6
node mock-server/server.mjs          # ฟังที่พอร์ต 8080
PORT=8098 node mock-server/server.mjs  # หรือเปลี่ยนพอร์ต
```

mock server มี **สองโหมดบทบาท** ชัดเจน

| โหมด | เปิดอย่างไร | ใช้เมื่อ |
|---|---|---|
| **ประพฤติดี** (ค่าเริ่มต้น) | `node mock-server/server.mjs` | เป็นปลายทางที่มั่นคงสำหรับ smoke/load/stress/spike/soak — ตอบทุกคำขอในราว 6–46 ms ไม่มีหางยาว |
| **หางยาว** | `TAIL_RATE=0.03 node mock-server/server.mjs` | สาธิตว่าเปอร์เซ็นไทล์ตอบสนองต่อหางยาวอย่างไร (บทที่ 4) — 3% ของคำขอช้าลง 150–570 ms |

> **อย่าใช้ปลายทางโหมดหางยาวเป็นตัวกั้น** smoke หรือ load เพราะเกณฑ์ของสคริปต์เหล่านั้น
> ตั้งไว้สำหรับปลายทางที่ประพฤติดี ถ้าปลายทางจริงของคุณมีหางยาว ให้ผ่อนเกณฑ์ตาม
> `docs/RUNBOOK.md` หัวข้อ 5.4 ไม่ใช่รันซ้ำจนกว่าจะผ่าน

endpoint ที่มีให้ใช้:

| endpoint | ใช้ทำอะไร |
|---|---|
| `GET /health` | ตรวจว่าเซิร์ฟเวอร์ยังทำงานอยู่ (รายงานค่า `TAIL_RATE` ด้วย) |
| `GET /api/items` | รายการสินค้า 20 ชิ้น (ใช้เป็นปลายทางหลัก) |
| `GET /api/items/{id}` | สินค้ารายชิ้น |
| `GET /api/always-404` | ตอบ 404 ทุกครั้ง สำหรับทดลองแท็ก `expected_response` |
| `GET /api/toggle-slow` | สลับโหมดช้า (+400 ms) |
| `GET /api/toggle-fail?rate=0.2` | ตั้งอัตราความล้มเหลวจำลอง |
| `?delay=N` | หน่วงคำตอบคงที่ N ms (0–3000) ใช้สร้าง "ช่วงอุ่นเครื่องที่ช้า" แบบกำหนดได้ |

### 4.2 รันแบบติดตั้ง k6 ในเครื่อง

```bash
cd loadtest-k6

k6 run k6/smoke.js                              # ~20 วินาที
k6 run k6/load.js                               # ~12 นาที
k6 run -e PEAK_VUS=20 k6/load.js                # เพิ่มระดับ peak
k6 run k6/stress.js                             # ~17 นาที
k6 run -e BASE_VUS=5 k6/stress.js
k6 run k6/spike.js                              # ~9 นาที
k6 run k6/soak.js                               # ~1 ชั่วโมง 4 นาที (ค่าเริ่มต้น)
k6 run -e VUS=5 -e HOLD=30m k6/soak.js          # ย่อลงเหลือ 34 นาที
k6 run -e BASE_URL=https://test.k6.io k6/smoke.js
```

ตัวแปรสภาพแวดล้อมที่สคริปต์รองรับ:

| ตัวแปร | ใช้กับ | ค่าเริ่มต้น | ความหมาย |
|---|---|---|---|
| `BASE_URL` | ทุกตัว | `http://localhost:8080` | ปลายทางที่ยิง |
| `TARGET_PATH` | ทุกตัว | `/api/items` | เส้นทางที่ยิง |
| `ALLOW_ANY_TARGET` | ทุกตัว | – | ตั้ง `1` เพื่อยอมให้ยิงปลายทางนอกที่อนุญาต |
| `PEAK_VUS` | `load.js` | `10` | จำนวน VU สูงสุด |
| `BASE_VUS` | `stress.js` | `10` | จำนวน VU ระดับปกติ (ไล่ขึ้นถึง 4 เท่า) |
| `NORMAL_VUS` | `spike.js` | `5` | จำนวน VU ระดับปกติ |
| `SPIKE_VUS` | `spike.js` | `50` | จำนวน VU ตอนกระชาก |
| `VUS` | `soak.js` | `10` | จำนวน VU ที่ถือไว้ |
| `HOLD` | `soak.js` | `1h` | ระยะเวลาถือภาระ |

> **หมายเหตุ:** ห้ามตั้งชื่อตัวแปรว่า `PATH` เด็ดขาด เพราะ `__ENV` มองเห็นตัวแปร
> ของเชลล์ทั้งหมด และจะชนกับ `PATH` ของระบบปฏิบัติการ สคริปต์ทุกตัวใช้ `TARGET_PATH`

### 4.3 รันแบบ Docker (ไม่ต้องติดตั้ง k6)

```bash
cd loadtest-k6

docker run --rm -i --network host \
  -v "$PWD/k6:/scripts" grafana/k6:2.2.0 run /scripts/smoke.js
```

ถ้าใช้ Docker Desktop บน macOS ที่ `--network host` ไม่ทำงานตามที่คาด ให้ใช้
`host.docker.internal` แทน `localhost`:

```bash
docker run --rm -i \
  -v "$PWD/k6:/scripts" \
  -e BASE_URL=http://host.docker.internal:8080 \
  grafana/k6:2.2.0 run /scripts/smoke.js
```

### 4.4 ตัดการรันให้สั้นลงตอนพัฒนา

สคริปต์ในโปรเจกต์นี้กำหนด `scenarios` กับ `stages` ไว้เอง จึงตัด "เวลา" ให้สั้นลง
จากบรรทัดคำสั่งได้ยาก สิ่งที่ทดลองแล้วพบ (k6 v2.2.0):

| วิธี | ผลที่ได้จริง |
|---|---|
| `-d/--duration`, `-u/--vus`, `-i/--iterations`, `-s/--stage` | k6 พิมพ์เตือน `"cli" level configuration overrode scenarios configuration entirely` แล้ว **ทับ scenario ทั้งก้อน** กลายเป็นการรัน VU คงที่ ไม่มี ramp-up ให้ดู |
| `--execution-segment 0:33%` | **ไม่ได้ทำให้เวลาสั้นลง** — k6 ลด *ภาระ* ลงเหลือ 33% ของ VU แต่ยังรันจนครบระยะเวลาเดิม (ทดลองกับสคริปต์ stages รวม 12 วินาที: ได้ `Up to 3 looping VUs for 12s` และ `running (11.9s)` ไม่ใช่ 4 วินาที) |

วิธีที่ได้ผลจริงคือลดจำนวน VU ผ่านตัวแปรสภาพแวดล้อมที่สคริปต์รองรับอยู่แล้ว
ซึ่งลด *ภาระ* ไม่ได้ลด *เวลา* ยกเว้น `HOLD` ของ `soak.js` ที่ลดเวลาได้จริง:

```bash
# ลดภาระแต่ยังได้เห็น ramp-up ครบทุกช่วง (เวลายังเป็น 12 นาที)
k6 run -e PEAK_VUS=4 k6/load.js

# soak ลดเวลาได้จริงเพราะ HOLD เป็นตัวกำหนดความยาวช่วงถือภาระ
k6 run -e VUS=2 -e HOLD=2m k6/soak.js      # ~6 นาที
```

ถ้าต้องการรัน `load.js` / `stress.js` / `spike.js` ให้สั้นจริง ๆ ต้องคัดลอกสคริปต์
ไปแก้ค่า `duration` ใน `stages` เอง หรือเพิ่ม scenario ย่อของตัวเอง
**อย่าใช้ `--execution-segment` เพื่อหวังให้เวลาสั้นลง** เพราะไม่ได้ผล

---

## 5. รันชุดทดสอบ

```bash
cd loadtest-k6

node scripts/test-calc.mjs      # 95 เคส — สูตรคำนวณและข้อมูลดิบ
node scripts/verify-site.mjs    # 50 รายการ — คุณภาพเว็บไซต์แบบ static
node scripts/browser-check.mjs  # 84 การเปิดหน้า — Chromium จริง ทั้งสองธีม
```

สำหรับวัดผลการตัดสำนวน (ต้องมีสำเนา `site/` ก่อนการแก้ไว้เทียบ):

```bash
node scripts/word-count.mjs --check                           # เทียบค่าอ้างอิงที่ตรึงไว้ (ใช้บ่อยสุด)
node scripts/word-count.mjs --site site                       # นับคำอย่างเดียว
node scripts/word-count.mjs --before <สำเนาเดิม> --after site  # เทียบกับสำเนาเดิมทีละหน้า
```

| ชุดทดสอบ | ตรวจอะไร | เกณฑ์ผ่าน | ต้องมีอะไรก่อน |
|---|---|---|---|
| `test-calc.mjs` | สูตร TPS/VU/เปอร์เซ็นไทล์, ฮิสโตแกรม, CDF, ความสอดคล้องของไฟล์ข้อมูล | ผ่าน 95/95, exit 0 | – |
| `verify-site.mjs` | ไฟล์ครบ, ลิงก์ภายใน, ไม่มี asset ภายนอก, คำต้องห้าม, meta + favicon, emoji, ไวยากรณ์ JS, ความสอดคล้องของข้อมูล, **โทเคนธีมสองโหมด + สคริปต์ตั้งธีมก่อนวาด + ปุ่มสลับธีม**, **บล็อกใจความสำคัญและคลาสเน้น**, **สาระครบตามเกณฑ์ส่งมอบ** | ผ่าน 50/50, exit 0 | – |
| `browser-check.mjs` | ทุกหน้า 200, favicon 200, ไม่มี console/page error, ไม่มี 404, ไม่มี overflow แนวนอนที่ 360/768/1440 px, **คอนทราสต์ WCAG ทั้งสองธีม**, **ปุ่มสลับธีมทำงานจริงและจำค่าได้**, **ธีมถูกตั้งก่อนวาด** | ผ่าน 84/84, exit 0 | Chromium + playwright-core |
| `word-count.mjs --check` | จำนวนคำในเนื้อความต่อหน้าเทียบค่าอ้างอิงที่ตรึงไว้ และ **โทเคนทางเทคนิค (ตัวเลข/แฟล็ก/ชื่อ metric/สูตร) ต้องไม่หาย** | ลด 25–35% ต่อหน้า และโทเคนครบ, exit 0 | – |

`test-calc.mjs` และ `verify-site.mjs` และ `word-count.mjs` **ไม่ต้องใช้ mock server และไม่ต้องใช้ k6**
ส่วน `browser-check.mjs` ต้องมี Chromium ที่ติดตั้งไว้ (ดูหัวข้อ 2)

ถ้า `browser-check.mjs` หา Chromium ไม่เจอ ให้ตั้งพาธเอง:

```bash
PLAYWRIGHT_CORE=/path/to/playwright-core/index.js \
CHROME_PATH="/path/to/Google Chrome for Testing" \
node scripts/browser-check.mjs
```

---

## 6. เอกสารใน `docs/`

| ไฟล์ | อ่านเมื่อไหร่ |
|---|---|
| [`docs/DEPLOY.md`](docs/DEPLOY.md) | จะเอาขึ้นโฮสต์ — ขั้นตอน deploy, ค่าที่ต้องตั้ง, **rollback แบบทีละขั้น** |
| [`docs/RUNBOOK.md`](docs/RUNBOOK.md) | ดูแลระบบ — ตรวจสุขภาพ, รันชุดทดสอบ, แก้อาการผิดปกติ, ซ้อม rollback |
| [`docs/CONTENT_REVIEW.md`](docs/CONTENT_REVIEW.md) | ตรวจความถูกต้องของเนื้อหาบทเรียนทีละหัวข้อ เทียบเอกสารทางการ |
| [`docs/REFERENCES.md`](docs/REFERENCES.md) | ดูว่าแหล่งอ้างอิงแต่ละอันถูกใช้ในบทไหน |
| [`docs/HANDOFF.md`](docs/HANDOFF.md) | รับงานต่อ — สิ่งที่ส่งมอบ, สิทธิ์ที่ต้องใช้, ข้อจำกัด, งานที่ยังค้าง |
| [`docs/evidence/`](docs/evidence/) | ดูผลการรันจริงแบบดิบ ไม่ผ่านการเรียบเรียง |

---

## 7. หลักการที่โปรเจกต์นี้ยึด

1. **ตัวเลขต้องตรวจสอบได้** — ค่าทุกตัวในบทเรียนมาจาก `site/assets/data/*.json`
   หรือจากการรันที่บันทึกไว้ และมี `verify-site.mjs` เทียบให้ทุกครั้ง
2. **ห้ามโหลดของจากภายนอก** — ไม่มี CDN ไม่มีฟอนต์ภายนอก ไม่มี analytics
   ทุกอย่างอยู่ใน `site/` ทำให้เปิดได้แม้ไม่มีเน็ต และ deploy ได้ทุกที่
3. **ไม่ใช้ emoji เป็นไอคอน** — ใช้ inline SVG ทั้งหมด (เส้นเดียว stroke 1.6–1.8)
4. **สคริปต์ k6 ต้องกันการยิงผิดปลายทาง** — ดูรายการ `ALLOWED_HOSTS` ในทุกสคริปต์
5. **แยก "การคำนวณ" ออกจาก "การวัด"** — ตารางที่มาจากสูตรจะระบุไว้ชัดว่าไม่ใช่ผลการวัด
6. **สีทุกสีเป็นโทเคน ไม่มีสีตายตัวใน JavaScript** — กราฟและแถบต่าง ๆ อ่านสีจาก CSS variable
   เพื่อให้เปลี่ยนตามธีมสว่าง/มืดได้ มีด่านตรวจใน `verify-site.mjs`
7. **ตัดสำนวนได้ แต่ตัดข้อเท็จจริงไม่ได้** — การลดความยาวทำได้เฉพาะถ้อยคำ
   ตัวเลข สูตร ตาราง โค้ด และเกณฑ์ตัดสินต้องอยู่ครบ มี `word-count.mjs` เป็นด่านเทียบกับสำเนาก่อนแก้
