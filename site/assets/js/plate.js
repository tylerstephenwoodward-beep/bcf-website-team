// Draws Marks Metal Signs signs as SVG at true size (viewBox units are hundredths of an inch).
// Cut plate: numbers cut through 11 gauge 304 stainless, wall shows through, four corner screws.
//   Closed shapes inside a character (the middle of a 0, 4, 6, 8, 9 or a) stay joined to the plate by small tabs.
// Bar: solid numbers on a bottom rail, one screw through the front of the rail near each end.
// Loose: each character cut on its own and screwed to the wall through its face.
(function () {
  var U = 100; // SVG units per inch
  // stroke: the thinnest main stroke of any digit as a share of digit height, measured from the bold
  // stand-in fonts (2026-10-22). Fire code (IFC 505.1) needs at least a 0.5 inch stroke, so a font
  // only works at a size where stroke x size >= 0.5. Re-measure when the licensed fonts arrive.
  var FONTS = {
    jost: { css: 'Jost', label: 'Futura', digit: 0.70, stroke: 0.17 },
    arimo: { css: 'Arimo', label: 'Helvetica', digit: 0.716, stroke: 0.139 },
    besley: { css: 'Besley', label: 'Besley', digit: 0.70, stroke: 0.10 }
  };
  var MIN_STROKE_IN = 0.5;
  function meetsCode(font, size) { return (FONTS[font] || FONTS.jost).stroke * size >= MIN_STROKE_IN; }
  // screw: the screw heads match the finish, so black signs get black screws.
  var FINISHES = {
    brushed: { label: 'Brushed stainless', stops: ['#d4d7d5', '#a5a9a8', '#dfe1df', '#9ea2a1', '#c9ccca'], grain: true, screw: ['#f4f5f4', '#a9adab', '#5f6362'] },
    black: { label: 'Black powder coat', stops: ['#2c2c2d', '#1d1d1e', '#262627', '#1a1a1b', '#232324'], screw: ['#55565a', '#262628', '#0e0e0f'] },
    // Bronze and white are not offered on the site until Terran confirms them (decision 2026-10-21).
    bronze: { label: 'Bronze powder coat', stops: ['#5e4733', '#45331f', '#59432f', '#3f2f1d', '#523d29'], screw: ['#8a6c4f', '#4f3a25', '#2c2014'] },
    white: { label: 'White powder coat', stops: ['#f0efea', '#dddbd4', '#ecebe5', '#d8d6cf', '#e7e6e0'], screw: ['#ffffff', '#e2e0da', '#a9a7a1'] }
  };
  var uid = 0;
  var measureCtx = document.createElement('canvas').getContext('2d');

  // Places each character on its own (gap between them), so tabs and screws line up with it exactly.
  function layout(text, fontCss, fs, gap) {
    measureCtx.font = '700 ' + fs + 'px ' + fontCss;
    var x = 0, chars = [];
    text.split('').forEach(function (ch, i) {
      if (i) x += gap;
      var adv = measureCtx.measureText(ch).width;
      chars.push({ ch: ch, x: x, w: adv });
      x += adv;
    });
    return { chars: chars, width: x };
  }

  // How far the ink reaches above and below the baseline, so the number is centered on what you see.
  function inkBox(text, fontCss, fs) {
    measureCtx.font = '700 ' + fs + 'px ' + fontCss;
    var t = measureCtx.measureText(text.replace(/ /g, '') || '0');
    var a = t.actualBoundingBoxAscent, d = t.actualBoundingBoxDescent;
    return a > 0 ? { ascent: a, descent: d || 0 } : { ascent: fs * 0.7, descent: 0 };
  }

  function textEls(lay, x0, y, attrs, extra) {
    return lay.chars.map(function (c) {
      return c.ch === ' ' ? '' : '<text x="' + (x0 + c.x).toFixed(1) + '" y="' + y.toFixed(1) + '" ' + attrs + (extra || '') + '>' + c.ch + '</text>';
    }).join('');
  }

  // Shape analysis of one character, drawn on a small canvas: which pixels are steel, which closed
  // shapes would fall out when cut, and how deep each steel pixel sits inside the stroke.
  var GRID = 160, shapes = {}, waiting = {};

  // Where a character's tabs go, copied from Terran's real signs (7009a, 2724, 4027):
  //   'top'     a narrow tab straight up from the middle of the shape's top edge (his 0s)
  //   'bottom'  straight down from the middle of its bottom edge (the A and the 4, through the crossbar)
  //   'bottom@0.8'  straight down, that share of the way across the shape
  //   a number  a clock position: the tab runs straight out from the middle of the shape at that hour, so his 9 is
  //             cut at half past 7 (where the bowl meets the tail) and his 6 at half past 1 (under the hook)
  // A list is one entry per closed shape, top to bottom. Anything not listed gets 'top'. If the set spot can't reach
  // open plate, the nearest hour that can is used. viewer3d.js reads these same tabs through BCFPlate.tabs.
  var TAB_RULE = { A: 'bottom', '4': 'bottom', '8': ['top', 'bottom'], B: ['top', 'bottom'], p: 'bottom', q: 'bottom', '9': 7.5, '6': 1.5 };
  // Terran's photos are all Futura. Helvetica and Besley close their 6 and 9 tighter, so a slanted tab there lands in
  // a slit; they get straight tabs like his 0s instead. Their g is two-story. The a is tabbed at the top in every font:
  // his beside-the-stem tab lands in a hairline notch in these fonts.
  var TAB_FONT = {
    Arimo: { '6': 'bottom', '9': 'top', g: ['top', 'bottom'] },
    Besley: { '6': 'bottom', '9': 'top', g: ['top', 'bottom'] }
  };
  function tabRule(ch, k, count, fontCss) {
    var f = TAB_FONT[fontCss] || {}, r = ch in f ? f[ch] : TAB_RULE[ch];
    return Array.isArray(r) ? (count === r.length ? r[k] : 'top') : r == null ? 'top' : r;
  }
  function shape(fontCss, ch) {
    var key = fontCss + '|' + ch;
    if (shapes[key]) return shapes[key];
    if (document.fonts && !document.fonts.check('700 20px "' + fontCss + '"')) {
      // Font still loading: draw without tabs now, and tell the page to redraw once it arrives.
      if (!waiting[fontCss]) {
        waiting[fontCss] = 1;
        document.fonts.load('700 20px "' + fontCss + '"').then(function () { window.dispatchEvent(new Event('bcf:fonts')); });
      }
      return null;
    }
    var c = document.createElement('canvas'), g = c.getContext('2d');
    g.font = '700 ' + GRID + 'px ' + fontCss;
    var adv = g.measureText(ch).width, ox = Math.round(GRID * 0.25), oy = Math.round(GRID * 1.15);
    var w = Math.ceil(adv + GRID * 0.5), h = Math.ceil(GRID * 1.5), n = w * h;
    c.width = w; c.height = h;
    g.font = '700 ' + GRID + 'px ' + fontCss;
    g.fillText(ch, ox, oy);
    var px = g.getImageData(0, 0, w, h).data, ink = new Uint8Array(n), lab = new Int32Array(n), i;
    for (i = 0; i < n; i++) ink[i] = px[i * 4 + 3] > 127 ? 1 : 0;
    // lab: 1 = open background reachable from the edge, 2 and up = closed shapes
    function fill(start, id) {
      var stack = [start]; lab[start] = id;
      while (stack.length) {
        var p = stack.pop(), x = p % w;
        [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w].forEach(function (q) {
          if (q >= 0 && q < n && !ink[q] && !lab[q]) { lab[q] = id; stack.push(q); }
        });
      }
    }
    for (i = 0; i < w; i++) { if (!ink[i] && !lab[i]) fill(i, 1); if (!ink[n - 1 - i] && !lab[n - 1 - i]) fill(n - 1 - i, 1); }
    for (i = 0; i < h; i++) { if (!ink[i * w] && !lab[i * w]) fill(i * w, 1); if (!ink[i * w + w - 1] && !lab[i * w + w - 1]) fill(i * w + w - 1, 1); }
    var islands = [], id = 2;
    for (i = 0; i < n; i++) if (!ink[i] && !lab[i]) { fill(i, id); islands.push({ id: id, area: 0, sx: 0, sy: 0, x0: w, x1: 0, y0: h, y1: 0 }); id++; }
    for (i = 0; i < n; i++) if (lab[i] > 1) {
      var s = islands[lab[i] - 2], x = i % w, y = (i / w) | 0;
      s.area++; s.sx += x; s.sy += y; s.x0 = Math.min(s.x0, x); s.x1 = Math.max(s.x1, x); s.y0 = Math.min(s.y0, y); s.y1 = Math.max(s.y1, y);
    }
    // Tabs, one per closed shape (see TAB_RULE). A tab is a straight bridge of plate across the cut, about 1/25 of
    // the character height wide, landing on open plate. Its ends flare a little, so the cut rounds off where it meets
    // the tab, the way a laser leaves it.
    var tabs = [], tabW = GRID * 0.04;
    var real = islands.filter(function (s) { return s.area >= GRID * GRID * 0.002; }) // drop anti-aliasing specks
      .sort(function (a, b) { return a.y0 - b.y0; });
    real.forEach(function (s, k) {
      var rule = tabRule(ch, k, real.length, fontCss), t;
      if (typeof rule === 'number') t = clockTab(s, rule);
      else {
        var down = rule.indexOf('bottom') === 0, at = +(rule.split('@')[1] || 0.5);
        t = straightTab(s, down ? 1 : -1, at) || straightTab(s, down ? 1 : -1, 0.5) || clockTab(s, down ? 6 : 12);
      }
      if (!t) return;
      // Run each end on into open plate (up to most of a tab width, stopping before any more cut), so the bar's
      // sides cross the cut edge cleanly. j1 and j2 are where it meets the cut; build() rounds the corners there.
      var L = Math.hypot(t[2] - t[0], t[3] - t[1]) || 1, ux = (t[2] - t[0]) / L, uy = (t[3] - t[1]) / L;
      var a = reach(t[0], t[1], -ux, -uy), b = reach(t[2], t[3], ux, uy), em = function (x, y) { return [(x - ox) / GRID, (y - oy) / GRID]; };
      var A = em(a[0], a[1]), B = em(b[0], b[1]);
      tabs.push({ x1: A[0], y1: A[1], x2: B[0], y2: B[1], w: tabW / GRID, j: [em(t[0], t[1]), em(t[2], t[3])] });
    });
    function reach(x, y, ux, uy) {
      var half = tabW / 2, nx = -uy, ny = ux, best = 0;
      for (var t = 0.5; t <= tabW * 0.8; t += 0.5) {
        for (var k = -1; k <= 1; k += 0.5) {
          var q = Math.round(y + uy * t + ny * half * k) * w + Math.round(x + ux * t + nx * half * k);
          if (q < 0 || q >= n || ink[q]) return [x + ux * best, y + uy * best];
        }
        best = t;
      }
      return [x + ux * best, y + uy * best];
    }
    // Straight up (dir -1) or down (dir 1) out of the shape. at 0.5 is the middle of its top or bottom edge; other
    // values pick a column that share of the way across the shape, starting from that column's own edge.
    function straightTab(s, dir, at) {
      var y = dir < 0 ? s.y0 : s.y1, xs = [], cx, yy;
      if (at === 0.5) {
        for (var x = s.x0; x <= s.x1; x++) if (lab[y * w + x] === s.id) xs.push(x);
        if (!xs.length) return null;
        cx = Math.round((xs[0] + xs[xs.length - 1]) / 2);
      } else {
        cx = Math.round(s.x0 + (s.x1 - s.x0) * at);
        for (y = dir < 0 ? s.y0 : s.y1; y >= s.y0 && y <= s.y1 && lab[y * w + cx] !== s.id; y -= dir) {}
        if (lab[y * w + cx] !== s.id) return null;
      }
      yy = y;
      while (yy >= 0 && yy < h && lab[yy * w + cx] === s.id) yy += dir;
      var y0 = yy;
      while (yy >= 0 && yy < h && ink[yy * w + cx]) yy += dir;
      if (yy < 0 || yy >= h || lab[yy * w + cx] !== 1 || Math.abs(yy - y0) > GRID * 0.45) return null;
      return [cx, y0 - dir, cx, yy];
    }
    // From the middle of the shape, straight out at a clock hour, across the cut to open plate. Tries the hour first,
    // then up to 45 degrees either side, keeping the nearest hour that works (a short crossing breaks near-ties).
    function clockTab(s, hour) {
      var cx = s.sx / s.area, cy = s.sy / s.area, best = null;
      for (var off = 0; off <= 45; off += 3) [off, -off].forEach(function (o, i) {
        if (i && !off) return;
        var a = (hour / 12 * 360 + o) * Math.PI / 180, ux = Math.sin(a), uy = -Math.cos(a), t = 0, q, last = null, enter = null;
        for (; t < GRID; t += 0.5) {
          var px = Math.round(cx + ux * t), py = Math.round(cy + uy * t);
          if (px < 0 || py < 0 || px >= w || py >= h) return;
          q = py * w + px;
          if (lab[q] === s.id) { last = [px, py]; if (enter) return; continue; } // a ray that re-enters the shape is no good
          if (!last) continue;
          if (!enter) enter = t;
          if (!ink[q]) break;
        }
        if (!last || !enter || lab[q] !== 1) return;
        var len = t - enter, score = Math.abs(o) / 45 + len / (GRID * 0.5);
        if (!best || score < best.score) best = { score: score, t: [last[0], last[1], Math.round(cx + ux * t), Math.round(cy + uy * t)] };
      });
      return best && best.t;
    }
    // Depth inside the stroke (chamfer distance, 3 per pixel) for placing screws on loose numbers.
    var dist = new Uint16Array(n), big = 60000, inkY0 = h, inkY1 = 0, inkX0 = w, inkX1 = 0;
    for (i = 0; i < n; i++) {
      dist[i] = ink[i] ? big : 0;
      if (ink[i]) { var ix = i % w, iy = (i / w) | 0; inkY0 = Math.min(inkY0, iy); inkY1 = Math.max(inkY1, iy); inkX0 = Math.min(inkX0, ix); inkX1 = Math.max(inkX1, ix); }
    }
    function relax(p, q, cost) { if (q >= 0 && q < n && dist[q] + cost < dist[p]) dist[p] = dist[q] + cost; }
    for (i = 0; i < n; i++) if (dist[i]) {
      var x1 = i % w;
      relax(i, i - w, 3); if (x1 > 0) { relax(i, i - 1, 3); relax(i, i - w - 1, 4); } if (x1 < w - 1) relax(i, i - w + 1, 4);
    }
    for (i = n - 1; i >= 0; i--) if (dist[i]) {
      var x2 = i % w;
      relax(i, i + w, 3); if (x2 < w - 1) { relax(i, i + 1, 3); relax(i, i + w + 1, 4); } if (x2 > 0) relax(i, i + w - 1, 4);
    }
    shapes[key] = { w: w, h: h, ox: ox, oy: oy, tabs: tabs, dist: dist, ink: [inkX0, inkY0, inkX1, inkY1] };
    return shapes[key];
  }

  // Two screw spots inside the stroke of a loose character, one near the top and one near the bottom.
  // rEm is the screw head radius as a share of the font size. Returns points in font-size units.
  function screwSpots(sh, rEm) {
    var need = Math.max(3, rEm * GRID * 3) * 3, w = sh.w, mid = (sh.ink[0] + sh.ink[2]) / 2, best = [null, null];
    function pick(y0, y1, step, slot) {
      for (var y = y0; y !== y1; y += step) {
        var bx = -1;
        for (var x = 0; x < w; x++) if (sh.dist[y * w + x] >= need && (bx < 0 || Math.abs(x - mid) < Math.abs(bx - mid))) bx = x;
        if (bx >= 0) { best[slot] = [bx, y]; return; }
      }
    }
    pick(sh.ink[1], sh.ink[3] + 1, 1, 0);
    pick(sh.ink[3], sh.ink[1] - 1, -1, 1);
    var pts = best.filter(Boolean);
    if (pts.length === 2 && pts[1][1] - pts[0][1] < GRID * 0.25) pts = [pts[0]];
    return pts.map(function (p) { return { x: (p[0] - sh.ox) / GRID, y: (p[1] - sh.oy) / GRID }; });
  }

  var TURN = [14, 61, 103, 37, 82, 128, 9, 54]; // screws are never all turned the same way
  function screw(x, y, r, gid, k) {
    var l = r * 0.6;
    return '<g transform="translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ')">' +
      '<circle r="' + r.toFixed(1) + '" fill="url(#' + gid + ')" stroke="rgba(0,0,0,0.4)" stroke-width="' + (r * 0.09).toFixed(2) + '"/>' +
      '<path transform="rotate(' + TURN[k % TURN.length] + ')" d="M' + (-l).toFixed(1) + ' 0H' + l.toFixed(1) + 'M0 ' + (-l).toFixed(1) + 'V' + l.toFixed(1) + '" stroke="rgba(0,0,0,0.62)" stroke-width="' + (r * 0.26).toFixed(2) + '" stroke-linecap="round"/>' +
      '</g>';
  }

  // Outline of one tab in font-size units: a straight bar t.w wide from (x1, y1) to (x2, y2). Returns [x, y] points.
  function tabOutline(t) {
    var dx = t.x2 - t.x1, dy = t.y2 - t.y1, L = Math.hypot(dx, dy) || 1e-6, nx = -dy / L * t.w / 2, ny = dx / L * t.w / 2;
    return [[t.x1 + nx, t.y1 + ny], [t.x2 + nx, t.y2 + ny], [t.x2 - nx, t.y2 - ny], [t.x1 - nx, t.y1 - ny]];
  }

  function tabRects(lay, x0, baseY, fontCss, fs, joins) {
    return lay.chars.map(function (c) {
      var sh = c.ch !== ' ' && shape(fontCss, c.ch);
      return sh ? sh.tabs.map(function (t) {
        if (joins) t.j.forEach(function (p) { joins.push([x0 + c.x + p[0] * fs, baseY + p[1] * fs]); });
        return '<path d="M' + tabOutline(t).map(function (p) { return (x0 + c.x + p[0] * fs).toFixed(1) + ' ' + (baseY + p[1] * fs).toFixed(1); }).join('L') + 'Z" fill="#fff"/>';
      }).join('') : '';
    }).join('');
  }

  // The mask for a cut plate, with soft corners where each tab meets the cut: around every join, the mask is swapped
  // for a blurred and re-sharpened copy of itself, which rounds those corners off the way the laser leaves them.
  // Everywhere else the cut stays exactly as drawn. r is the corner radius in SVG units.
  function cutMask(id, W, H, body, joins, r) {
    var base = '<rect width="' + W.toFixed(0) + '" height="' + H.toFixed(0) + '" fill="#fff"/>' + body;
    if (!joins.length) return '<mask id="' + id + 'm" maskUnits="userSpaceOnUse" x="0" y="0" width="' + W.toFixed(0) + '" height="' + H.toFixed(0) + '">' + base + '</mask>';
    return '<filter id="' + id + 'f" filterUnits="userSpaceOnUse" x="0" y="0" width="' + W.toFixed(0) + '" height="' + H.toFixed(0) + '" color-interpolation-filters="sRGB">' +
      '<feGaussianBlur stdDeviation="' + r.toFixed(1) + '"/><feComponentTransfer><feFuncR type="linear" slope="30" intercept="-14.5"/>' +
      '<feFuncG type="linear" slope="30" intercept="-14.5"/><feFuncB type="linear" slope="30" intercept="-14.5"/></feComponentTransfer></filter>' +
      '<clipPath id="' + id + 'k">' + joins.map(function (p) { return '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="' + (r * 2.4).toFixed(1) + '"/>'; }).join('') + '</clipPath>' +
      '<mask id="' + id + 'm" maskUnits="userSpaceOnUse" x="0" y="0" width="' + W.toFixed(0) + '" height="' + H.toFixed(0) + '">' + base +
      '<g clip-path="url(#' + id + 'k)"><g filter="url(#' + id + 'f)">' + base + '</g></g></mask>';
  }

  function gradient(id, stops) {
    return '<linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="0.35">' + stops.map(function (c, i) {
      return '<stop offset="' + (i / (stops.length - 1)) + '" stop-color="' + c + '"/>';
    }).join('') + '</linearGradient>';
  }

  // Returns { svg, widthIn, heightIn } for the sign described by opts.
  function build(opts) {
    var id = 'p' + (++uid);
    // Only letters, digits, spaces and dashes are cut, and that also keeps the text safe inside the SVG markup.
    var number = String(opts.number || '2724').replace(/[^0-9a-zA-Z -]/g, '').slice(0, 6) || '0';
    var font = FONTS[opts.font] || FONTS.jost;
    var finish = FINISHES[opts.finish] || FINISHES.brushed;
    var size = opts.size === 4 ? 4 : 6;
    var fs = size * U / font.digit;
    var textAttrs = 'font-family="' + font.css + ', sans-serif" font-weight="700" font-size="' + fs.toFixed(1) + '" text-anchor="start" dominant-baseline="alphabetic"';
    var defs = gradient(id + 'g', finish.stops) +
      '<pattern id="' + id + 'grain" width="400" height="3" patternUnits="userSpaceOnUse">' +
      '<rect width="400" height="1" fill="rgba(255,255,255,0.22)"/><rect y="1.6" width="400" height="0.8" fill="rgba(0,0,0,0.06)"/></pattern>' +
      '<radialGradient id="' + id + 'screw" cx="0.35" cy="0.3" r="0.8">' + finish.screw.map(function (c, i) {
        return '<stop offset="' + [0, 0.55, 1][i] + '" stop-color="' + c + '"/>';
      }).join('') + '</radialGradient>';

    if (opts.vertical) return buildVertical(opts, id, number, font, finish, size, fs, defs, textAttrs);

    if (opts.kind === 'loose') {
      // Loose numbers: each character cut on its own, with screws through its face (no plate, no rail).
      var llay = layout(number, font.css, fs, fs * 0.16), lw = llay.width;
      var lpad = size * U * 0.25, LW = lw + lpad * 2, LH = size * U + lpad * 2, lbase = lpad + size * U;
      var lshadow = '<filter id="' + id + 's" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="' + (0.2 * U) + '" dy="' + (0.35 * U) + '" stdDeviation="' + (0.22 * U) + '" flood-color="#000" flood-opacity="0.4"/></filter>';
      var lr = 0.12 * U, k = 0;
      var lscrews = llay.chars.map(function (c) {
        var sh = c.ch !== ' ' && shape(font.css, c.ch);
        return sh ? screwSpots(sh, lr / fs).map(function (p) { return screw(lpad + c.x + p.x * fs, lbase + p.y * fs, lr, id + 'screw', k++); }).join('') : '';
      }).join('');
      var lsvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + LW.toFixed(0) + ' ' + LH.toFixed(0) + '" role="img" aria-label="Loose address numbers reading ' + number + '">' +
        '<defs>' + defs + lshadow + '</defs><g filter="url(#' + id + 's)" fill="url(#' + id + 'g)">' + textEls(llay, lpad, lbase, textAttrs) + '</g>' +
        (finish.grain ? '<g fill="url(#' + id + 'grain)" opacity="0.6">' + textEls(llay, lpad, lbase, textAttrs) + '</g>' : '') +
        lscrews + '</svg>';
      return { svg: lsvg, widthIn: LW / U, heightIn: LH / U, contentWidthIn: lw / U, contentHeightIn: size };
    }

    var lay = layout(number, font.css, fs, fs * 0.06), tw = lay.width;

    if (opts.kind === 'bar') {
      var railH = size * 0.09 * U / 0.9;
      var w = tw * 1.18, h = size * U + railH * 1.6, pad = size * U * 0.25;
      var W = w + pad * 2, H = h + pad * 2;
      var base = pad + size * U, railY = base - railH * 0.15, tx = pad + (w - tw) / 2;
      var br = Math.min(0.16 * U, railH * 0.3), bin = railH * 0.9;
      var shadow = '<filter id="' + id + 's" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="' + (0.25 * U) + '" dy="' + (0.45 * U) + '" stdDeviation="' + (0.3 * U) + '" flood-color="#000" flood-opacity="0.38"/></filter>';
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W.toFixed(0) + ' ' + H.toFixed(0) + '" role="img" aria-label="Address sign reading ' + number + '">' +
        '<defs>' + defs + shadow + '</defs><g filter="url(#' + id + 's)" fill="url(#' + id + 'g)">' + textEls(lay, tx, base, textAttrs) +
        '<rect x="' + pad + '" y="' + railY.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + railH.toFixed(1) + '" rx="4"/></g>' +
        (finish.grain ? '<g fill="url(#' + id + 'grain)" opacity="0.6">' + textEls(lay, tx, base, textAttrs) + '</g>' : '') +
        screw(pad + bin, railY + railH / 2, br, id + 'screw', 0) + screw(pad + w - bin, railY + railH / 2, br, id + 'screw', 1) +
        '</svg>';
      return { svg: svg, widthIn: W / U, heightIn: H / U, contentWidthIn: w / U, contentHeightIn: h / U };
    }

    var padX = size * U * 0.34, plateH = size * U * 1.5;
    // With a placement, the plate has a standard length (4.5 x the character height, like the 6 x 18 inch store sign
    // with 4 inch numbers) and the number sits left, centered or right. Longer numbers still widen the plate, and
    // left or right always leaves half a character height of extra plate on the other side: a gentle shift, measured
    // from Terran's installed 2724 (gaps of about 0.3 and 0.8 character heights), so the placement shows even when
    // the number is long.
    var room = opts.align === 'left' || opts.align === 'right' ? size * U * 0.5 : 0;
    var plateW = opts.align ? Math.max(tw + padX * 2 + room, size * U * 4.5) : tw + padX * 2;
    var m = 0.6 * U; // margin so the shadow is not clipped
    var W2 = plateW + m * 2, H2 = plateH + m * 2;
    var cx = opts.align === 'left' ? m + padX + tw / 2 : opts.align === 'right' ? m + plateW - padX - tw / 2 : m + plateW / 2;
    var ink = inkBox(number, font.css, fs);
    var baseY = m + plateH / 2 + (ink.ascent - ink.descent) / 2, x0 = cx - tw / 2;
    var r = 0.16 * U, inset = 0.38 * U;
    var screws = [[m + inset, m + inset], [m + plateW - inset, m + inset], [m + inset, m + plateH - inset], [m + plateW - inset, m + plateH - inset]];
    var svg2 = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W2.toFixed(0) + ' ' + H2.toFixed(0) + '" role="img" aria-label="Address sign reading ' + number + '">' +
      '<defs>' + defs +
      (function () { var joins = []; var body = textEls(lay, x0, baseY, textAttrs, ' fill="#000"') + tabRects(lay, x0, baseY, font.css, fs, joins); return cutMask(id, W2, H2, body, joins, fs * 0.012); })() +
      '<filter id="' + id + 's" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="' + (0.05 * U) + '" dy="' + (0.12 * U) + '" stdDeviation="' + (0.1 * U) + '" flood-color="#000" flood-opacity="0.45"/></filter>' +
      '</defs>' +
      '<g filter="url(#' + id + 's)"><g mask="url(#' + id + 'm)">' +
      '<rect x="' + m + '" y="' + m + '" width="' + plateW.toFixed(1) + '" height="' + plateH.toFixed(1) + '" rx="' + (0.12 * U) + '" fill="url(#' + id + 'g)"/>' +
      (finish.grain ? '<rect x="' + m + '" y="' + m + '" width="' + plateW.toFixed(1) + '" height="' + plateH.toFixed(1) + '" rx="' + (0.12 * U) + '" fill="url(#' + id + 'grain)"/>' : '') +
      '<rect x="' + (m + 2) + '" y="' + (m + 2) + '" width="' + (plateW - 4).toFixed(1) + '" height="' + (plateH - 4).toFixed(1) + '" rx="' + (0.12 * U) + '" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="2"/>' +
      '</g></g>' +
      screws.map(function (p, k) { return screw(p[0], p[1], r, id + 'screw', k); }).join('') +
      '</svg>';
    return { svg: svg2, widthIn: W2 / U, heightIn: H2 / U, contentWidthIn: plateW / U, contentHeightIn: plateH / U };
  }

  // Vertical: characters stacked top to bottom (like the 4027 post plate). Vertical signs are cut plates only.
  function buildVertical(opts, id, number, font, finish, size, fs, defs, attrs) {
    var chars = number.replace(/ /g, '').split('');
    if (!chars.length) chars = ['0'];
    var lineH = size * U * 1.4;
    var lays = chars.map(function (ch) { return layout(ch, font.css, fs, 0); });
    var maxW = Math.max.apply(null, lays.map(function (l) { return l.width; }));
    var asc = 0, desc = 0;
    chars.forEach(function (ch) { var b = inkBox(ch, font.css, fs); asc = Math.max(asc, b.ascent); desc = Math.max(desc, b.descent); });
    var stackH = asc + desc + (chars.length - 1) * lineH;
    var m = 0.6 * U;
    var padX = size * U * 0.42, padY = size * U * 0.5;
    var plateW = maxW + padX * 2, plateH = size * U + (chars.length - 1) * lineH + padY * 2;
    var W2 = plateW + m * 2, H2 = plateH + m * 2;
    var cx2 = m + plateW / 2, base0 = m + plateH / 2 - stackH / 2 + asc;
    function each(fn) { return lays.map(function (l, i) { return fn(l, cx2 - l.width / 2, base0 + i * lineH); }).join(''); }
    var r = 0.16 * U, inset = 0.38 * U;
    var screws = [[m + inset, m + inset], [m + plateW - inset, m + inset], [m + inset, m + plateH - inset], [m + plateW - inset, m + plateH - inset]];
    var svg2 = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W2.toFixed(0) + ' ' + H2.toFixed(0) + '" role="img" aria-label="Vertical address sign reading ' + number + '">' +
      '<defs>' + defs +
      (function () { var joins = []; var body = each(function (l, x, y) { return textEls(l, x, y, attrs, ' fill="#000"') + tabRects(l, x, y, font.css, fs, joins); }); return cutMask(id, W2, H2, body, joins, fs * 0.012); })() +
      '<filter id="' + id + 's" x="-10%" y="-10%" width="130%" height="120%"><feDropShadow dx="' + (0.05 * U) + '" dy="' + (0.12 * U) + '" stdDeviation="' + (0.1 * U) + '" flood-color="#000" flood-opacity="0.45"/></filter>' +
      '</defs>' +
      '<g filter="url(#' + id + 's)"><g mask="url(#' + id + 'm)">' +
      '<rect x="' + m + '" y="' + m + '" width="' + plateW.toFixed(1) + '" height="' + plateH.toFixed(1) + '" rx="' + (0.12 * U) + '" fill="url(#' + id + 'g)"/>' +
      (finish.grain ? '<rect x="' + m + '" y="' + m + '" width="' + plateW.toFixed(1) + '" height="' + plateH.toFixed(1) + '" rx="' + (0.12 * U) + '" fill="url(#' + id + 'grain)"/>' : '') +
      '</g></g>' +
      screws.map(function (p, k) { return screw(p[0], p[1], r, id + 'screw', k); }).join('') +
      '</svg>';
    return { svg: svg2, widthIn: W2 / U, heightIn: H2 / U, contentWidthIn: plateW / U, contentHeightIn: plateH / U };
  }

  // Sign size in inches as sold (for quotes and captions).
  function dims(opts) {
    var b = build(opts);
    return { width: b.contentWidthIn, height: b.contentHeightIn };
  }

  // Tab outlines for one character, in font-size units from its origin on the baseline (y down), for the 3D view.
  function tabs(fontKey, ch) {
    var sh = shape((FONTS[fontKey] || FONTS.jost).css, ch);
    return sh ? sh.tabs.map(tabOutline) : null;
  }

  window.BCFPlate = { build: build, dims: dims, meetsCode: meetsCode, tabs: tabs, FONTS: FONTS, FINISHES: FINISHES };
})();
