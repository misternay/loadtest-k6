/* ==========================================================================
   quiz.js — คลังคำถาม 6 ชุด (ตรงกับบทเรียนบทที่ 1–6) และตัวรันแบบทดสอบ
   - ทุกข้อมีเฉลยและคำอธิบาย
   - บันทึกคะแนนที่ดีที่สุดต่อบทลง localStorage ผ่าน storage.js
   ========================================================================== */
(function () {
  'use strict';

  var ROOT = typeof globalThis !== 'undefined' ? globalThis : this;
  ROOT.LTK6 = ROOT.LTK6 || {};

  var OPTION_KEYS = ['ก', 'ข', 'ค', 'ง'];

  var SETS = [
    {
      id: '01-tps',
      lessonId: '01-tps',
      title: 'บทที่ 1 — คำนวณ TPS / RPS',
      lessonFile: 'lessons/01-tps.html',
      questions: [
        {
          q: 'การรัน k6 ด้วย 10 VU เป็นเวลา 12 วินาที ได้ 1,155 request และใช้เวลารันจริง 12.36 วินาที ค่า TPS (request/s) อยู่ที่ประมาณเท่าไร',
          options: ['115.5 request/s', '93.44 request/s', '12.36 request/s', '1,155 request/s'],
          answer: 1,
          explain: 'TPS = จำนวน request ที่สำเร็จ ÷ เวลาที่ใช้จริง = 1,155 ÷ 12.36 = 93.4 request/s ซึ่งตรงกับที่ k6 รายงานว่า http_reqs: 1,155, 93.44/s ตัวเลข 1,155 คือยอดสะสมทั้งการรัน ไม่ใช่ค่าต่อวินาที'
        },
        {
          q: 'ทำไมการคำนวณ iterations/s จึงต้องใช้ iteration_duration ไม่ใช่ http_req_duration',
          options: [
            'เพราะ iteration_duration เป็น metric ชนิด Counter ส่วน http_req_duration เป็น Trend',
            'เพราะ iteration_duration ครอบคลุมทั้งเวลารอ response และ think time ในรอบนั้น ขณะที่ response time เป็นเพียงส่วนหนึ่งของรอบ',
            'เพราะ http_req_duration วัดได้เฉพาะ request ที่ล้มเหลว',
            'เพราะทั้งสองค่าเท่ากัน แต่ตั้งชื่อต่างกันในแต่ละเวอร์ชันของ k6'
          ],
          answer: 1,
          explain: 'การรันของเราได้ iteration_duration เฉลี่ย 105.38 ms และ http_req_duration เฉลี่ย 54.25 ms ส่วนต่างคือ think time (sleep 50 ms) บวก overhead ถ้าใช้แค่ response time จะได้ 10 ÷ 0.05425 = 184 iterations/s ซึ่งสูงเกินจริงราวสองเท่า เมื่อเทียบกับค่าที่ k6 รายงานที่ 93.44/s'
        },
        {
          q: 'กำหนด N = 10 VUs, R = 1 request ต่อ iteration, Rt = 100 ms, Tt = 200 ms ค่า TPS เท่ากับเท่าไร',
          options: ['50 TPS', '100 TPS', '33.3 TPS', '25 TPS'],
          answer: 2,
          explain: 'iteration_duration = (R × Rt) + Tt = (1 × 100) + 200 = 300 ms → iterations/s = 10 ÷ 0.300 = 33.33 → TPS = 33.33 × 1 = 33.3 TPS สังเกตว่า think time 200 ms ทำให้ throughput ลดลงสามเท่าเมื่อเทียบกับกรณีไม่มี think time'
        },
        {
          q: 'ต้องการ 500 RPS โดยให้แต่ละ iteration ยิง 1 request เวลาตอบสนองเฉลี่ย 50 ms และ think time 150 ms ต้องใช้ VU ประมาณกี่ตัว',
          options: ['25 VUs', '50 VUs', '100 VUs', '150 VUs'],
          answer: 2,
          explain: 'iteration_duration = 50 + 150 = 200 ms → 1 VU ทำได้ 1000 ÷ 200 = 5 request/s → ต้องใช้ 500 ÷ 5 = 100 VUs ถ้าลืม think time แล้วคิดจาก 50 ms จะได้เพียง 25 VUs ซึ่งจะสร้างโหลดได้ไม่ถึงครึ่งของเป้าหมาย'
        },
        {
          q: 'จากกฎของ Little ถ้าวัด throughput ได้ 93.44 request/s และเวลาตอบสนองเฉลี่ย 54.25 ms มี request ลอยอยู่ในระบบพร้อมกันประมาณเท่าไร',
          options: ['ประมาณ 5.07 request', 'ประมาณ 10 request', 'ประมาณ 50.7 request', 'ประมาณ 1.72 request'],
          answer: 0,
          explain: 'N = อัตราการเกิดงาน × เวลาที่งานนั้นกินอยู่ = 93.44 × 0.05425 = 5.07 request เท่านั้น ส่วนที่เหลือจาก 10 VU อีกประมาณ 4.9 ตัวหมดไปกับการนอนรอ (think time) นี่คือเหตุผลที่จำนวน VU ไม่เท่ากับจำนวนงานที่ทำพร้อมกันจริง'
        },
        {
          q: 'การกระทำใดทำให้ตัวเลข TPS ที่คำนวณได้ "สูงเกินความจริง" มากที่สุด',
          options: [
            'ไม่นำ think time มารวมในเวลาต่อรอบ',
            'ตั้ง threshold ไว้บน p(95) แทนค่าเฉลี่ย',
            'เพิ่มจำนวน VU จาก 5 เป็น 10 ตัว',
            'ส่งออกผลลัพธ์เป็นไฟล์ JSON แทนการอ่านบนหน้าจอ'
          ],
          answer: 0,
          explain: 'การรันจริงของเราให้ 10 ÷ 0.05425 = 184 iterations/s ถ้าใช้แค่ response time สูงเกินจริงประมาณสองเท่า เพราะ VU ไม่ได้ยิง request ตลอดเวลา มันใช้เวลาส่วนหนึ่งไปกับ think time ส่วนข้ออื่นไม่ทำให้ตัวเลขเพี้ยนในลักษณะนี้'
        }
      ]
    },
    {
      id: '02-vu',
      lessonId: '02-vu',
      title: 'บทที่ 2 — VU ทำงานอย่างไร',
      lessonFile: 'lessons/02-vu.html',
      questions: [
        {
          q: 'ข้อใดอธิบาย VU ของ k6 ได้ถูกต้องที่สุด',
          options: [
            'เป็นเบราว์เซอร์จำลองที่ render HTML และ CSS เหมือน Chrome',
            'เป็น HTTP client ที่มี JS runtime ของตัวเอง และไม่รัน JavaScript ของหน้าเว็บ',
            'เป็นหนึ่งเธรดของระบบปฏิบัติการต่อหนึ่ง VU',
            'เป็นหนึ่งโปรเซสแยกกันต่อหนึ่ง VU'
          ],
          answer: 1,
          explain: 'VU คือหน่วยทำงานที่ประกอบด้วย goroutine และ JS runtime ของตัวเอง ทำหน้าที่เป็น HTTP client ที่ reuse TCP connection โดยไม่ render หน้าเว็บและไม่รัน JavaScript ของเว็บที่ถูกทดสอบ จึงเบามากเมื่อเทียบกับเบราว์เซอร์จริง'
        },
        {
          q: 'โค้ดที่เขียนไว้นอกฟังก์ชัน default() หรือในบริบท init รันกี่ครั้ง',
          options: [
            'หนึ่งครั้งต่อ VU หนึ่งตัว',
            'หนึ่งครั้งต่อ iteration',
            'หนึ่งครั้งต่อ request',
            'หนึ่งครั้งต่อการรัน k6 ทั้งหมด โดยไม่ผูกกับ VU'
          ],
          answer: 0,
          explain: 'บริบท init รันหนึ่งครั้งต่อ VU ใช้เตรียมข้อมูลคงที่ เช่น อ่านไฟล์หรือสร้างชุดข้อมูลทดสอบ ตัวแปรที่สร้างใน init และตัวแปรที่สร้างใหม่ใน default() จะแยกกันในแต่ละ VU รวมถึง cookies ก็แยกกันด้วย'
        },
        {
          q: 'executor แบบใดที่ทำให้ "แต่ละ VU ได้ทำงานครบตามจำนวนรอบที่กำหนด"',
          options: ['shared-iterations', 'per-vu-iterations', 'constant-arrival-rate', 'ramping-vus'],
          answer: 1,
          explain: 'per-vu-iterations กำหนดให้แต่ละ VU รันครบตามจำนวนที่ตั้งไว้ จึงได้รอบรวมเท่ากับ VU × iterations ส่วน shared-iterations แชร์โควตารวมกันทุก VU โดย VU ที่เร็วจะทำมากกว่า และ constant-arrival-rate กำหนดตามอัตราการมาถึงของงาน ไม่ได้นับเป็นรอบต่อ VU'
        },
        {
          q: 'ระหว่างที่ VU กำลังรอ response จากเซิร์ฟเวอร์ VU ตัวนั้นทำอะไรได้',
          options: [
            'ไปเริ่ม iteration ใหม่ให้ VU ตัวอื่นแทน',
            'ว่างงาน ทำงานอย่างอื่นไม่ได้เลย',
            'เปิด connection เพิ่มโดยอัตโนมัติ',
            'รันโค้ดใน init ซ้ำเพื่อเตรียมข้อมูลรอบถัดไป'
          ],
          answer: 1,
          explain: 'VU ถูกจองไว้ตลอดช่วงที่รอ response จึงเป็นเหตุผลว่าทำไมเพิ่ม throughput ต้องเพิ่ม VU (หรือเปลี่ยนไปใช้ executor แบบ arrival-rate) และทำไม think time ที่ยาวขึ้นทำให้ TPS ต่อ VU ลดลง'
        },
        {
          q: 'เหตุผลหลักที่ต้องมีช่วง ramp-up ก่อนวัดผลจริงคือข้อใด',
          options: [
            'เพื่อให้ค่า p95 สูงขึ้นและดูน่าตกใจ',
            'เพื่อให้ JIT, cache, connection pool และ DB pool ได้อุ่นเครื่อง และหลีกเลี่ยงภาระกระชากปลอมที่เกิดจากเครื่องทดสอบเอง',
            'เพราะ k6 ไม่รองรับการตั้งจำนวน VU คงที่ตั้งแต่ต้น',
            'เพื่อลดจำนวน request ที่ต้องเก็บข้อมูล'
          ],
          answer: 1,
          explain: 'การเปิด VU เต็มจำนวนทันทีทำให้เกิดภาระกระชากที่ระบบจริงไม่เคยเจอ และช่วงต้นจะได้ค่าที่ไม่เป็นตัวแทน การไต่ขึ้นทีละขั้นยังช่วยให้เห็นจุดที่ระบบเริ่มตอบสนองไม่ทันด้วย'
        },
        {
          q: 'เพิ่มจำนวน VU แล้วค่า TPS ยังเท่าเดิม สาเหตุที่เป็นไปได้มากที่สุดคือข้อใด',
          options: [
            'สคริปต์เขียนผิดแน่นอน',
            'ระบบถึงจุดอิ่มตัวแล้ว คิวเริ่มยาวขึ้น เวลาตอบสนองจึงพุ่งแทนที่ throughput จะเพิ่ม',
            'k6 มีเพดานตายตัวที่ 1,000 request/s',
            'ต้องลบ threshold ออกก่อนจึงจะวัดได้'
          ],
          answer: 1,
          explain: 'หลังจุดอิ่มตัว การเพิ่ม VU จะไปเพิ่มความยาวคิว ทำให้ latency สูงขึ้นโดยที่ throughput แทบไม่ขยับ ตามกฎของ Little เมื่ออัตราคงที่และเวลาต่อรอบเพิ่มขึ้น จำนวนงานที่ลอยอยู่ก็เพิ่มขึ้นแต่ผลผลิตไม่ได้เพิ่ม และเครื่องรัน k6 เองก็อาจกลายเป็นคอขวดได้เช่นกัน จึงควรดู dropped_iterations และ CPU ของเครื่องทดสอบประกอบ'
        }
      ]
    },
    {
      id: '03-metrics',
      lessonId: '03-metrics',
      title: 'บทที่ 3 — แคตตาล็อก metric',
      lessonFile: 'lessons/03-metrics.html',
      questions: [
        {
          q: 'metric ใดในกลุ่มนี้เป็นชนิด Gauge',
          options: ['http_reqs', 'vus', 'http_req_duration', 'http_req_failed'],
          answer: 1,
          explain: 'vus และ vus_max เป็น Gauge คือค่าที่เพิ่มและลดได้ จึงอ่านเป็นค่าขณะใดขณะหนึ่ง ไม่ใช่ผลรวม ส่วน http_reqs และ iterations เป็น Counter, http_req_duration เป็น Trend และ http_req_failed เป็น Rate'
        },
        {
          q: 'sub-metric ใดชี้ปัญหาที่ฝั่งเซิร์ฟเวอร์มากกว่าฝั่งเครือข่ายหรือเครื่องทดสอบ',
          options: ['http_req_blocked', 'http_req_connecting', 'http_req_waiting', 'http_req_sending'],
          answer: 2,
          explain: 'http_req_waiting คือเวลาตั้งแต่ส่ง request ครบจนได้ไบต์แรกของ response หรือ TTFB จึงเป็นเวลาที่เซิร์ฟเวอร์ใช้จริง ในการรันของเรา waiting เฉลี่ย 54.03 ms จาก http_req_duration 54.25 ms คิดเป็น 99.58% แปลว่าเวลาหายไปที่เซิร์ฟเวอร์แทบทั้งหมด ส่วน blocked, connecting และ sending เป็นฝั่งเครื่องทดสอบกับเครือข่าย'
        },
        {
          q: 'เมื่อนำ sending 0.054 ms + waiting 54.02 ms + receiving 0.172 ms มารวมกัน ได้ผลลัพธ์ที่ตรงกับข้อใด',
          options: [
            '54.25 ms ซึ่งตรงกับ http_req_duration เฉลี่ย',
            '54.25 ms ซึ่งตรงกับ iteration_duration เฉลี่ย',
            '105.39 ms ซึ่งตรงกับ http_req_duration เฉลี่ย',
            '0.226 ms ซึ่งตรงกับ http_req_blocked เฉลี่ย'
          ],
          answer: 0,
          explain: 'ผลรวมได้ 54.246 ms เมื่อใช้ค่าที่ปัดแล้ว และได้ 54.2519 ms เมื่อใช้ค่าเต็ม ซึ่งตรงกับ http_req_duration เฉลี่ยที่ k6 รายงานว่า 54.25 ms นี่คือความสัมพันธ์ที่ยืนยันได้ว่า sub-metric ทั้งหมดคือการแยกส่วนของเวลาเดียวกัน ส่วน 105.39 ms คือ iteration_duration ซึ่งรวมคิด time เข้าไปด้วย'
        },
        {
          q: 'ข้อใดถูกต้องเกี่ยวกับการนับ 4xx ของ k6 ใน metric http_req_failed',
          options: [
            'k6 นับ 4xx เป็นความล้มเหลวโดยค่าเริ่มต้น',
            'k6 ไม่นับ 4xx เป็นความล้มเหลวเลย',
            'k6 นับเฉพาะสถานะ 5xx เท่านั้น',
            'k6 นับ 4xx เป็นความสำเร็จเสมอ ไม่ตั้งค่าได้'
          ],
          answer: 0,
          explain: 'โดยค่าเริ่มต้น k6 ถือว่า 4xx และ 5xx เป็นความล้มเหลว ถ้าตั้งใจทดสอบ endpoint ที่ควรตอบ 404 หรือ 401 ต้องใช้แท็ก expected_response เพื่อบอก k6 ว่าไม่ควรนับเป็น error ไม่อย่างนั้นอัตราความล้มเหลวจะดูสูงผิดความจริง'
        },
        {
          q: 'metric ใดเตือนได้ตรงที่สุดว่า "เครื่องที่รัน k6 เองกลายเป็นคอขวด"',
          options: ['http_reqs', 'dropped_iterations', 'data_sent', 'group_duration'],
          answer: 1,
          explain: 'dropped_iterations เกิดขึ้นเมื่อ k6 ต้องเริ่มรอบตามกำหนดเวลาแต่ไม่มี VU ว่างให้ใช้ แปลว่าโหลดที่สร้างได้จริงต่ำกว่าแผน ตัวเลข throughput ที่ได้จึงต่ำกว่าที่ควรเป็น ทันทีที่ค่านี้ไม่ใช่ 0 ต้องเพิ่ม maxVUs หรือลดอัตราเป้าหมายแล้วรันใหม่ก่อนตีความผล'
        },
        {
          q: 'ข้อใดกล่าวถึงความสัมพันธ์ระหว่าง iterations กับ http_reqs ได้ถูกต้อง',
          options: [
            'ทั้งสองค่าเท่ากันเสมอ ไม่ว่าสคริปต์จะยิงกี่ request ต่อรอบ',
            'ถ้าหนึ่ง iteration ยิง 3 request ค่า http_reqs จะมากกว่า iterations ประมาณสามเท่า',
            'iterations มากกว่า http_reqs เสมอ เพราะรวมงานนอก HTTP ด้วย',
            'ทั้งสองค่าเป็น metric ชนิด Trend จึงเทียบกันไม่ได้'
          ],
          answer: 1,
          explain: 'iterations นับรอบของฟังก์ชัน default() ส่วน http_reqs นับจำนวน request ที่ยิงออกไปจริง ในการรันของเราที่หนึ่งรอบยิงหนึ่ง request ทั้งสองค่าจึงเท่ากันที่ 1,155 การเทียบสองค่านี้ทำให้ตรวจได้ว่าสคริปต์ยิง request ครบตามที่ตั้งใจในทุกรอบหรือไม่'
        }
      ]
    },
    {
      id: '04-percentiles',
      lessonId: '04-percentiles',
      title: 'บทที่ 4 — เปอร์เซ็นไทล์ p95 / p99',
      lessonFile: 'lessons/04-percentiles.html',
      questions: [
        {
          q: 'ขั้นตอนการคำนวณเปอร์เซ็นไทล์ด้วยมือ ข้อใดถูกต้อง',
          options: [
            'หาค่ากลางของข้อมูล แล้วบวกส่วนเบี่ยงเบนมาตรฐานหนึ่งเท่า',
            'เรียงค่าจากน้อยไปมาก หาตำแหน่งด้วยสูตร p × (n − 1) แล้วเทียบสัดส่วนระหว่างสองค่าที่อยู่ติดกัน',
            'นับจำนวนข้อมูลแล้วหารด้วย 100',
            'เลือกค่าที่มากที่สุดในกลุ่มเป็นตัวแทนของทุกเปอร์เซ็นไทล์'
          ],
          answer: 1,
          explain: 'ตำแหน่ง = p × (n − 1) โดย p เป็นสัดส่วนทศนิยม ถ้าตำแหน่งไม่ลงตัวให้เทียบสัดส่วนระหว่างค่าที่อยู่ก่อนกับค่าที่อยู่ถัดไป ตัวอย่างจากข้อมูลจริง 1,155 ค่า ตำแหน่งของ p95 = 0.95 × 1154 = 1,096.3 ซึ่งอยู่ระหว่างค่าลำดับที่ 1,096 กับ 1,097 จึงได้ 74.53 ms'
        },
        {
          q: 'จากข้อมูลจริง ค่าเฉลี่ยของ http_req_duration คือ 54.25 ms แต่ p99 คือ 466.29 ms ข้อสรุปใดถูกต้อง',
          options: [
            'ข้อมูลผิด เพราะ p99 ต้องไม่สูงกว่าค่าเฉลี่ย',
            'ค่าเฉลี่ยกลบหางของการกระจายไว้ ทำให้มีผู้ใช้ส่วนหนึ่งที่เจอความหน่วงสูงกว่าค่าเฉลี่ยหลายเท่า',
            'ระบบมีปัญหากับ request ทุกตัว',
            'p99 ไม่มีความหมายถ้าไม่รู้ค่าสูงสุด'
          ],
          answer: 1,
          explain: 'p99 สูงกว่าค่าเฉลี่ยประมาณ 8.6 เท่า ความต่างระดับนี้คือสัญญาณว่าการกระจายมีหางยาว การดูแต่ค่าเฉลี่ยจะทำให้สรุปผิดว่าระบบเร็วสม่ำเสมอ ทั้งที่ 1% ของ request ช้ากว่า 466 ms'
        },
        {
          q: 'ค่า p95 = 74.53 ms หมายความว่าอย่างไร',
          options: [
            '95% ของ request ใช้เวลาไม่เกิน 74.53 ms',
            'request ทุกตัวใช้เวลา 74.53 ms',
            '5% ของ request ที่เร็วที่สุดอยู่ที่ 74.53 ms',
            'ค่าเฉลี่ยของ request 95 ตัวแรก'
          ],
          answer: 0,
          explain: 'p95 คือค่าที่ 95% ของ request เร็วกว่าหรือเท่ากับ และอีก 5% ช้ากว่านั้น จาก 1,155 request คิดเป็นประมาณ 58 request ที่ช้ากว่า 74.53 ms'
        },
        {
          q: 'หนึ่งหน้าเว็บยิง 20 request ถ้า p95 ของแต่ละ request เท่ากับ 74.53 ms โอกาสที่ผู้ใช้จะเจออย่างน้อย 1 request ที่ช้ากว่า p95 เป็นเท่าไร',
          options: ['5%', '64%', '95%', '100%'],
          answer: 1,
          explain: 'โอกาสที่ทุก request จะเร็วกว่า p95 คือ 0.95 ยกกำลัง 20 = 0.3585 ดังนั้นโอกาสที่จะเจออย่างน้อยหนึ่งตัวที่ช้ากว่าคือ 1 − 0.3585 = 0.6415 หรือประมาณ 64% ตัวเลข 5% ต่อ request เดียวไม่เคยตรงกับประสบการณ์จริงของผู้ใช้ที่โหลดทั้งหน้า'
        },
        {
          q: 'ทำไมจึงไม่ควรใช้ค่าสูงสุด (max) เป็นเกณฑ์ตัดสินเพียงตัวเดียว',
          options: [
            'เพราะ k6 ไม่สามารถวัดค่าสูงสุดได้',
            'เพราะค่าสูงสุดไวต่อค่าผิดปกติเพียงตัวเดียว และแกว่งมากจนเทียบระหว่างการรันไม่ได้',
            'เพราะค่าสูงสุดต่ำกว่า p99 เสมอ',
            'เพราะค่าสูงสุดเป็น metric ชนิด Counter'
          ],
          answer: 1,
          explain: 'max มาจาก request ตัวที่ช้าที่สุดเพียงตัวเดียว จึงเปลี่ยนไปมามากและไม่บอกว่าผู้ใช้ส่วนใหญ่เจออะไร การรันของเราได้ max 584.70 ms เทียบกับ p95 74.53 ms ซึ่งเป็นตัวแทนประสบการณ์ส่วนใหญ่ได้ดีกว่ามาก'
        },
        {
          q: 'ข้อใดคือ threshold ที่เตือนเมื่อ p95 ของเวลาตอบสนองเกิน 500 ms ได้ถูกต้อง',
          options: [
            "thresholds: { http_req_duration: ['p(95)<500'] }",
            "thresholds: { http_req_duration: ['p95 < 500'] }",
            "thresholds: { http_req_duration: ['95<500'] }",
            "thresholds: { http_req_duration: ['avg<500'] }"
          ],
          answer: 0,
          explain: 'ไวยากรณ์ที่ k6 รองรับคือ p(95)<500 โดยห้ามมีช่องว่างในนิพจน์ ข้อ ข ผิดเพราะมีช่องว่าง ข้อ ค ผิดเพราะไม่มีวงเล็บ ข้อ ง ใช้ได้แต่เป็นการตั้งเกณฑ์บนค่าเฉลี่ยซึ่งกลบหาง ไม่ใช่สิ่งที่ SLO ระบุ'
        }
      ]
    },
    {
      id: '05-load-profiles',
      lessonId: '05-load-profiles',
      title: 'บทที่ 5 — รูปแบบการทดสอบ',
      lessonFile: 'lessons/05-load-profiles.html',
      questions: [
        {
          q: 'การทดสอบรูปแบบใดเหมาะที่สุดสำหรับหารอยรั่วหน่วยความจำและการเสื่อมสภาพตามเวลา',
          options: ['smoke test', 'soak test', 'spike test', 'breakpoint test'],
          answer: 1,
          explain: 'soak test ถือภาระในระดับปกติต่อเนื่องเป็นชั่วโมง ทำให้ปัญหาที่โผล่เฉพาะเมื่อเวลาผ่านไป เช่น memory leak, connection ที่ไม่ถูกคืน, ไฟล์ชั่วคราวที่โตขึ้น แสดงตัวออกมา ส่วน smoke test ตรวจว่าใช้งานได้, spike test ดูการรับภาระกระชาก และ breakpoint test หาจุดที่ระบบเริ่มพัง'
        },
        {
          q: 'เพราะเหตุใดจึงควรทิ้งข้อมูลช่วง warm-up ก่อนวิเคราะห์ผล',
          options: [
            'เพราะระบบยังไม่พร้อมเต็มที่ ค่าที่ได้ช่วงต้นจะทำให้ผลวิเคราะห์เพี้ยนไปทางแย่',
            'เพราะ k6 ไม่บันทึกข้อมูลในช่วงนั้น',
            'เพราะช่วงนั้น VU จะทำงานผิดพลาดเสมอ',
            'เพราะไม่มีการส่ง request เกิดขึ้นในช่วงนั้น'
          ],
          answer: 0,
          explain: 'ช่วงต้นยังมีค่าใช้จ่ายจากการ compile โค้ด การเติม cache และการเปิด connection ใหม่ ทำให้ค่าสูงกว่าปกติ การนำช่วงนี้ไปรวมกับ steady state จะดึงค่าเฉลี่ยและเปอร์เซ็นไทล์ให้ผิดเพี้ยน ข้อควรระวังคือ k6 ไม่ตัดข้อมูลช่วงนี้ให้เอง ค่าเปอร์เซ็นไทล์ท้ายการรันยังคิดจากทุกตัวอย่างรวมช่วงอุ่นเครื่อง และตัวเลือก delayAbortEval ก็ไม่ได้กรองข้อมูลให้ มันเลื่อนแค่เวลาที่ k6 จะตัดสินใจหยุดการรัน ถ้าต้องการตัวเลขที่สะอาดต้องแยกช่วงภาวะคงตัวเป็น scenario ของตัวเองแล้วตั้ง threshold อ้างแท็ก scenario หรือส่งออกข้อมูลดิบมาเลือกช่วงเอง'
        },
        {
          q: 'open model ต่างจาก closed model อย่างไร',
          options: [
            'open model กำหนดอัตราการเกิดงานไว้ตายตัว โดยไม่ขึ้นกับว่ามี VU ว่างหรือไม่',
            'open model ใช้จำนวน VU น้อยกว่า closed model เสมอ',
            'open model วัดได้เฉพาะ latency ไม่วัด throughput',
            'closed model ใช้ได้กับ executor แบบ arrival-rate เท่านั้น'
          ],
          answer: 0,
          explain: 'ใน open model งานถูกปล่อยตามอัตราที่กำหนด ถ้าไม่มี VU ว่างงานนั้นจะถูกจัดคิวหรือถูกทิ้งและนับใน dropped_iterations ทำให้สมจริงกับทราฟฟิกที่มาจากผู้ใช้ภายนอก ส่วน closed model มีจำนวนงานในระบบคงที่เท่ากับจำนวน VU อัตราจึงขึ้นกับความเร็วของระบบเอง'
        },
        {
          q: 'จุดอิ่มตัว (saturation point) สังเกตได้จากอาการใด',
          options: [
            'throughput ทรงตัวหรือลดลง ขณะที่ latency พุ่งขึ้นอย่างชัดเจน',
            'จำนวน VU ลดลงเองโดยไม่มีคำสั่ง',
            'อัตราความผิดพลาดลดลงเหลือศูนย์',
            'ค่า p50 เท่ากับค่าเฉลี่ยพอดี'
          ],
          answer: 0,
          explain: 'จุดอิ่มตัวคือจุดที่เพิ่มภาระต่อไปแล้วระบบให้ผลผลิตไม่เพิ่ม แต่คิวเริ่มยาวขึ้นจนเวลาตอบสนองพุ่งเป็นรูปไม้ฮอกกี้ การเพิ่ม VU เกินจุดนี้มีแต่ทำให้ผู้ใช้ทุกคนช้าลง'
        },
        {
          q: 'ข้อใดแปลง SLO ที่ว่า "p95 ต่ำกว่า 300 ms และอัตราความผิดพลาดต่ำกว่า 1%" เป็น threshold ของ k6 ได้ถูกต้อง',
          options: [
            "thresholds: { http_req_duration: ['p(95)<300'], http_req_failed: ['rate<0.01'] }",
            "thresholds: { http_req_duration: ['avg<300'], http_req_failed: ['rate<1'] }",
            "thresholds: { http_req_duration: ['p(95)<300'], http_req_failed: ['rate<0.1'] }",
            "thresholds: { iterations: ['p(95)<300'] }"
          ],
          answer: 0,
          explain: 'ต้องใช้ p(95) ไม่ใช่ avg และอัตราความผิดพลาด 1% เขียนเป็น rate<0.01 เพราะ metric http_req_failed เป็นสัดส่วนทศนิยม (1% = 0.01) ไม่ใช่ตัวเลขเปอร์เซ็นต์ตรง ๆ ข้อ ค ผิดเพราะ 0.1 คือ 10% ซึ่งหลวมกว่าที่ตกลงไว้สิบเท่า'
        },
        {
          q: 'ระหว่างการรันพบว่า dropped_iterations มากกว่า 0 ต่อเนื่อง แปลว่าอะไร',
          options: [
            'เซิร์ฟเวอร์ปฏิเสธ request ที่เข้ามา',
            'k6 ต้องการเริ่มรอบตามกำหนดเวลาแต่ไม่มี VU ว่าง โหลดที่สร้างได้จึงต่ำกว่าแผน',
            'ข้อมูลผลลัพธ์สูญหายไประหว่างบันทึกเป็นไฟล์',
            'threshold ของการรันไม่ผ่าน'
          ],
          answer: 1,
          explain: 'dropped_iterations เป็นสัญญาณของเครื่องทดสอบ ไม่ใช่ของระบบที่ถูกทดสอบ เมื่อค่านี้ไม่ใช่ 0 แปลว่าอัตราที่ตั้งไว้สูงกว่าที่ VU ที่จองไว้จะทำได้จริง ต้องเพิ่ม maxVUs หรือลดอัตราเป้าหมาย แล้วรันใหม่ก่อนนำผลไปตีความ'
        }
      ]
    },
    {
      id: '06-read-results',
      lessonId: '06-read-results',
      title: 'บทที่ 6 — อ่านผลลัพธ์',
      lessonFile: 'lessons/06-read-results.html',
      questions: [
        {
          q: 'ในสรุปผลท้ายการรัน บรรทัดที่ขึ้นต้นว่า http_reqs: 1,155 93.44/s บอกอะไร',
          options: [
            'บอกยอดสะสม 1,155 request และอัตราเฉลี่ย 93.44 request ต่อวินาที',
            'บอกว่ามี request ค้างอยู่ 1,155 รายการ',
            'บอกว่ามี request ล้มเหลว 93.44 รายการต่อวินาที',
            'บอกจำนวน VU ที่ทำงานพร้อมกัน',
          ],
          answer: 0,
          explain: 'ตัวเลขซ้ายคือยอดสะสมทั้งการรัน ตัวเลขขวาที่มีหน่วย /s คืออัตราต่อวินาที ซึ่งได้จากการหารด้วยระยะเวลารันจริง 12.36 วินาที จึงได้ 93.44/s ค่านี้ใช้เป็น throughput (RPS) ได้ทันที'
        },
        {
          q: 'เมื่ออัตราความผิดพลาดสูงขึ้นเรื่อย ๆ ตามจำนวน VU ควรตีความอย่างไร',
          options: [
            'ไม่ต้องสนใจถ้าสถานะที่ได้เป็น 200 ทั้งหมด',
            'ระบบเริ่มรับภาระไม่ไหว และการเพิ่ม VU ต่อไปจะยิ่งทำให้แย่ลง',
            'เป็นเพราะ threshold ตั้งไว้ผิด',
            'เป็นเพราะ k6 บันทึกผลผิดพลาด'
          ],
          answer: 1,
          explain: 'อัตราความผิดพลาดที่โตตามจำนวน VU คือสัญญาณของการอิ่มตัวหรือการที่ระบบเริ่มปฏิเสธงาน ควรหยุดไต่ขึ้นและหาว่าองค์ประกอบใดเป็นคอขวดก่อน ไม่ใช่ฝืนเพิ่ม VU ต่อ'
        },
        {
          q: 'ตัวเลือกใดของ k6 ที่ใช้สั่งให้สรุปผลท้ายการรันเขียนออกเป็นไฟล์ JSON',
          options: ['--summary-export', '--no-connection-reuse', '--summary-mode compact', '-o csv=raw.csv'],
          answer: 0,
          explain: '--summary-export เขียนสรุปผลท้ายการรันออกเป็นไฟล์ JSON เพื่อเก็บไว้เทียบระหว่างการรันแต่ละครั้ง ส่วน --summary-mode compact ย่อหน้าจอสรุปให้อ่านง่ายขึ้น --no-connection-reuse ปิดการใช้ connection ซ้ำ และ -o csv=... ส่งข้อมูลดิบออกเป็น CSV'
        },
        {
          q: 'ก่อนเริ่มการทดสอบโหลดเต็มรูปแบบ ควรทำอะไรเป็นอันดับแรกเสมอ',
          options: [
            'รัน smoke test ด้วย VU น้อย ๆ เพื่อยืนยันว่าสคริปต์ถูกและปลายทางตอบได้',
            'เพิ่ม VU ให้มากที่สุดเพื่อดูว่าเครื่องรับไหวไหม',
            'ตั้ง abortOnFail ให้ทุก threshold แล้วรันเลย',
            'ลบ threshold ทั้งหมดออกเพื่อให้การรันผ่านแน่นอน'
          ],
          answer: 0,
          explain: 'smoke test ใช้เวลาน้อยและจับข้อผิดพลาดพื้นฐานได้เกือบทั้งหมด เช่น URL ผิด ลืมใส่ header, check ที่ไม่เคยผ่าน การข้ามขั้นตอนนี้แล้วไปรันเต็มรูปแบบมักเสียเวลาไปกับการรันที่ผลใช้ไม่ได้เลย'
        },
        {
          q: 'การทดสอบโหลดควรยิงใส่ระบบแบบใด',
          options: [
            'ระบบของคู่แข่งเพื่อวัดว่าของเราเร็วกว่าไหม',
            'ระบบของเราที่มีสิทธิ์ทดสอบ หรือเครื่องจำลองในเครื่องของเราเอง',
            'เว็บไซต์สาธารณะขนาดใหญ่ เพื่อให้ได้ข้อมูลที่สมจริง',
            'ระบบใดก็ได้ที่ตอบสนองเร็วพอ'
          ],
          answer: 1,
          explain: 'ต้องยิงโหลดเฉพาะระบบที่เราได้รับอนุญาตให้ทดสอบเท่านั้น การยิงโหลดใส่ระบบของคนอื่นถือเป็นการโจมตีและอาจผิดกฎหมาย รวมถึงกระทบผู้ใช้จริงที่ไม่ได้เกี่ยวข้อง ตัวอย่างในบทเรียนนี้จึงชี้ไปที่ localhost และโดเมนทดสอบสาธารณะที่ทำขึ้นเพื่อการนี้โดยเฉพาะ'
        },
        {
          q: 'ถ้า threshold ไม่ผ่าน k6 จะจบการทำงานด้วย exit code เท่าไร',
          options: ['0', '1', '99', '255'],
          answer: 2,
          explain: 'k6 จบด้วย exit code 99 เมื่อ threshold ไม่ผ่าน ซึ่งทำให้ระบบอัตโนมัติแยกออกได้ว่างานล้มเหลวเพราะเกณฑ์ประสิทธิภาพไม่ผ่าน ไม่ใช่เพราะสคริปต์มีข้อผิดพลาด จึงใช้กั้นในไปป์ไลน์ได้โดยไม่ต้องเขียนตัวตรวจเพิ่ม'
        }
      ]
    }
  ];

  /* ---------- ตัวรันแบบทดสอบ ---------- */

  function esc(text) {
    return String(text)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function buildSet(set, ctx) {
    var saved = ctx.storage ? ctx.storage.getQuiz(set.lessonId) : null;
    var wrap = document.createElement('section');
    wrap.className = 'quiz-set bleed';
    wrap.id = 'quiz-' + set.id;
    wrap.setAttribute('data-set-id', set.id);

    var statusText = saved
      ? 'ทำแล้ว ' + saved.best + '/' + saved.total + ' (' + Math.round(saved.best / saved.total * 100) + '%)'
      : 'ยังไม่ทำ';
    var statusClass = saved ? 'status-pill is-done' : 'status-pill is-none';

    var html = '<div class="quiz-set__head">' +
      '<h3>' + esc(set.title) + '</h3>' +
      '<span class="' + statusClass + '" data-role="status">' + esc(statusText) + '</span>' +
      '</div>' +
      '<p class="muted" style="font-size:.83rem">มี ' + set.questions.length +
      ' ข้อ เลือกคำตอบแล้วกดตรวจ คำตอบที่ถูกและคำอธิบายจะแสดงหลังตรวจ ทบทวนเนื้อหาได้ที่ ' +
      '<a href="' + ctx.root + set.lessonFile + '">' + esc(set.title.split(' — ')[1] || set.title) + '</a></p>' +
      '<form novalidate>';

    set.questions.forEach(function (item, qi) {
      var name = 'q-' + set.id + '-' + qi;
      html += '<fieldset class="question" data-q="' + qi + '">' +
        '<legend><span class="question__num">ข้อ ' + (qi + 1) + '.</span>' + esc(item.q) + '</legend>' +
        '<ul class="options">';
      item.options.forEach(function (opt, oi) {
        html += '<li><label class="option" data-opt="' + oi + '">' +
          '<input type="radio" name="' + name + '" value="' + oi + '">' +
          '<span class="option__key">' + OPTION_KEYS[oi] + '</span>' +
          '<span class="option__text">' + esc(opt) + '</span>' +
          '<span class="option__tag" hidden></span>' +
          '</label></li>';
      });
      html += '</ul>' +
        '<p class="explanation" data-role="explanation" hidden></p>' +
        '</fieldset>';
    });

    html += '<div class="btn-row">' +
      '<button class="btn btn--primary" type="submit">ตรวจคำตอบ</button>' +
      '<button class="btn" type="button" data-role="clear">ล้างคำตอบชุดนี้</button>' +
      '</div></form>' +
      '<div class="quiz-result" data-role="result" role="status" aria-live="polite" hidden></div>' +
      '<p class="quiz-disclaimer">คะแนนที่ดีที่สุดของแต่ละบทจะถูกบันทึกไว้ในเครื่องนี้ และนำไปแสดงในหน้าความคืบหน้า</p>';

    wrap.innerHTML = html;

    var form = wrap.querySelector('form');

    form.addEventListener('submit', function (evt) {
      evt.preventDefault();
      var unanswered = [];
      var score = 0;

      set.questions.forEach(function (item, qi) {
        var field = wrap.querySelector('fieldset[data-q="' + qi + '"]');
        var chosen = form.querySelector('input[name="q-' + set.id + '-' + qi + '"]:checked');
        var picked = chosen ? parseInt(chosen.value, 10) : -1;
        if (picked === -1) unanswered.push(qi + 1);

        Array.prototype.forEach.call(field.querySelectorAll('.option'), function (label) {
          var oi = parseInt(label.getAttribute('data-opt'), 10);
          label.classList.remove('is-correct', 'is-wrong');
          var tag = label.querySelector('.option__tag');
          tag.hidden = true;
          tag.textContent = '';
          if (oi === item.answer) {
            label.classList.add('is-correct');
            tag.hidden = false;
            tag.textContent = 'คำตอบที่ถูก';
          } else if (oi === picked) {
            label.classList.add('is-wrong');
            tag.hidden = false;
            tag.textContent = 'ตัวเลือกที่คุณเลือก';
          }
        });
        if (picked === item.answer) score++;

        var exp = field.querySelector('[data-role="explanation"]');
        var verdict = picked === -1
          ? '<span class="verdict is-no">ยังไม่ได้ตอบข้อนี้</span>'
          : (picked === item.answer
            ? '<span class="verdict is-ok">ตอบถูก</span>'
            : '<span class="verdict is-no">ตอบไม่ถูก — คำตอบที่ถูกคือข้อ ' + OPTION_KEYS[item.answer] + '</span>');
        exp.innerHTML = verdict + ' — ' + esc(item.explain);
        exp.hidden = false;
      });

      var total = set.questions.length;
      var pct = Math.round(score / total * 100);
      var entry = ctx.storage ? ctx.storage.saveQuizResult(set.lessonId, score, total) : null;

      var result = wrap.querySelector('[data-role="result"]');
      var msg = '<span class="score"><strong>' + score + '/' + total + '</strong> (' + pct + '%)</span>';
      msg += '<span class="muted">' + (pct === 100
        ? 'ครบทุกข้อ ผ่านบทนี้แล้ว'
        : (pct >= 80 ? 'ผ่านเกณฑ์ comfortably — ทบทวนข้อที่พลาดแล้วไปบทถัดไปได้'
          : 'ลองทบทวนบทเรียนอีกครั้งแล้วทำใหม่ได้ไม่จำกัดจำนวนครั้ง')) + '</span>';
      if (unanswered.length) {
        msg += '<span class="muted">ข้อที่ยังไม่ได้ตอบ: ' + unanswered.join(', ') + '</span>';
      }
      if (entry) {
        msg += '<span class="muted">คะแนนที่ดีที่สุด: ' + entry.best + '/' + entry.total +
          ' · ทำมาแล้ว ' + entry.attempts + ' ครั้ง</span>';
      }
      result.innerHTML = msg;
      result.hidden = false;

      var status = wrap.querySelector('[data-role="status"]');
      if (entry) {
        status.className = 'status-pill is-done';
        status.textContent = 'ทำแล้ว ' + entry.best + '/' + entry.total + ' (' +
          Math.round(entry.best / entry.total * 100) + '%)';
      }

      if (ROOT.LTK6.refreshShell) ROOT.LTK6.refreshShell();
      result.scrollIntoView({ block: 'nearest' });
    });

    form.querySelector('[data-role="clear"]').addEventListener('click', function () {
      form.reset();
      set.questions.forEach(function (item, qi) {
        var field = wrap.querySelector('fieldset[data-q="' + qi + '"]');
        Array.prototype.forEach.call(field.querySelectorAll('.option'), function (label) {
          label.classList.remove('is-correct', 'is-wrong');
          var tag = label.querySelector('.option__tag');
          tag.hidden = true;
          tag.textContent = '';
        });
        var exp = field.querySelector('[data-role="explanation"]');
        exp.hidden = true;
        exp.innerHTML = '';
      });
      var result = wrap.querySelector('[data-role="result"]');
      result.hidden = true;
      result.innerHTML = '';
      var first = form.querySelector('input[type="radio"]');
      if (first) first.focus();
    });

    return wrap;
  }

  function render(hostId) {
    var host = document.getElementById(hostId || 'quiz-host');
    if (!host) return;
    var ctx = ROOT.LTK6.__ctx;
    if (!ctx) return;

    /* แถบเลือกชุด */
    var picker = document.createElement('nav');
    picker.className = 'quiz-picker bleed';
    picker.setAttribute('aria-label', 'เลือกชุดแบบทดสอบ');
    var pk = '';
    SETS.forEach(function (s) {
      var saved = ctx.storage ? ctx.storage.getQuiz(s.lessonId) : null;
      pk += '<a href="#quiz-' + s.id + '"' + (saved ? ' class="is-done"' : '') + '>' +
        esc('บทที่ ' + s.lessonId.slice(0, 2).replace(/^0/, '')) +
        (saved ? ' · ' + saved.best + '/' + saved.total : '') + '</a>';
    });
    pk += '<a href="' + ctx.root + 'progress.html">ดูความคืบหน้าทั้งหมด</a>';
    picker.innerHTML = pk;
    host.appendChild(picker);

    SETS.forEach(function (set) {
      host.appendChild(buildSet(set, ctx));
    });
  }

  ROOT.LTK6.quiz = {
    SETS: SETS,
    render: render,
    questionCount: function () {
      return SETS.reduce(function (a, s) { return a + s.questions.length; }, 0);
    }
  };
})();
