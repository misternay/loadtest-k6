# REFERENCES.md — แหล่งอ้างอิงทั้งหมด

รวมแหล่งอ้างอิงทุกอันที่เว็บไซต์และเครื่องมือในโปรเจกต์นี้ใช้
พร้อมระบุว่าใช้ในบทไหนหรือไฟล์ใด และตรวจสอบล่าสุดเมื่อไหร่

**เวอร์ชัน k6 ที่อ้างอิง: v2.2.0**
**วันที่ตรวจสอบลิงก์และเนื้อหา: 16 กันยายน 2026**

---

## 1. เอกสารทางการของ k6

แหล่งอ้างอิงหลักของบทเรียนทั้งหมด ทุกหัวข้อใน [`CONTENT_REVIEW.md`](CONTENT_REVIEW.md)
อ้างอิงจากห้าแหล่งนี้

| # | ชื่อ | URL | ใช้ในบทไหน / ไฟล์ใด | ตรวจเมื่อ |
|---|---|---|---|---|
| 1 | **Metrics reference** — รายการ metric ทั้งหมดของ k6 พร้อมชนิดและนิยาม รวมถึงนิยามของ `http_req_duration` ที่เป็นสูตร `sending + waiting + receiving` | https://grafana.com/docs/k6/latest/using-k6/metrics/reference/ | บทที่ 3 (ทั้งบท), บทที่ 4, บทที่ 6, `assets/data/metrics.json` | 16 ก.ย. 2026 |
| 2 | **Scenarios > Executors** — รายชื่อ executor ทั้ง 6 แบบของ k6 v2.2.0 พร้อมค่าที่ใช้ใน config | https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/ | บทที่ 2 (ตารางเลือก executor), บทที่ 5 | 16 ก.ย. 2026 |
| 3 | **Thresholds** — ไวยากรณ์ threshold expression, รูปแบบสั้นและรูปแบบยาว, `abortOnFail`, `delayAbortEval`, exit code 99 | https://grafana.com/docs/k6/latest/using-k6/thresholds/ | บทที่ 4 (หัวข้อตั้งเกณฑ์), บทที่ 5, บทที่ 6, `k6/*.js` ทุกไฟล์ | 16 ก.ย. 2026 |
| 4 | **Scenarios** — ภาพรวม scenario, แนวคิด open model / closed model, การจอง VU ล่วงหน้า | https://grafana.com/docs/k6/latest/using-k6/scenarios/ | บทที่ 2, บทที่ 5, `k6/load.js`, `k6/stress.js`, `k6/spike.js`, `k6/soak.js` | 16 ก.ย. 2026 |
| 5 | **Metrics** — ภาพรวม metric, ชนิดของ metric (Counter / Gauge / Rate / Trend), ตัวเลือกการส่งออกผลลัพธ์ | https://grafana.com/docs/k6/latest/using-k6/metrics/ | บทที่ 3, บทที่ 6, บทที่ 4 | 16 ก.ย. 2026 |

---

## 2. เอกสารทางการที่เว็บลิงก์ออกไป

เว็บไซต์มีลิงก์ออกภายนอกทั้งหมด **6 แห่ง** ซึ่ง `verify-site.mjs` บังคับว่าต้องเป็น
โดเมนของ k6 เท่านั้น (`grafana.com` หรือ `k6.io`) ไม่งั้นจะไม่ผ่านการตรวจ

### 2.1 ลิงก์ในท้ายเว็บ (สร้างจาก `assets/js/site.js` — ปรากฏทุกหน้า)

หัวข้อ "เอกสาร k6 ทางการ" ในแถบท้ายเว็บ:

| ชื่อที่แสดง | URL |
|---|---|---|
| คู่มือ k6 (grafana.com) | https://grafana.com/docs/k6/latest/ | – (หน้าหลัก) |
| metric คืออะไร และมีชนิดใดบ้าง | https://grafana.com/docs/k6/latest/using-k6/metrics/ | 5 |
| นิยาม metric รายตัว (metrics reference) | https://grafana.com/docs/k6/latest/using-k6/metrics/reference/ | 1 |
| thresholds และ delayAbortEval | https://grafana.com/docs/k6/latest/using-k6/thresholds/ | 3 |
| scenarios และแบบจำลองโหลด | https://grafana.com/docs/k6/latest/using-k6/scenarios/ | 4 |
| executors ทั้ง 6 แบบ | https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/ | 2 |

### 2.2 ลิงก์ในเนื้อหา

| ไฟล์ | ตำแหน่ง | ชื่อที่แสดง | URL |
|---|---|---|---|
| `index.html` | บรรทัด 379 | วิธีติดตั้ง k6 | https://grafana.com/docs/k6/latest/set-up/install-k6/ |
| `troubleshooting.html` | บรรทัด 95 | วิธีติดตั้ง k6 | https://grafana.com/docs/k6/latest/set-up/install-k6/ |
| `troubleshooting.html` | บรรทัด 671 | คู่มือ k6 ทางการ | https://grafana.com/docs/k6/latest/ |

> **ช่องว่างที่เคยพบ — ปิดแล้ว (16 ก.ย. 2026):** ก่อนหน้านี้ท้ายเว็บไม่มีลิงก์ไป
> `metrics/reference/` ซึ่งเป็นหน้าที่มีรายละเอียด metric ครบที่สุด และไม่มีลิงก์ไป
> `scenarios/` รอบนี้เพิ่มทั้งสองเข้าไปใน `assets/js/site.js` แล้ว ท้ายเว็บจึง
> ครอบแหล่งอ้างอิงหลักทั้ง 5 ข้อของโปรเจกต์ (ข้อ 1–5 ในตารางหัวข้อ 1)

---

## 3. แหล่งอ้างอิงประกอบ (ไม่ใช่เอกสาร k6)

| # | ชื่อ | URL | ใช้ในบทไหน | ลักษณะการอ้าง |
|---|---|---|---|---|
| 6 | **k6 pull request #5846** — "Drop externally-controlled executor" (milestone `v2.0.0-rc1`, merge 22 เม.ย. 2026) | https://github.com/grafana/k6/pull/5846 | `CONTENT_REVIEW.md` ข้อ 5.0 | ใช้เป็นหลักฐานว่า executor ตัวที่เจ็ดถูกลบออกจาก k6 แล้ว จึงเหลือ 6 แบบ |
| 7 | **k6 issue #5640** — "Drop externally-controlled executor" | https://github.com/grafana/k6/issues/5640 | `CONTENT_REVIEW.md` ข้อ 5.0 | ประเด็นต้นทางของ PR ข้างต้น |
| 8 | **นิยาม exit code ของ k6** — ซอร์สโค้ด `errext/exitcodes/codes.go` | https://github.com/grafana/k6/blob/master/errext/exitcodes/codes.go | `RUNBOOK.md` หัวข้อ 2.4 | ตารางความหมาย exit code คัดลอกจากไฟล์นี้ ไม่ได้เดาจากพฤติกรรมที่สังเกต |

---

## 4. กฎของ Little และทฤษฎีที่เกี่ยวข้อง

บทที่ 1 สอน **กฎของ Little** (`N = อัตราการเกิดงาน × เวลาที่งานนั้นกินอยู่`)
และความสัมพันธ์ `throughput = concurrency ÷ latency`

**ไม่ปรากฏ URL อ้างอิงในเว็บสำหรับหัวข้อนี้** — เป็นทฤษฎีคิวที่เป็นที่รู้จักทั่วไป
และเว็บได้ระบุข้อจำกัดการใช้ไว้ครบถ้วน (ใช้ได้เฉพาะช่วงภาวะคงตัว ไม่ได้บอกว่าต้องใช้
VU เท่าไรจึงเพียงพอ ต้องนับงานที่ลอยพร้อมกันแยกจากจำนวน VU)

ถ้าต้องการเพิ่มแหล่งอ้างอิงเชิงวิชาการ ให้ใช้:
- Little, J. D. C. (1961). *A Proof for the Queuing Formula: L = λW*. Operations Research, 9(3), 383–387.

---

## 5. แหล่งอ้างอิงของข้อมูลตัวเลขในบทเรียน

ทุกตัวเลขในบทเรียน **ไม่ได้มาจากแหล่งภายนอก** แต่มาจากการรัน k6 v2.2.0 จริง
ที่บันทึกไว้ในโปรเจกต์นี้เอง ซึ่งเป็นหลักการสำคัญของโปรเจกต์ (ดู `README.md` หัวข้อ 7)

| ชุดข้อมูล | ไฟล์ | ที่มา | ใช้ในบทไหน |
|---|---|---|---|
| เวลาตอบสนอง 1,155 ค่า | `site/assets/data/latency-samples.json` | `k6 run` ด้วย 10 VUs นาน 12 วินาที ส่งออกด้วย `-o csv` แล้วแปลงเป็น JSON (เรียงจากน้อยไปมาก) | บทที่ 1, 3, 4, 6 |
| ค่า metric และอภิธานศัพท์ 69 คำ | `site/assets/data/metrics.json` | สรุปผลการรันเดียวกัน รวมกับคำนิยามที่เรียบเรียงจากเอกสารทางการข้อ 1 | บทที่ 1, 2, 3, 6, `glossary.html` |
| ข้อมูลดิบตัวอย่าง (CSV) | `docs/evidence/k6-csv-raw-sample.csv` | ไฟล์ที่ส่งออกด้วย `-o csv` โดยตรง ยังไม่ผ่านการแปลง | หลักฐานอ้างอิง |

การเชื่อมโยงระหว่างข้อมูลกับตัวเลขบนหน้าเว็บถูกตรวจอัตโนมัติทุกครั้งที่รัน
`node scripts/verify-site.mjs` (กลุ่มที่ 8) และ `node scripts/test-calc.mjs`

---

## 6. เครื่องมือที่ใช้

| เครื่องมือ | เวอร์ชัน | ใช้ทำอะไร | ที่มา |
|---|---|---|---|
| k6 | v2.2.0 | รันสคริปต์โหลดเทสต์ | https://github.com/grafana/k6 |
| Node.js | v22.22.3 | รัน mock server และตัวตรวจทั้งหมด | https://nodejs.org/ |
| Chromium (Chrome for Testing) | 153.0.8010.12 | ตรวจเว็บด้วยเบราว์เซอร์จริง | ติดตั้งผ่าน Playwright ที่ `~/Library/Caches/ms-playwright/` |
| playwright-core | 1.63.0 | ขับ Chromium จาก Node | https://github.com/microsoft/playwright |
| Docker | 27.4.0 | ทางเลือกสำหรับรัน k6 โดยไม่ติดตั้งลงเครื่อง | https://www.docker.com/ |

**ไม่มี dependency ของ Node ในโปรเจกต์นี้** — สคริปต์ทั้งหมดใช้เฉพาะโมดูลมาตรฐาน
(`node:fs`, `node:http`, `node:path`, `node:vm`, `node:module`, `node:url`)
ยกเว้น `scripts/browser-check.mjs` ที่ต้องใช้ `playwright-core` จากภายนอก

---

## 7. วิธีตรวจว่าลิงก์ภายนอกยังใช้ได้

`verify-site.mjs` ตรวจแค่ว่าลิงก์ภายนอกชี้ไปโดเมนที่อนุญาต **ไม่ได้ตรวจว่ายังเปิดได้จริง**
การยืนยันว่าลิงก์ไม่ตายต้องทำมือ:

```bash
cd loadtest-k6/site
grep -rho 'href="https\?://[^"]*"' --include='*.html' . | sed 's|href="||;s|"$||' | sort -u
```

แล้วเปิดแต่ละอันด้วยตา หรือใช้:

```bash
for u in \
  https://grafana.com/docs/k6/latest/ \
  https://grafana.com/docs/k6/latest/using-k6/metrics/ \
  https://grafana.com/docs/k6/latest/using-k6/thresholds/ \
  https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/ \
  https://grafana.com/docs/k6/latest/using-k6/metrics/reference/ \
  https://grafana.com/docs/k6/latest/using-k6/scenarios/ \
  https://grafana.com/docs/k6/latest/set-up/install-k6/ \
  https://github.com/grafana/k6/blob/master/errext/exitcodes/codes.go ; do
  printf "%-70s %s\n" "$u" "$(curl -s -o /dev/null -w '%{http_code}' -L --max-time 20 "$u")"
done
```

ต้องได้ `200` ทุกอัน ถ้าอันใดได้ `404` แปลว่าเอกสารถูกย้าย ต้องตามหา URL ใหม่
แล้วแก้ทั้งในเว็บ (`site/`) และในเอกสาร (`docs/`)
