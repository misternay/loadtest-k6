/* ==========================================================================
   charts.js — วาดกราฟ SVG จากข้อมูลจริง (ไม่มี asset หรือไลบรารีภายนอก)
   - histogram: การกระจายของ latency
   - cdf: สัดส่วนสะสม พร้อมเส้น mark p50/p90/p95/p99 และ mean
   ทุกกราฟมี aria-label, คำอธิบายใต้กราฟ ( caller ใส่ ), และ hover/คีย์บอร์ดดูค่าได้
   ========================================================================== */
(function () {
  'use strict';

  var ROOT = typeof globalThis !== 'undefined' ? globalThis : this;
  ROOT.LTK6 = ROOT.LTK6 || {};

  var NS = 'http://www.w3.org/2000/svg';

  function fmt(v, digits) {
    if (ROOT.LTK6.format && ROOT.LTK6.format.number) {
      return ROOT.LTK6.format.number(v, digits === undefined ? 2 : digits);
    }
    var d = digits === undefined ? 2 : digits;
    var n = Number(v);
    if (!Number.isFinite(n)) return '—';
    var r = Math.round(n * Math.pow(10, d)) / Math.pow(10, d);
    var parts = String(r).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return d > 0 && parts[1] ? parts[0] + '.' + parts[1] : (d > 0 ? parts[0] + '.' + '0'.repeat(d) : parts[0]);
  }

  function el(name, attrs, text) {
    var node = document.createElementNS(NS, name);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (attrs[k] === null || attrs[k] === undefined) return;
        node.setAttribute(k, String(attrs[k]));
      });
    }
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  /* ---------- แกนและกริด ---------- */

  function ticks(max, count) {
    var steps = count || 4;
    var raw = max / steps;
    var mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
    var norm = raw / mag;
    var mult = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
    var step = mult * mag;
    var out = [];
    for (var v = 0; v <= max + step * 0.001 && out.length < 12; v += step) {
      out.push(Math.round(v * 1000) / 1000);
    }
    return out;
  }

  function makeTooltip(host) {
    var tip = host.querySelector('.chart-tooltip');
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'chart-tooltip';
      tip.hidden = true;
      tip.setAttribute('role', 'status');
      host.appendChild(tip);
    }
    return tip;
  }

  function showTip(host, tip, x, y, lines) {
    tip.textContent = '';
    lines.forEach(function (line, i) {
      if (i > 0) tip.appendChild(document.createElement('br'));
      tip.appendChild(document.createTextNode(line));
    });
    tip.hidden = false;
    var rect = host.getBoundingClientRect();
    var left = Math.min(Math.max(x, 60), rect.width - 60);
    tip.style.left = left + 'px';
    tip.style.top = Math.max(y, 24) + 'px';
  }

  /* ======================================================================
     Histogram
     opts: { bins:[{from,to,count}], unit, total, marks:[{value,label,kind}] }
     ====================================================================== */
  function histogram(host, opts) {
    var bins = opts.bins || [];
    var unit = opts.unit || 'ms';
    var total = opts.total || bins.reduce(function (a, b) { return a + b.count; }, 0);

    var W = 900, H = 360;
    var PAD = { top: 70, right: 18, bottom: 46, left: 58 };
    var plotW = W - PAD.left - PAD.right;
    var plotH = H - PAD.top - PAD.bottom;

    var closed = bins.filter(function (b) { return b.to !== null; });
    var tail = bins.filter(function (b) { return b.to === null; });
    var domainMax = closed.length ? closed[closed.length - 1].to : 1;

    var tailBarW = tail.length ? 26 : 0;
    var gapW = tail.length ? 16 : 0;
    var barsW = plotW - tailBarW - gapW;
    var sx = barsW / domainMax;

    var maxCount = bins.reduce(function (a, b) { return Math.max(a, b.count); }, 0);
    var yTicks = ticks(maxCount, 4);
    var yMax = yTicks.length ? yTicks[yTicks.length - 1] : maxCount || 1;
    var sy = plotH / (yMax || 1);

    var svg = el('svg', {
      viewBox: '0 0 ' + W + ' ' + H,
      preserveAspectRatio: 'xMidYMid meet',
      role: 'img',
      'aria-label': opts.ariaLabel || ('ฮิสโตแกรมการกระจายของค่า ' + unit)
    });

    var g = el('g', { transform: 'translate(' + PAD.left + ',' + PAD.top + ')' });
    svg.appendChild(g);

    /* grid + y labels */
    yTicks.forEach(function (t) {
      var y = plotH - t * sy;
      g.appendChild(el('line', { x1: 0, y1: y, x2: plotW, y2: y, stroke: 'var(--border)', 'stroke-width': 1 }));
      g.appendChild(el('text', {
        x: -10, y: y + 3.5, 'text-anchor': 'end',
        'font-size': 11, fill: 'var(--muted)', style: 'font-variant-numeric:tabular-nums'
      }, fmt(t, 0)));
    });
    /* baseline */
    g.appendChild(el('line', { x1: 0, y1: plotH, x2: plotW, y2: plotH, stroke: 'var(--border-strong)', 'stroke-width': 1 }));
    /* y axis title */
    g.appendChild(el('text', {
      x: -46, y: -12, 'font-size': 10.5, fill: 'var(--muted)', 'letter-spacing': '.06em'
    }, opts.yLabel || 'จำนวน REQUEST'));

    /* x ticks */
    var xStep = domainMax / 5;
    for (var i = 0; i <= 5; i++) {
      var xv = xStep * i;
      var x = xv * sx;
      g.appendChild(el('line', { x1: x, y1: plotH, x2: x, y2: plotH + 5, stroke: 'var(--border-strong)', 'stroke-width': 1 }));
      g.appendChild(el('text', {
        x: x, y: plotH + 19, 'text-anchor': 'middle',
        'font-size': 11, fill: 'var(--muted)', style: 'font-variant-numeric:tabular-nums'
      }, fmt(xv, 0)));
    }
    g.appendChild(el('text', {
      x: plotW, y: plotH + 36, 'text-anchor': 'end', 'font-size': 11, fill: 'var(--muted)'
    }, 'latency (' + unit + ')'));

    /* bars */
    var bars = [];
    bins.forEach(function (b) {
      var isTail = b.to === null;
      var x, w;
      if (isTail) {
        x = barsW + gapW;
        w = tailBarW;
      } else {
        x = b.from * sx;
        w = Math.max(1, (b.to - b.from) * sx - 1);
      }
      var h = b.count * sy;
      var rect = el('rect', {
        x: x, y: plotH - h, width: w, height: Math.max(h, b.count > 0 ? 1 : 0),
        fill: isTail ? 'var(--signal)' : 'var(--chart-1)',
        'fill-opacity': isTail ? 0.85 : 0.72,
        tabindex: -1
      });
      g.appendChild(rect);
      bars.push({ rect: rect, bin: b, x: x + w / 2, top: plotH - h });
    });

    /* tail bar label */
    if (tail.length) {
      var tailX = barsW + gapW + tailBarW / 2;
      g.appendChild(el('text', {
        x: tailX, y: plotH + 19, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--signal)'
      }, '>' + fmt(domainMax, 0)));
      g.appendChild(el('text', {
        x: tailX, y: plotH + 32, 'text-anchor': 'middle', 'font-size': 9.5, fill: 'var(--muted)'
      }, 'หาง'));
    }

    /* markers */
    (opts.marks || []).forEach(function (m, mi) {
      var mx = m.value * sx;
      if (mx > barsW) return;
      var useSignal = m.kind === 'mean';
      var color = useSignal ? 'var(--signal)' : m.color || 'var(--accent)';
      g.appendChild(el('line', {
        x1: mx, y1: -6, x2: mx, y2: plotH,
        stroke: color, 'stroke-width': 1.2, 'stroke-dasharray': useSignal ? '4 3' : '2 2'
      }));
      g.appendChild(el('circle', { cx: mx, cy: -6, r: 2.4, fill: color }));
      var anchorY = -12 - mi * 13;
      var anchor = el('text', {
        x: mx, y: anchorY,
        transform: 'rotate(-90 ' + mx + ' ' + anchorY + ')',
        'text-anchor': 'end', 'font-size': 10, fill: color,
        style: 'font-variant-numeric:tabular-nums'
      }, m.label);
      g.appendChild(anchor);
      g.appendChild(el('line', {
        x1: mx, y1: anchorY - 2, x2: mx, y2: -6, stroke: color, 'stroke-width': 0.8, 'stroke-opacity': 0.5
      }));
    });

    host.insertBefore(svg, host.firstChild);
    var tip = makeTooltip(host);

    function attach(bar) {
      var b = bar.bin;
      var range = b.to === null
        ? 'ตั้งแต่ ' + fmt(b.from, 0) + ' ' + unit + ' ขึ้นไป'
        : fmt(b.from, 0) + '–' + fmt(b.to, 0) + ' ' + unit;
      var pct = total ? (b.count / total * 100) : 0;
      var rect = host.getBoundingClientRect();
      var scale = rect.width / W;
      showTip(host, tip, (bar.x + PAD.left) * scale, PAD.top + bar.top - 4,
        [range, fmt(b.count, 0) + ' request (' + fmt(pct, 2) + '%)']);
    }
    bars.forEach(function (bar) {
      bar.rect.addEventListener('pointerenter', function () { attach(bar); });
      bar.rect.addEventListener('pointermove', function () { attach(bar); });
      bar.rect.addEventListener('pointerleave', function () { tip.hidden = true; });
    });
    svg.addEventListener('pointerleave', function () { tip.hidden = true; });

    return { svg: svg, bars: bars, tail: tail };
  }

  /* ======================================================================
     CDF
     opts: { points:[{x,y}], xMax, unit, marks:[{value,label,pct,kind,color,row}] }
     ====================================================================== */
  function cdf(host, opts) {
    var points = opts.points || [];
    var unit = opts.unit || 'ms';
    var W = 900, H = 380;
    var PAD = { top: 70, right: 22, bottom: 48, left: 58 };
    var plotW = W - PAD.left - PAD.right;
    var plotH = H - PAD.top - PAD.bottom;

    var xMax = opts.xMax || Math.ceil((points.length ? points[points.length - 1].x : 1) / 100) * 100;
    var sx = plotW / xMax;
    var sy = plotH / 100;

    var svg = el('svg', {
      viewBox: '0 0 ' + W + ' ' + H,
      preserveAspectRatio: 'xMidYMid meet',
      role: 'img',
      'aria-label': opts.ariaLabel || ('กราฟสัดส่วนสะสม (CDF) ของ latency หน่วย ' + unit)
    });
    var g = el('g', { transform: 'translate(' + PAD.left + ',' + PAD.top + ')' });
    svg.appendChild(g);

    [0, 25, 50, 75, 100].forEach(function (t) {
      var y = plotH - t * sy;
      g.appendChild(el('line', {
        x1: 0, y1: y, x2: plotW, y2: y,
        stroke: t === 50 ? 'var(--border-strong)' : 'var(--border)',
        'stroke-width': 1,
        'stroke-dasharray': t === 50 ? '3 3' : null
      }));
      g.appendChild(el('text', {
        x: -10, y: y + 3.5, 'text-anchor': 'end',
        'font-size': 11, fill: 'var(--muted)', style: 'font-variant-numeric:tabular-nums'
      }, t + '%'));
    });

    g.appendChild(el('text', {
      x: -46, y: -12, 'font-size': 10.5, fill: 'var(--muted)', 'letter-spacing': '.06em'
    }, 'สัดส่วนสะสมของ REQUEST'));

    var xTicks = ticks(xMax, 6);
    xTicks.forEach(function (t) {
      var x = t * sx;
      g.appendChild(el('line', { x1: x, y1: plotH, x2: x, y2: plotH + 5, stroke: 'var(--border-strong)', 'stroke-width': 1 }));
      g.appendChild(el('text', {
        x: x, y: plotH + 19, 'text-anchor': 'middle',
        'font-size': 11, fill: 'var(--muted)', style: 'font-variant-numeric:tabular-nums'
      }, fmt(t, 0)));
    });
    g.appendChild(el('line', { x1: 0, y1: plotH, x2: plotW, y2: plotH, stroke: 'var(--border-strong)', 'stroke-width': 1 }));
    g.appendChild(el('text', {
      x: plotW, y: plotH + 38, 'text-anchor': 'end', 'font-size': 11, fill: 'var(--muted)'
    }, 'latency (' + unit + ')'));

    /* พื้นที่ใต้เส้น */
    var areaD = ['M', 0, plotH];
    points.forEach(function (p) {
      areaD.push('L', (p.x * sx).toFixed(2), (plotH - p.y * sy).toFixed(2));
    });
    areaD.push('L', plotW, plotH, 'Z');
    g.appendChild(el('path', { d: areaD.join(' '), fill: 'var(--chart-1)', 'fill-opacity': 0.07 }));

    var lineD = points.map(function (p, i) {
      return (i === 0 ? 'M' : 'L') + (p.x * sx).toFixed(2) + ' ' + (plotH - p.y * sy).toFixed(2);
    }).join(' ');
    g.appendChild(el('path', {
      d: lineD, fill: 'none', stroke: 'var(--chart-1)', 'stroke-width': 1.6,
      'stroke-linejoin': 'round', 'stroke-linecap': 'round'
    }));

    /* markers */
    (opts.marks || []).forEach(function (m) {
      var mx = m.value * sx;
      if (mx > plotW) return;
      var my = plotH - (m.pct || 0) * sy;
      var color = m.kind === 'mean' ? 'var(--signal)' : (m.color || 'var(--accent)');
      g.appendChild(el('line', {
        x1: mx, y1: -6, x2: mx, y2: my,
        stroke: color, 'stroke-width': 1.1,
        'stroke-dasharray': m.kind === 'mean' ? '4 3' : '2 2'
      }));
      g.appendChild(el('circle', { cx: mx, cy: my, r: 3, fill: color }));
      var anchorY = -12 - (m.row || 0) * 13;
      var anchor = el('text', {
        x: mx, y: anchorY,
        transform: 'rotate(-90 ' + mx + ' ' + anchorY + ')',
        'text-anchor': 'end', 'font-size': 10, fill: color,
        style: 'font-variant-numeric:tabular-nums'
      }, m.label);
      g.appendChild(anchor);
      g.appendChild(el('line', {
        x1: mx, y1: anchorY - 2, x2: mx, y2: -6, stroke: color, 'stroke-width': 0.8, 'stroke-opacity': 0.5
      }));
    });

    host.insertBefore(svg, host.firstChild);
    var tip = makeTooltip(host);

    var hit = el('rect', { x: 0, y: 0, width: plotW, height: plotH, fill: 'transparent', tabindex: 0 });
    g.appendChild(hit);

    function nearestX(px) {
      var targetMs = px / sx;
      var lo = 0, hi = points.length - 1;
      while (lo < hi) {
        var mid = (lo + hi) >> 1;
        if (points[mid].x < targetMs) lo = mid + 1; else hi = mid;
      }
      return points[lo] || points[points.length - 1];
    }

    var rect = null;
    function onMove(evt) {
      var box = host.getBoundingClientRect();
      var scale = box.width / W;
      var localX = evt.clientX - box.left - PAD.left * scale;
      var px = localX / scale;
      if (px < 0 || px > plotW) { tip.hidden = true; return; }
      var p = nearestX(px);
      showTip(host, tip, (p.x * sx + PAD.left) * scale, PAD.top + (plotH - p.y * sy) * scale - 4,
        ['≤ ' + fmt(p.x, 2) + ' ' + unit, fmt(p.y, 2) + '% ของ request']);
    }
    hit.addEventListener('pointermove', onMove);
    hit.addEventListener('pointerleave', function () { tip.hidden = true; });

    var cursorIdx = 0;
    hit.addEventListener('keydown', function (evt) {
      var step = Math.max(1, Math.round(points.length / 40));
      if (evt.key === 'ArrowRight') { cursorIdx = Math.min(points.length - 1, cursorIdx + step); }
      else if (evt.key === 'ArrowLeft') { cursorIdx = Math.max(0, cursorIdx - step); }
      else if (evt.key === 'Home') { cursorIdx = 0; }
      else if (evt.key === 'End') { cursorIdx = points.length - 1; }
      else if (evt.key === 'Home') { cursorIdx = 0; }
      else { return; }
      evt.preventDefault();
      var p = points[cursorIdx];
      var box = host.getBoundingClientRect();
      var scale = box.width / W;
      showTip(host, tip, (p.x * sx + PAD.left) * scale, PAD.top + (plotH - p.y * sy) * scale - 4,
        ['≤ ' + fmt(p.x, 2) + ' ' + unit, fmt(p.y, 2) + '% ของ request']);
    });

    return { svg: svg, plotW: plotW, plotH: plotH };
  }

  /* ---------- สร้างตารางข้อมูลจริงจาก bins ---------- */

  function histogramTable(bins, unit, total) {
    var table = document.createElement('table');
    table.className = 'data';
    var caption = document.createElement('caption');
    caption.textContent = 'ตารางข้อมูลจริงของฮิสโตแกรม: ช่วง latency, จำนวน request และสัดส่วน (n = ' +
      fmt(total, 0) + ')';
    table.appendChild(caption);
    var thead = document.createElement('thead');
    var hr = document.createElement('tr');
    ['ช่วง (' + unit + ')', 'จำนวน request', 'สัดส่วน', 'สะสม'].forEach(function (t, i) {
      var th = document.createElement('th');
      th.textContent = t;
      if (i > 0) th.className = 'num';
      hr.appendChild(th);
    });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = document.createElement('tbody');
    var cum = 0;
    bins.forEach(function (b) {
      if (b.count === 0) return; /* แสดงเฉพาะ bin ที่มีข้อมูลจริง เพื่อให้ตารางอ่านได้ */
      cum += b.count;
      var tr = document.createElement('tr');
      var range = b.to === null ? '≥ ' + fmt(b.from, 0) : fmt(b.from, 0) + ' – ' + fmt(b.to, 0);
      var cells = [
        range,
        fmt(b.count, 0),
        fmt(b.count / total * 100, 1) + '%',
        fmt(cum / total * 100, 1) + '%'
      ];
      cells.forEach(function (text, i) {
        var td = document.createElement('td');
        td.textContent = text;
        if (i > 0) td.className = 'num';
        tr.appendChild(td);
      });
      if (b.to === null) tr.className = 'row-signal';
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    var wrap = document.createElement('div');
    wrap.className = 'table-wrap';
    wrap.appendChild(table);
    return wrap;
  }

  ROOT.LTK6.charts = {
    histogram: histogram,
    cdf: cdf,
    histogramTable: histogramTable,
    fmt: fmt,
    NS: NS
  };
})();
