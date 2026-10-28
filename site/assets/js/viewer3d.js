// Rotatable 3D model of a Marks Metal Signs sign: real glyph outlines from the plate fonts, cut through
// 11 gauge (0.12 inch) stainless at true size, with an anisotropic brushed finish or powder coat.
// Usage: import { mount } from '/assets/js/viewer3d.js'; const v = mount(el, opts); v.update(opts);
// opts: { number, font: 'jost'|'arimo'|'besley', size: 4|6, finish: 'brushed'|'black'|'bronze'|'white', kind: 'plate'|'bar', maxLen,
//         wallImage, wallWidthIn, wallTile, signPos: {x, y}, frame: 'sign'|'wall' }
// With wallImage the sign sits on that photo at true scale (wallWidthIn inches across, sign centre at signPos),
// the same way the flat preview places it.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as OT from 'opentype';

const opentype = OT.parse ? OT : OT.default;
const GAUGE = 0.12; // inches
const FONT_FILES = { jost: '/assets/fonts/jost-bold.ttf', arimo: '/assets/fonts/arimo-bold.ttf', besley: '/assets/fonts/besley-bold.ttf' };
const DIGIT = { jost: 0.70, arimo: 0.716, besley: 0.70 }; // digit height as a share of font size (matches plate.js)
const fontCache = {};

function loadFont(key) {
  if (!fontCache[key]) {
    fontCache[key] = fetch(FONT_FILES[key] || FONT_FILES.jost).then((r) => r.arrayBuffer()).then((b) => opentype.parse(b));
  }
  return fontCache[key];
}

// Fine horizontal brushing, drawn once: a bump map for the grain and a roughness map for the streaks.
function brushedMaps() {
  const n = 1024;
  const make = (base, spread, alpha) => {
    const c = document.createElement('canvas');
    c.width = c.height = n;
    const g = c.getContext('2d');
    g.fillStyle = base;
    g.fillRect(0, 0, n, n);
    for (let i = 0; i < 9000; i++) {
      const y = Math.random() * n, x = Math.random() * n, len = 80 + Math.random() * 600;
      const v = Math.round(128 + (Math.random() - 0.5) * spread);
      g.fillStyle = 'rgba(' + v + ',' + v + ',' + v + ',' + alpha + ')';
      g.fillRect(x, y, len, 0.6 + Math.random() * 0.9);
      if (x + len > n) g.fillRect(x - n, y, len, 1);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1 / 14, 1 / 14); // geometry UVs are inches, so one tile covers about 14 inches
    t.anisotropy = 8;
    return t;
  };
  return { bump: make('#808080', 160, 0.5), rough: make('#d0d0d0', 90, 0.35) };
}

function materialFor(finish, maps) {
  if (finish === 'brushed') {
    return new THREE.MeshPhysicalMaterial({
      color: 0xe8eaea, metalness: 1, roughness: 0.42, roughnessMap: maps.rough,
      bumpMap: maps.bump, bumpScale: 0.6, anisotropy: 0.85, anisotropyRotation: 0, envMapIntensity: 1.15
    });
  }
  const colors = { black: 0x1c1c1d, bronze: 0x4a3626, white: 0xecebe5 };
  return new THREE.MeshPhysicalMaterial({
    color: colors[finish] || colors.black, metalness: finish === 'bronze' ? 0.35 : 0.05,
    roughness: 0.58, clearcoat: 0.25, clearcoatRoughness: 0.5, bumpMap: maps.bump, bumpScale: 0.08
  });
}

function inside(pt, poly) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < (b.x - a.x) * (pt.y - a.y) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

// Glyph outlines in inches (y up), centred on the origin, split into outer contours and counters by how
// deeply each is nested. Vertical stacks the characters top to bottom, each centred (matches plate.js).
function glyphContours(font, text, sizeIn, fontKey, vertical, spacingEm = 0.06) {
  const fs = sizeIn / DIGIT[fontKey];
  const spacing = fs * spacingEm, lineH = sizeIn * 1.4;
  let x = 0, maxAdv = 0, row = 0;
  const contours = [], origins = []; // origins: where each character starts, in path units (y down)
  for (const ch of text) {
    if (vertical && ch === ' ') continue;
    const glyph = font.charToGlyph(ch);
    const adv = glyph.advanceWidth * fs / font.unitsPerEm;
    maxAdv = Math.max(maxAdv, adv);
    const path = vertical ? glyph.getPath(-adv / 2, row * lineH, fs) : glyph.getPath(x, 0, fs);
    origins.push(vertical ? { ch, x: -adv / 2, y: row * lineH } : { ch, x, y: 0 });
    row += 1;
    let cur = null;
    for (const c of path.commands) {
      if (c.type === 'M') { cur = new THREE.Path(); cur.moveTo(c.x, -c.y); contours.push(cur); }
      else if (c.type === 'L') cur.lineTo(c.x, -c.y);
      else if (c.type === 'Q') cur.quadraticCurveTo(c.x1, -c.y1, c.x, -c.y);
      else if (c.type === 'C') cur.bezierCurveTo(c.x1, -c.y1, c.x2, -c.y2, c.x, -c.y);
    }
    x += adv + spacing;
  }
  const width = vertical ? maxAdv : x - spacing;
  const height = vertical ? sizeIn + (row - 1) * lineH : sizeIn;
  const pts = contours.map((p) => p.getPoints(10));
  // Centre on the ink itself, not the font's nominal digit height, so every font sits evenly on the plate.
  let minY = Infinity, maxY = -Infinity;
  pts.forEach((p) => p.forEach((v) => { minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y); }));
  if (!isFinite(minY)) { minY = 0; maxY = sizeIn; }
  const dx = vertical ? 0 : width / 2, dy = (minY + maxY) / 2;
  const depth = pts.map((p, i) => pts.reduce((d, q, j) => d + (i !== j && inside(p[0], q) ? 1 : 0), 0));
  const shift = (p) => p.map((v) => new THREE.Vector2(v.x - dx, v.y - dy));
  return {
    width,
    height,
    outer: pts.filter((_, i) => depth[i] % 2 === 0).map(shift),
    counters: pts.filter((_, i) => depth[i] % 2 === 1).map(shift),
    origins, dx, dy
  };
}

function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  return s;
}

// A dark product-photo studio for reflections: a big softbox, two strip lights and a warm bounce.
// Brushed steel is mostly reflection, so these panels are what make it read as metal.
function studio() {
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x1c1b1a);
  const panel = (w, h, color, power, pos) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(power), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  panel(26, 10, 0xffffff, 3.0, [0, 7, 18]);  // big softbox above and behind the viewer: the flat face reflects this
  panel(8, 18, 0xfff6ec, 3.2, [-11, 0, 13]); // tall softbox front left
  panel(9, 6, 0xffffff, 5, [-6, 6, 7]);    // key softbox, upper left
  panel(1.2, 12, 0xffffff, 7, [9, 0, 4]);  // strip on the right
  panel(1.2, 12, 0xffffff, 3, [-10, 0, -2]); // strip behind left, for edge glints
  panel(14, 1, 0xffffff, 4, [0, 9, 1]);    // top strip
  panel(16, 5, 0xffb27a, 0.35, [0, -8, 5]); // warm floor bounce
  panel(30, 30, 0x8a8a8a, 0.08, [0, 0, -14]); // faint back wall
  return env;
}

// A soft rounded-rectangle shadow for the plate on the wall photo.
function softShadow() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.shadowColor = 'rgba(0,0,0,1)';
  g.shadowBlur = 18;
  g.shadowOffsetX = 1000; // draw the rectangle off-canvas so only its blurred shadow lands on it
  g.fillStyle = '#000';
  g.fillRect(28 - 1000, 24, 200, 80);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const EXTRUDE = { depth: GAUGE, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 10 };
const SLOT = new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.7 });
const TURN = [14, 61, 103, 37, 82, 128, 9, 54]; // screws are never all turned the same way (matches plate.js)

// Tabs that hold each counter (the middle of a 0, 4, 6, 8, 9) to the plate. They come from plate.js (BCFPlate.tabs),
// so the 3D sign has exactly the tabs of the flat drawing, placed the way Terran's real signs are cut.
function tabMeshes(g, sizeIn, fontKey, mat, shiftX) {
  const P = window.BCFPlate;
  if (!P || !P.tabs) return [];
  const fs = sizeIn / DIGIT[fontKey], out = [];
  g.origins.forEach((o) => {
    (P.tabs(fontKey, o.ch) || []).forEach((pts) => {
      const s = new THREE.Shape(pts.map(([px, py]) => new THREE.Vector2(o.x + px * fs - g.dx + shiftX, -(o.y + py * fs) - g.dy)));
      // a hair thinner than the plate so its face never fights the plate's face where they overlap
      const m = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: GAUGE + 0.02, bevelEnabled: false, curveSegments: 4 }), mat);
      m.position.z = -0.01;
      out.push(m);
    });
  });
  return out;
}

// A Phillips pan-head screw facing the viewer, its top at z.
function screwHead(x, y, z, r, mat, k) {
  const head = new THREE.Group();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat);
  dome.rotation.x = Math.PI / 2;
  dome.scale.set(1, 0.35, 1);
  head.add(dome);
  const cross = new THREE.Group();
  [0, Math.PI / 2].forEach((a) => {
    const slot = new THREE.Mesh(new THREE.BoxGeometry(r * 1.15, r * 0.24, r * 0.16), SLOT);
    slot.rotation.z = a;
    slot.position.z = r * 0.3;
    cross.add(slot);
  });
  cross.rotation.z = TURN[k % TURN.length] * Math.PI / 180;
  head.add(cross);
  head.position.set(x, y, z);
  return head;
}

function edgeDist(pt, polys) {
  let d = Infinity;
  polys.forEach((p) => {
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      const a = p[j], b = p[i], ex = b.x - a.x, ey = b.y - a.y, l = ex * ex + ey * ey;
      const t = l ? Math.max(0, Math.min(1, ((pt.x - a.x) * ex + (pt.y - a.y) * ey) / l)) : 0;
      d = Math.min(d, Math.hypot(pt.x - a.x - t * ex, pt.y - a.y - t * ey));
    }
  });
  return d;
}

// Screw spots on one loose character: the highest and lowest points with room for the head inside the stroke.
function looseSpots(outer, holes, r, sizeIn) {
  const need = r * 3, step = 0.04, polys = [outer, ...holes];
  const xs = outer.map((v) => v.x), ys = outer.map((v) => v.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), mid = (x0 + x1) / 2;
  const ok = (p) => inside(p, outer) && !holes.some((h) => inside(p, h)) && edgeDist(p, polys) >= need;
  const scan = (from, to, dy) => {
    for (let y = from; dy < 0 ? y > to : y < to; y += dy) {
      let best = null;
      for (let x = x0; x <= x1; x += step) {
        const p = new THREE.Vector2(x, y);
        if (ok(p) && (!best || Math.abs(x - mid) < Math.abs(best.x - mid))) best = p;
      }
      if (best) return best;
    }
    return null;
  };
  const top = scan(y1, y0, -step), bot = scan(y0, y1, step);
  if (top && bot && top.y - bot.y >= sizeIn * 0.25) return [top, bot];
  return top ? [top] : [];
}

function buildSign(font, opts, mat, screwMat) {
  const size = opts.size === 4 ? 4 : 6;
  const vertical = !!opts.vertical;
  const loose = opts.kind === 'loose' && !vertical;
  const g = glyphContours(font, String(opts.number || '2724').slice(0, opts.maxLen || 6), size, opts.font, vertical, loose ? 0.16 : 0.06);
  const group = new THREE.Group();
  const geo = (shape) => new THREE.ExtrudeGeometry(shape, EXTRUDE);
  // Screw heads match the finish: steel on brushed signs, coated on powder-coated ones.
  const headMat = !opts.finish || opts.finish === 'brushed' ? screwMat : mat;
  const top = GAUGE + 0.012;
  let k = 0;

  if (loose) {
    // Loose numbers: each character on its own, screwed to the wall through its face.
    const r = 0.12;
    g.outer.forEach((o) => {
      const s = new THREE.Shape(o), holes = g.counters.filter((c) => inside(c[0], o));
      holes.forEach((c) => s.holes.push(new THREE.Path(c)));
      group.add(new THREE.Mesh(geo(s), mat));
      looseSpots(o, holes, r, size).forEach((p) => group.add(screwHead(p.x, p.y, top, r, headMat, k++)));
    });
    return { group, w: g.width, h: size };
  }

  if (opts.kind === 'bar' && !vertical) {
    // Solid numbers standing on a rail, one screw through the front of the rail near each end.
    g.outer.forEach((o) => {
      const s = new THREE.Shape(o);
      g.counters.forEach((c) => { if (inside(c[0], o)) s.holes.push(new THREE.Path(c)); });
      group.add(new THREE.Mesh(geo(s), mat));
    });
    const railH = size * 0.1, railW = g.width * 1.18;
    const rail = new THREE.Mesh(geo(roundedRect(railW, railH, 0.05)), mat);
    rail.position.y = -size / 2 - railH / 2 + 0.02;
    group.add(rail);
    const r = Math.min(0.16, railH * 0.3);
    [-1, 1].forEach((side) => group.add(screwHead(side * (railW / 2 - railH * 0.9), rail.position.y, top, r, headMat, k++)));
    return { group, w: railW, h: size + railH };
  }

  // Cut plate: the glyph outlines are holes; counters (inside 0, 4, 6, 8, 9) are held to the plate by tabs.
  // Placement (matches plate.js): a standard 4.5 x height plate with the number left, centered or right.
  const padX = size * 0.34;
  // left or right leaves half a character height of extra plate on the other side (matches plate.js)
  const room = !vertical && (opts.align === 'left' || opts.align === 'right') ? size * 0.5 : 0;
  const plateW = vertical ? g.width + size * 0.84 : (opts.align ? Math.max(g.width + padX * 2 + room, size * 4.5) : g.width + padX * 2);
  const plateH = vertical ? g.height + size : size * 1.5;
  const dx = vertical || !opts.align || opts.align === 'center' ? 0 : (opts.align === 'left' ? -1 : 1) * (plateW / 2 - padX - g.width / 2);
  const move = (pts) => pts.map((v) => new THREE.Vector2(v.x + dx, v.y));
  g.outer = g.outer.map(move);
  g.counters = g.counters.map(move);
  const plate = roundedRect(plateW, plateH, 0.12);
  g.outer.forEach((o) => plate.holes.push(new THREE.Path(o)));
  const inset = 0.42, screwR = 0.22;
  const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy]) => [sx * (plateW / 2 - inset), sy * (plateH / 2 - inset)]);
  corners.forEach(([x, y]) => { const h = new THREE.Path(); h.absarc(x, y, screwR * 0.75, 0, Math.PI * 2, true); plate.holes.push(h); });
  group.add(new THREE.Mesh(geo(plate), mat));
  g.counters.forEach((c) => group.add(new THREE.Mesh(geo(new THREE.Shape(c)), mat)));
  tabMeshes(g, size, opts.font, mat, dx).forEach((m) => group.add(m));
  corners.forEach(([x, y]) => group.add(screwHead(x, y, GAUGE + 0.01, screwR, headMat, k++)));
  return { group, w: plateW, h: plateH };
}

export function mount(el, initial) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // The canvas is laid over the stage, so the stage's own CSS size decides the canvas size and never the reverse.
  if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
  el.style.overflow = 'hidden';
  Object.assign(renderer.domElement.style, { position: 'absolute', inset: '0', display: 'block' });
  el.insertBefore(renderer.domElement, el.firstChild);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(studio(), 0.02).texture;
  const key = new THREE.DirectionalLight(0xfff4e8, 1.2);
  key.position.set(-6, 5, 8);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffb27a, 0.9); // warm spark-colored rim from behind
  rim.position.set(7, -2, -6);
  scene.add(rim);

  // A matte wall just behind the sign, so the cut-outs read: dark behind light finishes, light behind dark ones.
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x24221f, roughness: 0.95 }));
  wall.position.z = -0.35;
  scene.add(wall);

  // The real wall photo, unlit so it looks exactly like the flat preview. Stock walls are mirrored past their
  // edges so turning the sign never shows a hard border; a customer's photo (wallTile: false) appears once.
  const photoWall = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ toneMapped: false }));
  photoWall.visible = false;
  scene.add(photoWall);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: softShadow(), transparent: true, depthWrite: false, opacity: 0.5 }));
  shadow.visible = false;
  scene.add(shadow);
  const texLoader = new THREE.TextureLoader();
  let wallUrl = null, wallAspect = 0.625;

  function setWall() {
    const url = opts.wallImage || null;
    if (url !== wallUrl) {
      wallUrl = url;
      if (url) {
        texLoader.load(url, (t) => {
          if (wallUrl !== url) { t.dispose(); return; }
          t.colorSpace = THREE.SRGBColorSpace;
          if (opts.wallTile !== false) {
            t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;
            t.repeat.set(3, 3);
            t.offset.set(-1, -1);
          }
          t.anisotropy = 8;
          wallAspect = t.image.height / t.image.width;
          if (photoWall.material.map) photoWall.material.map.dispose();
          photoWall.material.map = t;
          photoWall.material.needsUpdate = true;
          placeWall();
        });
      }
    }
    placeWall();
  }

  function placeWall() {
    const on = !!(opts.wallImage && photoWall.material.map);
    photoWall.visible = on;
    wall.visible = !on;
    shadow.visible = on && !!current && opts.kind === 'plate';
    if (!on) return;
    const W = opts.wallWidthIn || 40, H = W * wallAspect, p = opts.signPos || { x: 0.5, y: 0.5 };
    const k = opts.wallTile === false ? 1 : 3; // a customer's own photo is shown once, never mirrored
    photoWall.scale.set(k * W, k * H, 1);
    photoWall.position.set(-(p.x - 0.5) * W, (p.y - 0.5) * H, wall.position.z);
    if (current) {
      shadow.scale.set(current.w * 1.25, current.h * 1.35, 1);
      shadow.position.set(0.35, -0.6, wall.position.z + 0.01);
    }
  }

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 500);
  const controls = new OrbitControls(camera, renderer.domElement);
  Object.assign(controls, {
    enableDamping: true, dampingFactor: 0.08, enablePan: false, enableZoom: false, rotateSpeed: 0.7,
    minAzimuthAngle: -1.25, maxAzimuthAngle: 1.25, minPolarAngle: 0.45, maxPolarAngle: Math.PI - 0.45
  });

  const maps = brushedMaps();
  const screwMat = new THREE.MeshPhysicalMaterial({ color: 0xe2e4e3, metalness: 1, roughness: 0.22, anisotropy: 0.5 });
  let current = null, opts = Object.assign({ number: '2724', font: 'jost', size: 6, finish: 'brushed', kind: 'plate' }, initial);
  let idle = true, t0 = performance.now(), seq = 0, fitDist = 30;

  controls.addEventListener('start', () => { idle = false; });

  // Zoom with the + and - buttons or a trackpad pinch. A plain scroll wheel scrolls the page, so the
  // viewer never traps someone halfway down the page.
  function zoom(f) {
    idle = false;
    const d = THREE.MathUtils.clamp(camera.position.length() * f, controls.minDistance, controls.maxDistance);
    camera.position.setLength(d);
  }
  el.addEventListener('wheel', (e) => { if (!e.ctrlKey) return; e.preventDefault(); zoom(Math.exp(e.deltaY * 0.01)); }, { passive: false });
  const zoomBox = document.createElement('div');
  zoomBox.className = 'zoom3d';
  zoomBox.innerHTML = '<button type="button" aria-label="Zoom in">+</button><button type="button" aria-label="Zoom out">&minus;</button>';
  zoomBox.children[0].addEventListener('click', () => zoom(0.75));
  zoomBox.children[1].addEventListener('click', () => zoom(1 / 0.75));
  el.appendChild(zoomBox);

  async function rebuild() {
    const my = ++seq;
    let font;
    try { font = await loadFont(opts.font); } catch (e) { console.error('3D view: font failed', e); return; }
    if (my !== seq) return;
    const mat = materialFor(opts.finish, maps);
    wall.material.color.set(opts.finish === 'black' || opts.finish === 'bronze' ? 0xb9b2a6 : 0x24221f);
    wall.position.z = opts.kind === 'bar' || opts.kind === 'loose' ? -0.6 : -0.35; // bars and loose numbers sit on spacers
    let built;
    try { built = buildSign(font, opts, mat, screwMat); } catch (e) { console.error('3D view: build failed', e); return; }
    built.group.position.z = -GAUGE / 2;
    if (current) {
      scene.remove(current.group);
      current.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    }
    current = built;
    scene.add(built.group);
    setWall();
    fit();
  }

  function fit() {
    if (!current) return;
    const w = el.clientWidth || 600, h = el.clientHeight || 400;
    camera.aspect = w / h;
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const wallMode = opts.frame === 'wall' && opts.wallImage;
    // 'wall' frames the whole wall like the flat preview; otherwise frame the sign itself.
    const needH = wallMode ? Math.max((opts.wallWidthIn || 40) / camera.aspect, current.h * 1.2) : Math.max(current.h, current.w / camera.aspect) * 1.3;
    const dist = needH / 2 / Math.tan(vFov / 2);
    if (Math.abs(dist - fitDist) > 0.01 || !controls.maxDistance) {
      const dir = camera.position.lengthSq() ? camera.position.clone().normalize() : new THREE.Vector3(0.25, 0.12, 1).normalize();
      camera.position.copy(dir.multiplyScalar(dist));
      fitDist = dist;
    }
    controls.minDistance = Math.min(dist * 0.3, current.w * 0.9); // close enough to see the grain and the cut edge
    controls.maxDistance = dist * (wallMode ? 1.15 : 1.6);
    camera.updateProjectionMatrix();
  }

  function resize() {
    const w = el.clientWidth, h = Math.min(el.clientHeight, w * 1.5, 1400); // hard cap: never a runaway canvas
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    Object.assign(renderer.domElement.style, { width: '100%', height: '100%' });
    fit();
  }
  new ResizeObserver(resize).observe(el);

  let visible = true;
  new IntersectionObserver((e) => { visible = e[0].isIntersecting; }).observe(el);
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  renderer.setAnimationLoop((now) => {
    if (!visible) return;
    if (idle && !still && current) {
      // A slow sway until someone grabs it, so the light runs across the grain.
      const a = Math.sin((now - t0) / 2600) * (opts.frame === 'wall' ? 0.22 : 0.5);
      camera.position.set(Math.sin(a) * fitDist, fitDist * 0.12, Math.cos(a) * fitDist);
      camera.lookAt(0, 0, 0);
    }
    controls.update();
    renderer.render(scene, camera);
  });

  el._bcf3d = { scene, camera, renderer }; // handy when debugging in the console
  resize();
  rebuild();
  return {
    update(next) {
      const before = JSON.stringify(opts);
      opts = Object.assign({}, opts, next);
      if (JSON.stringify(opts) !== before) rebuild();
    }
  };
}
