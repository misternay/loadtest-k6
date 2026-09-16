# CONTENT_REVIEW.md — บันทึกการทบทวนความถูกต้องของเนื้อหา

**เวอร์ชัน k6 ที่ใช้อ้างอิง: v2.2.0** (`k6 v2.2.0 (commit/devel, go1.26.5, darwin/arm64)`)
**วันที่ตรวจ: 16 กันยายน 2026**
**ขอบเขตที่ตรวจ:** บทเรียนทั้ง 6 บท, หน้าอภิธานศัพท์, หน้าสคริปต์ตัวอย่าง,
หน้าครื่องคำนวณ, หน้าสำรวจ latency, แก้ปัญหาที่พบบ่อย และสคริปต์ k6 ทั้ง 5 ไฟล์

**วิธีที่ใช้ตรวจ:** เทียบข้อความในเว็บกับเอกสารทางการของ k6 ทีละหัวข้อ
และ **รัน k6 v2.2.0 จริงเพื่อยืนยันทุกข้อที่สงสัย** ไม่ได้เชื่อเอกสารอย่างเดียว
ข้อใดที่ยืนยันด้วยการรัน จะระบุคำสั่งที่ใช้ไว้ในหมายเหตุ

---

## 0. สรุปภาพรวม

| สถานะ | จำนวนหัวข้อ |
|---|---|
| ตรงกับเอกสารทางการ | 9 |
| เรียบเรียงใหม่เพื่อการสอน (ตัดทอน/เปลี่ยนคำ แต่สาระตรง) | 4 |
| แก้ไขแล้วในเฟสก่อน | 4 |
| **แก้ไขแล้วในรอบนี้ (16 ก.ย. 2026)** | **4** |
| **ยังไม่ตรงกับ k6 v2.2.0 — ค้างแก้** | **0** |

**สรุปของรอบนี้:** ข้อบกพร่องที่ค้างไว้ทั้ง 4 ข้อ (หัวข้อ 9.1–9.4) **แก้ครบแล้ว**
และไม่พบข้อบกพร่องใหม่ที่ยังไม่ได้แก้

> **หมายเหตุเรื่องขอบเขตที่ขยายในรอบนี้:** ข้อ 9.1 และ 9.3 ต้องแก้ไฟล์
> `site/assets/data/metrics.json` ซึ่งรอบก่อนถูกสั่งห้ามแตะ รอบนี้ได้รับอนุญาต
> จึงแก้ได้ครบ ทำให้อภิธานศัพท์กับบทเรียนไม่ขัดกันเองอีก

### 0.1 สรุปห้าบรรทัดที่ต้องยืนยันในรอบนี้

| # | เรื่อง | ข้อสรุป | ที่อ้างอิงในเอกสารนี้ |
|---|---|---|---|
| 1 | **ชื่อฟิลด์ threshold** | ชื่อที่ถูกต้องคือ `delayAbortEval` ไม่ใช่ `delayAbortedCheck` ซึ่งไม่มีอยู่ใน k6 v2.2.0 — แก้ครบ 13 จุดใน 9 ไฟล์ และ `k6 inspect` ของสคริปต์ทั้งห้าไม่พบฟิลด์ที่ไม่รู้จักอีก | ข้อ 9.1, `RUNBOOK.md` 5.4 |
| 2 | **`delayAbortEval` ทำอะไร** | เลื่อนเฉพาะ **เวลาที่ k6 จะตัดสินใจหยุดการรัน** (2.0 วินาที → 12.0 วินาที) **ไม่ได้ตัดข้อมูลช่วงอุ่นเครื่องออกจากการคิด threshold** (การรันที่รันจนจบ 20.1 วินาทีทั้งคู่รายงาน `p(95)` 603.32 กับ 602.49 ms) | ข้อ 9.1, `docs/evidence/k6-delay-abort-eval.txt` |
| 3 | **จำนวน executor ใน k6 v2.2.0** | **6 แบบ** (`shared-iterations`, `per-vu-iterations`, `constant-vus`, `ramping-vus`, `constant-arrival-rate`, `ramping-arrival-rate`) เว็บไซต์สอน 6 แบบ จึงถูกต้อง — `externally-controlled` ถูกลบออกจาก k6 แล้ว **ห้าม "แก้" ให้เป็น 7** | หัวข้อ 5.0 |
| 4 | **ความเสถียรของ smoke** | แก้แล้ว: `vus: 2, duration: '20s'` + mock server ปิดหางยาวเป็นค่าเริ่มต้น + เพดานสุขภาพ `p(95)<1000` → รัน 30 ครั้งติดกันผ่าน **30/30** (ก่อนแก้ 37 ครั้ง ไม่ผ่าน 6 ครั้ง ≈ 16%) | ข้อ 9.2, `docs/evidence/k6-smoke-repeatability.txt` |
| 5 | **คำต่างภาษา** | ลบ `hasil` 3 จุดแล้ว และสแกนทั้งเว็บซ้ำสองวิธี (สแกนคำกว่า 70 คำจาก 6 ภาษา + สแกนอักขระนอกช่วงไทย-ละติน) ไม่พบคำต่างภาษาตกค้าง | ข้อ 9.3 |

---

## 1. สูตรและความหมายของ TPS / RPS

**อยู่ที่:** `lessons/01-tps.html`

| หัวข้อ | เนื้อหาที่สอน | เอกสารอ้างอิง | สถานะ | หมายเหตุ |
|---|---|---|---|---|
| นิยาม TPS / RPS / iterations/s | แยกสามคำตามหน่วยที่นับ: RPS นับคำขอ HTTP (`http_reqs`), TPS นับธุรกรรม (อาจหลายคำขอ), iterations/s นับรอบของ `default()` | [`metrics/reference`](https://grafana.com/docs/k6/latest/using-k6/metrics/reference/) | ตรง | `http_reqs` นิยามทางการคือ "How many total HTTP requests k6 generated" ตรงกับที่สอน |
| สูตรจากของจริง | `TPS = จำนวน request ที่สำเร็จ ÷ เวลาที่ใช้จริง (วินาที)` | [`metrics`](https://grafana.com/docs/k6/latest/using-k6/metrics/) | ตรง | สอดคล้องกับวิธีที่ k6 คำนวณอัตราต่อวินาทีให้ในสรุปผล |
| สูตร closed model | `iteration_duration = (R × Rt) + Tt` และ `iterations/s = จำนวน VU ÷ iteration_duration` | [`metrics/reference`](https://grafana.com/docs/k6/latest/using-k6/metrics/reference/) | เรียบเรียงใหม่เพื่อการสอน | เป็นสูตรปิดรูปที่อนุมานจากนิยาม `iteration_duration` ของ k6 ไม่ใช่สูตรที่เอกสารเขียนไว้ตรง ๆ เว็บระบุชัดว่าเป็น "สูตรแบบง่าย" และให้ค่าสูงกว่าจริงเล็กน้อย |
| ตัวอย่างแทนค่า 3 ตัวอย่าง | ตัวอย่างคำนวณทีละบรรทัด พร้อมตารางเทียบ | – | เรียบเรียงใหม่เพื่อการสอน | เว็บระบุไว้ใต้ตารางชัดเจนว่า "เป็นตัวอย่างการคำนวณ ไม่ใช่ผลการวัดจากเครื่องจริง" **ถือว่าถูกต้องตามหลักฐานที่อ้าง** |
| ค่าที่วัดได้จริง | `1,155 ÷ 12.36 = 93.45` เทียบกับ `http_reqs 93.44/s` ของ k6 | – | ตรง | ตรวจกับ `assets/data/metrics.json` แล้วตรง |
| กฎของ Little | `N = TPS × เวลาต่อรอบ` | – | ตรง | เป็นทฤษฎีคิวทั่วไป ไม่ได้อ้างว่าเป็นเอกสาร k6 และให้ข้อจำกัดการใช้ไว้ครบ |
| กับดัก `http_reqs` นับรวมที่ล้มเหลว | "`http_reqs` ของ k6 นับรวมคำขอที่ได้ 500 แม้ว่า `http_req_failed` จะรายงานว่าล้มเหลว" | [`metrics/reference`](https://grafana.com/docs/k6/latest/using-k6/metrics/reference/) | ตรง | ยืนยันจากนิยามทางการ: `http_reqs` = "How many total HTTP requests k6 generated" ไม่ได้กรองตามสถานะ |
| **`delayAbortEval` เพื่อหน่วงการตัดสินใจหยุด** | "ใช้ `delayAbortEval` คู่กับ `abortOnFail: true` เพื่อไม่ให้ช่วงอุ่นเครื่องทำให้การรันถูกตัดจบก่อนได้ข้อมูลที่มีความหมาย และมันไม่ได้ตัดข้อมูลช่วงอุ่นเครื่องออกจากการคิด threshold" | [`thresholds`](https://grafana.com/docs/k6/latest/using-k6/thresholds/) | **แก้ไขแล้วในรอบนี้** | เดิมเขียนว่า `delayAbortedCheck` ซึ่งไม่มีใน k6 v2.2.0 และเขียนว่า "ทิ้งข้อมูลช่วง ramp-up ออกจากการตัดสิน" ซึ่งไม่จริง ดูข้อ 9.1 |

---

## 2. ความหมายของ VU และ lifecycle

**อยู่ที่:** `lessons/02-vu.html`

| หัวข้อ | เนื้อหาที่สอน | เอกสารอ้างอิง | สถานะ | หมายเหตุ |
|---|---|---|---|---|
| VU ไม่ใช่เบราว์เซอร์ | VU เป็นหน่วยทำงานที่ยิง HTTP แล้วรอคำตอบ ไม่ได้รัน JavaScript ของหน้าเว็บ ไม่ได้วัดเวลาเรนเดอร์ | [`metrics/reference`](https://grafana.com/docs/k6/latest/using-k6/metrics/reference/) | ตรง | สอดคล้องกับนิยาม `vus` = "Current number of active virtual users" และ `iteration_duration` = "The time to complete one full iteration" ซึ่งเป็นเวลาระดับสคริปต์ ไม่ใช่ระดับเรนเดอร์ |
| ลำดับ lifecycle | อ่านโค้ดระดับโมดูลหนึ่งครั้งต่อ VU (บริบท init) → เข้า `default()` → รอคำตอบ (ถูกจอง) → ทำงานที่เหลือ → `sleep()` → วนรอบใหม่ | [`metrics`](https://grafana.com/docs/k6/latest/using-k6/metrics/) | ตรง | `http_req_blocked` นิยามทางการว่า "Time spent blocked (waiting for a free TCP connection slot)" สนับสนุนข้อที่ว่า VU ถูกจองระหว่างรอ |
| state และ cookie แยกกันทุก VU | ตัวแปรในบริบท init อยู่ตลอดอายุ VU และไม่แชร์ข้าม VU, cookie jar แยกกัน | [`metrics/reference`](https://grafana.com/docs/k6/latest/using-k6/metrics/reference/) | ตรง | สอดคล้องกับคำอธิบายทางการเรื่อง VU resources ที่ถูกจัดสรรล่วงหน้า (`vus_max`) |
| ตัวเลขยืนยันจากข้อมูลจริง | `vus: 10`, `vus_max: 10` และ `request ที่ลอยพร้อมกัน = 93.44 × 0.05425 = 5.07` | – | ตรง | ตรวจกับ `assets/data/metrics.json` แล้วตรง |
| ตาราง TPS ต่อ VU ตาม think time | ตารางเทียบ think time 10/50/500/1000 ms จาก Rt = 54.25 ms | – | เรียบเรียงใหม่เพื่อการสอน | ระบุที่มาใต้ตารางชัดว่ามีเพียงแถว think time 50 ms ที่เทียบกับผลจริง แถวอื่นเป็นการคำนวณ |
| `iteration_duration` รวม `sleep()` | think time ถูกนับใน `iteration_duration` จึงต้องนำไปคิด TPS | [`metrics/reference`](https://grafana.com/docs/k6/latest/using-k6/metrics/reference/) | ตรง | นิยามทางการของ `iteration_duration` ครอบคลุมทั้งรอบของ `default()` |

---

## 3. รายการ metric และสูตร `http_req_duration`

**อยู่ที่:** `lessons/03-metrics.html`, `glossary.html`, `assets/data/metrics.json`

| หัวข้อ | เนื้อหาที่สอน | เอกสารอ้างอิง | สถานะ | หมายเหตุ |
|---|---|---|---|---|
| สูตร `http_req_duration` | "`http_req_duration` คือผลรวมของสามตัวนี้: `http_req_sending + http_req_waiting + http_req_receiving`" | [`metrics/reference`](https://grafana.com/docs/k6/latest/using-k6/metrics/reference/) | **แก้ไขแล้วในเฟสก่อน** | นิยามทางการตรงคำต่อคำ: "Total time for the request. It's equal to `http_req_sending + http_req_waiting + http_req_receiving`" ดูข้อ 8.1 |
| สามตัวที่ **ไม่** ถูกรวม | `http_req_blocked`, `http_req_connecting`, `http_req_tls_handshaking` ถูกวัดแยก | [`metrics/reference`](https://grafana.com/docs/k6/latest/using-k6/metrics/reference/) | ตรง | เอกสารทางการยืนยันว่านิยามไม่รวม "the initial DNS lookup/connection times" |
| การตรวจสอบกับข้อมูลดิบ | ผลรวม sending + waiting + receiving = 62,660.934 ms เท่ากับผลรวม duration = 62,660.934 ms จาก 1,155 ค่า | [`metrics/reference`](https://grafana.com/docs/k6/latest/using-k6/metrics/reference/) | ตรง | ตรวจซ้ำด้วย `node scripts/test-calc.mjs` แล้วผ่าน (มีเคสตรวจความเท่ากันนี้โดยเฉพาะ) |
| ค่าของ `http_req_blocked` / `connecting` | avg 0.0231 ms / 0.0097 ms และ p95 = 0.02 ms / 0 ตามลำดับ | [`metrics/reference`](https://grafana.com/docs/k6/latest/using-k6/metrics/reference/) | ตรง | ในไฟล์ข้อมูลจริงส่งออกมาด้วย `-o csv` และตรวจสอบด้วยตาได้ |
| ตารางแสดงว่าคอขวดอยู่ที่เซิร์ฟเวอร์ | `http_req_waiting` กิน 99.58% ของ `http_req_duration` | [`metrics/reference`](https://grafana.com/docs/k6/latest/using-k6/metrics/reference/) | ตรง | นิยามทางการของ `http_req_waiting` = "Time spent waiting for response from remote host (a.k.a. TTFB)" จึงแปลความได้ตามที่สอน |
| ประเภทของ metric | Counter / Gauge / Rate / Trend พร้อมวิธีอ่านแต่ละชนิด | [`metrics`](https://grafana.com/docs/k6/latest/using-k6/metrics/) | ตรง | เอกสารทางการแบ่งสี่ชนิดเดียวกัน และระบุว่าค่าดิบของ Trend ถูกส่งออกตามที่เว็บสอน |
| `vus` เป็น Gauge ห้ามบวกกัน | "ผลรวมคือ 120 ซึ่งไม่มีความหมายอะไร ส่วนที่ควรอ่านคือ avg 10, min 10, max 10" | [`metrics/reference`](https://grafana.com/docs/k6/latest/using-k6/metrics/reference/) | ตรง | นิยามทางการของ `vus` = "Current number of active virtual users" เป็นค่าขณะใดขณะหนึ่งจริง |
| แท็ก `expected_response` | 4xx/5xx นับเป็นความล้มเหลวโดยค่าเริ่มต้น ต้องใส่แท็ก `expected_response: 'true'` จึงไม่นับ | [`metrics/reference`](https://grafana.com/docs/k6/latest/using-k6/metrics/reference/) | ตรง | นิยามทางการของ `http_req_failed` = "The rate of failed requests according to `setResponseCallback`" สอดคล้องกัน |
| สรุปบท | `http_req_duration = sending + waiting + receiving` ตรวจกับผลรวมดิบ 1,155 ค่า ได้ 62,660.934 ms เท่ากัน | [`metrics/reference`](https://grafana.com/docs/k6/latest/using-k6/metrics/reference/) | ตรง | – |
| **ชื่อฟิลด์ในตัวอย่างคำสั่ง** | `k6 run -o csv=raw.csv script.js` | [`metrics`](https://grafana.com/docs/k6/latest/using-k6/metrics/) | **แก้ไขแล้วในรอบนี้** | เดิมใช้ชื่อไฟล์ `hasil.csv` ซึ่งเป็นคำในภาษาอินโดนีเซีย เปลี่ยนเป็น `raw.csv` ให้ตรงกับบทที่ 6 ดูข้อ 9.3 |

---

## 4. ชนิดของ metric (Counter / Gauge / Rate / Trend)

**อยู่ที่:** `lessons/03-metrics.html`, `assets/data/metrics.json`, `glossary.html`

| หัวข้อ | เนื้อหาที่สอน | เอกสารอ้างอิง | สถานะ | หมายเหตุ |
|---|---|---|---|---|
| Counter | ยอดสะสม เพิ่มอย่างเดียว อ่านผลรวมและอัตราต่อวินาที | [`metrics`](https://grafana.com/docs/k6/latest/using-k6/metrics/) | ตรง | ตัวอย่างที่ยก (`http_reqs`, `iterations`, `data_sent`, `dropped_iterations`) ตรงกับชนิด Counter ในตารางทางการทั้งหมด |
| Gauge | ค่าขณะใดขณะหนึ่ง ขึ้นลงได้ อ่านเป็น min/max/avg | [`metrics`](https://grafana.com/docs/k6/latest/using-k6/metrics/) | ตรง | ตัวอย่าง `vus`, `vus_max` ตรงกับตารางทางการ |
| Rate | สัดส่วนของเหตุการณ์ ค่าอยู่ระหว่าง 0 กับ 1 | [`metrics`](https://grafana.com/docs/k6/latest/using-k6/metrics/) | ตรง | ตัวอย่าง `http_req_failed`, `checks` ตรงกับตารางทางการ |
| Trend | การกระจายของค่า ต้องดูลึกกว่าแค่ค่าเฉลี่ย | [`metrics`](https://grafana.com/docs/k6/latest/using-k6/metrics/) | ตรง | ตัวอย่าง `http_req_duration`, `iteration_duration`, `http_req_waiting` ตรงกับตารางทางการ |
| custom metric ทั้งสี่ชนิด | ตัวอย่างสร้าง `Counter`, `Gauge`, `Rate`, `Trend` พร้อมพารามิเตอร์ `true` ให้ Trend แสดงเป็น ms | [`metrics`](https://grafana.com/docs/k6/latest/using-k6/metrics/) | ตรง | – |
| คำเตือนเรื่องสร้าง metric ซ้ำ | ไม่ควรสร้าง Trend วัดเวลาตอบสนองทั้งที่มี `http_req_duration` อยู่แล้ว | [`metrics`](https://grafana.com/docs/k6/latest/using-k6/metrics/) | เรียบเรียงใหม่เพื่อการสอน | เป็นคำแนะนำเชิงปฏิบัติ ไม่ได้อยู่ในเอกสารทางการแบบตรงตัว แต่สอดคล้องกับข้อจำกัดที่เอกสารระบุว่าค่าดิบจะถูกส่งออกเพิ่มขึ้น |

**การตรวจไขว้กับเอกสารทางการ** — ตารางชนิด metric ของ k6 v2.2.0 (ดึงเมื่อ 16 ก.ย. 2026):

| Metric | Type ตามเอกสารทางการ | เว็บสอนตรงกัน |
|---|---|---|
| `checks` | Rate | ตรง |
| `data_received` / `data_sent` | Counter | ตรง |
| `dropped_iterations` | Counter | ตรง |
| `iteration_duration` | Trend | ตรง |
| `iterations` | Counter | ตรง |
| `vus` / `vus_max` | Gauge | ตรง |
| `http_req_blocked` / `connecting` / `duration` / `receiving` / `sending` / `tls_handshaking` / `waiting` | Trend | ตรง |
| `http_req_failed` | Rate | ตรง |
| `http_reqs` | Counter | ตรง |

---

## 5. Executor และ open / closed model

**อยู่ที่:** `lessons/02-vu.html`, `lessons/05-load-profiles.html`

### 5.0 เรื่องจำนวน executor — 6 ไม่ใช่ 7

ข้อกำหนดตั้งต้นของรอบนี้ระบุว่า "executors ทั้ง 7 แบบ" แต่ **k6 v2.2.0 มี executor 6 แบบ**
และเว็บไซต์สอน 6 แบบ ซึ่ง **ถูกต้องสำหรับเวอร์ชันที่อ้างอิง**

หลักฐาน:

1. ตาราง "All executors" บนเอกสารทางการ (ดึง 16 ก.ย. 2026) มี 6 แถว:
   `shared-iterations`, `per-vu-iterations`, `constant-vus`, `ramping-vus`,
   `constant-arrival-rate`, `ramping-arrival-rate`
2. `externally-controlled` ซึ่งเคยเป็นตัวที่เจ็ด **ถูกลบออกจาก k6 แล้ว**
   (PR [grafana/k6#5846](https://github.com/grafana/k6/pull/5846) "Drop externally-controlled executor",
   milestone `v2.0.0-rc1`, merge 22 เมษายน 2026)
3. ทดสอบกับไบนารีจริงแล้วได้ error:

   ```
   $ k6 run /tmp/ext-test.js
   level=error msg="could not initialize 'ext-test.js': could not load JS test
     'file:///tmp/ext-test.js': unknown executor type 'externally-controlled'"
   ```

**สรุป: เว็บไซต์ถูกต้อง ห้าม "แก้" ให้เป็น 7** ถ้าอนาคตอัปเกรดเป็น k6 เวอร์ชันที่คืน
executor นี้กลับมา จึงค่อยพิจารณาเพิ่ม

### 5.1 ตารางเทียบทีละหัวข้อ

| หัวข้อ | เนื้อหาที่สอน | เอกสารอ้างอิง | สถานะ | หมายเหตุ |
|---|---|---|---|---|
| รายชื่อ executor | `shared-iterations`, `per-vu-iterations`, `constant-vus`, `ramping-vus`, `constant-arrival-rate`, `ramping-arrival-rate` | [`scenarios/executors`](https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/) | ตรง | ตรงกับตารางทางการทั้ง 6 รายการ และค่าของแต่ละตัว (`Value` ในเอกสาร) |
| ความหมายของแต่ละ executor | ระบุว่าแต่ละตัวกำหนดอะไร และเมื่อระบบช้าลงพฤติกรรมเปลี่ยนอย่างไร | [`scenarios/executors`](https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/) | ตรง | สอดคล้องกับคำอธิบายทางการ: VU-based = "execute as many iterations as possible for a specified amount of time", arrival-rate = "a fixed number of iterations are executed in a specified period of time" |
| open / closed model | "สองแถวท้ายเป็นแบบจำลองเปิด ส่วนที่เหลือเป็นแบบจำลองปิด" — arrival-rate เป็น open, VU-based เป็น closed | [`scenarios`](https://grafana.com/docs/k6/latest/using-k6/scenarios/) | เรียบเรียงใหม่เพื่อการสอน | เอกสารทางการอธิบายแนวคิด open/closed model ไว้ในหน้าภาพรวม scenarios เว็บสรุปเป็นประโยคเดียวให้จำง่าย โดยคงสาระเดิม |
| ผลของ closed model เมื่อระบบช้าลง | ramping-vus ที่ระบบช้าลงจะยิงช้าลงเองโดยอัตโนมัติ ซึ่งอาจไม่ตรงกับทราฟฟิกจริง | [`scenarios`](https://grafana.com/docs/k6/latest/using-k6/scenarios/) | ตรง | เป็นเหตุผลเดียวกับที่เอกสารทางการแนะนำให้ใช้ arrival-rate เมื่อต้องการจำลองทราฟฟิกจากภายนอก |
| `dropped_iterations` เกิดกับ arrival-rate | "รอบที่ถูกทิ้งเพราะไม่มี VU ว่าง เกิดกับ executor แบบ arrival-rate" | [`metrics/reference`](https://grafana.com/docs/k6/latest/using-k6/metrics/reference/) | ตรง | นิยามทางการ: "The number of iterations that weren't started due to lack of VUs (for the arrival-rate executors) or lack of time (expired maxDuration in the iteration-based executors)" — เว็บยกมาส่วน arrival-rate ซึ่งเป็นกรณีหลัก ไม่ได้กล่าวถึงกรณี maxDuration (ไม่ผิด เพียงไม่ครบ) |
| รูปแบบการทดสอบ 6 แบบ | smoke / load / stress / spike / soak / breakpoint | [`scenarios`](https://grafana.com/docs/k6/latest/using-k6/scenarios/) | เรียบเรียงใหม่เพื่อการสอน | เอกสารทางการไม่ได้จัดหมวด "รูปแบบการทดสอบ" ไว้เป็นทางการ (เป็นแนวปฏิบัติอุตสาหกรรม) เว็บไม่ได้อ้างว่าเป็นคำของ k6 |
| โครงสร้าง stages สี่ช่วง | อุ่นเครื่อง → ไต่ขึ้น → ภาวะคงตัว → ผ่อนลง | [`scenarios`](https://grafana.com/docs/k6/latest/using-k6/scenarios/) | ตรง | `gracefulRampDown` เป็นตัวเลือกที่มีจริงของ `ramping-vus` |
| **เรียกใช้ `delayAbortEval` ในสคริปต์ stages** | "ยังไม่ต้องตัดสินใจหยุดใน 3 นาทีแรก" พร้อมหัวข้อใหม่ "ถ้าต้องการตัดสินเฉพาะช่วงภาวะคงตัวจริง ๆ" ที่สอนวิธีแยก scenario + threshold อ้างแท็ก scenario | [`thresholds`](https://grafana.com/docs/k6/latest/using-k6/thresholds/) | **แก้ไขแล้วในรอบนี้** | ดูข้อ 9.1 · วิธีที่ 1 (แยก scenario) พิสูจน์ด้วยการรันจริงแล้วว่าได้ผล |

---

## 6. ความหมายของ percentile และวิธีตั้ง threshold

**อยู่ที่:** `lessons/04-percentiles.html`

| หัวข้อ | เนื้อหาที่สอน | เอกสารอ้างอิง | สถานะ | หมายเหตุ |
|---|---|---|---|---|
| นิยาม percentile | "จุดบนเส้นบอกว่ามีคำขอสัดส่วนเท่าไรที่ใช้เวลาไม่เกินค่าบนแกนนอน ณ จุดนั้น" | [`metrics`](https://grafana.com/docs/k6/latest/using-k6/metrics/) | ตรง | สอดคล้องกับ CDF ที่ k6 ใช้ และกับค่า `p(N)` ในสรุปผล |
| วิธีคำนวณด้วยมือ | `ตำแหน่ง = p × (n − 1)` แล้วเทียบสัดส่วนระหว่างสองค่าที่ติดกัน | [`metrics`](https://grafana.com/docs/k6/latest/using-k6/metrics/) | เรียบเรียงใหม่เพื่อการสอน | เอกสารทางการไม่ได้ระบุอัลกอริทึมที่ k6 ใช้ เว็บระบุไว้ชัดว่า k6 ใช้ตัวประมาณของตัวเอง ซึ่งทำให้ p90 ต่างกัน 0.01 ms และอธิบายเหตุผลไว้แล้ว — **ถูกต้องและโปร่งใส** |
| p50 ที่คำนวณผิด | ค่า p50 จากข้อมูลจริง 1,155 ค่า | [`metrics`](https://grafana.com/docs/k6/latest/using-k6/metrics/) | **แก้ไขแล้วในเฟสก่อน** | ดูข้อ 8.2 |
| ตัวเลขสถิติทั้งตาราง | min 4.21, mean 54.25, p50 44.40, p75 54.69, p90 65.31, p95 74.53, p99 466.29, max 584.70 | – | ตรง | ตรวจกับ `assets/data/latency-samples.json` ด้วย `node scripts/test-calc.mjs` แล้วตรงทุกค่า |
| ความคลาดเคลื่อน p90 | ระบุว่า k6 รายงาน 65.31 ขณะที่คำนวณได้ 65.30 ต่าง 0.006 ms และให้เหตุผลว่า k6 ใช้ตัวประมาณของตัวเอง | [`metrics`](https://grafana.com/docs/k6/latest/using-k6/metrics/) | ตรง | เป็นการเปิดเผยข้อจำกัดของตัวเอง ควรค่าแก่การรักษาไว้ |
| ไวยากรณ์ threshold | `p(95)<500` ไม่มีช่องว่างในนิพจน์ | [`thresholds`](https://grafana.com/docs/k6/latest/using-k6/thresholds/) | ตรง | ตรงกับไวยากรณ์ threshold expression ของทางการ |
| `abortOnFail` | เมื่อตั้งแล้ว k6 จะหยุดการรันทันทีที่เกณฑ์ไม่ผ่าน | [`thresholds`](https://grafana.com/docs/k6/latest/using-k6/thresholds/) | ตรง | เอกสารทางการ: "When you set `abortOnFail`, the test run stops as soon as the threshold fails" |
| exit code 99 | "เมื่อ threshold ไม่ผ่าน k6 จะจบการทำงานด้วย exit code 99" | [`thresholds`](https://grafana.com/docs/k6/latest/using-k6/thresholds/) | ตรง | **ยืนยันด้วยการรันจริง** ในรอบนี้หลายครั้ง (ดู `docs/evidence/k6-smoke.txt`) |
| p95 ไม่ปรากฏโดยค่าเริ่มต้น | "k6 ไม่แสดง p99 ให้โดยค่าเริ่มต้น ต้องตั้ง threshold ที่อ้างถึง หรือส่งออกข้อมูลดิบมาคำนวณเอง" | [`metrics`](https://grafana.com/docs/k6/latest/using-k6/metrics/) | ตรง | **ยืนยันด้วยการรันจริง**: `k6 run --help` แสดงค่าเริ่มต้นของ `--summary-trend-stats` = `avg, min, med, max, p(90), p(95)` ไม่มี p(99) |
| ความน่าจะเป็นการเจอคำขอช้า | `1 − (1 − p)^n` พร้อมตาราง 5/20/50/100 คำขอต่อหน้า | – | เรียบเรียงใหม่เพื่อการสอน | ระบุใต้ตารางว่าเป็นการคำนวณความน่าจะเป็น ไม่ใช่ผลการวัด และระบุสมมติฐานว่าคำขอเป็นอิสระต่อกัน |
| max เป็นเกณฑ์ที่ไม่ดี | แนะนำให้ใช้ max เป็นเบาะแส ไม่ใช่เกณฑ์ผ่าน/ไม่ผ่าน | [`thresholds`](https://grafana.com/docs/k6/latest/using-k6/thresholds/) | ตรง | สอดคล้องกับแนวปฏิบัติที่เอกสารทางการเน้นค่าเปอร์เซ็นไทล์ |
| **`delayAbortEval` กับ abortOnFail** | "ยังไม่ต้องตัดสินใจหยุดใน 60 วินาทีแรก" พร้อมกล่องเตือนว่าชื่อ `delayAbortedCheck` ไม่มีใน k6 v2.2.0 และ `delayAbortEval` ไม่ได้กรองข้อมูลออกจากการคิดค่าเปอร์เซ็นไทล์ | [`thresholds`](https://grafana.com/docs/k6/latest/using-k6/thresholds/) | **แก้ไขแล้วในรอบนี้** | ดูข้อ 9.1 · ตัวเลขที่อ้างในกล่องเตือน (p(95) 603.32 กับ 602.49 ms) มาจาก `docs/evidence/k6-delay-abort-eval.txt` |

---

## 7. ตัวเลือกการสรุปผล (`--summary-mode`, `--summary-export`, `-o csv/json`)

**อยู่ที่:** `lessons/03-metrics.html`, `lessons/06-read-results.html`

ยืนยันด้วย `k6 run --help` บน k6 v2.2.0 เมื่อ 16 กันยายน 2026:

```
--summary-mode string    determine the summary mode, "compact", "full" or "disabled" (default "compact")
--summary-export string  output the end-of-test summary report to JSON file
-o, --out uri            uri for an external metrics database
--summary-trend-stats    define stats for trend metrics (default 'avg, min, med, max, p(90), p(95)')
```

| หัวข้อ | เนื้อหาที่สอน | เอกสารอ้างอิง | สถานะ | หมายเหตุ |
|---|---|---|---|---|
| `k6 run script.js` | สรุปผลท้ายการรันแบบเต็ม | [`metrics`](https://grafana.com/docs/k6/latest/using-k6/metrics/) | ตรง | ค่าเริ่มต้นคือ `--summary-mode compact` |
| `--summary-mode compact` | ตัดบรรทัดส่วนเกินและบรรทัด tag ออก | [`metrics`](https://grafana.com/docs/k6/latest/using-k6/metrics/) | ตรง | มีจริงใน v2.2.0 และเป็นค่าเริ่มต้น |
| `--summary-export=result.json` | ไฟล์ JSON ของสรุปผลท้ายการรัน | [`metrics`](https://grafana.com/docs/k6/latest/using-k6/metrics/) | ตรง | **ยืนยันด้วยการรันจริง** — โครงสร้างที่ได้คือ `{ root_group, metrics }` โดย `metrics.<ชื่อ>.<สถิติ>` ไม่มีชั้น `values` ครอบ (ต่างจากรูปแบบที่ส่งออกทาง `handleSummary` ถ้าตั้ง `--new-machine-readable-summary`) |
| `-o json=out.json` | ข้อมูลดิบทุกจุด พร้อม tag ครบ | [`metrics`](https://grafana.com/docs/k6/latest/using-k6/metrics/) | ตรง | มีจริงใน v2.2.0 |
| `-o csv=out.csv` | ข้อมูลดิบในรูปแบบตาราง เปิดในสเปรดชีตได้ | [`metrics`](https://grafana.com/docs/k6/latest/using-k6/metrics/) | ตรง | **ยืนยันด้วยไฟล์จริง** `docs/evidence/k6-csv-raw-sample.csv` มีคอลัมน์ `metric_name,timestamp,metric_value,check,error,error_code,expected_response,group,method,name,proto,scenario,service,status,subproto,tls_version,url,extra_tags,metadata` |
| ใช้ทั้งสองแบบพร้อมกัน | `-o csv=... --summary-export=...` | [`metrics`](https://grafana.com/docs/k6/latest/using-k6/metrics/) | ตรง | เป็นอิสระต่อกัน ใช้ร่วมได้ |
| การอ้างว่าต้องส่งออก CSV จึงได้ p99 | ไม่มีแล้ว — บทที่ 6 มีหัวข้อ "วิธีที่สาม" อธิบาย `--summary-trend-stats` ครบ พร้อมตารางเทียบกับ `--summary-export` และ `-o csv/json` | [`metrics`](https://grafana.com/docs/k6/latest/using-k6/metrics/) | **แก้ไขแล้วในรอบนี้** | ดูข้อ 9.4 · ยืนยันด้วยการรันจริง ดู `docs/evidence/k6-summary-trend-stats.txt` |
| **ชื่อไฟล์ `hasil.csv`** | ไม่มีแล้ว — เปลี่ยนเป็น `raw.csv` ทั้ง 3 จุด | – | **แก้ไขแล้วในรอบนี้** | ดูข้อ 9.3 |

---

## 8. ข้อผิดพลาดที่พบระหว่างทำ และวิธีแก้

### 8.1 (เฟสก่อน) สูตร `http_req_duration` เขียนผิด — **แก้แล้ว**

| หัวข้อ | รายละเอียด |
|---|---|
| อาการ | บทที่ 3 เขียนความสัมพันธ์ของ `http_req_duration` ผิด (เขียนว่าเป็นเวลารวมที่ไม่รวม `waiting` หรือสลับองค์ประกอบ) |
| ผลกระทบ | ผู้อ่านหาคอขวดผิดพลาดทั้งบท เพราะบทนี้ใช้การแยกเวลาของคำขอเป็นเครื่องมือหลัก |
| วิธีแก้ | เขียนใหม่ให้ตรงกับนิยามทางการ: `http_req_duration = http_req_sending + http_req_waiting + http_req_receiving` และเพิ่มการตรวจสอบกับผลรวมดิบทั้ง 1,155 ค่า (ได้ 62,660.934 ms เท่ากันทั้งสองข้าง) |
| การยืนยัน | `node scripts/test-calc.mjs` มีเคสตรวจความเท่ากันนี้ และผ่าน 95/95 |
| เอกสารอ้างอิง | https://grafana.com/docs/k6/latest/using-k6/metrics/reference/ |

### 8.2 (เฟสก่อน) p50 ในบทที่ 4 คำนวณผิด — **แก้แล้ว**

| หัวข้อ | รายละเอียด |
|---|---|
| อาการ | ค่า p50 ของข้อมูลจริง 1,155 ค่า คำนวณจากตำแหน่งผิด (ใช้ `p × n` แทน `p × (n − 1)`) ทำให้ได้ค่าคลาดเคลื่อน |
| ผลกระทบ | ตารางสถิติหลักของบทที่ 4 ทั้งตารางเชื่อถือไม่ได้ และข้อสรุปเรื่อง "p50 ต่ำกว่า mean" ซึ่งเป็นแก่นของบท ก็พลอยผิดไปด้วย |
| วิธีแก้ | คำนวณใหม่ด้วยตำแหน่ง `p × (n − 1)` แล้วเทียบสัดส่วน ได้ p50 = 44.40 ms และปรับคำอธิบายวิธีคิดให้ระบุชัดว่าดัชนีเริ่มจาก 0 |
| การยืนยัน | `scripts/verify-site.mjs` กลุ่มที่ 8 ตรวจว่าตัวเลข `44.40` ปรากฏในบทที่ 4 และ `test-calc.mjs` ตรวจค่านี้กับข้อมูลดิบ |
| เอกสารอ้างอิง | https://grafana.com/docs/k6/latest/using-k6/metrics/ |

### 8.3 (เฟสก่อน) บทที่ 4 ลืมโหลด `calc.js` — **แก้แล้ว**

| หัวข้อ | รายละเอียด |
|---|---|
| อาการ | หน้าบทที่ 4 มีสคริปต์ในหน้าเรียก `LTK6.calc.percentile(...)` แต่ไม่มี `<script src="../assets/js/calc.js">` |
| ผลกระทบ | เครื่องคำนวณเปอร์เซ็นไทล์ในหน้าเงียบ ๆ ไม่ทำงาน ไม่มีข้อความแจ้ง ผู้ใช้อาจคิดว่าค่าที่เห็นเป็นค่าที่คำนวณแล้ว |
| วิธีแก้ | เพิ่มแท็ก `<script src="../assets/js/calc.js">` และเพิ่มตัวตรวจอัตโนมัติใน `verify-site.mjs` กลุ่มที่ 7 ที่ไล่ดูทุกหน้าว่า ถ้าสคริปต์ในหน้าเรียกใช้โมดูลใด ต้องโหลดไฟล์โมดูลนั้น |
| การยืนยัน | `verify-site.mjs` รายงาน "ทุกหน้าที่เรียกใช้โมดูล ได้โหลดไฟล์ของโมดูลนั้นครบ (ตรวจ calc, charts, quiz, storage)" |
| เอกสารอ้างอิง | – (เป็นข้อบกพร่องภายใน ไม่เกี่ยวกับเอกสาร k6) |

### 8.4 (เฟสก่อน) ตัวแปร `PATH` ชนกับ `PATH` ของระบบปฏิบัติการ — **แก้แล้ว**

| หัวข้อ | รายละเอียด |
|---|---|
| อาการ | สคริปต์ k6 ตั้งค่าตัวแปรด้วย `__ENV.PATH` เพื่อกำหนดเส้นทางที่ยิง |
| ผลกระทบ | ก่อนหน้านั้นไม่เห็นผล แต่ถ้าเคยตั้ง `PATH` ในเชลล์มาก่อน ค่าจะถูกใช้แทนค่าที่ต้องการโดยไม่แจ้งเตือน และสคริปต์จะยิงไปผิดเส้นทางโดยไม่มีใครรู้ตัว |
| วิธีแก้ | เปลี่ยนชื่อเป็น `TARGET_PATH` ทุกสคริปต์ และใส่คอมเมนต์อธิบายไว้ในไฟล์แล้วว่าเหตุใดจึงห้ามใช้ชื่อ `PATH` |
| การยืนยัน | ทดสอบด้วย `ALLOW_ANY_TARGET` และค่า `TARGET_PATH` แล้วสคริปต์อ่านค่าถูกต้อง |
| เอกสารอ้างอิง | https://grafana.com/docs/k6/latest/using-k6/ (เรื่องสภาพแวดล้อมของสคริปต์ k6) |

---

## 9. ข้อบกพร่องที่พบในรอบก่อน — **แก้ครบแล้วในรอบนี้**

> ทั้ง 4 ข้อได้รับการแก้ไขในรอบนี้ (16 กันยายน 2026) พร้อมหลักฐานจากการรันจริง
> แต่ละข้อด้านล่างคงรายละเอียดเดิมไว้เพื่อให้เห็นว่าอะไรผิด และเพิ่มส่วน
> "สิ่งที่แก้ในรอบนี้" กับ "หลักฐาน" กำกับไว้

| # | เรื่อง | ระดับความรุนแรง | สถานะ |
|---|---|---|---|
| 9.1 | `delayAbortedCheck` ไม่มีอยู่จริงใน k6 + คำอธิบายเชิงความหมายผิด | สูง | **แก้แล้ว** |
| 9.2 | `k6/smoke.js` เปราะ ไม่ผ่านราว 16% ของการรัน | สูง | **แก้แล้ว — รัน 30 ครั้งติดกันผ่าน 30/30** |
| 9.3 | คำว่า `hasil` ตกค้างจากภาษาอื่น | ต่ำ | **แก้แล้ว** |
| 9.4 | `--summary-trend-stats` ไม่ถูกกล่าวถึง | ต่ำ | **แก้แล้ว** |

### 9.1 `delayAbortedCheck` ไม่มีอยู่จริงใน k6 — **แก้แล้ว** (ระดับความรุนแรงเดิม: สูง)

| หัวข้อ | รายละเอียด |
|---|---|
| อาการ | เอกสารและสคริปต์ใช้ตัวเลือกชื่อ `delayAbortedCheck` รวม **13 จุด ใน 9 ไฟล์**:<br>`k6/load.js:64` · `k6/stress.js:53` · `site/examples/load.js:64` · `site/examples/stress.js:53` · `site/lessons/01-tps.html:517` · `site/lessons/04-percentiles.html:499,508` · `site/lessons/05-load-profiles.html:176,185,187,586` · `site/troubleshooting.html:467` · `site/assets/data/metrics.json:256` (รหัส `delay-aborted-check`) |
| หลักฐาน | `k6 v2.2.0` ปฏิเสธชื่อนี้:<br>`level=warning msg="There were unknown fields in the options exported in the script" error="json: unknown field \"delayAbortedCheck\""`<br>แล้ว **เพิกเฉยต่อตัวเลือกนั้นทั้งหมด** — การรันจบปกติโดยไม่มีผลอะไรเกิดขึ้น |
| สาเหตุ | ชื่อที่ถูกต้องคือ `delayAbortEval` และต้องวางเป็น **ฟิลด์ในรูปแบบยาวของ threshold** คู่กับ `abortOnFail: true` ไม่ใช่ตัวเลือกระดับบนของ `options` |
| รูปแบบที่ถูกต้อง | `thresholds: { http_req_duration: [{ threshold: 'p(95)<500', abortOnFail: true, delayAbortEval: '60s' }] }` |
| ข้อผิดพลาดเชิงความหมายซ้อนอยู่ | บทที่ 1 และ 5 สอนว่าเป็นการ "เลื่อนการเริ่มตัดสิน threshold" และ "ทิ้งข้อมูลช่วง ramp-up ออกจากการตัดสิน" ซึ่ง **ไม่จริง** |
| **สิ่งที่แก้ในรอบนี้** | เปลี่ยนชื่อเป็น `delayAbortEval` **ครบทั้ง 13 จุดใน 9 ไฟล์** โดย `k6/load.js` ย้ายตัวเลือกจากระดับบนของ `options` เข้าไปอยู่ในรูปแบบยาวของ threshold (ดู `/api/items` `http_req_duration`) และ `site/examples/*.js` ถูกคัดลอกให้ตรงทุกไบต์ตามที่ `verify-site.mjs` บังคับ<br>เขียนคำอธิบายใหม่ให้ตรงกับพฤติกรรมจริงในบทที่ 1, 4, 5, `troubleshooting.html` และ `metrics.json` (เปลี่ยนรหัสเป็น `delay-abort-eval`) พร้อมเพิ่มหัวข้อใหม่ในบทที่ 5 ว่า**ถ้าต้องการตัดสินเฉพาะช่วงภาวะคงตัวจริง ๆ ต้องทำอย่างไร** (แยก scenario + threshold อ้างแท็ก scenario / รันแยก / ส่งออก CSV มาคิดเอง) พร้อมตัวอย่างที่รันแล้วผ่าน |
| **หลักฐานชุดใหม่** | `docs/evidence/k6-delay-abort-eval.txt` — ประกอบด้วย<br>· `k6 inspect` ของสคริปต์ทั้งห้า: **0 บรรทัดเตือน unknown field**<br>· การตรวจความไว: สคริปต์ที่ยังใช้ชื่อเก่าถูกจับได้จริง<br>· ตัวเลือกที่ k6 แปลงแล้วมีคีย์ `delayAbortEval` และไม่มี `delayAbortedCheck`<br>· การรันจริง 4 กรณี (มี/ไม่มี `abortOnFail` × มี/ไม่มี `delayAbortEval`)<br>· ตัวอย่างการแยก scenario เพื่อตัดสินเฉพาะช่วงภาวะคงตัว (exit 0) |
| **กับดักที่ค้นพบเพิ่มในรอบนี้** | k6 ตรวจชื่อฟิลด์ที่ไม่รู้จัก **เฉพาะระดับบนสุดของ `options`** ถ้าใส่ชื่อผิดไว้ข้างในออบเจกต์ threshold k6 จะเงียบและเพิกเฉยโดยไม่มีบรรทัดเตือนเลย กรณีเดิม `load.js` วางไว้ระดับบนสุดจึงมีบรรทัดเตือน แต่ `stress.js` วางไว้ในออบเจกต์ threshold จึงเงียบมาโดยตลอด **วิธีตรวจที่เชื่อถือได้คือ `k6 inspect`** ซึ่งพิมพ์ตัวเลือกที่ k6 แปลงแล้วออกมา |
| ผลการทดลองที่ใช้เป็นตัวเลขในบทเรียน | · ไม่มี `delayAbortEval` → ถูกตัดจบเมื่อรันได้ **2.0 วินาที** · มี `delayAbortEval '12s'` → ถูกตัดจบเมื่อรันได้ **12.0 วินาที** (เลื่อนจริง)<br>· ไม่มี `delayAbortEval` → รันจนจบ **20.1 วินาที** รายงาน `p(95)=603.32 ms` · มี `delayAbortEval` → รันจนจบ **20.1 วินาที** รายงาน `p(95)=602.49 ms` **เท่ากันในทางปฏิบัติ** ทั้งที่ 10 วินาทีแรกของทั้งสองรันถูกทำให้ตอบช้า 600 ms → **ไม่ได้กรองข้อมูล** |
| เอกสารอ้างอิง | https://grafana.com/docs/k6/latest/using-k6/thresholds/ |

### 9.2 `k6/smoke.js` (และ `load.js`) เปราะ — ไม่ผ่านราว 16% ของการรัน — **แก้แล้ว** (ระดับความรุนแรงเดิม: สูง)

| หัวข้อ | รายละเอียด |
|---|---|
| อาการ | รัน `k6 run k6/smoke.js` แล้วได้ exit code 99 (threshold ไม่ผ่าน) โดยที่ระบบปลายทางไม่ได้มีปัญหาอะไร |
| หลักฐาน | วัดจากการรันจริง **37 ครั้ง พบไม่ผ่าน 6 ครั้ง คิดเป็น 16% (ราว 1 ใน 6 ครั้ง)**<br>· ครั้งที่ไม่ผ่านมี `http_req_duration max` = 533.21, 576.61, 604.48, 549.55 ms และมีครั้งที่ `p(95)` = 512.75 ms<br>· ครั้งที่ผ่านมี `max` อยู่ราว 35–57 ms เป็นส่วนใหญ่<br>รายละเอียดดิบทั้งหมดอยู่ใน `docs/evidence/k6-smoke.txt` |
| สาเหตุ | `smoke.js` ตั้ง `vus: 1, duration: '10s'` และมี `sleep(1)` จึงได้เพียง **ราว 10 รอบ** (30 ข้อตรวจ) ขณะที่ mock server ตั้งใจให้มีหางยาว 3% ที่บวกเพิ่ม 150–570 ms เมื่อมีคำขอใดเกิน 500 ms เพียงตัวเดียว จะทำให้ (1) check "ตอบภายใน 500 ms" ตกไป 1 ข้อ → `checks` = 29/30 = 96.7% ต่ำกว่าเกณฑ์ 99% (2) และอาจทำให้ `p(95)` กระโดดเกิน 500 ms — ทำให้ threshold ล้มได้ทั้งสองข้อพร้อมกัน |
| ผลกระทบ | เป็นข้อร้ายแรงที่สุดในรายการนี้ เพราะบทเรียนสอนให้ "รัน smoke ก่อนทุกครั้ง" และ `DEPLOY.md` แนะนำให้ใช้เป็นตัวกั้นในไปป์ไลน์ ผู้ใช้จะเจอ build แดงเป็นครั้งคราวโดยหาสาเหตุไม่เจอ และอาจเลิกเชื่อถือชุดทดสอบไปเลย |
| วิธีแก้ที่เสนอ (เลือกอย่างใดอย่างหนึ่ง) | 1) เพิ่ม `duration` เป็น `'30s'` และผ่อน check "ตอบภายใน 500 ms" เป็น `< 1500` เพื่อให้สอดคล้องกับหางของ mock server<br>2) หรือแยก mock server ให้ปิดหางยาวในโหมด smoke<br>3) หรือตั้ง `checks: ['rate>0.95']` พร้อมคอมเมนต์อธิบายว่าทำไมต้องผ่อน เพราะจำนวนตัวอย่างน้อย |
| หมายเหตุ | ตัวเลขใน `docs/evidence/k6-smoke.txt` เป็นผลจริงจากการรันครั้งแรก (ล้มเหลว) ไม่ได้เลือกครั้งที่ผ่านมาอ้าง และแนบผลการรันซ้ำไว้ครบ |
| **ผลกระทบต่อ `load.js` — ปัญหาเดียวกัน ไม่ใช่เฉพาะ smoke** | การรัน `load.js` แบบย่อ (`--execution-segment 0:33%`) ก็ไม่ผ่าน threshold ด้วยเหตุเดียวกัน:<br>· `checks` ✗ `rate>0.99` ได้ 98.99% (984/994)<br>· `items_payload_ok` ✗ `rate>0.99` ได้ 97.98% (487/497)<br>· แต่ `http_req_failed` ✓ 0.00% และ `http_req_duration` ✓ p(95)=222.19 ms / p(99)=558.1 ms<br>· `items_list_duration` med = 28.17 ms ซึ่งเร็วกว่าปกติ<br>สาเหตุเดียวกันทั้งหมด: check `ตอบภายใน 500 ms` ตกสำหรับคำขอที่อยู่ในหางยาว<br>จำนวนที่ตก 10 รอบจาก 497 = 2.01% สอดคล้องกับหางยาว 3% ของ mock server<br>รายละเอียดใน `docs/evidence/k6-load-short.txt` |
| **สิ่งที่แก้ในรอบนี้** | **1) แยกบทบาทของ mock server** — `mock-server/server.mjs` ปิดหางยาวเป็นค่าเริ่มต้น (หางยาวเปิดเฉพาะเมื่อตั้ง `TAIL_RATE=0.03` เพื่อสาธิตในบทที่ 4) และเพิ่มพารามิเตอร์ `?delay=N` สำหรับสร้างช่วงอุ่นเครื่องที่ช้าแบบกำหนดได้ พร้อมให้ `GET /health` รายงานค่า `tailRate`<br>**2) เพิ่มจำนวนตัวอย่างของ smoke** — `vus: 2, duration: '20s'` (~40 รอบ = 120 ข้อตรวจ) ทำให้ `p(95)` และ `checks` rate มีความหมาย<br>**3) แยกเพดานของ smoke ออกจาก SLO** — smoke ใช้เพดานสุขภาพ `p(95)<1000` และ check `ตอบภายใต้เพดานสุขภาพ 1000 ms` ส่วนเกณฑ์ SLO 500 ms ยังอยู่ใน `load.js` และ `soak.js`<br>**4) เขียนเหตุผลทั้งหมดไว้ในคอมเมนต์ของสคริปต์** เพื่อไม่ให้ใครแก้กลับ |
| **หลักฐานชุดใหม่** | `docs/evidence/k6-smoke-repeatability.txt` — รัน `k6 run k6/smoke.js` **ซ้ำ 30 ครั้งติดกัน ผ่าน 30/30 (exit 0 ทุกครั้ง)** พร้อมตารางค่า p(95), checks rate, max, med ของทุกครั้ง<br>`docs/evidence/k6-load-full.txt` — การรันโปรไฟล์เต็ม 12 นาที ผ่าน threshold ทั้งห้าข้อ<br>เทียบกับก่อนแก้: 37 ครั้ง ไม่ผ่าน 6 ครั้ง (~16%) ใน `docs/evidence/k6-smoke.txt` |
| เอกสารอ้างอิง | https://grafana.com/docs/k6/latest/using-k6/thresholds/ |

### 9.3 คำว่า `hasil` ตกค้างจากภาษาอื่น — **แก้แล้ว** (ระดับความรุนแรงเดิม: ต่ำ)

| หัวข้อ | รายละเอียด |
|---|---|
| อาการ | ชื่อไฟล์ตัวอย่าง `hasil.csv` (`hasil` เป็นคำในภาษาอินโดนีเซีย แปลว่า "ผลลัพธ์") ปรากฏ 3 จุด: `lessons/03-metrics.html:383,389` และ `assets/js/quiz.js:365` |
| หลักฐาน | `grep -rn "hasil" site/` |
| ผลกระทบ | เป็นเพียงความไม่สม่ำเสมอของภาษาในเอกสารภาษาไทย ไม่ได้ทำให้คำตอบผิด |
| **สิ่งที่แก้ในรอบนี้** | เปลี่ยนเป็น `raw.csv` ครบทั้ง 3 จุด (ให้ตรงกับที่บทที่ 6 ใช้อยู่แล้ว) |
| **การสแกนซ้ำทั้งเว็บ (รอบนี้)** | สแกนสองแบบกับไฟล์ทั้งหมดใน `site/`<br>· **สแกนคำ** ด้วยรายการคำหน้าที่พบบ่อยในภาษาอินโดนีเซีย/มาเลเซีย/เวียดนาม/ฟิลิปปินส์/สเปน/โปรตุเกส กว่า 70 คำ (`hasil`, `dengan`, `untuk`, `yang`, `tidak`, `và`, `của`, `como`, `muito`, `mga`, ฯลฯ) → **ไม่พบคำต่างภาษาเหลืออยู่เลย** ผลลัพธ์ที่ได้มีแต่ผลบวกลวงจากการจับคำอังกฤษในโค้ด (`grafana.com` จับคำ `com`, ตัวแปร `at` ใน `storage.js`)<br>· **สแกนอักขระ** นอกช่วงไทย-ละติน → พบเฉพาะสัญลักษณ์ทางคณิตศาสตร์ที่ตั้งใจใช้ (`⌈` `⌉` สำหรับ ceiling, `²⁰` ในสูตรความน่าจะเป็น, `─│├└` ในแผนผังโฟลเดอร์ของ README) ไม่มีอักขระจากภาษาที่สาม |
| เอกสารอ้างอิง | – |

### 9.4 `--summary-trend-stats` ยังเป็นทางเลือกที่สามที่ไม่ได้กล่าวถึง — **แก้แล้ว** (ระดับความรุนแรงเดิม: ต่ำ)

| หัวข้อ | รายละเอียด |
|---|---|
| อาการ | บทที่ 6 สรุปว่า "p99 ไม่ปรากฏบนหน้าจอสรุปผลโดยค่าเริ่มต้น ต้องตั้ง threshold ที่อ้างถึง หรือส่งออกข้อมูลดิบมาคำนวณเอง" โดยไม่กล่าวถึง `--summary-trend-stats` |
| หลักฐาน | `k6 run --summary-trend-stats="avg,min,med,max,p(90),p(95),p(99)" k6/smoke.js` ทำให้ค่า p99 ปรากฏบนหน้าจอได้โดยไม่ต้องแก้สคริปต์และไม่ต้องส่งออกไฟล์ |
| ผลกระทบ | ผู้อ่านต้องส่งออก CSV โดยไม่จำเป็น ทั้งที่มีวิธีที่เบากว่า |
| **สิ่งที่แก้ในรอบนี้** | เพิ่มหัวข้อ "วิธีที่สาม: ขอให้ k6 แสดง p99 บนหน้าจอ" ในบทที่ 6 (`lessons/06-read-results.html`) พร้อม<br>· คำสั่งจริงและผลลัพธ์จริงจากการรัน (ไม่ใช่ตัวอย่างสมมติ)<br>· ตารางอธิบายความต่างระหว่าง `--summary-trend-stats`, `--summary-export`, `-o csv` และ `-o json` ว่าใครเปลี่ยนอะไร (หน้าจอ / ไฟล์สรุป / ข้อมูลรายคำขอ)<br>· คำเตือนว่า `--summary-trend-stats` มีผลกับ **ทุก** Trend metric ไม่ใช่เฉพาะ `http_req_duration` และไม่เปลี่ยนผลการตัดสิน threshold<br>เพิ่มตารางเทียบแบบเดียวกันใน `RUNBOOK.md` หัวข้อ 3.4 ด้วย |
| **หลักฐานชุดใหม่** | `docs/evidence/k6-summary-trend-stats.txt` — ผลการรันจริงของทั้ง 3 คำสั่ง (`--summary-trend-stats`, `--summary-export`, `-o csv`) บน k6 v2.2.0 พร้อมไฟล์ที่ได้และส่วนหัวของไฟล์ |
| เอกสารอ้างอิง | https://grafana.com/docs/k6/latest/using-k6/metrics/ |

---

## 10. ผลการตรวจสอบอัตโนมัติที่หนุนเนื้อหา

เนื้อหาที่อ้างตัวเลขถูกตรวจด้วยเครื่องทุกครั้งที่รัน:

```bash
node scripts/test-calc.mjs      # 95/95 ผ่าน — ตรวจสูตรและค่ากับข้อมูลดิบ
node scripts/verify-site.mjs    # 50/50 ผ่าน — ตรวจว่าตัวเลขบนหน้าเว็บตรงกับไฟล์ข้อมูล
```

`verify-site.mjs` ตรวจโดยเฉพาะว่า:

- ตัวเลข `1,155`, `93.44`, `105.38`, `54.25` ในบทที่ 1 ตรงกับไฟล์ข้อมูล
- ตัวเลข `44.40`, `54.69`, `65.31`, `74.53`, `466.29`, `584.70`, `54.25` ในบทที่ 4 ตรงกับไฟล์ข้อมูล
- ไฟล์ `latency-samples.json` มี 1,155 ค่า ผลรวม bins = 1,155 และเรียงลำดับแล้ว
- สำเนาสคริปต์ใน `site/examples/` ตรงกับต้นฉบับใน `k6/` ทุกไบต์
- ทุกหน้าที่เรียกใช้โมดูลโหลดไฟล์ของโมดูลนั้นจริง

---

## 11. เอกสารอ้างอิงที่ใช้ในการทบทวนรอบนี้

| หัวข้อ | URL | วันที่ดึง |
|---|---|---|
| รายการ metric และนิยาม `http_req_duration` | https://grafana.com/docs/k6/latest/using-k6/metrics/reference/ | 16 ก.ย. 2026 |
| executor ทั้งหมดและค่าของแต่ละตัว | https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/ | 16 ก.ย. 2026 |
| threshold, `abortOnFail`, `delayAbortEval` | https://grafana.com/docs/k6/latest/using-k6/thresholds/ | 16 ก.ย. 2026 |
| ภาพรวม scenario และแนวคิด open/closed model | https://grafana.com/docs/k6/latest/using-k6/scenarios/ | 16 ก.ย. 2026 |
| ภาพรวม metric และชนิดของ metric | https://grafana.com/docs/k6/latest/using-k6/metrics/ | 16 ก.ย. 2026 |
| การลบ executor `externally-controlled` | https://github.com/grafana/k6/pull/5846 | 16 ก.ย. 2026 |
| ประเด็นที่เกี่ยวข้อง | https://github.com/grafana/k6/issues/5640 | 16 ก.ย. 2026 |

รายการแหล่งอ้างอิงทั้งหมดที่เว็บไซต์ใช้อ้าง พร้อมระบุว่าใช้ในบทไหน อยู่ใน
[`REFERENCES.md`](REFERENCES.md)

---

## 12. การตัดสำนวนในรอบ redesign (16 ก.ย. 2026) — ไม่ได้เปลี่ยนข้อเท็จจริงหรือตัวเลขใด

รอบนี้มีการตัดสำนวนหน้าเนื้อหาลง 26.9% (16,501 → 12,064 คำ) จึงต้องยืนยันว่าการตัดนั้น
**ไม่ได้แตะข้อเท็จจริง ตัวเลข สูตร ตาราง โค้ด หรือเกณฑ์ตัดสินใด ๆ** — เป็นการยืนยันแยกจาก
การทบทวนความถูกต้องตามหัวข้อ 1–11 ข้างบน (ซึ่งยังมีผลเหมือนเดิมทุกข้อ)

### 12.1 สิ่งที่ตัด vs สิ่งที่คงไว้

| ตัดออก | คงไว้ |
|---|---|
| ประโยคเกริ่นที่บอกว่าจะพูดถึงอะไร | ทุกสูตรและการอธิบายว่าสูตรมาจากไหน |
| การย้ำสิ่งที่เพิ่งพูดไปแล้ว | ตัวอย่างคิดเลขทีละขั้นครบทั้ง 3 เคสในบทที่ 1 |
| คำเชื่อมฟุ่มเฟือยและคำกำกับที่ไม่ได้เพิ่มความหมาย | ตารางทุกตัว ทุกแถว ทุกช่อง รวม `<caption>` |
| คำอธิบายซ้ำสองที่ในเรื่องเดียวกัน | บล็อก `.working` ทั้งหมด (14 บล็อก) และ `<pre>`/โค้ดทุกบล็อก |
| ย่อหน้าที่ไม่เพิ่มข้อมูลใหม่ | คำเตือนเรื่องกับดัก และเกณฑ์ตัดสินทุกข้อ |
| | ตัวเลขจริงจากการรันทุกตัว |

### 12.2 หลักฐานว่าไม่มีข้อเท็จจริงหาย

**ก) ด่านโทเคนทางเทคนิค** — `scripts/word-count.mjs` ดึง "โทเคนทางเทคนิค" จากทั้งไฟล์
(ตัวเลขทุกตัวโดยตัดเครื่องหมายคั่นหลักพันออกแล้ว, แฟล็กบรรทัดคำสั่ง `--xxx`,
ชื่อ metric ที่มีขีดล่าง, การอ้างเปอร์เซ็นไทล์อย่าง `p(99)`, โมดูล `k6/xxx`,
พาธไฟล์ `.js/.mjs/.json`) แล้วบังคับว่าเซตของ after ต้องเป็น **superset** ของ before

ผล: **before 440 ค่า → after 440 ค่า ไม่มีค่าใดหายไปเลย** (`docs/evidence/word-count-before-after.txt`)

หมายเหตุ: ในการวัดครั้งแรกพบว่าเลข `58` หายไปหนึ่งค่าจากบทที่ 4
(ข้อความเดิม "5% ของคำขอ หรือประมาณ 58 คำขอจาก 1,155") จึงได้ใส่ข้อเท็จจริงนั้นกลับเข้าไป
ในบล็อกใจความสำคัญของบทนั้นแล้ว — เป็นตัวอย่างว่าด่านนี้จับการสูญหายได้จริง

**ข) ด่านสาระตามเกณฑ์ส่งมอบ** — `scripts/verify-site.mjs` กลุ่มที่ 11 ตรวจว่าหัวข้อเหล่านี้
ยังอยู่ครบ 19 รายการ: สูตร TPS, ตัวอย่าง 3 เคส, คำนวณย้อนกลับหา VU, กฎของ Little,
ข้อผิดพลาดที่พบบ่อย, ตัวเลข 12.36/105.38/54.25/93.44/1,155, แนวคิด VU (วงจรชีวิต/executor/
think time/connection pool/อิ่มตัว/ต้นทุน), แคตตาล็อก metric 16 ชื่อ + `expected_response`,
วิธีคิดเปอร์เซ็นไทล์ทีละขั้น + ฮิสโตแกรม + CDF + ตัวเลข 44.40/54.69/65.31/74.53/466.29/584.70,
ประเภทการทดสอบ 6 แบบ + จุดอิ่มตัว + threshold/abort/`delayAbortEval`,
การอ่าน summary ครบทุกบล็อก (EXECUTION/THRESHOLDS/checks/HTTP/NETWORK) + `--summary-export`,
และคำถามแก้ปัญหา 20 ข้อ

**ค) ด่านตัวเลขที่ผูกกับไฟล์ข้อมูลจริง** — กลุ่มที่ 8 ของ `verify-site.mjs` ยังเทียบตัวเลข
ในบทที่ 1 และบทที่ 4 กับ `site/assets/data/*.json` เหมือนเดิม (ไม่มีไฟล์ข้อมูลใดถูกแก้ในรอบนี้)

**ง) ด่านโครงสร้าง** — เทียบกับสำเนาก่อนแก้ พบว่าจำนวน `<table class="data">`, `.table-wrap`,
`<tr>`, `<td>`, `<caption>`, `.working`, `.callout`, `.steps`, `<pre>`, `.chart-figure`,
`<details class="faq">`, `.faq__symptom` และข้อความ `<h1>/<h2>/<h3>` **เท่าเดิมทุกหน้า**
ส่วนที่เพิ่มขึ้นคือสคริปต์ตั้งธีม (1 ต่อหน้า) และ `<ol>` ของบล็อกใจความสำคัญ (1 ต่อหน้า) เท่านั้น

### 12.3 สิ่งที่ *ไม่ได้* ยืนยันในรอบนี้

- **ไม่ได้ยืนยันเชิงความหมายทีละประโยค** ว่าทุกประโยคที่ตัดไปไม่มีข้อมูล
  — ด่านที่ใช้เป็นการตรวจโทเคนและโครงสร้าง ซึ่งจับการหายของ "ค่า" ได้ แต่จับการหายของ
  "คำอธิบายเชิงเหตุผลที่ไม่ใช่ตัวเลข" ได้ไม่ครบ อย่างไรก็ดี ได้อ่านเทียบทีละหัวข้อ
  ในหน้า `troubleshooting.html` ทั้ง 20 ข้อ (หน้าที่ยุ่งที่สุด) แล้วพบว่าสาระยังครบ
- **ไม่ได้ยืนยันความถูกต้องทางเทคนิคใหม่** — หัวข้อ 1–11 ข้างบนมาจากการเทียบเอกสารทางการ
  และการรัน k6 จริงในรอบก่อน การตัดสำนวนรอบนี้ไม่ได้เพิ่มหรือแก้ข้อความเชิงเทคนิค
  จึงไม่ได้ทำให้ผลการทบทวนเดิมเสียไป และไม่ได้ทำให้ข้อสรุปเดิมดีขึ้นด้วย
- **คะแนนความอ่านง่ายยังไม่ได้วัดกับผู้อ่านจริง** — ที่วัดได้คือจำนวนคำที่ลดลงและ
  บล็อกใจความสำคัญที่เพิ่มเข้ามา ไม่ใช่ผลการทดสอบกับผู้ใช้ว่าอ่านเข้าใจเร็วขึ้นจริง
