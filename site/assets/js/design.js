// The design tool: number, style, size, font, finish and wall, drawn at true scale on real wall photos.
(function () {
  var WALL_WIDTH_IN = 40; // every wall photo is 40 inches wide (walls.json)
  var params = new URLSearchParams(location.search);
  var state = {
    number: (params.get('n') || '2724').replace(/[^0-9a-zA-Z -]/g, '').slice(0, 6), kind: 'plate', orient: 'h', size: 6, font: 'jost', finish: 'brushed',
    forwho: params.get('for') === 'property' || +params.get('doors') > 1 ? 'property' : 'home',
    doors: Math.max(2, +params.get('doors') || 24),
    wall: 'cedar', paint: 'white', photo: null, scale: 1, pos: { x: 0.5, y: 0.45 }
  };
  var walls = [], presets = {};
  var $ = function (id) { return document.getElementById(id); };
  var stage = $('stage'), sign = $('sign');

  function wallFile(w, paint) {
    var entry = walls.find(function (x) { return x.id === w; });
    if (!entry) return '';
    return '/assets/walls/' + (entry.paintable ? entry.files[paint] : entry.files.natural);
  }

  function place(el, built, scale, pos) {
    el.innerHTML = built.svg;
    el.style.width = (built.widthIn / WALL_WIDTH_IN * 100 * scale) + '%';
    el.style.left = (pos.x * 100) + '%';
    el.style.top = (pos.y * 100) + '%';
  }

  // Rules between options:
  // - Vertical signs only come as a cut plate.
  // - Loose numbers come 6 inch in Futura (Terran's store), side by side. A custom font is still allowed.
  // - Numbers are always centered on the plate (customers ask in the quote notes for anything else).
  // - Fire code: a font's strokes must be at least 1/2 inch at the chosen size (BCFPlate.meetsCode).
  function syncOptions() {
    var vertical = state.orient === 'v', loose = state.kind === 'loose';
    if (vertical && state.kind !== 'plate') { state.kind = 'plate'; loose = false; }
    if (loose) { state.size = 6; if (state.font !== 'custom') state.font = 'jost'; }
    var thin = function (font, size) { return font !== 'custom' && !BCFPlate.meetsCode(font, size) && BCFPlate.FONTS[font].label + ' is too thin at 4 inch for the fire code (1/2 inch strokes)'; };
    var rules = {
      kind: { bar: vertical && 'Vertical signs come as a cut plate', loose: vertical && 'Vertical signs come as a cut plate' },
      orient: { v: loose && 'Loose numbers go side by side' },
      size: { 4: loose && 'Loose numbers come 6 inch' || thin(state.font, 4) },
      font: { arimo: loose && 'Loose numbers come in Futura' || thin('arimo', state.size), besley: loose && 'Loose numbers come in Futura' || thin('besley', state.size) }
    };
    Object.keys(rules).forEach(function (group) {
      document.querySelectorAll('#' + group + ' [data-v]').forEach(function (x) {
        var why = rules[group][x.dataset.v];
        if (!x.dataset.title) x.dataset.title = x.title || '';
        x.disabled = !!why;
        x.title = why || x.dataset.title;
        x.setAttribute('aria-pressed', String(state[group]) === x.dataset.v);
      });
    });
  }

  // Prices count up or down to their new value and give a small nudge, so a change is easy to notice.
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function countTo(el, to) {
    var from = +el.dataset.v;
    el.dataset.v = to;
    if (still || isNaN(from) || from === to) { el.textContent = money(to); return; }
    var t0 = performance.now();
    el.classList.remove('nudge'); void el.offsetWidth; el.classList.add('nudge');
    (function step(now) {
      var k = Math.min(1, (now - t0) / 380), e = 1 - Math.pow(1 - k, 3);
      el.textContent = money(Math.round((from + (to - from) * e) * 100) / 100);
      if (k < 1) requestAnimationFrame(step);
    })(t0);
    // if the tab isn't drawing frames (hidden), land on the final price anyway
    setTimeout(function () { if (+el.dataset.v === to) el.textContent = money(to); }, 450);
  }
  var money = function (n) { return '$' + n.toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }); };
  var STYLE = { plate: 'Cut plate', bar: 'Numbers on a bar', loose: 'Loose numbers' };
  var fontLabel = function () { return state.font === 'custom' ? 'Custom font (quoted separately)' : BCFPlate.FONTS[state.font].label; };
  var drawFont = function () { return state.font === 'custom' ? 'jost' : state.font; }; // custom fonts preview in Futura
  var chars = function () { return (state.number || '0').replace(/\s/g, '').length; };

  // The bulk discount on property orders: the single-sign price struck through, the percent off and the savings.
  // Motion (motion.dev) draws the strike and pops the badge when the discount first appears.
  var motion = null;
  function showDeal(q, property, count, fresh) {
    var deal = property && !q.custom && q.listEach > q.perSign;
    $('was').hidden = $('off').hidden = !deal;
    $('wasPrice').textContent = money(q.listEach);
    $('off').textContent = Math.round((1 - q.perSign / q.listEach) * 100) + '% off';
    $('save').textContent = deal ? 'You save ' + money(BCFPricing.round((q.listEach - q.perSign) * count)) + ' vs. buying one at a time' : '';
    if (!deal || !fresh || still) return;
    (motion || (motion = import('https://cdn.jsdelivr.net/npm/motion@11.11.17/+esm').catch(function () { return null; }))).then(function (m) {
      if (!m) return;
      m.animate($('was').querySelector('.strike'), { scaleX: [0, 1] }, { duration: 0.45, delay: 0.15, ease: 'easeOut' });
      m.animate($('off'), { opacity: [0, 1], scale: [0.6, 1] }, { type: 'spring', stiffness: 420, damping: 18, delay: 0.4 });
      m.animate($('save'), { opacity: [0, 1], y: [6, 0] }, { duration: 0.35, delay: 0.5 });
    });
  }

  // Price from the choices (pricing.js). Home is one sign; property is a set per door; loose numbers are per character.
  function renderPrice() {
    var property = state.forwho === 'property', count = property ? state.doors : 1;
    var q = BCFPricing.quote({ font: state.font, kind: state.kind, chars: chars(), property: property, finish: state.finish }, count);
    // Switching to a property order: the door price counts down from the single-sign price, so the bulk discount shows.
    var turnedProperty = property && $('tool').dataset.property === 'no';
    if (turnedProperty) $('perDoor').dataset.v = q.listEach;
    $('tool').dataset.property = property ? 'yes' : 'no';
    $('tool').dataset.custom = q.custom ? 'yes' : 'no';
    $('tool').dataset.loose = q.tier === 'loose' ? 'yes' : 'no';
    $('tierWhy').textContent = q.custom ? 'Custom fonts are quoted separately.'
      : q.tier === 'loose' ? chars() + ' numbers at ' + money(BCFPricing.looseEach) + ' each.'
      : property ? 'Each door gets its own set, ' + money(q.perSign) + ' a door.' : '';
    countTo($('price'), q.perSign);
    countTo($('perDoor'), q.perSign);
    countTo($('total'), q.total);
    showDeal(q, property, count, turnedProperty);
    $('totalLabel').textContent = count + ' doors';
    // One-line recap of the design above the quote form.
    $('qsum').textContent = [state.number || '0', STYLE[state.kind], state.orient === 'v' ? 'Vertical' : 'Horizontal',
      state.size + ' inch', fontLabel(), BCFPlate.FINISHES[state.finish].label, q.label,
      q.custom ? 'quoted separately' : property ? count + ' doors at ' + money(q.perSign) + ' = ' + money(q.total) : money(q.perSign)].filter(Boolean).join(' · ');
    return q;
  }

  // Once the choices stack under the preview (phones), "Who's it for?" moves right under the preview, above the price.
  var forwhoCtl = $('forwhoCtl'), controls = forwhoCtl.parentNode, narrow = matchMedia('(max-width: 1039px)');
  function placeForwho() {
    var inSlot = forwhoCtl.parentNode === $('forwhoSlot');
    var stacked = narrow.matches;
    if (stacked && !inSlot) $('forwhoSlot').appendChild(forwhoCtl);
    else if (!stacked && inSlot) controls.insertBefore(forwhoCtl, controls.firstElementChild);
  }
  placeForwho();
  narrow.addEventListener('change', placeForwho);
  // The preview pins just under the menu on phones (design.html), so it needs the menu's height.
  function navHeight() { var n = document.querySelector('.nav'); if (n) document.documentElement.style.setProperty('--nav-h', n.offsetHeight + 'px'); }
  navHeight();
  window.addEventListener('resize', navHeight);

  function render() {
    var vertical = state.orient === 'v';
    var align = state.kind === 'plate' && !vertical ? 'center' : undefined; // a standard length plate, numbers centered
    var opts = { number: state.number || '0', kind: state.kind, vertical: vertical, align: align, size: state.size, font: drawFont(), finish: state.finish };
    // Vertical signs are tall, so the wall gets taller too (the 40 inch wide photo repeats downward).
    [stage, $('stage3d')].forEach(function (el) { el.classList.toggle('tall', vertical); });
    var bg = state.photo ? 'url("' + state.photo + '")' : 'url("' + wallFile(state.wall, state.paint) + '")';
    stage.style.backgroundImage = bg;
    stage.classList.toggle('own', !!state.photo); // a customer's photo fills the stage once, never repeated
    place(sign, BCFPlate.build(opts), state.photo ? state.scale : 1, state.pos);
    var d = BCFPlate.dims(opts);
    $('dims').textContent = (vertical ? 'Vertical ' : '') + ({ bar: 'numbers on a bar, about ', loose: 'loose numbers, about ' }[state.kind] || 'plate about ') + Math.round(d.width) + ' in × ' + Math.round(d.height) + ' in';
    $('dims').textContent = $('dims').textContent.charAt(0).toUpperCase() + $('dims').textContent.slice(1);
    var c = $('comply');
    c.className = 'badge ' + (state.size === 4 ? 'warn' : 'ok');
    c.textContent = state.font === 'custom' ? 'Every custom font is checked against the fire code before cutting.'
      : state.size === 4 ? '! 4 inch is the IFC minimum height. Check your local code.' : '✓ Meets the IFC baseline. Check your local code.';
    renderPrice();
    document.querySelectorAll('#font [data-v]:not([data-v="custom"]) .glyph').forEach(function (g) { g.textContent = state.number || '0'; });
    $('paintField').hidden = !!state.photo || !(walls.find(function (x) { return x.id === state.wall; }) || {}).paintable;
    $('scaleRow').classList.toggle('on', !!state.photo);
    var w = walls.find(function (x) { return x.id === state.wall; });
    if (w) {
      $('wallName').textContent = state.photo ? 'Your photo' : w.label;
      $('wallThumb').style.backgroundImage = state.photo ? 'url("' + state.photo + '")' : 'url("' + wallFile(state.wall, state.paint) + '")';
    }
    $('paintName').textContent = paintLabel(state.paint);
    // Tell the 3D close-up (design.html) what to draw.
    window.BCFSign = {
      number: state.number || '0', font: drawFont(), size: state.size, finish: state.finish, kind: state.kind, vertical: vertical, align: align,
      wallImage: state.photo || wallFile(state.wall, state.paint), wallWidthIn: WALL_WIDTH_IN / (state.photo ? state.scale : 1), wallTile: !state.photo,
      signPos: state.pos, frame: 'wall'
    };
    document.dispatchEvent(new CustomEvent('bcf:sign', { detail: window.BCFSign }));
  }

  function paintLabel(k) { k = k.replace('_', ' '); return k.charAt(0).toUpperCase() + k.slice(1); }

  function chips(groupId, key, cast) {
    var group = $(groupId);
    group.addEventListener('click', function (e) {
      var b = e.target.closest('[data-v]');
      if (!b) return;
      group.querySelectorAll('[data-v]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
      if (b.disabled) return;
      state[key] = cast ? cast(b.dataset.v) : b.dataset.v;
      if (key === 'wall' || key === 'paint') state.photo = null;
      syncOptions();
      render();
    });
  }

  function buildWallPickers() {
    var wallBox = $('walls'), paintBox = $('paint'), btn = $('wallBtn');
    wallBox.innerHTML = walls.map(function (w) {
      var thumb = '/assets/walls/' + (w.paintable ? w.files.white : w.files.natural);
      return '<button class="dd-opt" type="button" data-v="' + w.id + '" aria-pressed="' + (w.id === state.wall) + '">' +
        '<span class="dd-thumb" style="background-image:url(&quot;' + thumb + '&quot;)"></span>' + w.label + '</button>';
    }).join('');
    paintBox.innerHTML = Object.keys(presets).map(function (k) {
      return '<button class="dot" type="button" data-v="' + k + '" aria-pressed="' + (k === state.paint) + '" title="' + paintLabel(k) + '" aria-label="' + paintLabel(k) + '" style="background:' + presets[k] + '"></button>';
    }).join('');
    chips('walls', 'wall');
    chips('paint', 'paint');

    // The wall list is a dropdown: open on click, close on pick, outside click or Escape.
    function setOpen(open) { wallBox.hidden = !open; btn.setAttribute('aria-expanded', open); }
    btn.addEventListener('click', function () { setOpen(wallBox.hidden); });
    wallBox.addEventListener('click', function (e) { if (e.target.closest('[data-v]')) { setOpen(false); btn.focus(); } });
    document.addEventListener('click', function (e) { if (!e.target.closest('.dd')) setOpen(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !wallBox.hidden) { setOpen(false); btn.focus(); } });
  }

  // Drag the sign around the wall or photo.
  var drag = null;
  sign.addEventListener('pointerdown', function (e) {
    drag = { id: e.pointerId };
    sign.setPointerCapture(e.pointerId);
  });
  sign.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var r = stage.getBoundingClientRect();
    state.pos = { x: Math.min(0.95, Math.max(0.05, (e.clientX - r.left) / r.width)), y: Math.min(0.95, Math.max(0.05, (e.clientY - r.top) / r.height)) };
    sign.style.left = (state.pos.x * 100) + '%';
    sign.style.top = (state.pos.y * 100) + '%';
  });
  sign.addEventListener('pointerup', function () { drag = null; render(); });

  $('number').value = state.number;
  $('number').addEventListener('input', function (e) { state.number = e.target.value.replace(/[^0-9a-zA-Z -]/g, '').slice(0, 6); render(); });
  chips('forwho', 'forwho');
  ['home', 'property'].forEach(function (v) { $('forwho').querySelector('[data-v="' + v + '"]').setAttribute('aria-pressed', v === state.forwho); });
  $('doors').value = state.doors;
  $('doors').addEventListener('input', function (e) { state.doors = Math.max(2, Math.min(5000, parseInt(e.target.value, 10) || 2)); renderPrice(); });
  document.querySelectorAll('.doors-row .step').forEach(function (b) {
    b.addEventListener('click', function () { state.doors = Math.max(2, Math.min(5000, state.doors + +b.dataset.d)); $('doors').value = state.doors; renderPrice(); });
  });

  chips('kind', 'kind');
  syncOptions();
  chips('orient', 'orient');
  chips('size', 'size', Number);
  chips('font', 'font');
  chips('finish', 'finish');
  // A photo of the customer's own wall, picked here or sent from their phone (photo.js).
  // Photos are usually a wall section about 80 inches across, so the sign starts at half its stock-wall size.
  window.BCFUsePhoto = function (blob) {
    if (state.photo) URL.revokeObjectURL(state.photo);
    state.photo = URL.createObjectURL(blob);
    state.scale = 0.5;
    state.pos = { x: 0.5, y: 0.45 };
    $('scale').value = state.scale;
    document.querySelectorAll('#walls [data-v]').forEach(function (x) { x.setAttribute('aria-pressed', false); });
    render();
  };
  $('scale').addEventListener('input', function (e) { state.scale = +e.target.value; render(); });

  $('quote').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = $('qname').value.trim(), email = $('qemail').value.trim();
    if (!name || !/^\S+@\S+\.\S+$/.test(email)) { $('qerr').textContent = 'Add your name and a valid email so we can reply.'; return; }
    $('qerr').textContent = '';
    var wallEntry = walls.find(function (x) { return x.id === state.wall; }) || {};
    var q = renderPrice(), property = state.forwho === 'property';
    var summary = {
      type: property ? 'Property order' : 'Home sign', property: property ? $('qprop').value.trim() : '',
      doors: property ? String(state.doors) : '', tier: q.label,
      units: property ? $('qunits').value.trim() : '',
      number: state.number, style: STYLE[state.kind],
      orientation: state.orient === 'v' ? 'Vertical' : 'Horizontal',
      size: state.size + ' inch', font: fontLabel(), finish: BCFPlate.FINISHES[state.finish].label,
      wall: state.photo ? 'Customer photo (kept on their device)' : (wallEntry.label + (wallEntry.paintable ? ', ' + state.paint.replace('_', ' ') : '')),
      price: q.custom ? 'Quoted separately' : property ? '' : money(q.perSign),
      perDoor: !q.custom && property ? money(q.perSign) : '', total: !q.custom && property ? money(q.total) : '',
      addons: property ? ([].slice.call(document.querySelectorAll('#addons input:checked')).map(function (i) { return i.value; }).join(', ') || 'None') : '',
      name: name, email: email, notes: $('qnotes').value.trim()
    };
    BCFQuote.submit(summary, e.target.querySelector('button[type=submit]'));
  });

  fetch('/assets/walls/walls.json').then(function (r) { return r.json(); }).then(function (j) {
    walls = j.walls; presets = j.paintPresets;
    buildWallPickers();
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(render);
    window.addEventListener('bcf:fonts', render); // a font arrived late: redraw with its tabs and screws
  });
})();
