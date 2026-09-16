/* ==========================================================================
   calc.js — ฟังก์ชันคำนวณบริสุทธิ์ (pure) สำหรับ TPS / VU / load profile
   ไม่แตะ DOM เลย จึงนำไปทดสอบด้วย node ได้โดยตรง
   (scripts/test-calc.mjs จะ import ไฟล์นี้แล้วอ่าน globalThis.LTK6.calc)

   สัญลักษณ์
     N   = จำนวน virtual user (VU)
     R   = จำนวน request ต่อ 1 iteration
     Rt  = เวลาตอบสนองเฉลี่ยต่อ request (ms)
     Tt  = think time ต่อ iteration (ms)
   ========================================================================== */
(function () {
  'use strict';

  var ROOT = typeof globalThis !== 'undefined' ? globalThis : this;
  ROOT.LTK6 = ROOT.LTK6 || {};

  var MS_PER_SECOND = 1000;

  /* ---------- ตัวช่วยตัวเลข ---------- */

  function round(value, digits) {
    if (!Number.isFinite(value)) return NaN;
    var d = Number.isFinite(digits) ? digits : 2;
    var f = Math.pow(10, d);
    return Math.round((value + Number.EPSILON) * f) / f;
  }

  function toNumber(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
    if (typeof value === 'string' && value.trim() !== '') {
      var n = Number(value);
      return Number.isFinite(n) ? n : NaN;
    }
    return NaN;
  }

  /* ---------- การตรวจสอบอินพุต ---------- */

  var FIELD_LABELS = {
    N: 'จำนวน VU (N)',
    R: 'จำนวน request ต่อ iteration (R)',
    Rt: 'เวลาตอบสนองเฉลี่ย (Rt)',
    Tt: 'think time (Tt)',
    targetTps: 'TPS เป้าหมาย',
    p95Ms: 'เวลาตอบสนอง p95',
    pTarget: 'เปอร์เซ็นไทล์ที่ต้องการ (p)'
  };

  var INTEGER_FIELDS = { N: true, R: true };

  /* กฎ: N ≥ 1 (จำนวนเต็ม), R ≥ 1 (จำนวนเต็ม), Rt > 0, Tt ≥ 0,
         targetTps > 0, p95Ms > 0, 0 < pTarget < 100            */
  function validateInputs(input) {
    var errors = [];
    if (!input || typeof input !== 'object') {
      return [{ field: 'form', message: 'ไม่พบข้อมูลที่กรอก', fix: 'กรอกค่าทุกช่องแล้วกดคำนวณอีกครั้ง' }];
    }

    var required = {
      N: { min: 1, exclusive: false },
      R: { min: 1, exclusive: false },
      Rt: { min: 0, exclusive: true },
      Tt: { min: 0, exclusive: false },
      targetTps: { min: 0, exclusive: true },
      p95Ms: { min: 0, exclusive: true },
      pTarget: { min: 0, exclusive: true, max: 100 }
    };

    Object.keys(input).forEach(function (field) {
      var rule = required[field];
      if (!rule) return;
      var raw = input[field];
      var label = FIELD_LABELS[field] || field;
      var value = toNumber(raw);

      if (raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')) {
        errors.push({
          field: field,
          message: 'ยังไม่ได้กรอก' + label,
          fix: 'กรอกตัวเลข' + (INTEGER_FIELDS[field] ? 'จำนวนเต็ม' : '') + 'ก่อนกดคำนวณ'
        });
        return;
      }
      if (Number.isNaN(value)) {
        errors.push({
          field: field,
          message: label + ' ต้องเป็นตัวเลข',
          fix: 'แก้ไขให้เป็นตัวเลข เช่น ' + (INTEGER_FIELDS[field] ? '10' : '100')
        });
        return;
      }
      if (INTEGER_FIELDS[field] && !Number.isInteger(value)) {
        errors.push({
          field: field,
          message: label + ' ต้องเป็นจำนวนเต็ม (VU มีเศษไม่ได้)',
          fix: 'ปัดเป็นจำนวนเต็ม เช่น ' + Math.max(1, Math.round(value))
        });
        return;
      }
      if (rule.exclusive && value <= rule.min) {
        errors.push({
          field: field,
          message: label + ' ต้องมากกว่า 0' + (value === 0 ? ' แต่ได้รับ 0' : ''),
          fix: field === 'Rt'
            ? 'วัดเวลาตอบสนองจริงจาก k6 แล้วกรอกเป็นมิลลิวินาที เช่น 54.25'
            : (field === 'pTarget'
              ? 'เลือกค่าในช่วง 1 ถึง 99 เช่น 95'
              : 'กรอกค่าที่มากกว่า 0')
        });
        return;
      }
      if (!rule.exclusive && value < rule.min) {
        var tooSmall = value < 0
          ? label + ' ต้องไม่ติดลบ (ได้รับ ' + value + ')'
          : label + ' ต้องมีค่าอย่างน้อย ' + rule.min + ' (ได้รับ ' + value + ')';
        errors.push({
          field: field,
          message: tooSmall,
          fix: field === 'Tt'
            ? 'ถ้าสคริปต์ไม่มี sleep ให้กรอก 0'
            : 'กรอกเป็นจำนวนเต็มตั้งแต่ ' + rule.min + ' ขึ้นไป เช่น ' + Math.max(rule.min, 10)
        });
        return;
      }
      if (rule.max !== undefined && value >= rule.max) {
        errors.push({
          field: field,
          message: label + ' ต้องน้อยกว่า ' + rule.max,
          fix: 'เลือกค่าเช่น 50, 90, 95 หรือ 99'
        });
      }
    });

    return errors;
  }

  function hasErrors(input) {
    return validateInputs(input).length > 0;
  }

  /* ---------- แกนหลักของ closed model ---------- */

  /* เวลาต่อ 1 iteration = (R × Rt) + Tt  [ms] */
  function iterationDurationMs(input) {
    var R = toNumber(input.R), Rt = toNumber(input.Rt), Tt = toNumber(input.Tt);
    if (!Number.isFinite(R) || !Number.isFinite(Rt) || !Number.isFinite(Tt)) return NaN;
    return R * Rt + Tt;
  }

  /* iterations/s = N ÷ (iteration_duration เป็นวินาที) */
  function iterationsPerSecond(input) {
    var N = toNumber(input.N);
    var dur = iterationDurationMs(input);
    if (!Number.isFinite(N) || !Number.isFinite(dur) || dur <= 0) return NaN;
    return N * MS_PER_SECOND / dur;
  }

  /* TPS = iterations/s × R */
  function tps(input) {
    var R = toNumber(input.R);
    var ips = iterationsPerSecond(input);
    if (!Number.isFinite(R) || !Number.isFinite(ips)) return NaN;
    return ips * R;
  }

  /* TPS ต่อ 1 VU = R × 1000 ÷ (R × Rt + Tt) */
  function tpsPerVu(input) {
    var R = toNumber(input.R);
    var dur = iterationDurationMs(input);
    if (!Number.isFinite(R) || !Number.isFinite(dur) || dur <= 0) return NaN;
    return R * MS_PER_SECOND / dur;
  }

  /* คำนวณย้อนกลับ: VU ที่ต้องใช้ = ceil(target ÷ TPS ต่อ VU) */
  function vusForTps(input) {
    var target = toNumber(input.targetTps);
    var perVu = tpsPerVu(input);
    if (!Number.isFinite(target) || !Number.isFinite(perVu) || perVu <= 0) return NaN;
    return Math.ceil(target / perVu);
  }

  /* กฎของ Little: N = อัตราการเกิดงาน × เวลาที่งานนั้นกินอยู่ */
  function littlesLaw(input) {
    var tpsTarget = toNumber(input.tps);
    var R = toNumber(input.R);
    var Rt = toNumber(input.Rt);
    var dur = iterationDurationMs(input);
    if (!Number.isFinite(tpsTarget) || !Number.isFinite(R) || !Number.isFinite(Rt) ||
        !Number.isFinite(dur) || R <= 0 || dur <= 0) {
      return null;
    }
    var iters = tpsTarget / R;
    return {
      itersPerSec: iters,
      iterationDurationMs: dur,
      /* VU ที่ต้องมีจริง เพื่อให้เกิดงานที่อัตรานั้น */
      vusRequired: iters * dur / MS_PER_SECOND,
      /* จำนวน request ที่ "ลอยอยู่ในระบบ" พร้อมกันจริง ๆ */
      requestsInFlight: iters * Rt / MS_PER_SECOND,
      /* สัดส่วนเวลาต่อ iteration ที่ VU ถูกจองโดยการรอ response */
      busyRatio: Rt * R / dur
    };
  }

  /* ---------- TPS calculator (รวมวิธีคิดทีละขั้น) ---------- */

  function tpsCalculator(input) {
    var errors = validateInputs({ N: input.N, R: input.R, Rt: input.Rt, Tt: input.Tt });
    if (errors.length) return { ok: false, errors: errors };

    var N = toNumber(input.N), R = toNumber(input.R), Rt = toNumber(input.Rt), Tt = toNumber(input.Tt);
    var dur = iterationDurationMs(input);
    var ips = iterationsPerSecond(input);
    var out = tps(input);
    var perVu = tpsPerVu(input);
    var little = littlesLaw({ tps: out, R: R, Rt: Rt, Tt: Tt });

    return {
      ok: true,
      input: { N: N, R: R, Rt: Rt, Tt: Tt },
      iterationDurationMs: dur,
      iterationsPerSecond: ips,
      tps: out,
      tpsPerVu: perVu,
      /* ถ้าคิดจาก response time อย่างเดียว จะได้ตัวเลขที่สูงเกินจริง */
      tpsIfResponseOnly: N * MS_PER_SECOND / Rt,
      overestimateFactor: dur / Rt,
      little: little,
      steps: [
        {
          title: 'เวลาต่อ 1 iteration',
          formula: 'iteration_duration = (R × Rt) + Tt',
          substituted: '(' + R + ' × ' + Rt + ') + ' + Tt,
          value: round(dur, 2) + ' ms',
          note: 'รวมทั้งเวลารอ response ของทุก request และ think time ในรอบนั้น'
        },
        {
          title: 'iterations ต่อวินาที',
          formula: 'iterations/s = N ÷ (iteration_duration ÷ 1000)',
          substituted: N + ' ÷ (' + round(dur, 2) + ' ÷ 1000)',
          value: round(ips, 2) + ' iterations/s',
          note: 'นี่คือค่าที่ k6 รายงานในบรรทัด iterations'
        },
        {
          title: 'TPS (throughput)',
          formula: 'TPS = iterations/s × R',
          substituted: round(ips, 2) + ' × ' + R,
          value: round(out, 2) + ' request/s',
          note: 'ตรงกับบรรทัด http_reqs ของ k6 เมื่อทุก request สำเร็จ'
        },
        {
          title: 'เทียบกับกรณีที่เผลอใช้แค่ response time',
          formula: 'N ÷ (Rt ÷ 1000)',
          substituted: N + ' ÷ (' + Rt + ' ÷ 1000)',
          value: round(N * MS_PER_SECOND / Rt, 2) + ' request/s',
          note: 'สูงเกินจริง ' + round(dur / Rt, 2) + ' เท่า เพราะลืมว่า VU ไม่ได้ยิง request ตลอดเวลา'
        }
      ]
    };
  }

  /* ---------- VU calculator (ย้อนกลับ) ---------- */

  function vuCalculator(input) {
    var errors = validateInputs({
      targetTps: input.targetTps, R: input.R, Rt: input.Rt, Tt: input.Tt
    });
    if (errors.length) return { ok: false, errors: errors };

    var target = toNumber(input.targetTps), R = toNumber(input.R);
    var Rt = toNumber(input.Rt), Tt = toNumber(input.Tt);
    var dur = iterationDurationMs(input);
    var perVu = tpsPerVu(input);
    var vus = vusForTps(input);
    /* VU ขั้นต่ำเชิงทฤษฎีจากกฎของ Little (จำนวน request ลอยพร้อมกัน) */
    var minConcurrentRequests = target * Rt / MS_PER_SECOND;
    var little = littlesLaw({ tps: target, R: R, Rt: Rt, Tt: Tt });

    return {
      ok: true,
      input: { targetTps: target, R: R, Rt: Rt, Tt: Tt },
      iterationDurationMs: dur,
      tpsPerVu: perVu,
      vusRequired: vus,
      exactVus: target / perVu,
      little: little,
      theoreticalMinVus: Math.ceil(minConcurrentRequests),
      headroomVus: Math.ceil(vus * 1.2),
      steps: [
        {
          title: 'เวลาต่อ 1 iteration',
          formula: 'iteration_duration = (R × Rt) + Tt',
          substituted: '(' + R + ' × ' + Rt + ') + ' + Tt,
          value: round(dur, 2) + ' ms',
          note: 'ใช้ iteration_duration ไม่ใช่ response time'
        },
        {
          title: 'กำลังผลิตต่อ 1 VU',
          formula: 'TPS ต่อ VU = R × 1000 ÷ iteration_duration',
          substituted: R + ' × 1000 ÷ ' + round(dur, 2),
          value: round(perVu, 4) + ' request/s ต่อ VU',
          note: 'ยิ่ง think time มาก ค่านี้ยิ่งต่ำ'
        },
        {
          title: 'จำนวน VU ที่ต้องใช้',
          formula: 'VU = ⌈TPS เป้าหมาย ÷ TPS ต่อ VU⌉',
          substituted: '⌈' + target + ' ÷ ' + round(perVu, 4) + '⌉',
          value: vus + ' VUs',
          note: 'ปัดขึ้นเสมอ เพราะ VU มีเศษไม่ได้ และควรมีเผื่อสำหรับ ramp-up'
        },
        {
          title: 'เกณฑ์ขั้นต่ำจากกฎของ Little',
          formula: 'request ลอยพร้อมกัน = TPS × Rt (วินาที)',
          substituted: round(target, 2) + ' × ' + round(Rt / MS_PER_SECOND, 5),
          value: round(minConcurrentRequests, 2) + ' request',
          note: 'ถ้าค่านี้ใกล้ ' + vus + ' แปลว่า VU เกือบทั้งหมดต้องรอ response ตลอดเวลา'
        }
      ]
    };
  }

  /* ---------- Load profile helper ---------- */

  var PROFILE_TEXT = {
    smoke: {
      th: 'Smoke test',
      purpose: 'ยืนยันว่าสคริปต์รันผ่าน ปลายทางตอบ 200 และไม่มี error ก่อนวัดอะไรจริงจัง'
    },
    load: {
      th: 'Load test',
      purpose: 'วัดพฤติกรรมที่ภาวะการใช้งานตามที่คาดไว้ (expected peak) และเทียบกับ SLO'
    },
    stress: {
      th: 'Stress test',
      purpose: 'ไต่ขึ้นจนเลยภาวะปกติเพื่อหาจุดอิ่มตัวและดูว่าระบบพังแบบไหน'
    },
    spike: {
      th: 'Spike test',
      purpose: 'กระโดดขึ้นทันทีเพื่อดูว่าระบบรับภาระกะทันหันได้ไหม และฟื้นตัวเร็วแค่ไหน'
    },
    soak: {
      th: 'Soak test',
      purpose: 'ถือภาระระยะยาวเพื่อหารอยรั่วหน่วยความจำ connection ที่ค้าง และการเสื่อมสภาพ'
    }
  };

  function stage(duration, target) {
    return { duration: duration, target: Math.max(0, Math.round(target)) };
  }

  function rampUpVus(vus) {
    return Math.max(1, Math.round(vus * 0.25));
  }

  function recommendProfile(input) {
    /* ชื่อฟิลด์ think time รับได้ทั้ง Tt และ thinkTimeMs
       เพราะหน้าเว็บใช้ id ของช่องกรอกเป็น Tt ส่วนโค้ดที่เรียกจากที่อื่นอาจใช้ชื่อเต็ม */
    var thinkRaw = (input && input.thinkTimeMs !== undefined && input.thinkTimeMs !== null)
      ? input.thinkTimeMs
      : (input ? input.Tt : undefined);

    var errors = validateInputs({
      targetTps: input ? input.targetTps : undefined,
      p95Ms: input ? input.p95Ms : undefined,
      Tt: thinkRaw
    });
    if (errors.length) return { ok: false, errors: errors };

    var target = toNumber(input.targetTps);
    var p95 = toNumber(input.p95Ms);
    var think = toNumber(thinkRaw);

    var perVu = tpsPerVu({ R: 1, Rt: p95, Tt: think });
    var vus = Math.ceil(target / perVu);
    var warm = rampUpVus(vus);

    var profile, reason, stages;

    if (target <= 2) {
      profile = 'smoke';
      reason = 'อัตราเป้าหมายต่ำมาก (' + round(target, 2) + ' request/s) ขนาดนี้มีไว้ยืนยันว่าสคริปต์และปลายทางพร้อม ยังไม่ใช่การวัดสมรรถนะ';
      stages = [stage('30s', Math.min(2, Math.max(1, vus)))];
    } else if (vus >= 500 || target >= 1000) {
      profile = 'stress';
      reason = 'ต้องใช้ VU ประมาณ ' + vus + ' ตัว ซึ่งมากพอที่เครื่องรัน k6 เองจะเป็นคอขวดได้ จึงควรไต่หาขีดจำกัด (breakpoint) ก่อน แล้วค่อยยืนยันที่ภาวะใช้งานจริง';
      stages = [
        stage('2m', vus * 0.5),
        stage('5m', vus),
        stage('5m', vus * 2),
        stage('5m', vus * 4),
        stage('2m', 0)
      ];
    } else {
      profile = 'load';
      reason = 'อัตราเป้าหมาย ' + round(target, 2) + ' request/s อยู่ในช่วงที่วัดได้จริงด้วย VU ประมาณ ' + vus + ' ตัว จึงเหมาะกับการวัดที่ภาวะใช้งานตามที่คาดไว้';
      stages = [
        stage('1m', warm),
        stage('2m', Math.max(1, Math.round(vus * 0.6))),
        stage('5m', vus),
        stage('3m', vus),
        stage('1m', 0)
      ];
    }

    var notes = [];
    notes.push('จำนวน VU อ้างอิงจาก p95 = ' + round(p95, 2) + ' ms และ think time = ' + round(think, 2) +
      ' ms → 1 VU ผลิตได้ประมาณ ' + round(perVu, 4) + ' request/s');
    if (think === 0) {
      notes.push('think time = 0 ทำให้ 1 VU ยิง request ต่อเนื่องไม่หยุด ซึ่งมักไม่ตรงกับพฤติกรรมผู้ใช้จริง และทำให้ VU ถูกจองเต็มที่');
    }
    notes.push('ตัวเลข VU ใน stages เป็นค่าตั้งต้นจากสูตร closed model ต้องปรับหลังรันจริง เพราะระบบจริงไม่เป็นไปตามสูตรเป๊ะ');
    if (vus >= 200) {
      notes.push('VU ระดับ ' + vus + ' ตัวขึ้นไป ควรเฝ้า CPU/RAM ของเครื่องที่รัน k6 และดูค่า dropped_iterations ประกอบเสมอ');
    }
    if (p95 >= 500) {
      notes.push('p95 = ' + round(p95, 2) + ' ms สูงพอสมควร การเพิ่ม VU อาจไม่ช่วยเพิ่ม throughput เพราะระบบเริ่มอิ่มตัวแล้ว');
    }

    var follow = [];
    follow.push({ id: 'smoke', when: 'ทุกครั้งก่อนเริ่ม' });
    follow.push({ id: 'load', when: 'หลัง smoke ผ่าน' });
    follow.push({ id: 'stress', when: 'เมื่อต้องรู้จุดอิ่มตัว' });
    follow.push({ id: 'spike', when: 'เมื่อต้องรู้ว่ารับภาระกะทันหันได้ไหม' });
    follow.push({ id: 'soak', when: 'เมื่อต้องรู้ว่าทนยาวไหม (1–4 ชั่วโมงขึ้นไป)' });

    return {
      ok: true,
      input: { targetTps: target, p95Ms: p95, thinkTimeMs: think, Tt: think },
      profile: profile,
      profileTitle: PROFILE_TEXT[profile].th,
      purpose: PROFILE_TEXT[profile].purpose,
      reason: reason,
      vus: vus,
      tpsPerVu: perVu,
      stages: stages,
      notes: notes,
      follow: follow,
      optionsSnippet: buildOptionsSnippet(profile, stages)
    };
  }

  function buildOptionsSnippet(profile, stages) {
    var lines = [
      'export const options = {',
      '  scenarios: {',
      '    ' + profile + ': {',
      '      executor: \'ramping-vus\',',
      '      startVUs: 0,',
      '      stages: ['
    ];
    stages.forEach(function (s) {
      lines.push('        { duration: \'' + s.duration + '\', target: ' + s.target + ' },');
    });
    lines.push('      ],');
    lines.push('      gracefulRampDown: \'30s\',');
    lines.push('    },');
    lines.push('  },');
    lines.push('  thresholds: {');
    lines.push('    http_req_duration: [\'p(95)<500\'],');
    lines.push('    http_req_failed: [\'rate<0.01\'],');
    lines.push('  },');
    lines.push('};');
    return lines.join('\n');
  }

  /* ---------- สถิติสำหรับกราฟและหน้า latency ---------- */

  /* คำนวณ percentile ด้วยนิยาม index = p × (n − 1) แล้ว interpolate */
  function percentileStep(sorted, p) {
    if (!Array.isArray(sorted) || sorted.length === 0) return null;
    var pv = toNumber(p);
    if (!Number.isFinite(pv) || pv < 0 || pv > 100) return null;
    var n = sorted.length;
    var index = (pv / 100) * (n - 1);
    var lower = Math.floor(index);
    var upper = Math.ceil(index);
    var lo = toNumber(sorted[lower]);
    var hi = toNumber(sorted[upper]);
    var fraction = index - lower;
    var value = lo + (hi - lo) * fraction;
    return {
      p: pv,
      n: n,
      index: index,
      lower: lower,
      upper: upper,
      lowerValue: lo,
      upperValue: hi,
      fraction: fraction,
      value: value
    };
  }

  function percentile(sorted, p) {
    var step = percentileStep(sorted, p);
    return step ? step.value : NaN;
  }

  function mean(values) {
    if (!Array.isArray(values) || values.length === 0) return NaN;
    var sum = 0;
    for (var i = 0; i < values.length; i++) sum += toNumber(values[i]);
    return sum / values.length;
  }

  /* จัดกลุ่มค่าเป็น bins กว้าง width ms; bin สุดท้ายเป็นหางเปิด (to = null) */
  function binSamples(values, width, tailMultiple) {
    if (!Array.isArray(values) || values.length === 0) return [];
    var w = toNumber(width);
    if (!Number.isFinite(w) || w <= 0) return [];
    var mult = Number.isFinite(tailMultiple) ? tailMultiple : 5;
    var max = -Infinity;
    for (var i = 0; i < values.length; i++) {
      var v = toNumber(values[i]);
      if (v > max) max = v;
    }
    var softLimit = w * Math.ceil(max / w);
    var tailStart = w * Math.ceil((max / mult) / w);
    var bins = [];
    for (var from = 0; from < tailStart; from += w) {
      bins.push({ from: from, to: from + w, count: 0 });
    }
    bins.push({ from: tailStart, to: null, count: 0 });
    values.forEach(function (raw) {
      var v = toNumber(raw);
      var idx = v >= tailStart ? bins.length - 1 : Math.floor(v / w);
      if (idx < 0) idx = 0;
      if (idx > bins.length - 1) idx = bins.length - 1;
      bins[idx].count++;
    });
    return { bins: bins, softLimit: softLimit, tailStart: tailStart };
  }

  /* จุด CDF: สำหรับแต่ละค่า เรียงแล้วคำนวณสัดส่วนสะสม */
  function cdfPoints(sorted, maxPoints) {
    if (!Array.isArray(sorted) || sorted.length === 0) return [];
    var n = sorted.length;
    var limit = Number.isFinite(maxPoints) ? maxPoints : 240;
    var stride = Math.max(1, Math.floor(n / limit));
    var pts = [];
    for (var i = 0; i < n; i += stride) {
      pts.push({ x: toNumber(sorted[i]), y: (i + 1) / n * 100 });
    }
    var last = toNumber(sorted[n - 1]);
    if (pts.length === 0 || pts[pts.length - 1].x !== last) {
      pts.push({ x: last, y: 100 });
    }
    return pts;
  }

  function describe(sorted) {
    if (!Array.isArray(sorted) || sorted.length === 0) return null;
    var n = sorted.length;
    return {
      n: n,
      min: toNumber(sorted[0]),
      max: toNumber(sorted[n - 1]),
      mean: mean(sorted),
      p50: percentile(sorted, 50),
      p75: percentile(sorted, 75),
      p90: percentile(sorted, 90),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99)
    };
  }

  ROOT.LTK6.calc = {
    round: round,
    toNumber: toNumber,
    FIELD_LABELS: FIELD_LABELS,
    validateInputs: validateInputs,
    hasErrors: hasErrors,
    iterationDurationMs: iterationDurationMs,
    iterationsPerSecond: iterationsPerSecond,
    tps: tps,
    tpsPerVu: tpsPerVu,
    vusForTps: vusForTps,
    littlesLaw: littlesLaw,
    tpsCalculator: tpsCalculator,
    vuCalculator: vuCalculator,
    recommendProfile: recommendProfile,
    PROFILE_TEXT: PROFILE_TEXT,
    percentileStep: percentileStep,
    percentile: percentile,
    mean: mean,
    binSamples: binSamples,
    cdfPoints: cdfPoints,
    describe: describe
  };
})();
