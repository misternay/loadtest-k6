# DEPLOY.md — ขั้นตอนนำเว็บไซต์ขึ้นโฮสต์ และวิธีย้อนกลับ

เอกสารนี้ครอบคลุมการ deploy เว็บไซต์ `site/` แบบ **static ล้วน**
รวมถึงค่าที่ต้องตั้ง วิธีอัปเดตบทเรียนในอนาคต และ **ขั้นตอน rollback แบบทีละขั้น**

> **ขอบเขต:** เอกสารนี้ครอบคลุมเฉพาะเว็บไซต์บทเรียน (`site/`) เท่านั้น
> ไม่ครอบคลุม `mock-server/`, `k6/`, `scripts/` และ `docs/` ซึ่งเป็นเครื่องมือ
> สำหรับพัฒนาและตรวจสอบ ไม่ต้องอัปโหลดขึ้นโฮสต์

---

## 1. สิ่งที่ต้องอัปโหลด

อัปโหลด **เนื้อหาทั้งหมดใน `site/`** โดยรักษาโครงสร้างโฟลเดอร์ไว้ให้ครบ
ห้ามอัปโหลดเฉพาะไฟล์ HTML เพราะหน้าต่าง ๆ พึ่งพาไฟล์ต่อไปนี้

| อัปโหลด | จำนวนไฟล์ | ถ้าลืมจะเกิดอะไร |
|---|---|---|
| `site/` ทุกไฟล์ `.html` | 14 | – |
| `site/assets/css/main.css` | 1 | หน้าเว็บไม่มีสไตล์เลย |
| `site/assets/js/*.js` | 5 | เมนูไม่ขึ้น กราฟไม่วาด แบบทดสอบใช้ไม่ได้ |
| `site/assets/data/*.json` | 2 | ตาราง metric, ฮิสโตแกรม, CDF, อภิธานศัพท์ว่างเปล่า |
| `site/favicon.svg` | 1 | เบราว์เซอร์ยิงขอ `/favicon.ico` แล้วได้ 404 (กลับไปเป็นปัญหาเดิม) |
| `site/examples/*.js` | 5 | ปุ่มดาวน์โหลดสคริปต์ในหน้า `examples.html` เสีย |

รายการไฟล์ทั้งหมด **28 ไฟล์** (ตรวจด้วย `find site -type f | wc -l`):

```
site/
├── favicon.svg
├── index.html
├── quiz.html
├── progress.html
├── glossary.html
├── troubleshooting.html
├── examples.html
├── lessons/01-tps.html … 06-read-results.html   (6 ไฟล์)
├── tools/calculator.html, tools/latency.html     (2 ไฟล์)
├── examples/smoke.js, load.js, stress.js, spike.js, soak.js   (5 ไฟล์)
└── assets/
    ├── css/main.css
    ├── js/{site,storage,calc,quiz,charts}.js     (5 ไฟล์)
    └── data/{metrics,latency-samples}.json       (2 ไฟล์)
```

**ไม่ต้องอัปโหลด:** `docs/`, `k6/`, `mock-server/`, `scripts/`, `README.md`
(ทั้งหมดนี้เป็นเอกสารและเครื่องมือภายใน)

---

## 2. ค่าที่ต้องตั้ง

เว็บนี้ใช้ **พาธสัมพัทธ์ทั้งหมด** ไม่มี absolute path ไม่มี CDN
จึง **ไม่ต้องตั้ง base path** ถ้า deploy ที่ root ของโดเมน (`https://example.com/`)

| กรณี | ต้องแก้อะไร |
|---|---|
| Deploy ที่ **root** เช่น `https://example.com/` | ไม่ต้องแก้อะไร |
| Deploy ที่ **subpath** เช่น `https://example.com/loadtest/` | ไม่ต้องแก้อะไร ถ้าอัปโหลดโฟลเดอร์ `site/` ทั้งก้อนลงไปใน subpath นั้น เพราะพาธภายในเป็นสัมพัทธ์ทั้งหมด — ต้องอัปโหลด **ทั้งโฟลเดอร์** ไม่ใช่กระจายไฟล์ |
| ใช้ custom domain บน GitHub Pages | ต้องวางไฟล์ `CNAME` ที่ root ของ branch ที่ deploy (ไม่ใช่ใน `site/`) — เป็นไฟล์ของโฮสต์ ไม่ใช่ของเว็บ |

ค่าอื่นที่ต้องตั้ง:

| ค่า | ตั้งที่ไหน | หมายเหตุ |
|---|---|---|
| Content-Type ของ `.json` | ตั้งอัตโนมัติทุกโฮสต์ที่ระบุ | ต้องเป็น `application/json` ไม่งั้น `fetch()` จะ error |
| Content-Type ของ `.svg` | อัตโนมัติ | ต้องเป็น `image/svg+xml` ไม่งั้น favicon ไม่แสดง |
| HTTPS | เปิดใช้ | เปิดได้เลย ไม่มีอะไรขัด |
| Redirect `http` → `https` | เปิดใช้ | – |
| Caching | `assets/` ตั้ง cache ยาวได้ แต่ `.html` ควร cache สั้น | เพราะการอัปเดตบทเรียนแก้ที่ `.html` เป็นหลัก |
| Build step | **ไม่มี** | ไม่มี npm build ไม่มี bundler อัปโหลดไฟล์ดิบได้เลย |

---

## 3. ขั้นตอน deploy แยกตามโฮสต์

### 3.1 GitHub Pages

```bash
# ในโฟลเดอร์ loadtest-k6/
git init                      # ถ้ายังไม่มี repo
git add site
git commit -m "chore: deploy site"

# ใช้วิธี push โฟลเดอร์ site/ ขึ้น branch gh-pages
git subtree push --prefix site origin gh-pages
```

หรือตั้งค่าในหน้า repository: **Settings → Pages → Source** แล้วเลือกโฟลเดอร์
`/docs` หรือ branch `gh-pages` ให้ชี้ไปที่เนื้อหาใน `site/`

> ถ้าเลือกใช้โฟลเดอร์ `/docs` ของ GitHub Pages จะชนกับโฟลเดอร์ `docs/` ของโปรเจกต์นี้
> ซึ่งเป็นเอกสารภายในไม่ใช่เว็บไซต์ **ให้ใช้ branch `gh-pages` แทน**

### 3.2 Netlify

```bash
npx --yes netlify-cli deploy --dir=site --prod
```

หรือตั้งในไฟล์ `netlify.toml` ที่ root ของโปรเจกต์:

```toml
[build]
  publish = "site"
```

### 3.3 Cloudflare Pages

```bash
npx --yes wrangler pages deploy site --project-name=loadtest-k6
```

หรือผ่านหน้าเว็บ: **Build output directory** = `site`, **Build command** = เว้นว่าง

### 3.4 Function Compute (หรือ static hosting อื่นที่มี object storage)

1. อัปโหลดเนื้อหาใน `site/` ขึ้น bucket โดยรักษาโครงสร้างโฟลเดอร์
2. ตั้ง index document = `index.html`
3. ตั้ง error document = `index.html` (หรือปล่อยเป็น 404 ตามปกติก็ได้ เพราะไม่มี client-side routing)
4. ตรวจว่า object ที่ลงท้าย `.json` ได้ `Content-Type: application/json` —
   **ข้อนี้พลาดบ่อยที่สุดบน object storage** เพราะบางเจ้าเดา MIME จากนามสกุลไม่ได้
   แล้วคืน `application/octet-stream` ทำให้ `fetch().json()` ล้มเหลว
5. ถ้าเปิด CDN ให้ purge cache หลังอัปโหลดทุกครั้ง

---

## 4. วิธีอัปเดตบทเรียนในอนาคต

### 4.1 ไฟล์ไหนเก็บอะไร

| อยากแก้ | ไปแก้ที่ | ต้องทำอะไรต่อ |
|---|---|---|
| ข้อความ/คำอธิบายในบทเรียน | `site/lessons/*.html` | รัน `verify-site.mjs` |
| คำนิยาม metric หรือศัพท์ | `site/assets/data/metrics.json` | รัน `verify-site.mjs` และตรวจ `glossary.html` + `lessons/03-metrics.html` |
| ข้อมูล latency ตัวอย่าง | `site/assets/data/latency-samples.json` | **ต้องแก้ตัวเลขในบทที่ 1, 3, 4 ให้ตรงด้วย** แล้วรัน `test-calc.mjs` + `verify-site.mjs` |
| สูตรคำนวณในเครื่องคำนวณ | `site/assets/js/calc.js` | รัน `test-calc.mjs` + `verify-site.mjs` |
| สไตล์ | `site/assets/css/main.css` | รัน `verify-site.mjs` + `browser-check.mjs` |
| คำถามแบบทดสอบ | `site/assets/js/quiz.js` | รัน `verify-site.mjs` (ตรวจว่ามี 6 ชุด และอย่างน้อย 30 ข้อ) |
| สคริปต์ k6 | `k6/*.js` | **คัดลอกไป `site/examples/` ด้วย** ไม่งั้นตัวตรวจจะไม่ผ่าน |
| ไอคอนเว็บ | `site/favicon.svg` | รัน `browser-check.mjs` (ต้องได้ 200 ทุกหน้า) |

> **`site/examples/*.js` ต้องเหมือน `k6/*.js` ทุกไบต์** มีตัวตรวจคอยเทียบอยู่
> ถ้าแก้ไฟล์เดียวจะไม่ผ่านทันที คำสั่งคัดลอก:
> ```bash
> cp k6/*.js site/examples/
> ```

### 4.2 ตัวตรวจที่ต้องรันก่อน deploy ทุกครั้ง

```bash
cd loadtest-k6

node scripts/test-calc.mjs       # ต้องผ่าน 95/95
node scripts/verify-site.mjs     # ต้องผ่าน 50/50
node scripts/browser-check.mjs   # ต้องผ่าน 84/84 (ทั้งสองธีม)
```

ทั้งสามตัวคืน **exit code 0 เมื่อผ่าน** และ **ไม่ใช่ 0 เมื่อมีปัญหา**
จึงใช้กั้นในไปป์ไลน์ได้ตรง ๆ:

```bash
node scripts/test-calc.mjs && \
node scripts/verify-site.mjs && \
node scripts/browser-check.mjs && \
echo "พร้อม deploy" || echo "ยังไม่พร้อม — ห้าม deploy"
```

**ถ้าตัวใดตัวหนึ่งไม่ผ่าน ให้หยุดและแก้ก่อน ห้าม deploy**

---

## 5. Rollback แบบทีละขั้น

หลักการคือ **เก็บสำเนาเวอร์ชันที่กำลังใช้งานอยู่ให้ได้ก่อนทุกครั้งที่อัปเดต**
แล้วการ rollback จะกลายเป็นการอัปโหลดสำเนานั้นกลับไป ซึ่งทำได้เสมอไม่ว่าจะมี git หรือไม่

### 5.1 หลักการทั่วไป (ทำก่อน deploy ทุกครั้ง)

```bash
cd loadtest-k6

# 1) บันทึกสำเนาเวอร์ชันปัจจุบันพร้อมวันเวลา
STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p ../_backups
cp -a site "../_backups/site-$STAMP"

# 2) บันทึกว่าอะไรเปลี่ยนไปจากเดิม
diff -rq "../_backups/site-$STAMP" site > "../_backups/diff-$STAMP.txt" || true

# 3) เก็บค่า hash ของทุกไฟล์ไว้เทียบ
( cd site && find . -type f | sort | xargs shasum ) > "../_backups/site-$STAMP.sha256"
```

`_backups/` อยู่นอกโปรเจกต์เพื่อไม่ให้ปนกับไฟล์ที่ deploy

---

### 5.2 กรณีที่ใช้ git

**ขั้นที่ 1 — หา commit ที่ต้องการกลับไป**

```bash
cd loadtest-k6
git log --oneline -20 -- site
```

**ขั้นที่ 2 — ตรวจว่า commit นั้นคือเวอร์ชันที่ดีจริง** (สร้าง worktree แยก ไม่แตะของจริง)

```bash
git worktree add /tmp/rollback-check <COMMIT_SHA>
cd /tmp/rollback-check
node scripts/test-calc.mjs && node scripts/verify-site.mjs && node scripts/browser-check.mjs
echo "exit=$?"      # ต้องได้ 0
```

**ขั้นที่ 3 — ย้อนกลับ**

วิธี ก. ย้อนด้วย commit ใหม่ (ปลอดภัยกว่า ไม่เขียนประวัติทับ):

```bash
cd loadtest-k6
git revert --no-commit <COMMIT_SHA>..HEAD
git commit -m "revert: ย้อนเว็บไซต์กลับไปที่ <COMMIT_SHA>"
git push origin <BRANCH>
```

วิธี ข. ย้อนแบบบังคับ (ใช้เมื่อต้องการให้ประวัติสะอาด และไม่มีใครดึง branch นี้ไปใช้):

```bash
cd loadtest-k6
git checkout <BRANCH>
git reset --hard <COMMIT_SHA>
git push --force-with-lease origin <BRANCH>
```

**ขั้นที่ 4 — ตรวจหลัง rollback**

```bash
cd /tmp/rollback-check     # หรือ cd loadtest-k6 ถ้าใช้วิธี revert
node scripts/verify-site.mjs && node scripts/browser-check.mjs
echo "exit=$?"
```

**ขั้นที่ 5 — ล้าง worktree ที่ใช้ตรวจ**

```bash
git worktree remove /tmp/rollback-check
```

---

### 5.3 กรณีที่ไม่มี git — ใช้สำเนาที่เก็บไว้

**ขั้นที่ 1 — เลือกสำเนาที่จะย้อนกลับไป**

```bash
ls -1dt ../_backups/site-*        # เรียงจากใหม่ไปเก่า
```

**ขั้นที่ 2 — ตรวจสำเนาก่อนใช้** (สำคัญ: สำเนาอาจไม่ครบ)

```bash
cd ../_backups/site-20260916-143000
# เทียบกับ hash ที่บันทึกไว้ตอนเก็บสำเนา
( cd . && find . -type f | sort | xargs shasum ) | diff - ../_backups/site-20260916-143000.sha256 \
  && echo "สำเนาครบถ้วน" || echo "สำเนาไม่ครบ — ห้ามใช้ ลองตัวถัดไป"
```

**ขั้นที่ 3 — ทดสอบสำเนาก่อนอัปโหลด**

สำเนาไม่มี `scripts/` อยู่ข้างใน (เพราะเก็บเฉพาะ `site/`) จึงต้องตรวจด้วยวิธีนี้:

```bash
cd ../_backups/site-20260916-143000

# เสิร์ฟสำเนาผ่าน HTTP แล้วเปิดดูด้วยตา (ห้ามเปิดด้วย file:// เพราะหน้าดึง JSON)
node -e "const h=require('node:http'),f=require('node:fs'),p=require('node:path');h.createServer((q,s)=>{let u=decodeURIComponent(new URL(q.url,'http://x').pathname);let t=p.join('.',u==='/'?'index.html':u.slice(1));if(!f.existsSync(t)||f.statSync(t).isDirectory()){s.writeHead(404).end('404');return}s.writeHead(200);s.end(f.readFileSync(t))}).listen(8001,()=>console.log('http://localhost:8001'))"
```

เปิด <http://localhost:8001> แล้วตรวจว่า `lessons/03-metrics.html` มีตาราง และ
`tools/latency.html` มีกราฟ

ถ้าต้องการตรวจด้วยเครื่องแบบเต็มรูปแบบ ให้คัดลอกสำเนาทับ `site/` **ในสำเนาของโปรเจกต์**
แล้วรันตัวตรวจ (อย่าทับ `site/` ตัวจริงจนกว่าจะตัดสินใจย้อนจริง):

```bash
rm -rf /tmp/rollback-proj && cp -a /path/to/loadtest-k6 /tmp/rollback-proj
rm -rf /tmp/rollback-proj/site
cp -a ../_backups/site-20260916-143000 /tmp/rollback-proj/site
cd /tmp/rollback-proj
node scripts/test-calc.mjs && node scripts/verify-site.mjs && node scripts/browser-check.mjs
echo "exit=$?"      # ต้องได้ 0
```

**ขั้นที่ 4 — อัปโหลดสำเนากลับขึ้นโฮสต์**

```bash
cd ../_backups/site-20260916-143000

# ตัวอย่าง Netlify
npx --yes netlify-cli deploy --dir=. --prod

# ตัวอย่าง Cloudflare Pages
npx --yes wrangler pages deploy . --project-name=loadtest-k6

# ตัวอย่าง GitHub Pages — ทำจาก repo ไม่ใช่จากสำเนา
#   ใช้ git revert/reset ตามหัวข้อ 5.2 แทน แล้วจึง push
```

**ขั้นที่ 5 — อัปเดต cache**

หลังอัปโหลดให้ purge cache ที่ CDN ทันที ไม่งั้นผู้ใช้ยังได้ไฟล์เก่า
(Netlify และ Cloudflare Pages ทำอัตโนมัติเมื่อ deploy; GitHub Pages ใช้เวลา 1–2 นาที)

**ขั้นที่ 6 — ตรวจหลัง rollback ด้วยตา 4 ข้อ**

เปิดเว็บไซต์จริงแล้วตรวจ:

1. เปิดหน้าแรกได้ และไอคอนบนแท็บขึ้น (ไม่ใช่ไอคอนโลก)
2. เปิด DevTools → Console ต้องไม่มี error สีแดง
3. เปิด `lessons/03-metrics.html` ตาราง metric ต้องมีข้อมูล (ไม่ว่าง) —
   ถ้าว่างแปลว่าไฟล์ JSON ไม่ถูกอัปโหลดกลับไป
4. เปิด `tools/latency.html` กราฟต้องวาด

> **ข้อจำกัดที่ต้องรู้:** `scripts/browser-check.mjs` ตอนนี้เสิร์ฟจาก `site/` ในเครื่อง
> และยังไม่รองรับการตรวจ URL ปลายทางจริง จึงใช้ยืนยัน **สำเนาที่จะอัปโหลด** ได้
> (ตามขั้นที่ 3) แต่ใช้ยืนยันไซต์จริงบนอินเทอร์เน็ตไม่ได้
> การยืนยันไซต์จริงให้ใช้ 4 ข้อด้วยตาข้างต้น

**ขั้นที่ 7 — บันทึกเหตุการณ์**

```bash
cd /path/to/loadtest-k6
echo "$(date -Iseconds) rollback กลับไป site-20260916-143000 เหตุผล: <ระบุ>" >> docs/evidence/rollback-log.txt
```

---

## 6. Checklist ก่อน deploy

คัดลอกแล้วไล่ทีละข้อ ต้องได้ทุกข้อจึง deploy

```
[ ] 1.  k6 version ตรงกับที่บทเรียนอ้างอิง (v2.2.0) หรือสูงกว่า
[ ] 2.  node scripts/test-calc.mjs      → ผ่าน 95/95, exit 0
[ ] 3.  node scripts/verify-site.mjs    → ผ่าน 50/50, exit 0
[ ] 4.  node scripts/browser-check.mjs  → ผ่าน 84/84, exit 0
[ ] 5.  site/examples/*.js เหมือน k6/*.js ทุกไบต์ (ตัวตรวจข้อ 3 ครอบไว้แล้ว)
        แก้ k6/*.js เมื่อไหร่ต้อง cp ไป site/examples/ ด้วย
[ ] 6.  k6 inspect ของสคริปต์ทั้งห้าไม่มีฟิลด์ที่ไม่รู้จัก
        for f in smoke load stress spike soak; do k6 inspect k6/$f.js 2>&1 | grep -i 'unknown field'; done
        (ต้องไม่มีผลลัพธ์ — k6 ไม่เตือนเมื่อชื่อฟิลด์ผิดอยู่ข้างในออบเจกต์ threshold)
[ ] 7.  ไม่มีไฟล์ที่ยังไม่ได้แก้ว่างค้างอยู่ (เช่น backup, *.orig, *.bak)
[ ] 8.  เปิดเว็บในเครื่องแล้วไล่ดูด้วยตา โดยเฉพาะหน้าที่แก้ล่าสุด
        (lessons/01, 04, 05, 06, troubleshooting, glossary) และตรวจว่าลิงก์ท้ายเว็บ
        ชี้ไป metrics/reference/ และ scenarios/ ครบ
[ ] 9.  เปิด DevTools ดู Network ว่าลิงก์ภายนอกไม่ถูกโหลดเป็น asset
        (เว็บนี้ต้องไม่โหลด CSS/JS/รูป จากภายนอกเลย)
[ ] 10. เก็บสำเนาเวอร์ชันปัจจุบันลง _backups/ แล้ว (หัวข้อ 5.1)
[ ] 11. เขียน hash ของสำเนาไว้เทียบแล้ว (หัวข้อ 5.1)
[ ] 12. ทดสอบที่ความกว้าง 360 px ด้วย DevTools → ไม่มี scroll แนวนอน
[ ] 13. ยืนยันว่า favicon.svg ถูกอัปโหลดไปด้วย (ไม่ใช่ .ico)
[ ] 14. รู้วิธี rollback และมีสำเนาที่พร้อมใช้ (หัวข้อ 5.2 หรือ 5.3)
[ ] 15. แจ้งผู้ที่เกี่ยวข้องว่าจะมีการอัปเดต (ถ้ามีผู้ใช้จริง)
```

> **หมายเหตุ:** การ deploy เว็บไซต์ **ไม่ต้องใช้ mock server และไม่ต้องใช้ k6**
> ข้อ 6 ใช้เฉพาะตอนที่แก้สคริปต์ k6 ซึ่งอยู่ในรีโปเดียวกันแต่ไม่ได้ขึ้นโฮสต์
> (โฮสต์อัปโหลดเฉพาะ `site/`)

---

## 7. อาการที่พบบ่อยหลัง deploy และวิธีแก้

| อาการ | สาเหตุที่พบบ่อย | วิธีแก้ |
|---|---|---|
| หน้าเว็บไม่มีสไตล์เลย | `assets/css/` ไม่ได้อัปโหลด หรืออัปโหลดผิดระดับชั้น | อัปโหลดทั้งโฟลเดอร์ `site/` ไม่ใช่กระจายไฟล์ |
| เปิดหน้าแรกได้ หน้าใน `lessons/` พัง | อัปโหลดไม่ครบ หรือไม่ได้รักษาโครงสร้างโฟลเดอร์ | ตรวจว่ามี `site/lessons/` เป็นโฟลเดอร์จริง |
| ตารางและกราฟว่างเปล่า | `assets/data/*.json` หาย หรือ Content-Type ไม่ใช่ `application/json` | ดู Network tab ว่าไฟล์โหลดได้ 200 ไหม |
| มี console error `Failed to fetch` | เหมือนข้อบน หรือเปิดด้วย `file://` | ต้องเสิร์ฟผ่าน HTTP เท่านั้น |
| เบราว์เซอร์ขอ `/favicon.ico` แล้ว 404 | `favicon.svg` ไม่ถูกอัปโหลด หรือ `<link rel="icon">` หายไป | อัปโหลด `site/favicon.svg` แล้ว hard refresh |
| เห็นเวอร์ชันเก่าหลังอัปเดต | cache ของ CDN หรือเบราว์เซอร์ | purge cache แล้ว hard refresh (Cmd+Shift+R) |
| หน้าไทยเป็นตัวยึกยือ | ไม่ได้ตั้ง `charset=utf-8` ที่ระดับเซิร์ฟเวอร์ | หน้าทุกหน้ามี `<meta charset="utf-8">` อยู่แล้ว ให้ตรวจว่าเซิร์ฟเวอร์ไม่ได้ส่ง charset อื่นทับ |

---

## 8. สิ่งที่ยังไม่ได้ทำ

- ยังไม่มีไฟล์ configuration สำหรับ CI/CD (`.github/workflows/`) — ขั้นตอนในเอกสารนี้เป็นแบบทำมือ
- `browser-check.mjs` ยังตรวจได้เฉพาะเว็บที่เสิร์ฟจาก `site/` ในเครื่อง ยังไม่รองรับการตรวจ URL ปลายทางจริง
- ยังไม่ได้ตั้ง redirect จาก `/favicon.ico` ไป `/favicon.svg` ที่ระดับเซิร์ฟเวอร์
  (ไม่จำเป็นถ้าอัปโหลด `favicon.svg` ครบ เพราะหน้าเว็บประกาศไอคอนไว้แล้ว)
- **ยังไม่ได้รัน axe หรือ Lighthouse** กับเว็บไซต์นี้ จึงยังไม่มีการยืนยันเรื่อง
  WCAG 2.2 AA, ลำดับ heading, การใช้คีย์บอร์ดล้วน และ Core Web Vitals
  (ดู `HANDOFF.md` หัวข้อ 5.4) — อย่ากล่าวอ้างเรื่อง accessibility หรือ performance
  เกินกว่าที่ตัวตรวจที่มีอยู่ยืนยันได้
- ลิงก์ภายนอกในเว็บยังไม่เคยถูกตรวจว่ายังเปิดได้จริงด้วยเครื่อง
  (ตอนนี้ `verify-site.mjs` ตรวจแค่ว่าชี้ไปโดเมนของ k6 เท่านั้น
  วิธีตรวจด้วยมืออยู่ใน `REFERENCES.md` หัวข้อ 7)


---

## การ deploy ขึ้น GitHub Pages (เพิ่มเมื่อ 16 กันยายน 2026)

เว็บนี้ถูก deploy ขึ้น GitHub Pages เรียบร้อยแล้ว

| รายการ | ค่า |
|---|---|
| GitHub repo | https://github.com/misternay/loadtest-k6 (public) |
| หน้าเว็บ (GitHub Pages) | https://misternay.github.io/loadtest-k6/ |
| สาขา / โฟลเดอร์ที่เผยแพร่ | `main` · path `/` (ราก repo) |
| ไฟล์กำกับ | `.nojekyll` ที่ราก repo (ปิดการประมวลผลด้วย Jekyll) |

### โครงสร้าง repo ที่เผยแพร่

โฟลเดอร์ `site/` ในเครื่องถูกยกเนื้อหาขึ้นเป็น **รากของ repo** เพื่อให้ Pages เสิร์ฟได้ทันที
ส่วนไฟล์ประกอบอยู่ในโฟลเดอร์ย่อย:

```text
/                     ← เนื้อหาเว็บทั้งหมด (index.html, lessons/, tools/, assets/, examples/, favicon.svg)
/k6/                  ← สคริปต์ k6 ต้นฉบับ
/mock-server/         ← ปลายทางจำลองสำหรับฝึก
/scripts/             ← ชุดตรวจอัตโนมัติ (test-calc, verify-site, browser-check, word-count)
/docs/                ← เอกสารส่งมอบและหลักฐาน
/README.md, /serve.mjs
```

ลิงก์ภายในเว็บเป็นพาธสัมพันธ์ทั้งหมด จึงทำงานได้ทั้งที่รากโดเมนและใต้พาธย่อย `/loadtest-k6/`

### วิธีอัปเดตบทเรียนในอนาคต

1. แก้ไฟล์ในโฟลเดอร์ `site/` ของโปรเจกต์ในเครื่อง (ดูหัวข้อ 4 ด้านบน)
2. รันชุดตรวจให้ผ่านก่อนทุกครั้ง

```bash
node scripts/verify-site.mjs
node scripts/browser-check.mjs
node scripts/word-count.mjs --check
```

3. คัดลอกเนื้อหา `site/` ไปทับราก repo แล้ว commit + push ขึ้นสาขา `main`

```bash
cp -R site/. <โฟลเดอร์ repo>/
cd <โฟลเดอร์ repo>
git add -A && git commit -m "ปรับปรุงบทเรียน: <สรุป>" && git push origin main
```

4. GitHub Pages จะ build ใหม่ภายในราว 1 นาที ตรวจสถานะได้ด้วย `gh api repos/misternay/loadtest-k6/pages --jq .status`

### วิธี rollback GitHub Pages

**กรณีต้องการย้อนทั้งเว็บ** — ย้อน commit แล้ว push

```bash
git revert <commit ที่ต้องการย้อน> --no-edit
git push origin main
```

**กรณีต้องการย้อนเร็วกว่าการแก้ไฟล์** — checkout ไฟล์จาก commit เก่าแล้ว push

```bash
git checkout <commit เก่า> -- .
git commit -m "ย้อนเว็บกลับเวอร์ชัน <commit เก่า>"
git push origin main
```

**กรณีฉุกเฉิน (เว็บพัง ต้องหยุดให้บริการทันที)** — ปิด Pages ชั่วคราวได้ที่
`Settings → Pages → Source: None` แล้วเปิดกลับเมื่อแก้เสร็จ

หลัง push ทุกครั้ง ให้รอสถานะ `built` แล้วเปิด https://misternay.github.io/loadtest-k6/ ตรวจอีกครั้งว่าไม่มี console error และไม่ล้นแนวนอนที่ความกว้าง 360px
