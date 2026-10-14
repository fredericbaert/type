/* Coil Type — engine: settings, colour, layout, circle chains and canvas rendering. */
(function (root) {
  const Coil = (root.Coil = root.Coil || {});
  const TAU = Math.PI * 2, DEG = Math.PI / 180;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = (u) => u * u * (3 - 2 * u);
  Coil.clamp = clamp;
  Coil.smooth = smooth;

  /* ---------------- colour ---------------- */
  Coil.hexToRgb = function (hex) {
    let h = String(hex || '#000').replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h.slice(0, 6), 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  Coil.rgbToHex = function (rgb) {
    return '#' + rgb.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  };
  function rgbToHsl([r, g, b]) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    if (mx === mn) return [0, 0, l];
    const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, s, l];
  }
  function hslToRgb([h, s, l]) {
    h = ((h % 360) + 360) % 360 / 360;
    if (!s) return [l * 255, l * 255, l * 255];
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = (t) => {
      t = (t + 1) % 1;
      return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
    };
    return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
  }
  Coil.rgbToHsl = rgbToHsl;
  Coil.hslToRgb = hslToRgb;
  Coil.hueRotate = function (hex, deg) {
    if (!deg) return hex;
    const hsl = rgbToHsl(Coil.hexToRgb(hex));
    hsl[0] += deg;
    return Coil.rgbToHex(hslToRgb(hsl));
  };
  Coil.rgba = function (hex, a) {
    const [r, g, b] = Coil.hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  };

  /* ---------------- settings ---------------- */
  Coil.FORMATS = {
    poster: { label: 'Poster 4:5', w: 1080, h: 1350 },
    square: { label: 'Square 1:1', w: 1080, h: 1080 },
    story: { label: 'Story 9:16', w: 1080, h: 1920 },
    wide: { label: 'Wide 16:9', w: 1920, h: 1080 },
    a4: { label: 'A4 at 300 dpi', w: 2480, h: 3508 },
    fit: { label: 'Fit to text', w: 2400, h: 0 },
    custom: { label: 'Custom size', w: 0, h: 0 },
  };

  Coil.BLENDS = [
    ['source-over', 'Normal'], ['multiply', 'Multiply'], ['screen', 'Screen'], ['overlay', 'Overlay'],
    ['darken', 'Darken'], ['lighten', 'Lighten'], ['color-dodge', 'Color dodge'], ['color-burn', 'Color burn'],
    ['hard-light', 'Hard light'], ['soft-light', 'Soft light'], ['difference', 'Difference'], ['exclusion', 'Exclusion'],
    ['hue', 'Hue'], ['saturation', 'Saturation'], ['color', 'Color'], ['luminosity', 'Luminosity'],
  ];

  // The "Poster" look is matched to the reference print: hot pink rim, blue body, bottle green shade, navy edge.
  const POSTER = {
    weight: 190, density: 0.22, corners: 0.35, width: 1, slant: 0,
    taper: 0, contrast: 0, wave: 0, waveFreq: 3, jitter: 0,
    style: 'disc', ringWidth: 0.1,
    stops: [
      { c: '#ff3c9e', p: 0 }, { c: '#8a74f2', p: 0.16 }, { c: '#3d8df5', p: 0.42 },
      { c: '#0f6b35', p: 0.78 }, { c: '#0a0b3d', p: 1 },
    ],
    gradFollow: true, gradAngle: 90, twist: 0,
    opacity: 0.76, outlineWidth: 0.014, outlineColor: '#0b0a3d', outlineOpacity: 0.45,
    blend: 'source-over', hueDrift: 0, order: 'forward',
    bg: '#dbd7d3', transparent: false, grain: 0.32, dots: 0.16, dotSize: 1, shadow: 0,
  };

  Coil.DEFAULTS = Object.assign(
    { text: 'COIL\nTYPE', align: 'center', tracking: 30, lineHeight: 1, seed: 7, kernMode: 'none', kernStrength: 0.6, kerning: {} },
    POSTER,
    { format: 'poster', customW: 1600, customH: 1200, fill: 0.84 }
  );

  Coil.STYLE_KEYS = Object.keys(POSTER);

  const st = (arr) => arr.map(([c, p]) => ({ c, p }));

  /* Colour is kept apart from everything else: palettes only touch these keys, looks never do. */
  Coil.PALETTE_KEYS = ['stops', 'bg', 'outlineColor'];
  Coil.paletteOf = (S) => ({ stops: S.stops.map((x) => ({ ...x })), bg: S.bg, outlineColor: S.outlineColor });
  Coil.PALETTES = [
    { id: 'poster', name: 'Poster', p: Coil.paletteOf(POSTER) },
    { id: 'lavender', name: 'Lavender', p: { stops: st([['#e7a8f2', 0], ['#a48ee0', 0.3], ['#7d78cc', 0.62], ['#23a386', 1]]), bg: '#e6e8e9', outlineColor: '#4a4896' } },
    { id: 'riso', name: 'Riso', p: { stops: st([['#ff48b0', 0], ['#ffe14d', 0.5], ['#00a19b', 1]]), bg: '#f3eee4', outlineColor: '#2a2160' } },
    { id: 'night', name: 'Night', p: { stops: st([['#00f0ff', 0], ['#7b2cff', 0.45], ['#ff2e88', 0.8], ['#1a0033', 1]]), bg: '#0d0c22', outlineColor: '#7af6ff' } },
    { id: 'candy', name: 'Candy', p: { stops: st([['#ff7ab6', 0], ['#ffd166', 0.35], ['#7bdff2', 0.7], ['#b2f7ef', 1]]), bg: '#ffe4ee', outlineColor: '#5b2a86' } },
    { id: 'chrome', name: 'Chrome', p: { stops: st([['#ffffff', 0], ['#9aa0a9', 0.28], ['#2b2e35', 0.5], ['#e1e5ea', 0.72], ['#4a4f58', 1]]), bg: '#17171b', outlineColor: '#000000' } },
    { id: 'citrus', name: 'Citrus', p: { stops: st([['#ff5e00', 0], ['#ffb400', 0.4], ['#fff1b8', 0.7], ['#2b7a0b', 1]]), bg: '#fff7da', outlineColor: '#3a1500' } },
    { id: 'ocean', name: 'Ocean', p: { stops: st([['#e6fcff', 0], ['#5ad1e6', 0.3], ['#1767c2', 0.68], ['#0b1f5c', 1]]), bg: '#d6e8ea', outlineColor: '#06123a' } },
    { id: 'coral', name: 'Coral', p: { stops: st([['#ff4f2e', 0], ['#ff9fd0', 0.5], ['#2340ff', 1]]), bg: '#f2ede6', outlineColor: '#1b1446' } },
    { id: 'ink', name: 'Ink', p: { stops: st([['#ffffff', 0], ['#f4f1ea', 0.35], ['#141414', 1]]), bg: '#f4f1ea', outlineColor: '#141414' } },
  ];

  /* Presets. Applying one sets shape and finish only (see Coil.PRESET_SKIP); the colours stay. */
  Coil.PRESETS = [
    { id: 'poster', name: 'Poster', s: POSTER },
    { id: 'riso', name: 'Riso', s: { ...POSTER, blend: 'multiply', opacity: 0.72, outlineOpacity: 0, grain: 0.4, dots: 0.28, density: 0.24, gradAngle: 0, twist: 1 } },
    { id: 'night', name: 'Night', s: { ...POSTER, blend: 'screen', opacity: 0.62, outlineOpacity: 0.35, outlineWidth: 0.02, grain: 0.22, dots: 0, gradAngle: 90 } },
    { id: 'candy', name: 'Candy', s: { ...POSTER, opacity: 0.92, outlineOpacity: 0.55, dots: 0.08, grain: 0.2, corners: 0.6, gradAngle: 180 } },
    { id: 'chrome', name: 'Chrome', s: { ...POSTER, outlineOpacity: 0.8, opacity: 1, grain: 0.25, dots: 0, gradAngle: -60, gradFollow: false } },
    { id: 'citrus', name: 'Citrus', s: { ...POSTER, outlineOpacity: 0.5, dots: 0.12, twist: 2, gradAngle: 0 } },
    { id: 'ocean', name: 'Ocean', s: { ...POSTER, density: 0.16, taper: 0.5 } },
    { id: 'rings', name: 'Rings', s: { ...POSTER, style: 'ring', ringWidth: 0.07, density: 0.1, opacity: 0.9, grain: 0.3, dots: 0, gradAngle: 0 } },
    { id: 'mono', name: 'Ink', s: { ...POSTER, outlineOpacity: 1, outlineWidth: 0.04, opacity: 1, dots: 0.22, grain: 0.35 } },
  ];
  Coil.PRESET_SKIP = new Set([...Coil.PALETTE_KEYS, 'hueDrift', 'transparent']);

  Coil.normalizeSettings = function (s) {
    const out = Object.assign({}, Coil.DEFAULTS, s || {});
    if (!Array.isArray(out.stops) || out.stops.length < 2) out.stops = Coil.DEFAULTS.stops.map((x) => ({ ...x }));
    out.stops = out.stops.map((x) => ({ c: /^#[0-9a-f]{6}$/i.test(x.c) ? x.c : '#888888', p: clamp(+x.p || 0, 0, 1) }));
    if (!Coil.FORMATS[out.format]) out.format = 'poster';
    out.text = String(out.text ?? '');
    if (out.kernMode !== 'optical') out.kernMode = 'none';
    out.kernStrength = clamp(+out.kernStrength || 0, 0, 1);
    const kern = {};
    if (out.kerning && typeof out.kerning === 'object') {
      for (const [pair, v] of Object.entries(out.kerning)) {
        if ([...pair].length === 2 && Number.isFinite(+v) && +v) kern[pair] = clamp(Math.round(+v), -800, 800);
      }
    }
    out.kerning = kern;
    return out;
  };

  /* ---------------- layout ---------------- */
  function cornerRho(S) { return S.corners * 200; }

  /* ---------------- kerning ----------------
     Values are skeleton units (cap height 1000), added to the space between two neighbouring
     letters. S.kerning holds manual pair adjustments ({ AT: -60 }); optical kerning compares
     the two letters' side profiles so open pairs (AT, LT, DA) close up like straight pairs (HH). */
  const BAND = 20;
  const profileCache = new Map(), opticalCache = new Map();
  const shapeSig = (S) => [S.weight, S.density, S.corners, S.width, S.slant, S.taper, S.contrast, S.wave, S.waveFreq, S.jitter, S.seed].join(',');

  // Left and right ink edge of a letter per horizontal band, measured from its ink box's left edge.
  function profile(key, S) {
    const ck = shapeSig(S) + '|' + key;
    let p = profileCache.get(ck);
    if (p) return p;
    const r0 = S.weight;
    const prep = Coil.prepGlyph(key, cornerRho(S), S.width, S.slant);
    const y0 = -r0, n = Math.ceil((1000 + 2 * r0) / BAND) + 1;
    const left = new Float64Array(n).fill(Infinity), right = new Float64Array(n).fill(-Infinity);
    for (const c of Coil.glyphCircles(prep, S)) {
      const u = r0 + c.x - prep.xMin;
      const j0 = Math.max(0, Math.ceil((c.y - c.r - y0) / BAND)), j1 = Math.min(n - 1, Math.floor((c.y + c.r - y0) / BAND));
      for (let j = j0; j <= j1; j++) {
        const dy = y0 + j * BAND - c.y, h = Math.sqrt(Math.max(0, c.r * c.r - dy * dy));
        if (u - h < left[j]) left[j] = u - h;
        if (u + h > right[j]) right[j] = u + h;
      }
    }
    p = { left, right, adv: prep.width + 2 * r0, n };
    if (profileCache.size > 500) profileCache.clear();
    profileCache.set(ck, p);
    return p;
  }

  // Average gap between two letters placed D apart, with open bands capped, plus the tightest gap.
  function gaps(pl, pr, D, cap) {
    let sum = 0, cnt = 0, minG = Infinity;
    for (let j = 0; j < pl.n; j++) {
      const a = pl.right[j], b = pr.left[j];
      const ha = a > -Infinity, hb = b < Infinity;
      if (!ha && !hb) continue;
      let g = cap;
      if (ha && hb) { g = D + b - a; if (g < minG) minG = g; if (g > cap) g = cap; }
      sum += g; cnt++;
    }
    return { avg: cnt ? sum / cnt : cap, minG };
  }

  function optical(a, b, S) {
    const ck = shapeSig(S) + '|' + S.tracking + '|' + S.kernStrength + '|' + a + b;
    let v = opticalCache.get(ck);
    if (v !== undefined) return v;
    const r0 = S.weight, t = S.tracking;
    const cap = Math.max(t, 0) + 0.8 * r0;
    const ref = profile('H', S);
    const target = gaps(ref, ref, ref.adv + t, cap).avg;
    const pl = profile(a, S), pr = profile(b, S);
    const { avg, minG } = gaps(pl, pr, pl.adv + t, cap);
    let k = -(avg - target) * S.kernStrength;
    const floor = t >= 0 ? t * 0.4 : t; // never pull the closest points tighter than this
    if (minG < Infinity) k = Math.max(k, floor - minG);
    k = clamp(k, -pl.adv * 0.6, r0);
    v = Math.round(k / 5) * 5 || 0;
    if (opticalCache.size > 6000) opticalCache.clear();
    opticalCache.set(ck, v);
    return v;
  }

  Coil.opticalKern = (a, b, S) => (S.kernMode === 'optical' ? optical(a, b, S) : 0);
  Coil.manualKern = (a, b, S) => (S.kerning && S.kerning[a + b]) || 0;
  Coil.kernPair = (a, b, S) => Coil.manualKern(a, b, S) + Coil.opticalKern(a, b, S);

  /* Unique neighbouring letter pairs in a text, in reading order. */
  Coil.textPairs = function (text) {
    const pairs = [], seen = new Set();
    for (const line of String(text).split('\n')) {
      let prev = null;
      for (const ch of line) {
        const k = Coil.glyphKey(ch);
        if (!k || k === ' ') { prev = null; continue; }
        if (prev && !seen.has(prev + k)) { seen.add(prev + k); pairs.push(prev + k); }
        prev = k;
      }
    }
    return pairs;
  };

  /* Measure the text block in skeleton units. */
  Coil.measure = function (S, text) {
    const r = S.weight, ws = S.width;
    const lines = String(text ?? S.text).split('\n');
    const res = { lines: [], unsupported: new Set(), count: 0 };
    for (const line of lines) {
      let x = 0, any = false, prev = null;
      const items = [];
      for (const ch of line) {
        const key = Coil.glyphKey(ch);
        if (key === null) res.unsupported.add(ch);
        if (key === null || key === ' ') { x += Coil.SPACE_WIDTH * ws + S.tracking; prev = null; continue; }
        const prep = Coil.prepGlyph(key, cornerRho(S), ws, S.slant);
        const kern = prev ? Coil.kernPair(prev, key, S) : 0;
        x += kern;
        items.push({ key, prep, lx: x, index: res.count++, pair: prev ? prev + key : null, kern });
        x += prep.width + 2 * r + S.tracking;
        prev = key;
        any = true;
      }
      res.lines.push({ items, w: any ? Math.max(0, x - S.tracking) : x });
    }
    res.LH = (1000 + 2 * r) * S.lineHeight;
    res.blockW = Math.max(res.count ? 1 : 1000, ...res.lines.map((l) => l.w));
    res.blockH = (res.lines.length - 1) * res.LH + 1000 + 2 * r;
    return res;
  };

  Coil.docSize = function (S, forAnim) {
    let f = S.format;
    if (forAnim && f === 'fit') f = 'wide';
    if (f === 'custom') return { W: clamp(Math.round(S.customW) || 1600, 64, 8000), H: clamp(Math.round(S.customH) || 1200, 64, 8000) };
    if (f === 'fit') {
      const m = Coil.measure(S);
      const W = 2400, k = (W * S.fill) / m.blockW;
      return { W, H: clamp(Math.round(m.blockH * k + W * (1 - S.fill)), 64, 8000) };
    }
    const F = Coil.FORMATS[f];
    return { W: F.w, H: F.h };
  };

  /* Place glyphs in document pixels. Each item gets tx/ty so that docX = tx + skelX*k. */
  Coil.layout = function (S, W, H, opt = {}) {
    const m = Coil.measure(S, opt.text);
    const r = S.weight;
    const fill = opt.fill ?? S.fill;
    const k = Math.min((W * fill) / m.blockW, (H * fill) / m.blockH);
    const bx = (W - m.blockW * k) / 2, by = (H - m.blockH * k) / 2;
    const items = [];
    m.lines.forEach((line, li) => {
      const ox = S.align === 'left' ? 0 : S.align === 'right' ? m.blockW - line.w : (m.blockW - line.w) / 2;
      for (const it of line.items) {
        const x0 = bx + (ox + it.lx) * k, y0 = by + li * m.LH * k;
        items.push({
          key: it.key, prep: it.prep, index: it.index, line: li, pair: it.pair, kern: it.kern,
          tx: bx + (ox + it.lx + r - it.prep.xMin) * k,
          ty: by + (li * m.LH + r) * k,
          x0, x1: x0 + (it.prep.width + 2 * r) * k, y0, y1: y0 + (1000 + 2 * r) * k,
        });
      }
    });
    return { items, k, count: m.count, unsupported: m.unsupported, block: { x: bx, y: by, w: m.blockW * k, h: m.blockH * k }, measure: m };
  };

  /* ---------------- circle chains ---------------- */
  function hash(n) {
    const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  }
  Coil.hash = hash;

  Coil.strokeCount = function (stroke, S) {
    const sp = Math.max(2, S.density * S.weight);
    if (stroke.L < 1) return 1;
    return stroke.closed ? Math.max(3, Math.round(stroke.L / sp)) : Math.max(2, Math.round(stroke.L / sp) + 1);
  };

  function distribute(N, lengths) {
    const total = lengths.reduce((a, b) => a + b, 0) || 1;
    const raw = lengths.map((l) => (N * l) / total);
    const n = raw.map((v) => Math.max(1, Math.floor(v)));
    let left = N - n.reduce((a, b) => a + b, 0);
    const order = raw.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0]);
    for (let q = 0; left > 0 && order.length; q = (q + 1) % order.length, left--) n[order[q][1]]++;
    return n;
  }

  const tmp = { x: 0, y: 0, ang: 0 };

  /* Circles for one glyph, in skeleton units. opt: phase (flow, in steps), conveyor, spin (rad),
     wavePhase, fixedN (total count, used by morphing), altDir. */
  Coil.glyphCircles = function (prep, S, opt = {}) {
    const out = [];
    const r0 = S.weight;
    const counts = opt.fixedN ? distribute(opt.fixedN, prep.strokes.map((s) => Math.max(1, s.L))) : null;
    const seed = S.seed || 0;
    prep.strokes.forEach((stroke, si) => {
      const L = stroke.L;
      const n = counts ? counts[si] : Coil.strokeCount(stroke, S);
      const dir = opt.altDir && si % 2 ? -1 : 1;
      const phase = (opt.phase || 0) * dir;
      const emit = (s, fade, id) => {
        Coil.sampleStroke(stroke, s, tmp);
        let f = fade;
        if (S.contrast) f *= 1 + S.contrast * (Math.abs(Math.sin(tmp.ang)) - 0.5);
        if (S.taper && !stroke.closed && L > 1) {
          const e = Math.min(s, L - s), ramp = Math.min(L * 0.5, 420);
          f *= 1 - S.taper * (1 - smooth(clamp(e / ramp, 0, 1)));
        }
        if (S.wave) f *= 1 + S.wave * Math.sin(TAU * (s / 1000) * S.waveFreq + (opt.wavePhase || 0));
        let x = tmp.x, y = tmp.y;
        if (S.jitter) {
          const h = si * 1009 + id;
          x += (hash(h * 3.1 + seed) - 0.5) * S.jitter * r0 * 0.7;
          y += (hash(h * 7.7 + seed * 2) - 0.5) * S.jitter * r0 * 0.7;
          f *= 1 + (hash(h * 1.3 + seed * 5) - 0.5) * S.jitter * 0.9;
        }
        const r = r0 * f;
        if (r < 0.5) return;
        const a = (S.gradFollow ? tmp.ang : 0) + S.gradAngle * DEG + TAU * S.twist * (L > 0 ? s / L : 0) + (opt.spin || 0);
        const c = { x, y, r, a, s, si, t: L > 0 ? s / L : 0 };
        if (stroke.closed) { c.k = id; c.n = n; }
        out.push(c);
      };
      if (L < 1) { emit(0, 1, 0); return; }
      if (stroke.closed) {
        const step = L / n;
        for (let i = 0; i < n; i++) emit((((i + phase) * step) % L + L) % L, 1, i);
      } else if (!opt.conveyor) {
        const step = n > 1 ? L / (n - 1) : 0;
        for (let i = 0; i < n; i++) emit(n > 1 ? i * step : L / 2, 1, i);
      } else {
        const step = L / Math.max(1, n - 1);
        const base = Math.floor(phase), fr = phase - base;
        for (let i = -1; i < n; i++) {
          const s = (i + fr) * step;
          if (s < 0 || s > L) continue;
          const fade = smooth(clamp(s / step, 0, 1)) * smooth(clamp((L - s) / step, 0, 1));
          if (fade < 0.01) continue;
          emit(s, fade, i - base);
        }
      }
    });
    return out;
  };

  Coil.orderCircles = function (list, S, salt) {
    if (S.order === 'reverse') list.reverse();
    else if (S.order === 'shuffle') {
      let h = (S.seed || 1) * 7919 + salt * 104729;
      for (let i = list.length - 1; i > 0; i--) {
        h = (h * 16807 + 11) % 2147483647;
        const j = h % (i + 1);
        const t = list[i]; list[i] = list[j]; list[j] = t;
      }
    }
    return list;
  };

  /* Closed loops drawn in painter's order show a seam: the last circle sits on top of the first.
     Returns draw ops: circles, plus after each loop a clipped redraw of the circles around the seam
     in cyclic order, so the loop reads as continuous. Circles must carry si/k/n (from glyphCircles). */
  Coil.withSeams = function (list, S) {
    if (S.order === 'shuffle') return list;
    const loops = new Map();
    list.forEach((c, pos) => {
      if (c.n === undefined) return;
      let e = loops.get(c.si);
      if (!e) loops.set(c.si, (e = { n: c.n, pos: new Array(c.n), last: -1 }));
      e.pos[c.k] = pos;
      if (pos > e.last) e.last = pos;
    });
    if (!loops.size) return list;
    const after = new Map();
    for (const e of loops.values()) {
      const n = e.n;
      let ok = true;
      for (let j = 0; j < n; j++) if (e.pos[j] === undefined) { ok = false; break; }
      if (!ok) continue;
      const c0 = list[e.pos[0]], cl = list[e.pos[n - 1]];
      const sp = Math.max(1e-3, Math.hypot(c0.x - cl.x, c0.y - cl.y));
      let rmax = 0;
      for (const p of e.pos) if (list[p].r > rmax) rmax = list[p].r;
      const R = rmax * 1.1;
      const K = Math.ceil((rmax + R) / sp);
      if (2 * K + 2 > n || K > 120) continue;
      const idx = [];
      if (S.order === 'reverse') { for (let j = K; j >= 0; j--) idx.push(j); for (let j = n - 1; j >= n - K; j--) idx.push(j); }
      else { for (let j = n - K; j < n; j++) idx.push(j); for (let j = 0; j <= K; j++) idx.push(j); }
      after.set(e.last, { seam: true, x: (c0.x + cl.x) / 2, y: (c0.y + cl.y) / 2, R, list: idx.map((j) => list[e.pos[j]]) });
    }
    if (!after.size) return list;
    const ops = [];
    list.forEach((c, pos) => { ops.push(c); if (after.has(pos)) ops.push(after.get(pos)); });
    return ops;
  };

  Coil.hueFor = function (S, index, count, offset) {
    return (S.hueDrift || 0) * (count > 1 ? index / (count - 1) : 0) + (offset || 0);
  };

  const stopCache = new Map();
  Coil.stopsFor = function (S, hue) {
    const h = Math.round(hue || 0);
    const key = S.stops.map((s) => s.c + s.p).join() + '|' + h;
    let v = stopCache.get(key);
    if (!v) {
      v = S.stops.slice().sort((a, b) => a.p - b.p).map((s) => ({ p: s.p, c: h ? Coil.hueRotate(s.c, h) : s.c }));
      if (stopCache.size > 2000) stopCache.clear();
      stopCache.set(key, v);
    }
    return v;
  };

  /* Static scene for the generator / exports: groups of circles in document pixels. */
  Coil.buildScene = function (S, W, H, opt = {}) {
    const lay = Coil.layout(S, W, H, opt);
    const k = lay.k;
    const groups = lay.items.map((it) => {
      const cs = Coil.glyphCircles(it.prep, S, opt.circleOpt || {});
      const circles = cs.map((c) => ({ x: it.tx + c.x * k, y: it.ty + c.y * k, r: c.r * k, a: c.a, si: c.si, k: c.k, n: c.n }));
      Coil.orderCircles(circles, S, it.index);
      return { circles, ops: Coil.withSeams(circles, S), hue: Coil.hueFor(S, it.index, lay.count, opt.hueOffset), key: it.key, index: it.index };
    });
    return { W, H, groups, layout: lay };
  };

  /* ---------------- canvas rendering ---------------- */
  const makeCanvas = (w, h) => {
    if (typeof document === 'undefined') return new OffscreenCanvas(w, h);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  };
  Coil.makeCanvas = makeCanvas;

  const layers = {};
  function layer(name, w, h) {
    let c = layers[name];
    if (!c) c = layers[name] = makeCanvas(w, h);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const ctx = c.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.shadowColor = 'transparent';
    ctx.clearRect(0, 0, w, h);
    return [c, ctx];
  }

  let noiseTile = null;
  function noise() {
    if (noiseTile) return noiseTile;
    const N = 256, c = makeCanvas(N, N), ctx = c.getContext('2d');
    const img = ctx.createImageData(N, N);
    for (let i = 0; i < N * N; i++) {
      const v = 128 + (Math.random() + Math.random() + Math.random() - 1.5) * 150;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = clamp(v, 0, 255);
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return (noiseTile = c);
  }
  const dotTiles = {};
  function dots(color) {
    if (dotTiles[color]) return dotTiles[color];
    const N = 32, c = makeCanvas(N, N), ctx = c.getContext('2d');
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(N / 2, N / 2, N * 0.24, 0, TAU);
    ctx.fill();
    return (dotTiles[color] = c);
  }

  const spriteCache = new Map();
  function sprite(S, stops, Rs) {
    const key = stops.map((s) => s.c + s.p).join() + [S.style, S.opacity, S.outlineWidth, S.outlineColor, S.outlineOpacity, S.ringWidth, Rs].join('|');
    let sp = spriteCache.get(key);
    if (sp) return sp;
    const lw = S.style === 'ring' ? S.ringWidth * Rs : S.outlineWidth * Rs;
    const pad = Math.ceil(lw / 2 + 2);
    const size = 2 * (Rs + pad);
    const c = makeCanvas(size, size), ctx = c.getContext('2d');
    const m = size / 2;
    const g = ctx.createLinearGradient(m - Rs, m, m + Rs, m);
    for (const s of stops) g.addColorStop(s.p, s.c);
    ctx.beginPath();
    ctx.arc(m, m, Rs, 0, TAU);
    if (S.style === 'ring') {
      ctx.globalAlpha = S.opacity; ctx.lineWidth = lw; ctx.strokeStyle = g; ctx.stroke();
    } else {
      ctx.globalAlpha = S.opacity; ctx.fillStyle = g; ctx.fill();
      if (S.outlineWidth > 0 && S.outlineOpacity > 0) {
        ctx.globalAlpha = S.outlineOpacity; ctx.lineWidth = lw; ctx.strokeStyle = S.outlineColor; ctx.stroke();
      }
    }
    sp = { c, half: m, Rs };
    if (spriteCache.size > 160) spriteCache.clear();
    spriteCache.set(key, sp);
    return sp;
  }

  function drawVector(ctx, scene, S, k) {
    ctx.setTransform(k, 0, 0, k, 0, 0);
    const ring = S.style === 'ring';
    const outline = !ring && S.outlineWidth > 0 && S.outlineOpacity > 0;
    for (const grp of scene.groups) {
      const stops = Coil.stopsFor(S, grp.hue);
      const one = (c) => {
        if (c.r * k < 0.15) return;
        const dx = Math.cos(c.a) * c.r, dy = Math.sin(c.a) * c.r;
        const g = ctx.createLinearGradient(c.x - dx, c.y - dy, c.x + dx, c.y + dy);
        for (const s of stops) g.addColorStop(s.p, s.c);
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r, 0, TAU);
        ctx.globalAlpha = S.opacity * (c.alpha ?? 1);
        if (ring) { ctx.lineWidth = S.ringWidth * c.r; ctx.strokeStyle = g; ctx.stroke(); }
        else {
          ctx.fillStyle = g; ctx.fill();
          if (outline) { ctx.globalAlpha = S.outlineOpacity * (c.alpha ?? 1); ctx.lineWidth = S.outlineWidth * c.r; ctx.strokeStyle = S.outlineColor; ctx.stroke(); }
        }
      };
      for (const op of grp.ops || grp.circles) {
        if (!op.seam) { one(op); continue; }
        ctx.save();
        ctx.beginPath(); ctx.arc(op.x, op.y, op.R, 0, TAU); ctx.clip();
        for (const c of op.list) one(c);
        ctx.restore();
      }
    }
  }

  function drawSprites(ctx, scene, S, k) {
    let maxR = 1;
    for (const grp of scene.groups) for (const c of grp.circles) if (c.r * k > maxR) maxR = c.r * k;
    const Rs = clamp(2 ** Math.ceil(Math.log2(maxR)), 16, 256);
    for (const grp of scene.groups) {
      const sp = sprite(S, Coil.stopsFor(S, grp.hue), Rs);
      const one = (c) => {
        const s = (c.r * k) / Rs;
        if (s * Rs < 0.15) return;
        const co = Math.cos(c.a) * s, si = Math.sin(c.a) * s;
        ctx.setTransform(co, si, -si, co, c.x * k, c.y * k);
        ctx.globalAlpha = c.alpha ?? 1;
        ctx.drawImage(sp.c, -sp.half, -sp.half);
      };
      for (const op of grp.ops || grp.circles) {
        if (!op.seam) { one(op); continue; }
        ctx.save();
        ctx.setTransform(k, 0, 0, k, 0, 0);
        ctx.beginPath(); ctx.arc(op.x, op.y, op.R, 0, TAU); ctx.clip();
        for (const c of op.list) one(c);
        ctx.restore();
      }
    }
  }

  /* Render a scene onto a canvas. opt: { sprites, transparent, grainShift } */
  Coil.renderScene = function (canvas, scene, S, opt = {}) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height, k = W / scene.W;
    const transparent = opt.transparent ?? S.transparent;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, W, H);
    if (!transparent) { ctx.fillStyle = S.bg; ctx.fillRect(0, 0, W, H); }

    const [ink, ic] = layer('ink', W, H);
    ic.globalCompositeOperation = S.blend || 'source-over';
    if (opt.sprites) drawSprites(ic, scene, S, k);
    else drawVector(ic, scene, S, k);
    ic.setTransform(1, 0, 0, 1, 0, 0);
    ic.globalAlpha = 1;

    if (S.dots > 0) {
      const pat = ic.createPattern(dots(S.outlineColor), 'repeat');
      const spacing = 7 * S.dotSize * k;
      pat.setTransform(new DOMMatrix().scale(spacing / 32).rotate(45));
      ic.globalCompositeOperation = 'source-atop';
      ic.globalAlpha = S.dots;
      ic.fillStyle = pat;
      ic.fillRect(0, 0, W, H);
    }
    const grainMatrix = () => {
      const sh = opt.grainShift || [0, 0];
      return new DOMMatrix().translate(sh[0] * W, sh[1] * H).scale(Math.max(0.5, k));
    };
    if (transparent && S.grain > 0) {
      const [gc, gx] = layer('grain', W, H);
      const pat = gx.createPattern(noise(), 'repeat');
      pat.setTransform(grainMatrix());
      gx.fillStyle = pat;
      gx.fillRect(0, 0, W, H);
      gx.globalCompositeOperation = 'destination-in';
      gx.drawImage(ink, 0, 0);
      ic.globalCompositeOperation = 'overlay';
      ic.globalAlpha = S.grain;
      ic.drawImage(gc, 0, 0);
    }

    ctx.globalCompositeOperation = 'source-over';
    if (S.shadow > 0) {
      ctx.shadowColor = Coil.rgba(S.outlineColor, 0.45);
      ctx.shadowBlur = S.shadow * 70 * k;
      ctx.shadowOffsetY = S.shadow * 26 * k;
    }
    ctx.drawImage(ink, 0, 0);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    if (!transparent && S.grain > 0) {
      const pat = ctx.createPattern(noise(), 'repeat');
      pat.setTransform(grainMatrix());
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = S.grain;
      ctx.fillStyle = pat;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  };

  Coil.clearSprites = () => spriteCache.clear();
})(typeof window !== 'undefined' ? window : globalThis);
