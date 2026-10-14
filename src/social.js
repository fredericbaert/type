/* Coil Type — Social: a small artboard editor for social posts.
   Artboards (frames) hold layers: text, images, Coil lettering, rectangles and ellipses.
   Everything is drawn on one canvas; the same drawing code makes the exported images. */
(function (root) {
  const Coil = root.Coil;
  const DEG = Math.PI / 180;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const uid = () => Math.random().toString(36).slice(2, 10);
  const round = (v) => Math.round(v * 10) / 10;

  const SIZES = [
    { id: 'ig-portrait', name: 'Instagram portrait', w: 1080, h: 1350 },
    { id: 'ig-square', name: 'Instagram square', w: 1080, h: 1080 },
    { id: 'story', name: 'Story, Reel, TikTok', w: 1080, h: 1920 },
    { id: 'x', name: 'X post', w: 1600, h: 900 },
    { id: 'linkedin', name: 'LinkedIn post', w: 1200, h: 627 },
    { id: 'facebook', name: 'Facebook post', w: 1200, h: 630 },
    { id: 'youtube', name: 'YouTube thumbnail', w: 1280, h: 720 },
    { id: 'pinterest', name: 'Pinterest pin', w: 1000, h: 1500 },
    { id: 'banner', name: 'LinkedIn banner', w: 1584, h: 396 },
  ];
  const sizeOf = (F) => SIZES.find((s) => s.w === F.w && s.h === F.h);

  const FONTS = [
    ['Bricolage Grotesque', [400, 500, 700, 800]], ['Martian Mono', [400, 500]], ['Inter', [400, 500, 700, 900]],
    ['DM Sans', [400, 500, 700]], ['Space Grotesk', [400, 500, 700]], ['Syne', [400, 700, 800]], ['Unbounded', [400, 700, 900]],
    ['Archivo Black', [400]], ['Anton', [400]], ['Bebas Neue', [400]], ['Fraunces', [400, 700, 900]],
    ['Playfair Display', [400, 700, 900]], ['DM Serif Display', [400]], ['Instrument Serif', [400]],
    ['Caveat', [400, 700]], ['Permanent Marker', [400]], ['Coil Type', [400]],
  ];
  const weightsOf = (f) => (FONTS.find((x) => x[0] === f) || [f, [400, 700]])[1];
  const TYPE_NAMES = { text: 'Text', image: 'Image', coil: 'Lettering', rect: 'Rectangle', ellipse: 'Ellipse' };

  const svg = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const ICON = {
    text: '<path d="M5 5h14M12 5v14"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 17l-5-5-9 8"/>',
    coil: '<circle cx="8" cy="12" r="5"/><circle cx="12" cy="12" r="5"/><circle cx="16" cy="12" r="5"/>',
    rect: '<rect x="4" y="5" width="16" height="14" rx="1.5"/>',
    ellipse: '<ellipse cx="12" cy="12" rx="8" ry="7"/>',
    frame: '<path d="M7 3v18M17 3v18M3 7h18M3 17h18"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3.3 3.9M6.6 6.6C3.9 8.3 2 12 2 12s4 6 10 6a9.6 9.6 0 0 0 4.2-1"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/>',
    alL: '<path d="M4 3v18"/><rect x="7" y="6" width="10" height="4" rx="1"/><rect x="7" y="14" width="6" height="4" rx="1"/>',
    alC: '<path d="M12 3v18"/><rect x="6" y="6" width="12" height="4" rx="1"/><rect x="8" y="14" width="8" height="4" rx="1"/>',
    alR: '<path d="M20 3v18"/><rect x="7" y="6" width="10" height="4" rx="1"/><rect x="11" y="14" width="6" height="4" rx="1"/>',
    alT: '<path d="M3 4h18"/><rect x="6" y="7" width="4" height="10" rx="1"/><rect x="14" y="7" width="4" height="6" rx="1"/>',
    alM: '<path d="M3 12h18"/><rect x="6" y="6" width="4" height="12" rx="1"/><rect x="14" y="8" width="4" height="8" rx="1"/>',
    alB: '<path d="M3 20h18"/><rect x="6" y="7" width="4" height="10" rx="1"/><rect x="14" y="11" width="4" height="6" rx="1"/>',
    fwd: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    bwd: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    front: '<path d="M5 4h14M12 20V8M6 14l6-6 6 6"/>',
    back: '<path d="M5 20h14M12 4v12M6 10l6 6 6-6"/>',
    dup: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  };

  /* ---------- browser storage for designs and images (IndexedDB) ---------- */
  const store = {
    db: undefined,
    open() {
      if (this.db !== undefined) return Promise.resolve(this.db);
      return new Promise((res) => {
        try {
          const r = indexedDB.open('coil-social', 1);
          r.onupgradeneeded = () => r.result.createObjectStore('kv');
          r.onsuccess = () => { this.db = r.result; res(this.db); };
          r.onerror = () => { this.db = null; res(null); };
        } catch (e) { this.db = null; res(null); }
      });
    },
    async get(k) {
      const db = await this.open();
      if (!db) return null;
      return new Promise((res) => {
        try { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result ?? null); q.onerror = () => res(null); } catch (e) { res(null); }
      });
    },
    async set(k, v) {
      const db = await this.open();
      if (!db) return;
      try { db.transaction('kv', 'readwrite').objectStore('kv').put(v, k); } catch (e) {}
    },
  };

  /* ---------- fonts ---------- */
  const fontReady = new Map([['Bricolage Grotesque', null], ['Martian Mono', null]]);
  function loadFont(family, onDone) {
    if (family === 'Coil Type') return;
    if (fontReady.has(family) && fontReady.get(family)) { fontReady.get(family).then(onDone); return; }
    let p;
    if (!fontReady.has(family)) {
      p = new Promise((res) => {
        const l = document.createElement('link');
        l.rel = 'stylesheet';
        l.href = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@${weightsOf(family).join(';')}&display=swap`;
        l.onload = l.onerror = () => res();
        document.head.appendChild(l);
      });
    } else p = Promise.resolve();
    p = p.then(() => Promise.all(weightsOf(family).map((w) => document.fonts.load(`${w} 40px "${family}"`)))).catch(() => {});
    fontReady.set(family, p);
    p.then(onDone);
  }

  Coil.Social = function (o) {
    const $ = (id) => document.getElementById(id);
    const viewEl = $('socialView'), canvas = $('socialCanvas'), ctx = canvas.getContext('2d');
    const editBox = $('sxEdit');
    const measure = document.createElement('canvas').getContext('2d');
    let doc = null, active = false;
    const images = new Map(); // id -> { img, w, h }
    let sel = { frame: null, layers: [] };
    const cam = { z: 0.4, ox: 40, oy: 60, fitted: false };
    let dpr = 1, vw = 0, vh = 0;
    let drag = null, guides = [], marquee = null, spaceDown = false, editing = null, clip = null;
    let raf = 0;
    let exportFmt = 'png', exportScale = 2;

    /* ---------- document helpers ---------- */
    const frameById = (id) => doc.frames.find((f) => f.id === id);
    const findLayer = (id) => {
      for (const F of doc.frames) { const L = F.layers.find((l) => l.id === id); if (L) return [F, L]; }
      return [null, null];
    };
    const activeFrame = () => frameById(sel.frame) || doc.frames[0];
    const selected = () => sel.layers.map((id) => findLayer(id)[1]).filter(Boolean);
    const S = () => o.getS();
    const snapshotSettings = () => { const s = JSON.parse(JSON.stringify(S())); delete s.text; return s; };

    function newFrame(size, x, y) {
      return { id: uid(), name: size.name, x, y, w: size.w, h: size.h, bg: { type: 'solid', c1: S().bg, c2: '#ffffff', angle: 90 }, layers: [] };
    }
    function layerBase(type, F, w, h, extra) {
      return Object.assign({
        id: uid(), type, name: TYPE_NAMES[type], x: Math.round((F.w - w) / 2), y: Math.round((F.h - h) / 2), w, h,
        rot: 0, opacity: 1, blend: 'source-over', hidden: false, locked: false,
      }, extra);
    }
    function textDefaults(F) {
      return { text: 'Your text', font: 'Bricolage Grotesque', weight: 700, size: Math.round(F.w * 0.07), lineHeight: 1.1, ls: 0, align: 'left',
        color: S().outlineColor, upper: false, italic: false, hl: 'none', hlColor: S().stops[0].c, shadow: 0 };
    }
    function defaultDoc() {
      const F = newFrame(SIZES[0], 0, 0);
      const s = S();
      F.layers.push(layerBase('coil', F, 900, 760, { text: s.text, align: 'center', settings: snapshotSettings(), rev: 1, x: 90, y: 150 }));
      const t = layerBase('text', F, 900, 60, Object.assign(textDefaults(F), {
        text: 'Double-click to edit this text', font: 'Martian Mono', weight: 500, size: 34, align: 'center', upper: true, ls: 0.06, x: 90, y: 1090,
      }));
      F.layers.push(t);
      return { v: 1, frames: [F] };
    }

    /* ---------- history + saving ---------- */
    const hist = { stack: [], i: -1 };
    let saveTimer = 0;
    function save() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => store.set('doc', JSON.stringify(doc)), 400);
    }
    function commit() {
      const s = JSON.stringify(doc);
      if (hist.stack[hist.i] === s) return;
      hist.stack = hist.stack.slice(0, hist.i + 1);
      hist.stack.push(s);
      if (hist.stack.length > 120) hist.stack.shift();
      hist.i = hist.stack.length - 1;
      o.onHistory();
      save();
    }
    function travel(d) {
      const j = hist.i + d;
      if (j < 0 || j >= hist.stack.length) return;
      hist.i = j;
      doc = JSON.parse(hist.stack[j]);
      docReplaced();
      o.onHistory();
      save();
    }
    function docReplaced() {
      sel.layers = sel.layers.filter((id) => findLayer(id)[1]);
      if (!frameById(sel.frame)) sel.frame = doc.frames[0].id;
      endEdit(true);
      for (const F of doc.frames) for (const L of F.layers) if (L.type === 'text') loadFont(L.font, redraw);
      renderPanels();
      redraw();
    }

    /* ---------- images ---------- */
    async function loadImage(id, blob) {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.src = url;
      try { await img.decode(); } catch (e) { return null; }
      const rec = { img, w: img.naturalWidth, h: img.naturalHeight };
      images.set(id, rec);
      return rec;
    }
    async function addImageFiles(files, at) {
      const F = (at && at.frame) || activeFrame();
      const list = [...files].filter((f) => f.type && f.type.startsWith('image/'));
      if (!list.length) { o.toast('Those files are not images'); return; }
      const added = [];
      let n = 0;
      for (const file of list) {
        const id = uid();
        const rec = await loadImage(id, file);
        if (!rec) { o.toast(`Could not read ${file.name}`); continue; }
        store.set('img:' + id, file);
        const s = Math.min((F.w * 0.8) / rec.w, (F.h * 0.8) / rec.h, 1);
        const w = Math.round(rec.w * s), h = Math.round(rec.h * s);
        const L = layerBase('image', F, w, h, { src: id, fit: 'cover', mask: 'rect', radius: 0, gray: 0, bright: 1, contrast: 1, blur: 0, flip: false, name: (file.name || 'Image').replace(/\.[a-z0-9]+$/i, '').slice(0, 40) });
        if (at && at.x !== undefined) { L.x = Math.round(at.x - w / 2 + n * 30); L.y = Math.round(at.y - h / 2 + n * 30); }
        else { L.x += n * 30; L.y += n * 30; }
        F.layers.push(L);
        added.push(L.id);
        n++;
      }
      if (added.length) { sel = { frame: F.id, layers: added }; afterChange(true); }
    }
    async function replaceImage(L, file) {
      if (!file || !file.type.startsWith('image/')) return;
      const id = uid();
      const rec = await loadImage(id, file);
      if (!rec) { o.toast('Could not read that image'); return; }
      store.set('img:' + id, file);
      L.src = id;
      L.h = Math.round((L.w * rec.h) / rec.w);
      afterChange(true);
    }

    /* ---------- the Coil Type font for text layers ---------- */
    let coilKey = null, coilFace = null;
    function ensureCoilFont() {
      const key = JSON.stringify(snapshotSettings());
      if (key === coilKey) return;
      coilKey = key;
      try {
        const f = Coil.buildFont(S(), 'Coil Type');
        const face = new FontFace('Coil Type', f.bytes.buffer.slice(0));
        face.load().then(() => {
          if (coilFace) document.fonts.delete(coilFace);
          coilFace = face;
          document.fonts.add(face);
          redraw();
        }).catch(() => {});
      } catch (e) {}
    }

    /* ---------- geometry ---------- */
    const center = (F, L) => ({ x: F.x + L.x + L.w / 2, y: F.y + L.y + L.h / 2 });
    function corners(F, L) {
      const c = center(F, L), co = Math.cos(L.rot * DEG), si = Math.sin(L.rot * DEG);
      return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => {
        const x = (sx * L.w) / 2, y = (sy * L.h) / 2;
        return [c.x + x * co - y * si, c.y + x * si + y * co];
      });
    }
    function aabb(F, L) {
      const p = corners(F, L);
      const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]);
      return { l: Math.min(...xs), t: Math.min(...ys), r: Math.max(...xs), b: Math.max(...ys) };
    }
    function toLocal(F, L, wx, wy) {
      const c = center(F, L), co = Math.cos(-L.rot * DEG), si = Math.sin(-L.rot * DEG);
      const dx = wx - c.x, dy = wy - c.y;
      return [dx * co - dy * si, dx * si + dy * co];
    }
    function hitLayer(F, L, wx, wy) {
      if (L.hidden) return false;
      const [lx, ly] = toLocal(F, L, wx, wy);
      if (Math.abs(lx) > L.w / 2 || Math.abs(ly) > L.h / 2) return false;
      if (L.type === 'ellipse') return (lx / (L.w / 2)) ** 2 + (ly / (L.h / 2)) ** 2 <= 1;
      return true;
    }
    const toWorld = (sx, sy) => [(sx - cam.ox) / cam.z, (sy - cam.oy) / cam.z];
    const toScreen = (wx, wy) => [wx * cam.z + cam.ox, wy * cam.z + cam.oy];

    /* ---------- text layout ---------- */
    const fontStr = (L, size) => `${L.italic ? 'italic ' : ''}${L.weight} ${size}px "${L.font}", "Bricolage Grotesque", sans-serif`;
    function layoutText(L) {
      measure.font = fontStr(L, L.size);
      if ('letterSpacing' in measure) measure.letterSpacing = `${L.ls * L.size}px`;
      const content = L.upper ? L.text.toUpperCase() : L.text;
      const lines = [];
      for (const para of content.split('\n')) {
        const words = para.split(/(\s+)/);
        let line = '';
        for (const w of words) {
          const test = line + w;
          if (line.trim() && measure.measureText(test.trimEnd()).width > L.w + 0.5) { lines.push(line.trimEnd()); line = w.trimStart(); }
          else line = test;
        }
        lines.push(line);
      }
      const lh = L.size * L.lineHeight;
      L.h = Math.max(lh, lines.length * lh);
      return { lines: lines.map((t) => ({ t, w: measure.measureText(t).width })), lh };
    }

    /* ---------- drawing ---------- */
    const coilCache = new Map();
    function coilCanvas(L, pw, exporting) {
      const ph = Math.max(1, Math.round((pw * L.h) / L.w));
      const key = [L.rev, L.text, L.align, Math.round(L.w), Math.round(L.h), pw, exporting].join('|');
      const hit = coilCache.get(L.id);
      if (hit && hit.key === key) return hit.c;
      const s = Coil.normalizeSettings(Object.assign({}, L.settings, { text: L.text, align: L.align }));
      const scene = Coil.buildScene(s, L.w, L.h, { fill: 0.98 });
      const c = document.createElement('canvas');
      c.width = pw; c.height = ph;
      Coil.renderScene(c, scene, s, { transparent: true, sprites: !exporting });
      if (!exporting) coilCache.set(L.id, { key, c });
      return c;
    }
    function paintFill(g, fill, w, h) {
      if (fill.type === 'gradient') {
        const a = fill.angle * DEG, len = Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a));
        const dx = (Math.cos(a) * len) / 2, dy = (Math.sin(a) * len) / 2;
        const gr = g.createLinearGradient(-dx, -dy, dx, dy);
        gr.addColorStop(0, fill.c1); gr.addColorStop(1, fill.c2);
        return gr;
      }
      return fill.c1;
    }
    function shapePath(g, L, x, y, w, h) {
      g.beginPath();
      if (L.type === 'ellipse' || (L.type === 'image' && L.mask === 'ellipse')) g.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
      else if (L.radius > 0 && g.roundRect) g.roundRect(x, y, w, h, Math.min(L.radius, w / 2, h / 2));
      else g.rect(x, y, w, h);
    }
    function drawLayer(g, F, L, px, exporting) {
      if (L.hidden) return;
      const c = center(F, L), w = L.w, h = L.h, x = -w / 2, y = -h / 2;
      g.save();
      g.translate(c.x, c.y);
      if (L.rot) g.rotate(L.rot * DEG);
      g.globalAlpha *= L.opacity;
      g.globalCompositeOperation = L.blend || 'source-over';
      if (L.type === 'rect' || L.type === 'ellipse') {
        shapePath(g, L, x, y, w, h);
        g.fillStyle = paintFill(g, L.fill, w, h);
        g.fill();
        if (L.stroke && L.stroke.w > 0) { g.lineWidth = L.stroke.w; g.strokeStyle = L.stroke.c; g.stroke(); }
      } else if (L.type === 'image') {
        const im = images.get(L.src);
        shapePath(g, L, x, y, w, h);
        if (!im) { g.fillStyle = 'rgba(128,128,128,0.25)'; g.fill(); }
        else {
          g.clip();
          const filters = [];
          if (L.gray) filters.push(`grayscale(${L.gray})`);
          if (L.bright !== 1) filters.push(`brightness(${L.bright})`);
          if (L.contrast !== 1) filters.push(`contrast(${L.contrast})`);
          if (L.blur) filters.push(`blur(${L.blur * px}px)`);
          if (filters.length && 'filter' in g) g.filter = filters.join(' ');
          let dw = w, dh = h;
          if (L.fit !== 'stretch') {
            const s = (L.fit === 'contain' ? Math.min : Math.max)(w / im.w, h / im.h);
            dw = im.w * s; dh = im.h * s;
          }
          if (L.flip) g.scale(-1, 1);
          g.drawImage(im.img, -dw / 2, -dh / 2, dw, dh);
        }
      } else if (L.type === 'text') {
        const lay = layoutText(L);
        if (editing === L.id && !exporting) { g.restore(); return; }
        g.font = fontStr(L, L.size);
        if ('letterSpacing' in g) g.letterSpacing = `${L.ls * L.size}px`;
        g.textBaseline = 'middle';
        g.textAlign = 'left';
        const pad = L.size * 0.18;
        const lineX = (ln) => (L.align === 'center' ? -ln.w / 2 : L.align === 'right' ? w / 2 - ln.w : x);
        if (L.hl === 'box' && L.text.trim()) {
          g.fillStyle = L.hlColor;
          g.fillRect(x - pad, y - pad * 0.6, w + pad * 2, h + pad * 1.2);
        }
        lay.lines.forEach((ln, i) => {
          const ty = y + i * lay.lh + lay.lh / 2;
          if (L.hl === 'lines' && ln.t.trim()) {
            g.fillStyle = L.hlColor;
            g.fillRect(lineX(ln) - pad, ty - lay.lh / 2, ln.w + pad * 2, lay.lh);
          }
        });
        if (L.shadow) {
          g.shadowColor = 'rgba(0,0,0,0.35)';
          g.shadowBlur = L.shadow * L.size * 0.4 * px;
          g.shadowOffsetY = L.shadow * L.size * 0.08 * px;
        }
        g.fillStyle = L.color;
        lay.lines.forEach((ln, i) => g.fillText(ln.t, lineX(ln), y + i * lay.lh + lay.lh / 2));
      } else if (L.type === 'coil') {
        let pw = Math.max(16, L.w * px);
        if (!exporting) pw = 2 ** (Math.round(Math.log2(pw) * 3) / 3);
        pw = Math.round(Math.min(pw, exporting ? 8000 : 2600));
        g.drawImage(coilCanvas(L, pw, exporting), x, y, w, h);
      }
      g.restore();
    }
    function drawFrameContent(g, F, px, exporting) {
      g.save();
      g.beginPath(); g.rect(F.x, F.y, F.w, F.h); g.clip();
      g.save();
      g.translate(F.x + F.w / 2, F.y + F.h / 2);
      g.fillStyle = paintFill(g, F.bg, F.w, F.h);
      g.fillRect(-F.w / 2, -F.h / 2, F.w, F.h);
      g.restore();
      for (const L of F.layers) drawLayer(g, F, L, px, exporting);
      g.restore();
    }

    let colors = null;
    function readColors() {
      const cs = getComputedStyle(document.documentElement);
      const v = (n) => cs.getPropertyValue(n).trim();
      colors = { well: v('--well'), ink: v('--ink'), ink2: v('--ink-2'), accent: v('--accent'), line: v('--line'), surface: v('--surface'), mono: v('--font-mono') };
    }

    // Artboard name (and size when there is room), shortened to the artboard's width on screen.
    function fitLabel(F, room) {
      const full = `${F.name}  ${F.w} × ${F.h}`;
      if (ctx.measureText(full).width <= room) return full;
      if (ctx.measureText(F.name).width <= room) return F.name;
      let t = F.name;
      while (t.length > 1 && ctx.measureText(t + '…').width > room) t = t.slice(0, -1);
      return t.length > 1 ? t + '…' : '';
    }

    function handlesFor(F, L) {
      const p = corners(F, L).map(([x, y]) => toScreen(x, y));
      const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const hs = [
        { k: 'nw', hx: -1, hy: -1, p: p[0] }, { k: 'ne', hx: 1, hy: -1, p: p[1] }, { k: 'se', hx: 1, hy: 1, p: p[2] }, { k: 'sw', hx: -1, hy: 1, p: p[3] },
        { k: 'e', hx: 1, hy: 0, p: mid(p[1], p[2]) }, { k: 'w', hx: -1, hy: 0, p: mid(p[0], p[3]) },
      ];
      if (L.type !== 'text') hs.push({ k: 'n', hx: 0, hy: -1, p: mid(p[0], p[1]) }, { k: 's', hx: 0, hy: 1, p: mid(p[2], p[3]) });
      const top = mid(p[0], p[1]), c = mid(p[0], p[2]);
      const d = Math.hypot(top[0] - c[0], top[1] - c[1]) || 1;
      hs.push({ k: 'rot', p: [top[0] + ((top[0] - c[0]) / d) * 24, top[1] + ((top[1] - c[1]) / d) * 24] });
      return hs;
    }

    function draw() {
      raf = 0;
      if (!active || !doc) return;
      if (!colors) readColors();
      const W = Math.round(vw * dpr), H = Math.round(vh * dpr);
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = colors.well;
      ctx.fillRect(0, 0, W, H);
      const px = cam.z * dpr;
      for (const F of doc.frames) {
        ctx.setTransform(px, 0, 0, px, cam.ox * dpr, cam.oy * dpr);
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.18)';
        ctx.shadowBlur = 24 * dpr;
        ctx.shadowOffsetY = 6 * dpr;
        ctx.fillStyle = '#fff';
        ctx.fillRect(F.x, F.y, F.w, F.h);
        ctx.restore();
        drawFrameContent(ctx, F, px, false);
      }
      // overlay in screen pixels
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `500 11px ${colors.mono}`;
      ctx.textBaseline = 'bottom';
      for (const F of doc.frames) {
        const [sx, sy] = toScreen(F.x, F.y);
        const isSel = sel.frame === F.id && !sel.layers.length;
        ctx.fillStyle = isSel ? colors.accent : colors.ink2;
        const label = fitLabel(F, F.w * cam.z);
        if (label) ctx.fillText(label, sx, sy - 6);
        if (isSel) { ctx.strokeStyle = colors.accent; ctx.lineWidth = 2; ctx.strokeRect(sx, sy, F.w * cam.z, F.h * cam.z); }
      }
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = colors.accent;
      for (const L of selected()) {
        const [F] = findLayer(L.id);
        const p = corners(F, L).map(([x, y]) => toScreen(x, y));
        ctx.beginPath();
        p.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.closePath();
        ctx.stroke();
      }
      if (sel.layers.length === 1) {
        const [F, L] = findLayer(sel.layers[0]);
        if (F && !L.locked) {
          const hs = handlesFor(F, L);
          const top = hs.find((h) => h.k === 'n') || { p: [(hs[0].p[0] + hs[1].p[0]) / 2, (hs[0].p[1] + hs[1].p[1]) / 2] };
          const rot = hs.find((h) => h.k === 'rot');
          ctx.beginPath(); ctx.moveTo(top.p[0], top.p[1]); ctx.lineTo(rot.p[0], rot.p[1]); ctx.stroke();
          for (const h of hs) {
            ctx.beginPath();
            if (h.k === 'rot') ctx.arc(h.p[0], h.p[1], 5, 0, Math.PI * 2);
            else ctx.rect(h.p[0] - 4.5, h.p[1] - 4.5, 9, 9);
            ctx.fillStyle = '#fff';
            ctx.fill();
            ctx.stroke();
          }
        }
      }
      if (guides.length) {
        ctx.strokeStyle = colors.accent;
        ctx.lineWidth = 1;
        for (const gd of guides) {
          ctx.beginPath();
          if (gd.x !== undefined) { const [sx, s0] = toScreen(gd.x, gd.y0), [, s1] = toScreen(gd.x, gd.y1); ctx.moveTo(sx, s0); ctx.lineTo(sx, s1); }
          else { const [s0, sy] = toScreen(gd.x0, gd.y), [s1] = toScreen(gd.x1, gd.y); ctx.moveTo(s0, sy); ctx.lineTo(s1, sy); }
          ctx.stroke();
        }
      }
      if (marquee) {
        const [ax, ay] = toScreen(marquee.x0, marquee.y0), [bx, by] = toScreen(marquee.x1, marquee.y1);
        ctx.fillStyle = 'rgba(240,54,143,0.08)';
        ctx.fillRect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay));
        ctx.strokeRect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay));
      }
      info();
      if (editing) positionEditor();
    }
    function redraw() { if (!raf && active) raf = requestAnimationFrame(draw); }
    function info() {
      const F = activeFrame();
      o.onInfo(`${F.name} · ${F.w} × ${F.h} px · ${F.layers.length} layer${F.layers.length === 1 ? '' : 's'} · ${Math.round(cam.z * 100)}%`);
      $('sxZoomVal').textContent = Math.round(cam.z * 100) + '%';
    }

    /* ---------- camera ---------- */
    function resize() {
      const r = viewEl.getBoundingClientRect();
      vw = r.width; vh = r.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      if (!cam.fitted && vw > 0 && doc) { fit(); cam.fitted = true; }
      redraw();
    }
    function fit(frames) {
      frames = frames || doc.frames;
      if (!vw || !vh || !frames.length) return;
      const l = Math.min(...frames.map((f) => f.x)), t = Math.min(...frames.map((f) => f.y));
      const r = Math.max(...frames.map((f) => f.x + f.w)), b = Math.max(...frames.map((f) => f.y + f.h));
      const pad = 48;
      cam.z = clamp(Math.min((vw - pad * 2) / (r - l), (vh - pad * 2 - 20) / (b - t)), 0.02, 4);
      cam.ox = (vw - (r - l) * cam.z) / 2 - l * cam.z;
      cam.oy = (vh - (b - t) * cam.z) / 2 - t * cam.z + 10;
      redraw();
    }
    function zoomAt(f, sx = vw / 2, sy = vh / 2) {
      const z = clamp(cam.z * f, 0.02, 8);
      const [wx, wy] = toWorld(sx, sy);
      cam.z = z;
      cam.ox = sx - wx * z;
      cam.oy = sy - wy * z;
      redraw();
    }

    /* ---------- selection + changes ---------- */
    function select(frameId, layerIds) {
      sel = { frame: frameId, layers: layerIds || [] };
      endEdit();
      renderPanels();
      redraw();
    }
    function afterChange(final, structural = true) {
      if (structural) renderPanels(); else refreshProps();
      redraw();
      if (final) commit(); else save();
    }

    /* ---------- pointer interaction ---------- */
    const pt = (e) => { const r = viewEl.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    function layerAt(wx, wy) {
      for (let f = doc.frames.length - 1; f >= 0; f--) {
        const F = doc.frames[f];
        for (let i = F.layers.length - 1; i >= 0; i--) if (!F.layers[i].locked && hitLayer(F, F.layers[i], wx, wy)) return [F, F.layers[i]];
      }
      return [null, null];
    }
    const frameAt = (wx, wy) => doc.frames.slice().reverse().find((F) => wx >= F.x && wx <= F.x + F.w && wy >= F.y && wy <= F.y + F.h);
    function frameLabelAt(sx, sy) {
      ctx.font = `500 11px ${colors ? colors.mono : 'monospace'}`;
      return doc.frames.slice().reverse().find((F) => {
        const [fx, fy] = toScreen(F.x, F.y);
        const w = Math.min(ctx.measureText(`${F.name}  ${F.w} × ${F.h}`).width, F.w * cam.z);
        return sx >= fx && sx <= fx + Math.max(w, 40) && sy >= fy - 20 && sy <= fy;
      });
    }
    function handleAt(sx, sy) {
      if (sel.layers.length !== 1) return null;
      const [F, L] = findLayer(sel.layers[0]);
      if (!F || L.locked) return null;
      return handlesFor(F, L).find((h) => Math.hypot(h.p[0] - sx, h.p[1] - sy) < 8) || null;
    }

    viewEl.addEventListener('pointerdown', (e) => {
      if (!doc || e.target === editBox) return;
      if (editing) endEdit();
      viewEl.setPointerCapture(e.pointerId);
      const [sx, sy] = pt(e), [wx, wy] = toWorld(sx, sy);
      if (spaceDown || e.button === 1) { drag = { type: 'pan', sx, sy, ox: cam.ox, oy: cam.oy }; return; }
      const h = handleAt(sx, sy);
      if (h) {
        const [F, L] = findLayer(sel.layers[0]);
        if (h.k === 'rot') {
          const c = center(F, L);
          drag = { type: 'rotate', L, c, a0: Math.atan2(wy - c.y, wx - c.x), rot0: L.rot };
        } else {
          const anchorLocal = [(-h.hx * L.w) / 2, (-h.hy * L.h) / 2];
          const c = center(F, L), co = Math.cos(L.rot * DEG), si = Math.sin(L.rot * DEG);
          const anchor = [c.x + anchorLocal[0] * co - anchorLocal[1] * si, c.y + anchorLocal[0] * si + anchorLocal[1] * co];
          drag = { type: 'resize', F, L, h, anchor, w0: L.w, h0: L.h, size0: L.size };
        }
        return;
      }
      const [F, L] = layerAt(wx, wy);
      if (L) {
        if (e.shiftKey && sel.frame === F.id) {
          sel.layers = sel.layers.includes(L.id) ? sel.layers.filter((id) => id !== L.id) : sel.layers.concat(L.id);
          select(F.id, sel.layers);
        } else if (!sel.layers.includes(L.id)) select(F.id, [L.id]);
        const items = selected().map((l) => ({ l, x: l.x, y: l.y }));
        drag = { type: 'move', F, wx, wy, items, moved: false };
        return;
      }
      const lf = frameLabelAt(sx, sy);
      if (lf) { select(lf.id, []); drag = { type: 'frame', F: lf, wx, wy, x0: lf.x, y0: lf.y, moved: false }; return; }
      const Fr = frameAt(wx, wy);
      if (Fr) {
        select(Fr.id, e.shiftKey && sel.frame === Fr.id ? sel.layers : []);
        drag = { type: 'marquee', F: Fr, base: sel.layers.slice() };
        marquee = { x0: wx, y0: wy, x1: wx, y1: wy };
        return;
      }
      select(sel.frame, []);
      drag = { type: 'pan', sx, sy, ox: cam.ox, oy: cam.oy };
    });

    viewEl.addEventListener('pointermove', (e) => {
      if (!doc) return;
      const [sx, sy] = pt(e), [wx, wy] = toWorld(sx, sy);
      if (!drag) { updateCursor(sx, sy, wx, wy); return; }
      if (drag.type === 'pan') {
        cam.ox = drag.ox + sx - drag.sx; cam.oy = drag.oy + sy - drag.sy;
        redraw();
      } else if (drag.type === 'move') {
        let dx = wx - drag.wx, dy = wy - drag.wy;
        if (!drag.moved && Math.hypot(dx, dy) * cam.z < 3) return;
        drag.moved = true;
        [dx, dy] = snapMove(drag, dx, dy, e.altKey);
        for (const it of drag.items) { it.l.x = Math.round(it.x + dx); it.l.y = Math.round(it.y + dy); }
        afterChange(false, false);
      } else if (drag.type === 'frame') {
        drag.F.x = Math.round(drag.x0 + wx - drag.wx); drag.F.y = Math.round(drag.y0 + wy - drag.wy);
        drag.moved = true;
        redraw();
      } else if (drag.type === 'resize') {
        doResize(drag, wx, wy, e.shiftKey);
        afterChange(false, false);
      } else if (drag.type === 'rotate') {
        let a = drag.rot0 + (Math.atan2(wy - drag.c.y, wx - drag.c.x) - drag.a0) / DEG;
        a = ((a % 360) + 540) % 360 - 180;
        if (e.shiftKey) a = Math.round(a / 15) * 15;
        drag.L.rot = round(a);
        afterChange(false, false);
      } else if (drag.type === 'marquee') {
        marquee.x1 = wx; marquee.y1 = wy;
        const F = drag.F;
        const l = Math.min(marquee.x0, wx), r = Math.max(marquee.x0, wx), t = Math.min(marquee.y0, wy), b = Math.max(marquee.y0, wy);
        const hits = F.layers.filter((L) => { if (L.locked || L.hidden) return false; const bb = aabb(F, L); return bb.r >= l && bb.l <= r && bb.b >= t && bb.t <= b; }).map((L) => L.id);
        sel = { frame: F.id, layers: [...new Set(drag.base.concat(hits))] };
        redraw();
      }
    });

    const endDrag = () => {
      if (!drag) return;
      const d = drag;
      drag = null;
      guides = [];
      if (d.type === 'marquee') { marquee = null; renderPanels(); redraw(); return; }
      if (d.type === 'pan') return;
      if ((d.type === 'move' || d.type === 'frame') && !d.moved) { redraw(); return; }
      afterChange(true, d.type === 'frame');
    };
    viewEl.addEventListener('pointerup', endDrag);
    viewEl.addEventListener('pointercancel', endDrag);

    viewEl.addEventListener('dblclick', (e) => {
      const [sx, sy] = pt(e), [wx, wy] = toWorld(sx, sy);
      const [F, L] = layerAt(wx, wy);
      if (!L) return;
      if (L.type === 'text') { select(F.id, [L.id]); startEdit(L); }
      else if (L.type === 'coil') { const ta = $('sxCoilText'); if (ta) { ta.focus(); ta.select(); } }
      else if (L.type === 'image') $('sxReplace') && $('sxReplace').click();
    });

    viewEl.addEventListener('wheel', (e) => {
      e.preventDefault();
      const [sx, sy] = pt(e);
      if (e.ctrlKey || e.metaKey) zoomAt(Math.exp(-e.deltaY * 0.01), sx, sy);
      else { cam.ox -= e.deltaX; cam.oy -= e.deltaY; redraw(); }
    }, { passive: false });

    function updateCursor(sx, sy, wx, wy) {
      let cur = 'default';
      if (spaceDown) cur = 'grab';
      else {
        const h = handleAt(sx, sy);
        if (h) {
          if (h.k === 'rot') cur = 'grab';
          else {
            const [, L] = findLayer(sel.layers[0]);
            const ang = (((Math.atan2(h.hy, h.hx) / DEG + L.rot) % 180) + 180) % 180;
            cur = ang < 22.5 || ang >= 157.5 ? 'ew-resize' : ang < 67.5 ? 'nwse-resize' : ang < 112.5 ? 'ns-resize' : 'nesw-resize';
          }
        } else if (layerAt(wx, wy)[1]) cur = 'move';
      }
      viewEl.style.cursor = cur;
    }

    function snapMove(d, dx, dy, off) {
      guides = [];
      if (off) return [dx, dy];
      const F = d.F, tol = 6 / cam.z;
      const ids = new Set(d.items.map((it) => it.l.id));
      const box = { l: Infinity, t: Infinity, r: -Infinity, b: -Infinity };
      for (const it of d.items) {
        const bb = aabb(F, Object.assign({}, it.l, { x: it.x, y: it.y }));
        box.l = Math.min(box.l, bb.l); box.t = Math.min(box.t, bb.t); box.r = Math.max(box.r, bb.r); box.b = Math.max(box.b, bb.b);
      }
      const xs = [F.x, F.x + F.w / 2, F.x + F.w], ys = [F.y, F.y + F.h / 2, F.y + F.h];
      for (const L of F.layers) {
        if (ids.has(L.id) || L.hidden) continue;
        const bb = aabb(F, L);
        xs.push(bb.l, (bb.l + bb.r) / 2, bb.r); ys.push(bb.t, (bb.t + bb.b) / 2, bb.b);
      }
      const snap = (edges, targets) => {
        let best = null;
        for (const e of edges) for (const t of targets) { const df = t - e; if (Math.abs(df) < tol && (!best || Math.abs(df) < Math.abs(best.df))) best = { df, t }; }
        return best;
      };
      const sxp = snap([box.l + dx, (box.l + box.r) / 2 + dx, box.r + dx], xs);
      const syp = snap([box.t + dy, (box.t + box.b) / 2 + dy, box.b + dy], ys);
      if (sxp) { dx += sxp.df; guides.push({ x: sxp.t, y0: F.y, y1: F.y + F.h }); }
      if (syp) { dy += syp.df; guides.push({ y: syp.t, x0: F.x, x1: F.x + F.w }); }
      return [dx, dy];
    }

    function doResize(d, wx, wy, keep) {
      const { L, F, h, anchor } = d;
      const co = Math.cos(L.rot * DEG), si = Math.sin(L.rot * DEG);
      const vx = wx - anchor[0], vy = wy - anchor[1];
      const lx = vx * co + vy * si, ly = -vx * si + vy * co;
      let w = h.hx ? Math.max(8, h.hx * lx) : d.w0;
      let hh = h.hy ? Math.max(8, h.hy * ly) : d.h0;
      if (L.type === 'text') {
        if (h.hy) { const f = w / d.w0; L.size = Math.max(4, Math.round(d.size0 * f * 10) / 10); }
        L.w = Math.round(w);
        layoutText(L);
        hh = L.h;
      } else {
        if (keep) {
          const r = d.w0 / d.h0;
          if (h.hx && h.hy) { if (w / hh > r) hh = w / r; else w = hh * r; }
          else if (h.hx) hh = w / r;
          else w = hh * r;
        }
        L.w = Math.round(w); L.h = Math.round(hh);
      }
      const ax = (-h.hx * L.w) / 2, ay = (-h.hy * L.h) / 2;
      const cx = anchor[0] - (ax * co - ay * si), cy = anchor[1] - (ax * si + ay * co);
      L.x = Math.round(cx - F.x - L.w / 2);
      L.y = Math.round(cy - F.y - L.h / 2);
    }

    /* ---------- inline text editing ---------- */
    function startEdit(L) {
      editing = L.id;
      editBox.hidden = false;
      editBox.value = L.text;
      editBox.oninput = () => { L.text = editBox.value; save(); positionEditor(); redraw(); refreshProps(); };
      positionEditor();
      editBox.focus();
      editBox.select();
      redraw();
    }
    function positionEditor() {
      const [F, L] = findLayer(editing);
      if (!L) { endEdit(true); return; }
      layoutText(L);
      const c = center(F, L), [sx, sy] = toScreen(c.x, c.y), z = cam.z;
      Object.assign(editBox.style, {
        left: sx - (L.w * z) / 2 + 'px', top: sy - (L.h * z) / 2 + 'px', width: L.w * z + 'px', height: L.h * z + 'px',
        transform: `rotate(${L.rot}deg)`, font: fontStr(L, L.size * z), lineHeight: L.size * L.lineHeight * z + 'px',
        letterSpacing: L.ls * L.size * z + 'px', color: L.color, textAlign: L.align, textTransform: L.upper ? 'uppercase' : 'none',
      });
    }
    function endEdit(silent) {
      if (!editing) return;
      editing = null;
      editBox.hidden = true;
      editBox.oninput = null;
      if (!silent) { renderPanels(); commit(); }
      redraw();
    }
    editBox.addEventListener('blur', () => endEdit());
    editBox.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); endEdit(); } e.stopPropagation(); });

    /* ---------- adding + arranging ---------- */
    function add(type) {
      const F = activeFrame();
      if (type === 'image') { $('sxFile').click(); return; }
      let L;
      if (type === 'text') {
        L = layerBase('text', F, Math.round(F.w * 0.7), 100, textDefaults(F));
        layoutText(L);
        L.y = Math.round((F.h - L.h) / 2);
      } else if (type === 'coil') {
        L = layerBase('coil', F, Math.round(F.w * 0.84), Math.round(F.h * 0.45), { text: S().text, align: 'center', settings: snapshotSettings(), rev: 1 });
      } else {
        const s = Math.round(Math.min(F.w, F.h) * 0.4), st = S().stops;
        L = layerBase(type, F, s, s, { fill: { type: 'solid', c1: st[0].c, c2: st[st.length - 1].c, angle: 90 }, radius: 0, stroke: { c: S().outlineColor, w: 0 } });
      }
      F.layers.push(L);
      sel = { frame: F.id, layers: [L.id] };
      afterChange(true);
      if (type === 'text') startEdit(L);
    }
    function removeSelected() {
      if (sel.layers.length) {
        for (const F of doc.frames) F.layers = F.layers.filter((L) => !sel.layers.includes(L.id));
        sel.layers = [];
        afterChange(true);
      } else if (sel.frame && doc.frames.length > 1) {
        doc.frames = doc.frames.filter((F) => F.id !== sel.frame);
        sel.frame = doc.frames[0].id;
        afterChange(true);
      }
    }
    function cloneLayer(L, F, dx = 20, dy = 20) {
      const c = JSON.parse(JSON.stringify(L));
      c.id = uid(); c.x += dx; c.y += dy;
      if (c.type === 'coil') c.rev = (c.rev || 0) + 1;
      return c;
    }
    function duplicateSelected() {
      if (!sel.layers.length) { if (sel.frame) duplicateFrame(activeFrame()); return; }
      const F = activeFrame();
      const copies = selected().map((L) => cloneLayer(L, F));
      F.layers.push(...copies);
      sel.layers = copies.map((c) => c.id);
      afterChange(true);
    }
    function duplicateFrame(F, size) {
      const right = Math.max(...doc.frames.map((f) => f.x + f.w));
      const nw = size ? size.w : F.w, nh = size ? size.h : F.h;
      const s = Math.min(nw / F.w, nh / F.h), ox = (nw - F.w * s) / 2, oy = (nh - F.h * s) / 2;
      const N = { id: uid(), name: size ? size.name : F.name + ' copy', x: right + 160, y: F.y, w: nw, h: nh, bg: { ...F.bg }, layers: [] };
      for (const L of F.layers) {
        const c = cloneLayer(L, F, 0, 0);
        c.x = Math.round(L.x * s + ox); c.y = Math.round(L.y * s + oy); c.w = Math.round(L.w * s); c.h = Math.round(L.h * s);
        if (c.type === 'text') c.size = Math.round(L.size * s * 10) / 10;
        if (c.radius) c.radius = Math.round(c.radius * s);
        if (c.stroke) c.stroke.w = Math.round(c.stroke.w * s * 10) / 10;
        N.layers.push(c);
      }
      doc.frames.push(N);
      sel = { frame: N.id, layers: [] };
      afterChange(true);
      fit();
    }
    function addFrame(size) {
      const right = doc.frames.length ? Math.max(...doc.frames.map((f) => f.x + f.w)) + 160 : 0;
      const F = newFrame(size, right, 0);
      doc.frames.push(F);
      sel = { frame: F.id, layers: [] };
      afterChange(true);
      fit();
    }
    function arrange(how) {
      const F = activeFrame();
      const ids = new Set(sel.layers);
      const picked = F.layers.filter((L) => ids.has(L.id)), rest = F.layers.filter((L) => !ids.has(L.id));
      if (!picked.length) return;
      if (how === 'front') F.layers = rest.concat(picked);
      else if (how === 'back') F.layers = picked.concat(rest);
      else {
        const arr = F.layers.slice();
        const order = how === 'fwd' ? [...arr.keys()].reverse() : [...arr.keys()];
        for (const i of order) {
          const j = how === 'fwd' ? i + 1 : i - 1;
          if (ids.has(arr[i].id) && j >= 0 && j < arr.length && !ids.has(arr[j].id)) [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        F.layers = arr;
      }
      afterChange(true);
    }
    function align(how) {
      const F = activeFrame();
      for (const L of selected()) {
        const bb = aabb(F, L), ox = L.x - (bb.l - F.x), oy = L.y - (bb.t - F.y), bw = bb.r - bb.l, bh = bb.b - bb.t;
        if (how === 'l') L.x = Math.round(ox);
        if (how === 'c') L.x = Math.round(ox + (F.w - bw) / 2);
        if (how === 'r') L.x = Math.round(ox + F.w - bw);
        if (how === 't') L.y = Math.round(oy);
        if (how === 'm') L.y = Math.round(oy + (F.h - bh) / 2);
        if (how === 'b') L.y = Math.round(oy + F.h - bh);
      }
      afterChange(true, false);
    }
    function nudge(dx, dy) {
      for (const L of selected()) { L.x += dx; L.y += dy; }
      afterChange(false, false);
      clearTimeout(nudge.t);
      nudge.t = setTimeout(commit, 400);
    }

    /* ---------- panel controls ---------- */
    let refreshers = [];
    function refreshProps() { for (const f of refreshers) f(); }
    const elx = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
    function ctlWrap(host, label, input, idFor) {
      const w = elx('div', 'ctl');
      if (label) { const l = elx('label'); l.textContent = label; if (idFor) l.htmlFor = idFor; w.appendChild(l); }
      input.classList.add('full');
      w.appendChild(input);
      host.appendChild(w);
      return w;
    }
    let idn = 0;
    const nid = () => 'sx' + ++idn;
    function nums(host, items) {
      const g = elx('div', 'nums');
      for (const [label, get, set, step = 1, readOnly = false] of items) {
        const lab = elx('label', 'num');
        const sp = elx('span'); sp.textContent = label;
        const inp = elx('input');
        inp.type = 'number'; inp.step = step; inp.readOnly = readOnly;
        inp.setAttribute('aria-label', label);
        if (readOnly) lab.title = 'Set by the text';
        inp.addEventListener('input', () => { if (inp.value !== '' && isFinite(+inp.value)) { set(+inp.value); afterChange(false, false); } });
        inp.addEventListener('change', () => commit());
        lab.append(sp, inp);
        g.appendChild(lab);
        refreshers.push(() => { if (document.activeElement !== inp) inp.value = step < 1 ? round(get()) : Math.round(get()); });
      }
      host.appendChild(g);
    }
    function range(host, label, min, max, step, get, set, fmt = (v) => v) {
      const w = elx('div', 'ctl');
      const id = nid();
      const l = elx('label'); l.textContent = label; l.htmlFor = id;
      const out = elx('output');
      const inp = elx('input', 'full');
      Object.assign(inp, { type: 'range', min, max, step, id });
      inp.addEventListener('input', () => { set(+inp.value); out.textContent = fmt(+inp.value); afterChange(false, false); });
      inp.addEventListener('change', () => commit());
      w.append(l, out, inp);
      host.appendChild(w);
      refreshers.push(() => { inp.value = get(); out.textContent = fmt(get()); });
    }
    function seg(host, label, opts, get, set) {
      const s = elx('div', 'seg');
      s.setAttribute('role', 'radiogroup'); s.setAttribute('aria-label', label);
      const btns = opts.map(([v, t]) => {
        const b = elx('button'); b.type = 'button'; b.textContent = t; b.setAttribute('role', 'radio');
        b.addEventListener('click', () => { set(v); afterChange(true); });
        s.appendChild(b);
        return [v, b];
      });
      ctlWrap(host, label, s);
      refreshers.push(() => btns.forEach(([v, b]) => b.setAttribute('aria-checked', String(get() === v))));
    }
    function select_(host, label, opts, get, set) {
      const id = nid();
      const s = elx('select'); s.id = id;
      for (const [v, t] of opts) { const op = elx('option'); op.value = v; op.textContent = t; s.appendChild(op); }
      s.addEventListener('change', () => { set(s.value); afterChange(true); });
      ctlWrap(host, label, s, id);
      refreshers.push(() => { s.value = String(get()); });
    }
    function color(host, label, get, set) {
      const id = nid();
      const box = elx('div', 'color-ctl');
      const c = elx('input'); c.type = 'color'; c.id = id;
      const hex = elx('input', 'hex'); hex.type = 'text'; hex.maxLength = 7; hex.spellcheck = false; hex.setAttribute('aria-label', label + ' hex');
      c.addEventListener('input', () => { set(c.value); hex.value = c.value; afterChange(false, false); });
      c.addEventListener('change', () => commit());
      hex.addEventListener('change', () => {
        let v = hex.value.trim(); if (!v.startsWith('#')) v = '#' + v;
        if (/^#[0-9a-f]{3}$/i.test(v)) v = '#' + v.slice(1).split('').map((x) => x + x).join('');
        if (/^#[0-9a-f]{6}$/i.test(v)) { set(v.toLowerCase()); afterChange(true, false); } else { hex.value = get(); o.toast('Use a hex colour like #ff3c9e'); }
      });
      box.append(c, hex);
      const w = elx('div', 'ctl');
      const l = elx('label'); l.textContent = label; l.htmlFor = id;
      w.append(l, box);
      host.appendChild(w);
      refreshers.push(() => { c.value = get(); if (document.activeElement !== hex) hex.value = get(); });
    }
    function toggle(host, label, get, set) {
      const lab = elx('label', 'switch full');
      const sp = elx('span'); sp.textContent = label;
      const inp = elx('input'); inp.type = 'checkbox'; inp.setAttribute('role', 'switch');
      inp.addEventListener('change', () => { set(inp.checked); afterChange(true); });
      lab.append(sp, inp);
      const w = elx('div', 'ctl'); w.appendChild(lab); host.appendChild(w);
      refreshers.push(() => { inp.checked = !!get(); });
    }
    function textArea(host, label, get, set, id) {
      const ta = elx('textarea', 'sx-text');
      ta.rows = 3; ta.spellcheck = false;
      if (id) ta.id = id;
      let t = 0;
      ta.addEventListener('input', () => { set(ta.value); afterChange(false, false); clearTimeout(t); t = setTimeout(commit, 600); });
      ctlWrap(host, label, ta, ta.id || (ta.id = nid()));
      refreshers.push(() => { if (document.activeElement !== ta) ta.value = get(); });
    }
    function iconRow(host, items) {
      const r = elx('div', 'icon-row');
      for (const [icon, title, fn] of items) {
        const b = elx('button', 'icon-btn', svg(ICON[icon]));
        b.type = 'button'; b.title = title; b.setAttribute('aria-label', title);
        b.addEventListener('click', fn);
        r.appendChild(b);
      }
      host.appendChild(r);
    }
    function buttons(host, items) {
      const r = elx('div', 'export-row');
      for (const [label, fn, cls = '', id] of items) {
        const b = elx('button', 'btn ' + cls); b.type = 'button'; b.textContent = label;
        if (id) b.id = id;
        b.addEventListener('click', fn);
        r.appendChild(b);
      }
      host.appendChild(r);
      return r;
    }
    const hint = (host, text) => { const p = elx('p', 'hint'); p.textContent = text; host.appendChild(p); };
    const pc = (v) => Math.round(v * 100) + '%';

    function fillCtls(host, getFill, label) {
      seg(host, label, [['solid', 'Solid'], ['gradient', 'Gradient']], () => getFill().type, (v) => (getFill().type = v));
      color(host, 'Colour', () => getFill().c1, (v) => (getFill().c1 = v));
      if (getFill().type === 'gradient') {
        color(host, 'Second colour', () => getFill().c2, (v) => (getFill().c2 = v));
        range(host, 'Angle', -180, 180, 1, () => getFill().angle, (v) => (getFill().angle = v), (v) => Math.round(v) + '°');
      }
    }

    function renderFramePanel() {
      const host = $('sxFrameBody');
      host.innerHTML = '';
      const F = activeFrame();
      const nameId = nid();
      const name = elx('input'); name.type = 'text'; name.id = nameId; name.value = F.name; name.maxLength = 40;
      name.addEventListener('change', () => { F.name = name.value.trim() || 'Artboard'; afterChange(true); });
      ctlWrap(host, 'Name', name, nameId);
      const sizeSel = elx('select'); sizeSel.id = nid();
      for (const s of SIZES) { const op = elx('option'); op.value = s.id; op.textContent = `${s.name} · ${s.w}×${s.h}`; sizeSel.appendChild(op); }
      const cust = elx('option'); cust.value = 'custom'; cust.textContent = 'Custom size'; sizeSel.appendChild(cust);
      sizeSel.value = (sizeOf(F) || { id: 'custom' }).id;
      sizeSel.addEventListener('change', () => {
        const s = SIZES.find((x) => x.id === sizeSel.value);
        if (s) { if (F.name === (sizeOf(F) || {}).name) F.name = s.name; F.w = s.w; F.h = s.h; }
        afterChange(true);
      });
      ctlWrap(host, 'Size', sizeSel, sizeSel.id);
      nums(host, [['W', () => F.w, (v) => (F.w = clamp(Math.round(v), 16, 8000))], ['H', () => F.h, (v) => (F.h = clamp(Math.round(v), 16, 8000))]]);
      fillCtls(host, () => F.bg, 'Background');
      const copyRow = elx('div', 'ctl');
      const copyLab = elx('label'); copyLab.textContent = 'Make a copy in another size'; copyLab.htmlFor = nid();
      const copySel = elx('select', 'full'); copySel.id = copyLab.htmlFor;
      const ph = elx('option'); ph.value = ''; ph.textContent = 'Pick a size…'; copySel.appendChild(ph);
      for (const s of SIZES) { const op = elx('option'); op.value = s.id; op.textContent = `${s.name} · ${s.w}×${s.h}`; copySel.appendChild(op); }
      copySel.addEventListener('change', () => { const s = SIZES.find((x) => x.id === copySel.value); if (s) { duplicateFrame(F, s); o.toast(`Copied to ${s.name}`); } });
      copyRow.append(copyLab, copySel);
      host.appendChild(copyRow);
      hint(host, 'The copy scales your layers to fit the new size. Nudge things into place afterwards.');
      buttons(host, [
        ['Duplicate artboard', () => duplicateFrame(F)],
        ['Delete artboard', () => { if (doc.frames.length < 2) { o.toast('Keep at least one artboard'); return; } sel = { frame: F.id, layers: [] }; removeSelected(); }, 'ghost'],
      ]);
    }

    function renderPropsPanel() {
      const host = $('sxPropsBody');
      host.innerHTML = '';
      const list = selected();
      if (!list.length) {
        hint(host, 'Nothing selected. Click a layer on the artboard, or add one with the toolbar above it.');
        return;
      }
      iconRow(host, [
        ['alL', 'Align left', () => align('l')], ['alC', 'Align centre', () => align('c')], ['alR', 'Align right', () => align('r')],
        ['alT', 'Align top', () => align('t')], ['alM', 'Align middle', () => align('m')], ['alB', 'Align bottom', () => align('b')],
      ]);
      iconRow(host, [
        ['front', 'Bring to front', () => arrange('front')], ['fwd', 'Bring forward', () => arrange('fwd')],
        ['bwd', 'Send backward', () => arrange('bwd')], ['back', 'Send to back', () => arrange('back')],
        ['dup', 'Duplicate (Cmd/Ctrl+D)', duplicateSelected], ['trash', 'Delete (Backspace)', removeSelected],
      ]);
      if (list.length > 1) { hint(host, `${list.length} layers selected. Drag to move them together.`); return; }
      const L = list[0];
      nums(host, [
        ['X', () => L.x, (v) => (L.x = Math.round(v))], ['Y', () => L.y, (v) => (L.y = Math.round(v))],
        ['W', () => L.w, (v) => { if (L.type === 'text') { L.w = Math.max(8, Math.round(v)); layoutText(L); } else L.w = Math.max(1, Math.round(v)); }],
        ['H', () => L.h, (v) => { if (L.type !== 'text') L.h = Math.max(1, Math.round(v)); }, 1, L.type === 'text'],
        ['°', () => L.rot, (v) => (L.rot = round(((v % 360) + 540) % 360 - 180))],
      ]);
      range(host, 'Opacity', 0, 1, 0.01, () => L.opacity, (v) => (L.opacity = v), pc);
      select_(host, 'Blend mode', Coil.BLENDS, () => L.blend, (v) => (L.blend = v));
      if (L.type === 'text') {
        textArea(host, 'Text', () => L.text, (v) => (L.text = v));
        const fonts = FONTS.map(([f]) => [f, f === 'Coil Type' ? 'Coil Type (your lettering)' : f]);
        select_(host, 'Font', fonts, () => L.font, (v) => {
          L.font = v;
          if (!weightsOf(v).includes(L.weight)) L.weight = weightsOf(v).reduce((a, b) => (Math.abs(b - L.weight) < Math.abs(a - L.weight) ? b : a));
          if (v === 'Coil Type') ensureCoilFont(); else loadFont(v, () => { redraw(); refreshProps(); });
        });
        select_(host, 'Weight', weightsOf(L.font).map((w) => [w, String(w)]), () => L.weight, (v) => (L.weight = +v));
        nums(host, [['Size', () => L.size, (v) => (L.size = Math.max(2, v)), 1]]);
        range(host, 'Line height', 0.6, 2.5, 0.01, () => L.lineHeight, (v) => (L.lineHeight = v), (v) => v.toFixed(2));
        range(host, 'Letter spacing', -0.15, 0.6, 0.005, () => L.ls, (v) => (L.ls = v), (v) => (v * 1000).toFixed(0));
        seg(host, 'Align', [['left', 'Left'], ['center', 'Centre'], ['right', 'Right']], () => L.align, (v) => (L.align = v));
        color(host, 'Colour', () => L.color, (v) => (L.color = v));
        toggle(host, 'Capitals', () => L.upper, (v) => (L.upper = v));
        toggle(host, 'Italic', () => L.italic, (v) => (L.italic = v));
        seg(host, 'Highlight', [['none', 'None'], ['lines', 'Per line'], ['box', 'Box']], () => L.hl, (v) => (L.hl = v));
        if (L.hl !== 'none') color(host, 'Highlight colour', () => L.hlColor, (v) => (L.hlColor = v));
        range(host, 'Shadow', 0, 1, 0.01, () => L.shadow, (v) => (L.shadow = v), pc);
      } else if (L.type === 'image') {
        seg(host, 'Fit', [['cover', 'Fill'], ['contain', 'Fit'], ['stretch', 'Stretch']], () => L.fit, (v) => (L.fit = v));
        seg(host, 'Shape', [['rect', 'Rectangle'], ['ellipse', 'Circle']], () => L.mask, (v) => (L.mask = v));
        if (L.mask === 'rect') range(host, 'Corner radius', 0, Math.round(Math.min(L.w, L.h) / 2), 1, () => L.radius, (v) => (L.radius = v), (v) => Math.round(v));
        range(host, 'Black and white', 0, 1, 0.01, () => L.gray, (v) => (L.gray = v), pc);
        range(host, 'Brightness', 0.2, 2, 0.01, () => L.bright, (v) => (L.bright = v), pc);
        range(host, 'Contrast', 0.2, 2, 0.01, () => L.contrast, (v) => (L.contrast = v), pc);
        range(host, 'Blur', 0, 40, 0.5, () => L.blur, (v) => (L.blur = v), (v) => v + ' px');
        toggle(host, 'Mirror', () => L.flip, (v) => (L.flip = v));
        const im = images.get(L.src);
        buttons(host, [
          ['Replace image', () => { replaceTarget = L.id; $('sxFile').click(); }, '', 'sxReplace'],
          ['Original proportions', () => { if (im) { L.h = Math.round((L.w * im.h) / im.w); afterChange(true); } }],
        ]);
      } else if (L.type === 'coil') {
        textArea(host, 'Lettering', () => L.text, (v) => { L.text = v; L.rev++; }, 'sxCoilText');
        seg(host, 'Align', [['left', 'Left'], ['center', 'Centre'], ['right', 'Right']], () => L.align, (v) => { L.align = v; L.rev++; });
        buttons(host, [['Use the Generator’s current look', () => { L.settings = snapshotSettings(); L.rev++; afterChange(true); o.toast('Lettering updated'); }]]);
        hint(host, 'Change colours and shape in the Generator tab, then press the button above.');
      } else {
        fillCtls(host, () => L.fill, 'Fill');
        if (L.type === 'rect') range(host, 'Corner radius', 0, Math.round(Math.min(L.w, L.h) / 2), 1, () => L.radius, (v) => (L.radius = v), (v) => Math.round(v));
        color(host, 'Stroke colour', () => L.stroke.c, (v) => (L.stroke.c = v));
        range(host, 'Stroke width', 0, 80, 0.5, () => L.stroke.w, (v) => (L.stroke.w = v), (v) => v + ' px');
      }
    }

    function renderLayers() {
      const host = $('sxLayers');
      host.innerHTML = '';
      const F = activeFrame();
      const head = elx('p', 'hint');
      head.textContent = `${F.name}: top layer first. Drag rows to reorder.`;
      host.appendChild(head);
      const rows = F.layers.slice().reverse();
      if (!rows.length) { hint(host, 'This artboard is empty.'); return; }
      for (const L of rows) {
        const r = elx('div', 'layer-row' + (L.hidden ? ' off' : ''));
        r.setAttribute('role', 'option');
        r.setAttribute('aria-selected', String(sel.layers.includes(L.id)));
        r.draggable = true;
        r.dataset.id = L.id;
        const ic = elx('span', 'ic', svg(ICON[L.type]));
        const nm = elx('span', 'nm');
        nm.textContent = L.type === 'text' ? (L.text.split('\n')[0] || 'Text').slice(0, 40) : L.type === 'coil' ? `Lettering: ${L.text.replace(/\n/g, ' ')}`.slice(0, 40) : L.name;
        nm.title = 'Double-click to rename';
        const eye = elx('button', '', svg(L.hidden ? ICON.eyeOff : ICON.eye));
        eye.type = 'button'; eye.title = L.hidden ? 'Show' : 'Hide'; eye.setAttribute('aria-label', eye.title);
        eye.addEventListener('click', (e) => { e.stopPropagation(); L.hidden = !L.hidden; afterChange(true); });
        const lk = elx('button', '', svg(L.locked ? ICON.lock : ICON.unlock));
        lk.type = 'button'; lk.title = L.locked ? 'Unlock' : 'Lock'; lk.setAttribute('aria-label', lk.title);
        lk.addEventListener('click', (e) => { e.stopPropagation(); L.locked = !L.locked; if (L.locked) sel.layers = sel.layers.filter((id) => id !== L.id); afterChange(true); });
        r.append(ic, nm, eye, lk);
        r.addEventListener('click', (e) => {
          if (e.shiftKey) select(F.id, sel.layers.includes(L.id) ? sel.layers.filter((id) => id !== L.id) : sel.layers.concat(L.id));
          else select(F.id, [L.id]);
        });
        nm.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          if (L.type === 'text') { startEdit(L); return; }
          const inp = elx('input'); inp.type = 'text'; inp.value = L.name; inp.className = 'rename';
          nm.replaceWith(inp); inp.focus(); inp.select();
          const done = () => { L.name = inp.value.trim() || TYPE_NAMES[L.type]; afterChange(true); };
          inp.addEventListener('blur', done);
          inp.addEventListener('keydown', (k) => { if (k.key === 'Enter') inp.blur(); if (k.key === 'Escape') { inp.value = L.name; inp.blur(); } k.stopPropagation(); });
        });
        r.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', L.id); e.dataTransfer.effectAllowed = 'move'; });
        r.addEventListener('dragover', (e) => {
          e.preventDefault();
          const b = r.getBoundingClientRect(), after = e.clientY > b.top + b.height / 2;
          r.classList.toggle('drop-after', after); r.classList.toggle('drop-before', !after);
        });
        r.addEventListener('dragleave', () => r.classList.remove('drop-after', 'drop-before'));
        r.addEventListener('drop', (e) => {
          e.preventDefault();
          const id = e.dataTransfer.getData('text/plain');
          const after = r.classList.contains('drop-after');
          r.classList.remove('drop-after', 'drop-before');
          if (!id || id === L.id) return;
          const moving = F.layers.find((x) => x.id === id);
          if (!moving) return;
          F.layers = F.layers.filter((x) => x.id !== id);
          let idx = F.layers.indexOf(L);
          // rows are shown top-first, so "after" in the list means below, i.e. earlier in the array
          F.layers.splice(after ? idx : idx + 1, 0, moving);
          afterChange(true);
        });
        host.appendChild(r);
      }
    }

    function renderPanels() {
      if (!doc) return;
      refreshers = [];
      renderFramePanel();
      renderPropsPanel();
      renderLayers();
      refreshProps();
    }

    /* ---------- export + files ---------- */
    async function exportFrame(F) {
      const used = new Set();
      for (const L of F.layers) if (L.type === 'text' && !L.hidden) used.add(L.font);
      await Promise.all([...used].map((f) => (f === 'Coil Type' ? Promise.resolve() : new Promise((res) => loadFont(f, res)))));
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      let sc = exportScale;
      while (sc > 1 && F.w * sc * F.h * sc > 64e6) sc /= 2;
      const c = document.createElement('canvas');
      c.width = Math.round(F.w * sc); c.height = Math.round(F.h * sc);
      const g = c.getContext('2d');
      g.setTransform(sc, 0, 0, sc, -F.x * sc, -F.y * sc);
      drawFrameContent(g, F, sc, true);
      const type = exportFmt === 'jpg' ? 'image/jpeg' : 'image/png';
      const blob = await new Promise((res) => c.toBlob(res, type, 0.92));
      if (!blob) { o.toast('That artboard is too large to export'); return; }
      const slug = F.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'artboard';
      await o.saveFile(`${slug}-${F.w}x${F.h}${sc > 1 ? '@' + sc + 'x' : ''}.${exportFmt}`, blob);
    }
    const blobToDataURL = (b) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => res(null); r.readAsDataURL(b); });
    function dataURLToBlob(u) {
      const [head, body] = u.split(',');
      const mime = (head.match(/data:([^;]+)/) || [])[1] || 'image/png';
      const bin = atob(body), arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return new Blob([arr], { type: mime });
    }
    async function saveDesign() {
      const ids = new Set();
      for (const F of doc.frames) for (const L of F.layers) if (L.type === 'image') ids.add(L.src);
      const imgs = {};
      for (const id of ids) { const b = await store.get('img:' + id); if (b) imgs[id] = await blobToDataURL(b); }
      const json = JSON.stringify({ app: 'coil-type-social', v: 1, doc, images: imgs });
      await o.saveFile('coil-social-design.json', new Blob([json], { type: 'application/json' }));
    }
    async function openDesign(file) {
      try {
        const data = JSON.parse(await file.text());
        if (data.app !== 'coil-type-social' || !data.doc || !Array.isArray(data.doc.frames) || !data.doc.frames.length) throw new Error('shape');
        for (const [id, url] of Object.entries(data.images || {})) {
          const blob = dataURLToBlob(url);
          store.set('img:' + id, blob);
          await loadImage(id, blob);
        }
        doc = data.doc;
        sel = { frame: doc.frames[0].id, layers: [] };
        docReplaced();
        commit();
        fit();
        o.toast('Design opened');
      } catch (e) { o.toast('That file is not a Coil Type social design'); }
    }

    let replaceTarget = null;
    $('sxFile').addEventListener('change', async (e) => {
      const files = [...e.target.files];
      e.target.value = '';
      if (!files.length) return;
      if (replaceTarget) { const [, L] = findLayer(replaceTarget); replaceTarget = null; if (L) await replaceImage(L, files[0]); return; }
      addImageFiles(files);
    });
    $('sxOpen').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) openDesign(f); });

    // Drag and drop images onto the artboards
    let dropDepth = 0;
    viewEl.addEventListener('dragenter', (e) => { if ([...e.dataTransfer.types].includes('Files')) { dropDepth++; $('sxDrop').hidden = false; } });
    viewEl.addEventListener('dragleave', () => { dropDepth = Math.max(0, dropDepth - 1); if (!dropDepth) $('sxDrop').hidden = true; });
    viewEl.addEventListener('dragover', (e) => { if ([...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
    viewEl.addEventListener('drop', (e) => {
      e.preventDefault();
      dropDepth = 0; $('sxDrop').hidden = true;
      const [sx, sy] = pt(e), [wx, wy] = toWorld(sx, sy);
      const F = frameAt(wx, wy) || activeFrame();
      addImageFiles(e.dataTransfer.files, { frame: F, x: wx - F.x, y: wy - F.y });
    });
    // Paste images from the clipboard, or layers copied inside the editor
    document.addEventListener('paste', (e) => {
      if (!active || /^(TEXTAREA|INPUT)$/.test(document.activeElement && document.activeElement.tagName)) return;
      const files = [...(e.clipboardData ? e.clipboardData.files : [])].filter((f) => f.type.startsWith('image/'));
      if (files.length) { e.preventDefault(); addImageFiles(files); return; }
      if (clip) { e.preventDefault(); pasteLayers(); }
    });
    function pasteLayers() {
      const F = activeFrame();
      const copies = clip.map((L) => cloneLayer(L, F, 24, 24));
      clip = copies.map((c) => JSON.parse(JSON.stringify(c)));
      F.layers.push(...copies);
      sel = { frame: F.id, layers: copies.map((c) => c.id) };
      afterChange(true);
    }

    /* ---------- toolbar + keyboard ---------- */
    for (const sz of SIZES) {
      const op = document.createElement('option');
      op.value = sz.id; op.textContent = `${sz.name} · ${sz.w}×${sz.h}`;
      $('sxAddFrame').appendChild(op);
    }
    for (const b of document.querySelectorAll('[data-add]')) b.addEventListener('click', () => add(b.dataset.add));
    $('sxAddFrame').addEventListener('change', (e) => {
      const s = SIZES.find((x) => x.id === e.target.value);
      e.target.value = '';
      if (s) addFrame(s);
    });
    $('sxZoomIn').addEventListener('click', () => zoomAt(1.25));
    $('sxZoomOut').addEventListener('click', () => zoomAt(0.8));
    $('sxZoomVal').addEventListener('click', () => zoomAt(1 / cam.z));
    $('sxFit').addEventListener('click', () => fit());
    $('sxFmt').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      exportFmt = b.dataset.v;
      for (const x of $('sxFmt').children) x.setAttribute('aria-checked', String(x === b));
    });
    $('sxScale').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      exportScale = +b.dataset.v;
      for (const x of $('sxScale').children) x.setAttribute('aria-checked', String(x === b));
    });
    $('sxExport').addEventListener('click', () => exportFrame(activeFrame()));
    $('sxExportAll').addEventListener('click', async () => { for (const F of doc.frames) await exportFrame(F); });
    $('sxSave').addEventListener('click', saveDesign);
    let newArmed = 0;
    $('sxNew').addEventListener('click', () => {
      const b = $('sxNew');
      if (!newArmed) { b.textContent = 'Click again to start over'; newArmed = setTimeout(() => { newArmed = 0; b.textContent = 'New design'; }, 2500); return; }
      clearTimeout(newArmed); newArmed = 0; b.textContent = 'New design';
      doc = defaultDoc();
      sel = { frame: doc.frames[0].id, layers: [] };
      docReplaced(); commit(); fit();
    });

    document.addEventListener('keydown', (e) => {
      if (!active || editing) return;
      const t = e.target;
      if (/^(TEXTAREA|INPUT|SELECT)$/.test(t.tagName) || t.isContentEditable) return;
      const mod = e.metaKey || e.ctrlKey;
      if (e.code === 'Space' && !spaceDown) { spaceDown = true; viewEl.style.cursor = 'grab'; e.preventDefault(); return; }
      if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); removeSelected(); }
      else if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateSelected(); }
      else if (mod && e.key.toLowerCase() === 'c') { if (sel.layers.length) { clip = selected().map((L) => JSON.parse(JSON.stringify(L))); o.toast(`Copied ${clip.length} layer${clip.length > 1 ? 's' : ''}`); } }
      else if (mod && e.key === ']') { e.preventDefault(); arrange(e.shiftKey ? 'front' : 'fwd'); }
      else if (mod && e.key === '[') { e.preventDefault(); arrange(e.shiftKey ? 'back' : 'bwd'); }
      else if (mod && e.key === '0') { e.preventDefault(); fit(); }
      else if (mod && (e.key === '=' || e.key === '+')) { e.preventDefault(); zoomAt(1.25); }
      else if (mod && e.key === '-') { e.preventDefault(); zoomAt(0.8); }
      else if (e.key.startsWith('Arrow') && sel.layers.length) {
        e.preventDefault();
        const s = e.shiftKey ? 10 : 1;
        nudge(e.key === 'ArrowLeft' ? -s : e.key === 'ArrowRight' ? s : 0, e.key === 'ArrowUp' ? -s : e.key === 'ArrowDown' ? s : 0);
      } else if (e.key === 'Escape') select(sel.frame, []);
      else if (e.key === 'Enter' && sel.layers.length === 1) { const [, L] = findLayer(sel.layers[0]); if (L.type === 'text') { e.preventDefault(); startEdit(L); } }
      else if (!mod && !e.altKey) {
        const k = e.key.toLowerCase();
        const map = { t: 'text', i: 'image', l: 'coil', r: 'rect', o: 'ellipse' };
        if (map[k]) { e.preventDefault(); add(map[k]); }
      }
    });
    document.addEventListener('keyup', (e) => { if (e.code === 'Space') { spaceDown = false; viewEl.style.cursor = 'default'; } });

    /* ---------- lifecycle ---------- */
    async function init() {
      let saved = null;
      try { saved = JSON.parse((await store.get('doc')) || 'null'); } catch (e) {}
      if (saved && Array.isArray(saved.frames) && saved.frames.length) {
        doc = saved;
        const ids = new Set();
        for (const F of doc.frames) for (const L of F.layers) if (L.type === 'image') ids.add(L.src);
        await Promise.all([...ids].map(async (id) => { const b = await store.get('img:' + id); if (b) await loadImage(id, b); }));
      } else doc = defaultDoc();
      sel = { frame: doc.frames[0].id, layers: [] };
      hist.stack = [JSON.stringify(doc)]; hist.i = 0;
      for (const F of doc.frames) for (const L of F.layers) if (L.type === 'text') loadFont(L.font, redraw);
      if (doc.frames.some((F) => F.layers.some((L) => L.type === 'text' && L.font === 'Coil Type'))) ensureCoilFont();
      renderPanels();
      resize();
      o.onHistory();
    }
    const ready = init();

    return {
      async activate() {
        active = true;
        await ready;
        colors = null;
        if (doc.frames.some((F) => F.layers.some((L) => L.type === 'text' && L.font === 'Coil Type'))) ensureCoilFont();
        resize();
        renderPanels();
        o.onHistory();
      },
      deactivate() { active = false; endEdit(true); },
      resize,
      themeChanged() { colors = null; redraw(); },
      undo() { travel(-1); },
      redo() { travel(1); },
      canUndo: () => hist.i > 0,
      canRedo: () => hist.i < hist.stack.length - 1,
      sizes: SIZES,
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
