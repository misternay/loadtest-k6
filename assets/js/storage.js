/* ==========================================================================
   storage.js — ความคืบหน้าและคะแนนควิซ (localStorage)
   key: ltk6.progress.v1   schema มี version
   ถ้า localStorage ใช้ไม่ได้ (private mode / ปิดคุกกี้) จะไม่ throw
   แต่จะรายงานผ่าน available = false เพื่อให้หน้าเว็บแจ้งผู้ใช้อย่างสุภาพ
   ========================================================================== */
(function () {
  'use strict';

  var ROOT = typeof globalThis !== 'undefined' ? globalThis : this;
  ROOT.LTK6 = ROOT.LTK6 || {};

  var KEY = 'ltk6.progress.v1';
  var VERSION = 1;
  var LESSON_IDS = ['01-tps', '02-vu', '03-metrics', '04-percentiles', '05-load-profiles', '06-read-results'];

  function emptyState() {
    return { version: VERSION, read: {}, quiz: {}, updatedAt: null };
  }

  /* ---------- availability ---------- */

  var probe = (function () {
    try {
      if (typeof localStorage === 'undefined' || localStorage === null) {
        return { ok: false, reason: 'localStorage ไม่พร้อมใช้งานในเบราว์เซอร์นี้' };
      }
      var k = KEY + '.probe';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return { ok: true, reason: '' };
    } catch (err) {
      return {
        ok: false,
        reason: 'เบราว์เซอร์ปิดกั้นการบันทึกข้อมูล (โหมดไม่ระบุตัวตน/ส่วนตัว หรือปิดคุกกี้)'
      };
    }
  })();

  /* ---------- normalisation ---------- */

  function isPlainObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  }

  function toFiniteNumber(v) {
    var n = typeof v === 'number' ? v : parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }

  function normaliseQuizEntry(raw) {
    if (!isPlainObject(raw)) return null;
    var best = toFiniteNumber(raw.best);
    var total = toFiniteNumber(raw.total);
    if (best === null || total === null || total <= 0) return null;
    best = Math.max(0, Math.min(best, total));
    var attempts = toFiniteNumber(raw.attempts);
    return {
      best: best,
      total: total,
      attempts: attempts === null || attempts < 0 ? 1 : Math.floor(attempts),
      at: typeof raw.at === 'string' ? raw.at : null,
      lastScore: toFiniteNumber(raw.lastScore) === null ? best : Math.max(0, Math.min(toFiniteNumber(raw.lastScore), total))
    };
  }

  function normaliseReadEntry(raw) {
    if (raw === true) return { at: null };
    if (!isPlainObject(raw)) return null;
    return { at: typeof raw.at === 'string' ? raw.at : null };
  }

  function normalise(raw) {
    var out = emptyState();
    if (!isPlainObject(raw)) return out;

    if (isPlainObject(raw.read)) {
      Object.keys(raw.read).forEach(function (id) {
        var entry = normaliseReadEntry(raw.read[id]);
        if (entry) out.read[id] = entry;
      });
    }
    if (isPlainObject(raw.quiz)) {
      Object.keys(raw.quiz).forEach(function (id) {
        var entry = normaliseQuizEntry(raw.quiz[id]);
        if (entry) out.quiz[id] = entry;
      });
    }
    out.updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : null;
    return out;
  }

  /* ---------- state ---------- */

  var state = emptyState();
  var loadError = '';

  function load() {
    if (!probe.ok) {
      state = emptyState();
      return state;
    }
    try {
      var text = localStorage.getItem(KEY);
      if (!text) {
        state = emptyState();
        return state;
      }
      state = normalise(JSON.parse(text));
      return state;
    } catch (err) {
      loadError = 'ข้อมูลที่บันทึกไว้เสียหาย จึงเริ่มบันทึกใหม่จากศูนย์';
      state = emptyState();
      return state;
    }
  }

  function save() {
    if (!probe.ok) return false;
    try {
      state.updatedAt = new Date().toISOString();
      localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (err) {
      return false;
    }
  }

  /* ---------- public API ---------- */

  /* อ่านและตรวจไฟล์นำเข้า คืน {ok:true, state, summary} หรือ {ok:false, error} */
  function parseImport(text) {
    if (typeof text !== 'string' || text.trim() === '') {
      return { ok: false, error: 'ไฟล์ว่างเปล่า ไม่มีข้อมูลให้อ่าน' };
    }
    var parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      return { ok: false, error: 'อ่านไฟล์ไม่สำเร็จ: ไม่ใช่รูปแบบ JSON ที่ถูกต้อง' };
    }
    if (!isPlainObject(parsed)) {
      return { ok: false, error: 'โครงสร้างไฟล์ไม่ถูกต้อง: ต้องเป็นออบเจกต์ JSON' };
    }
    if (parsed.version !== VERSION) {
      return {
        ok: false,
        error: 'ไฟล์นี้เป็น schema version ' + JSON.stringify(parsed.version) +
          ' แต่หน้านี้รองรับ version ' + VERSION + ' เท่านั้น'
      };
    }
    if (!isPlainObject(parsed.read) && !isPlainObject(parsed.quiz)) {
      return { ok: false, error: 'ไม่พบส่วน read หรือ quiz ในไฟล์ ความคืบหน้าจึงว่างเปล่า' };
    }
    var next = normalise(parsed);
    return {
      ok: true,
      state: next,
      summary: {
        read: Object.keys(next.read).length,
        quiz: Object.keys(next.quiz).length,
        updatedAt: next.updatedAt
      }
    };
  }

  var api = {
    KEY: KEY,
    VERSION: VERSION,
    LESSON_IDS: LESSON_IDS,

    available: probe.ok,
    unavailableReason: probe.reason,

    loadError: function () { return loadError; },
    getState: function () { return state; },

    /* --- อ่านแล้ว ---
       คืน true เมื่อบันทึกลงเครื่องได้จริง และคืน false เมื่อบันทึกไม่ได้
       (เช่นอยู่ในโหมดส่วนตัว) แต่สถานะในหน่วยความจำยังถูกอัปเดต เพื่อให้ปุ่ม
       บนหน้าจอตอบสนองได้ ไม่กลายเป็นปุ่มตาย โดยหน้านั้นมีแถบเตือนอยู่แล้วว่าไม่ถูกบันทึก */
    isRead: function (pageId) { return Object.prototype.hasOwnProperty.call(state.read, pageId); },
    readAt: function (pageId) {
      var e = state.read[pageId];
      return e && e.at ? e.at : null;
    },
    markRead: function (pageId) {
      if (!pageId) return false;
      if (state.read[pageId]) return false;
      state.read[pageId] = { at: new Date().toISOString() };
      return save();
    },
    unmarkRead: function (pageId) {
      if (!pageId || !state.read[pageId]) return false;
      delete state.read[pageId];
      return save();
    },
    lessonsReadCount: function () {
      return LESSON_IDS.filter(function (id) { return api.isRead(id); }).length;
    },

    /* --- ควิซ --- */
    getQuiz: function (lessonId) { return state.quiz[lessonId] || null; },
    saveQuizResult: function (lessonId, score, total) {
      if (!lessonId || !Number.isFinite(score) || !Number.isFinite(total) || total <= 0) return null;
      score = Math.max(0, Math.min(Math.round(score), total));
      var prev = state.quiz[lessonId];
      var entry = {
        best: prev ? Math.max(prev.best, score) : score,
        lastScore: score,
        total: total,
        attempts: prev ? prev.attempts + 1 : 1,
        at: new Date().toISOString()
      };
      state.quiz[lessonId] = entry;
      save();
      return entry;
    },
    quizBestTotal: function () {
      var best = 0, total = 0;
      LESSON_IDS.forEach(function (id) {
        var q = state.quiz[id];
        if (q) { best += q.best; total += q.total; }
      });
      return { best: best, total: total };
    },

    /* --- รีเซ็ต --- */
    reset: function () {
      state = emptyState();
      if (probe.ok) {
        try { localStorage.removeItem(KEY); } catch (err) { /* ไม่มีอะไรต้องทำ */ }
      }
      return state;
    },

    /* --- export / import --- */
    exportJSON: function () {
      return JSON.stringify(state, null, 2);
    },
    exportFilename: function () {
      var d = new Date();
      var p = function (n) { return String(n).padStart(2, '0'); };
      return 'ltk6-progress-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '.json';
    },
    /* ตรวจรูปแบบไฟล์โดยยังไม่แก้ไขข้อมูลปัจจุบัน
       คืน {ok:true, summary, apply()} หรือ {ok:false, error} */
    validateImport: function (text) {
      var check = parseImport(text);
      if (!check.ok) return check;
      return {
        ok: true,
        summary: check.summary,
        state: check.state
      };
    },
    /* นำข้อมูลที่ผ่านการตรวจแล้วมาใช้จริง */
    applyImport: function (text) {
      var check = parseImport(text);
      if (!check.ok) return check;
      state = check.state;
      save();
      return { ok: true, summary: check.summary };
    },
    /* ตรวจและนำเข้าในขั้นตอนเดียว */
    importJSON: function (text) {
      return api.applyImport(text);
    },

    /* --- ตัวช่วยแสดงผล --- */
    formatDateTime: function (iso) {
      if (!iso) return 'ไม่ทราบเวลา';
      var d = new Date(iso);
      if (isNaN(d.getTime())) return 'ไม่ทราบเวลา';
      var p = function (n) { return String(n).padStart(2, '0'); };
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
        ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
    }
  };

  load();
  ROOT.LTK6.storage = api;
})();
