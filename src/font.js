/* Coil Type — TrueType font builder.
   glyf outlines: the union of each glyph's circles (single colour fallback).
   COLR v1 + CPAL: every circle as a transformed, gradient-filled layer (Chrome, Edge, Firefox).
   SVG table: the same circles as OpenType-SVG (Safari, Firefox, Adobe apps). */
(function (root) {
  const Coil = (root.Coil = root.Coil || {});
  const UPM = 1000, INK = 700, ASC = 860, DESC = -260;
  const UNIT = 256; // radius of the shared unit disc used by COLR layers

  /* ---------- binary writer ---------- */
  class Wr {
    constructor(n = 4096) { this.b = new Uint8Array(n); this.len = 0; }
    need(n) {
      if (this.len + n <= this.b.length) return;
      let c = this.b.length * 2;
      while (c < this.len + n) c *= 2;
      const nb = new Uint8Array(c); nb.set(this.b.subarray(0, this.len)); this.b = nb;
    }
    u8(v) { this.need(1); this.b[this.len++] = v & 255; }
    u16(v) { this.need(2); this.b[this.len++] = (v >> 8) & 255; this.b[this.len++] = v & 255; }
    i16(v) { v = Math.round(v); this.u16(v < 0 ? v + 65536 : v); }
    u24(v) { this.u8(v >>> 16); this.u8(v >>> 8); this.u8(v); }
    u32(v) { this.u16((v >>> 16) & 0xffff); this.u16(v & 0xffff); }
    f2(v) { this.i16(Math.max(-32768, Math.min(32767, Math.round(v * 16384)))); }
    tag(s) { for (let i = 0; i < 4; i++) this.u8(s.charCodeAt(i)); }
    bytes(a) { this.need(a.length); this.b.set(a, this.len); this.len += a.length; }
    pad(n = 4) { while (this.len % n) this.u8(0); }
    put24(at, v) { this.b[at] = (v >>> 16) & 255; this.b[at + 1] = (v >>> 8) & 255; this.b[at + 2] = v & 255; }
    put32(at, v) { this.b[at] = (v >>> 24) & 255; this.b[at + 1] = (v >>> 16) & 255; this.b[at + 2] = (v >>> 8) & 255; this.b[at + 3] = v & 255; }
    out() { return this.b.slice(0, this.len); }
  }

  /* ---------- outlines ---------- */
  // Circle as 8 quadratic segments: on-curve points every 45°, controls at r / cos(22.5°).
  function circleContour(cx, cy, r, clockwise) {
    const pts = [], rc = r / Math.cos(Math.PI / 8), dir = clockwise ? -1 : 1;
    for (let j = 0; j < 8; j++) {
      const a = (dir * j * Math.PI) / 4, b = a + (dir * Math.PI) / 8;
      pts.push({ x: Math.round(cx + r * Math.cos(a)), y: Math.round(cy + r * Math.sin(a)), on: true });
      pts.push({ x: Math.round(cx + rc * Math.cos(b)), y: Math.round(cy + rc * Math.sin(b)), on: false });
    }
    return pts;
  }

  function encodeGlyph(contours) {
    const w = new Wr(256);
    if (!contours.length) return { data: new Uint8Array(0), bbox: null, points: 0 };
    let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity, total = 0;
    for (const c of contours) for (const p of c) {
      if (p.x < xMin) xMin = p.x; if (p.x > xMax) xMax = p.x;
      if (p.y < yMin) yMin = p.y; if (p.y > yMax) yMax = p.y;
      total++;
    }
    w.i16(contours.length); w.i16(xMin); w.i16(yMin); w.i16(xMax); w.i16(yMax);
    let end = -1;
    for (const c of contours) { end += c.length; w.u16(end); }
    w.u16(0); // no instructions
    const flags = [], xs = new Wr(total * 2), ys = new Wr(total * 2);
    let px = 0, py = 0, first = true;
    for (const c of contours) for (const p of c) {
      let f = p.on ? 1 : 0;
      const dx = p.x - px, dy = p.y - py;
      if (dx === 0) f |= 0x10;
      else if (Math.abs(dx) < 256) { f |= 0x02; if (dx > 0) f |= 0x10; xs.u8(Math.abs(dx)); }
      else xs.i16(dx);
      if (dy === 0) f |= 0x20;
      else if (Math.abs(dy) < 256) { f |= 0x04; if (dy > 0) f |= 0x20; ys.u8(Math.abs(dy)); }
      else ys.i16(dy);
      if (first) { f |= 0x40; first = false; } // OVERLAP_SIMPLE
      flags.push(f);
      px = p.x; py = p.y;
    }
    for (const f of flags) w.u8(f);
    w.bytes(xs.out()); w.bytes(ys.out());
    w.pad(4);
    return { data: w.out(), bbox: { xMin, yMin, xMax, yMax }, points: total, contours: contours.length };
  }

  function checksum(bytes) {
    let sum = 0;
    const n = bytes.length;
    for (let i = 0; i < n; i += 4) {
      const v = ((bytes[i] << 24) >>> 0) + ((bytes[i + 1] || 0) << 16) + ((bytes[i + 2] || 0) << 8) + (bytes[i + 3] || 0);
      sum = (sum + v) >>> 0;
    }
    return sum;
  }

  const utf8 = (s) => (typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s) : Buffer.from(s, 'utf8'));
  const n2 = (v) => +(+v).toFixed(1);

  /* Characters in the font and their glyph keys. Lowercase maps to the capitals. */
  function charMap() {
    const keys = Object.keys(Coil.GLYPHS);
    const map = new Map();
    for (const k of keys) {
      map.set(k.codePointAt(0), k);
      const lower = k.toLowerCase();
      if (lower !== k) map.set(lower.codePointAt(0), k);
    }
    return { keys, map };
  }

  /* Build the font. Returns { bytes: Uint8Array, glyphCount, layerCount } */
  Coil.buildFont = function (S, familyName) {
    const family = (String(familyName || 'Coil').replace(/[^A-Za-z0-9 ]+/g, '').replace(/\s+/g, ' ').trim() || 'Coil').slice(0, 28);
    const psName = family.replace(/ /g, '') + '-Regular';
    const r0 = S.weight;
    const k = INK / (1000 + 2 * r0);
    const sb = Math.round(28 + (S.tracking * k) / 2);
    const corner = S.corners * 200;
    const ring = S.style === 'ring';
    const ow = !ring && S.outlineWidth > 0 && S.outlineOpacity > 0 ? S.outlineWidth : 0;
    const rw = S.ringWidth;
    const { keys, map } = charMap();

    // Glyph order: .notdef, space, base glyphs, then the COLR layer shapes.
    const glyphs = [];
    const notdef = [
      [{ x: 60, y: 0, on: true }, { x: 60, y: 700, on: true }, { x: 440, y: 700, on: true }, { x: 440, y: 0, on: true }],
      [{ x: 110, y: 50, on: true }, { x: 390, y: 50, on: true }, { x: 390, y: 650, on: true }, { x: 110, y: 650, on: true }],
    ];
    glyphs.push({ name: '.notdef', contours: notdef, adv: 500 });
    glyphs.push({ name: 'space', contours: [], adv: Math.max(0, Math.round((Coil.SPACE_WIDTH * S.width + S.tracking) * k)) });

    const colorSets = []; // stop lists (with hue) used by the layers
    const setIndex = new Map();
    const glyphIdOf = new Map();
    keys.forEach((key, i) => {
      const prep = Coil.prepGlyph(key, corner, S.width, S.slant);
      const cs = Coil.orderCircles(Coil.glyphCircles(prep, S), S, i);
      const circles = cs.map((c) => ({
        x: (c.x - prep.xMin + r0) * k + sb,
        y: (1000 + r0 - c.y) * k,
        r: c.r * k,
        a: c.a, si: c.si, k: c.k, n: c.n,
      })).filter((c) => c.r >= 1);
      const ops = Coil.withSeams(circles, S);
      const stops = Coil.stopsFor(S, Coil.hueFor(S, i, keys.length));
      const skey = stops.map((s) => s.c + s.p).join();
      if (!setIndex.has(skey)) { setIndex.set(skey, colorSets.length); colorSets.push(stops); }
      const contours = [];
      for (const c of circles) {
        if (ring) {
          contours.push(circleContour(c.x, c.y, c.r * (1 + rw / 2), true));
          if (rw < 1.98) contours.push(circleContour(c.x, c.y, c.r * (1 - rw / 2), false));
        } else contours.push(circleContour(c.x, c.y, c.r * (1 + ow / 2), true));
      }
      glyphIdOf.set(key, glyphs.length);
      glyphs.push({
        name: key, contours, circles, ops, set: setIndex.get(skey),
        adv: Math.max(0, Math.round((prep.width + 2 * r0) * k + 2 * sb)),
      });
    });
    const baseEnd = glyphs.length;
    const discGid = glyphs.length;
    glyphs.push({ name: 'layer.disc', contours: ring ? [circleContour(0, 0, UNIT * (1 + rw / 2), true), circleContour(0, 0, UNIT * Math.max(0.01, 1 - rw / 2), false)] : [circleContour(0, 0, UNIT, true)], adv: 0 });
    const outlineGid = glyphs.length;
    if (ow) glyphs.push({ name: 'layer.outline', contours: [circleContour(0, 0, UNIT * (1 + ow / 2), true), circleContour(0, 0, UNIT * (1 - ow / 2), false)], adv: 0 });
    // Clip shapes for loop seams (see Coil.withSeams)
    for (let gid = 2; gid < baseEnd; gid++) {
      for (const op of glyphs[gid].ops) {
        if (!op.seam) continue;
        op.clipGid = glyphs.length;
        glyphs.push({ name: 'layer.seam', contours: [circleContour(op.x, op.y, op.R, true)], adv: 0 });
      }
    }

    // Encode outlines
    let maxPoints = 0, maxContours = 0;
    let gx0 = Infinity, gy0 = Infinity, gx1 = -Infinity, gy1 = -Infinity;
    for (const g of glyphs) {
      const enc = encodeGlyph(g.contours);
      g.data = enc.data; g.bbox = enc.bbox;
      if (enc.bbox) {
        maxPoints = Math.max(maxPoints, enc.points); maxContours = Math.max(maxContours, enc.contours);
        gx0 = Math.min(gx0, enc.bbox.xMin); gy0 = Math.min(gy0, enc.bbox.yMin);
        gx1 = Math.max(gx1, enc.bbox.xMax); gy1 = Math.max(gy1, enc.bbox.yMax);
      }
    }
    const numGlyphs = glyphs.length;
    const tables = {};

    /* glyf + loca */
    {
      const gw = new Wr(1 << 16), lw = new Wr((numGlyphs + 1) * 4);
      for (const g of glyphs) { lw.u32(gw.len); gw.bytes(g.data); }
      lw.u32(gw.len);
      tables.glyf = gw.out(); tables.loca = lw.out();
    }

    /* hmtx */
    let advMax = 0, minLsb = Infinity, minRsb = Infinity, maxExtent = -Infinity, advSum = 0, advN = 0;
    {
      const w = new Wr(numGlyphs * 4);
      for (const g of glyphs) {
        const lsb = g.bbox ? g.bbox.xMin : 0;
        w.u16(g.adv); w.i16(lsb);
        advMax = Math.max(advMax, g.adv);
        if (g.adv) { advSum += g.adv; advN++; }
        if (g.bbox) {
          minLsb = Math.min(minLsb, lsb);
          minRsb = Math.min(minRsb, g.adv - g.bbox.xMax);
          maxExtent = Math.max(maxExtent, g.bbox.xMax);
        }
      }
      tables.hmtx = w.out();
    }
    const winAscent = Math.max(ASC, Math.ceil(gy1));
    const winDescent = Math.max(-DESC, Math.ceil(-gy0));

    /* head */
    const now = Math.floor(Date.now() / 1000) + 2082844800;
    {
      const w = new Wr(54);
      w.u32(0x00010000); w.u32(0x00010000); w.u32(0); w.u32(0x5f0f3cf5);
      w.u16(0x000b); w.u16(UPM);
      w.u32(Math.floor(now / 4294967296)); w.u32(now >>> 0);
      w.u32(Math.floor(now / 4294967296)); w.u32(now >>> 0);
      w.i16(gx0); w.i16(gy0); w.i16(gx1); w.i16(gy1);
      w.u16(0); w.u16(8); w.i16(2); w.i16(1); w.i16(0);
      tables.head = w.out();
    }

    /* hhea */
    {
      const w = new Wr(36);
      w.u32(0x00010000); w.i16(ASC); w.i16(DESC); w.i16(0);
      w.u16(advMax); w.i16(minLsb); w.i16(minRsb); w.i16(maxExtent);
      w.i16(1); w.i16(0); w.i16(0);
      w.i16(0); w.i16(0); w.i16(0); w.i16(0);
      w.i16(0); w.u16(numGlyphs);
      tables.hhea = w.out();
    }

    /* maxp */
    {
      const w = new Wr(32);
      w.u32(0x00010000); w.u16(numGlyphs); w.u16(maxPoints); w.u16(maxContours);
      w.u16(0); w.u16(0); w.u16(2); w.u16(0); w.u16(0); w.u16(0); w.u16(0); w.u16(0); w.u16(0); w.u16(0); w.u16(0);
      tables.maxp = w.out();
    }

    /* cmap (format 4) */
    const codes = [...map.keys()].sort((a, b) => a - b);
    {
      const pairs = [[32, 1]].concat(codes.map((c) => [c, glyphIdOf.get(map.get(c))])).sort((a, b) => a[0] - b[0]);
      const segs = [];
      for (const [c, g] of pairs) {
        const last = segs[segs.length - 1];
        if (last && c === last.end + 1 && g === last.gid + (c - last.start)) last.end = c;
        else segs.push({ start: c, end: c, gid: g });
      }
      segs.push({ start: 0xffff, end: 0xffff, gid: 1 - 0xffff + 65536, last: true });
      const n = segs.length, sr = 2 * 2 ** Math.floor(Math.log2(n));
      const sub = new Wr();
      sub.u16(4); sub.u16(16 + 8 * n); sub.u16(0); sub.u16(2 * n); sub.u16(sr); sub.u16(Math.floor(Math.log2(n))); sub.u16(2 * n - sr);
      for (const s of segs) sub.u16(s.end);
      sub.u16(0);
      for (const s of segs) sub.u16(s.start);
      for (const s of segs) sub.u16(s.last ? 1 : (s.gid - s.start + 65536) % 65536);
      for (let i = 0; i < n; i++) sub.u16(0);
      const w = new Wr();
      w.u16(0); w.u16(2);
      w.u16(0); w.u16(3); w.u32(20);
      w.u16(3); w.u16(1); w.u32(20);
      w.bytes(sub.out());
      tables.cmap = w.out();
    }

    /* OS/2 v4 */
    {
      const w = new Wr(96);
      const hasHeart = map.has(0x2665);
      w.u16(4); w.i16(Math.round(advSum / Math.max(1, advN))); w.u16(400); w.u16(5); w.u16(0);
      w.i16(650); w.i16(600); w.i16(0); w.i16(75); w.i16(650); w.i16(600); w.i16(0); w.i16(350);
      w.i16(50); w.i16(300); w.i16(0);
      for (let i = 0; i < 10; i++) w.u8(0);
      w.u32(1); w.u32(hasHeart ? 1 << 14 : 0); w.u32(0); w.u32(0);
      w.tag('COIL');
      w.u16(0x40 | 0x80);
      w.u16(32); w.u16(Math.min(0xffff, codes[codes.length - 1]));
      w.i16(ASC); w.i16(DESC); w.i16(0);
      w.u16(winAscent); w.u16(winDescent);
      w.u32(1); w.u32(0);
      w.i16(INK); w.i16(INK); w.u16(0); w.u16(32); w.u16(0);
      tables['OS/2'] = w.out();
    }

    /* name */
    {
      const ver = 'Version 1.000';
      const recs = [
        [0, 'Made with Coil Type'], [1, family], [2, 'Regular'], [3, `${psName};${new Date().toISOString().slice(0, 10)}`],
        [4, family], [5, ver], [6, psName],
      ];
      const strings = [];
      const entries = [];
      let off = 0;
      const add = (pid, eid, lid, nid, bytes) => { entries.push([pid, eid, lid, nid, bytes.length, off]); strings.push(bytes); off += bytes.length; };
      for (const [nid, s] of recs) add(1, 0, 0, nid, Uint8Array.from([...s].map((ch) => (ch.charCodeAt(0) < 128 ? ch.charCodeAt(0) : 63))));
      for (const [nid, s] of recs) {
        const b = new Uint8Array(s.length * 2);
        for (let i = 0; i < s.length; i++) { b[i * 2] = s.charCodeAt(i) >> 8; b[i * 2 + 1] = s.charCodeAt(i) & 255; }
        add(3, 1, 0x409, nid, b);
      }
      const w = new Wr();
      w.u16(0); w.u16(entries.length); w.u16(6 + 12 * entries.length);
      for (const e of entries) { w.u16(e[0]); w.u16(e[1]); w.u16(e[2]); w.u16(e[3]); w.u16(e[4]); w.u16(e[5]); }
      for (const s of strings) w.bytes(s);
      tables.name = w.out();
    }

    /* post v3 */
    {
      const w = new Wr(32);
      const ang = -Math.atan(S.slant) * (180 / Math.PI);
      w.u32(0x00030000); w.u32(Math.round(ang * 65536) >>> 0);
      w.i16(-120); w.i16(50); w.u32(0); w.u32(0); w.u32(0); w.u32(0); w.u32(0);
      tables.post = w.out();
    }

    /* kern (format 0): the same pair kerning as the preview, manual pairs plus optical when it is on */
    {
      const pairs = [];
      for (const a of keys) for (const b of keys) {
        const v = Math.round(Coil.kernPair(a, b, S) * k);
        if (v) pairs.push([glyphIdOf.get(a), glyphIdOf.get(b), v]);
      }
      if (pairs.length) {
        pairs.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
        const n = Math.min(pairs.length, 10900);
        const es = Math.floor(Math.log2(n)), sr = 6 * 2 ** es;
        const w = new Wr(18 + 6 * n);
        w.u16(0); w.u16(1);
        w.u16(0); w.u16(14 + 6 * n); w.u16(0x0001);
        w.u16(n); w.u16(sr); w.u16(es); w.u16(n * 6 - sr);
        for (let i = 0; i < n; i++) { w.u16(pairs[i][0]); w.u16(pairs[i][1]); w.i16(pairs[i][2]); }
        tables.kern = w.out();
        tables._kernPairs = n;
      }
    }

    /* CPAL */
    const palette = [];
    const palIndex = (hex) => {
      let i = palette.indexOf(hex);
      if (i < 0) { i = palette.length; palette.push(hex); }
      return i;
    };
    const setStops = colorSets.map((stops) => stops.map((s) => ({ p: s.p, i: palIndex(s.c) })));
    const outlinePal = palIndex(S.outlineColor);

    /* COLR v1 */
    {
      const bases = glyphs.slice(2, baseEnd).map((g, j) => ({ gid: j + 2, g }));
      const layerPaints = []; // absolute offsets of paints in the LayerList, filled after writing
      const layerRefs = []; // per layer: id string of the paint
      const P = new Wr(1 << 16); // paint region, offsets relative to its start
      const at = {}; // paint id -> offset within P
      const patches = []; // { pos, from, id }
      const topOf = new Map();
      let layerCount = 0;

      // plan the layer list
      const plan = bases.map(({ gid, g }) => {
        const leaves = [], idOf = new Map();
        g.circles.forEach((c, ci) => idOf.set(c, ci));
        for (const op of g.ops) {
          if (op.seam) {
            const dup = [];
            for (const c of op.list) {
              const ci = idOf.get(c);
              if (ci === undefined) continue;
              dup.push(`leaf:${gid}:f${ci}`);
              if (ow) dup.push(`leaf:${gid}:o${ci}`);
            }
            if (dup.length && dup.length <= 255) leaves.push({ kind: 'seam', op, dup, id: `leaf:${gid}:s${leaves.length}` });
            continue;
          }
          const ci = idOf.get(op);
          leaves.push({ kind: 'fill', c: op, id: `leaf:${gid}:f${ci}` });
          if (ow) leaves.push({ kind: 'outline', c: op, id: `leaf:${gid}:o${ci}` });
        }
        return { gid, g, leaves };
      });
      // layer index assignments: top-level layers, then chunk nodes, then the seam repeats
      for (const p of plan) {
        p.first = layerRefs.length;
        p.leaves.forEach((lf) => layerRefs.push(lf.id));
        if (p.leaves.length > 255) {
          p.chunks = Math.ceil(p.leaves.length / 255);
          p.chunkFirst = layerRefs.length;
          for (let q = 0; q < p.chunks; q++) layerRefs.push(`chunk:${p.gid}:${q}`);
        }
        for (const lf of p.leaves) if (lf.kind === 'seam') { lf.dupFirst = layerRefs.length; layerRefs.push(...lf.dup); }
      }
      const writeColrLayers = (id, num, first) => { at[id] = P.len; P.u8(1); P.u8(num); P.u32(first); };
      // tops and chunks
      for (const p of plan) {
        if (!p.leaves.length) continue;
        if (p.chunks) {
          writeColrLayers(`top:${p.gid}`, p.chunks, p.chunkFirst);
          for (let q = 0; q < p.chunks; q++) writeColrLayers(`chunk:${p.gid}:${q}`, Math.min(255, p.leaves.length - q * 255), p.first + q * 255);
        } else writeColrLayers(`top:${p.gid}`, p.leaves.length, p.first);
        topOf.set(p.gid, `top:${p.gid}`);
      }
      // leaves
      const ref24 = (id) => { const from = P.len; P.u8(0); P.u24(0); patches.push({ pos: from + 1, from, id }); };
      for (const p of plan) {
        p.leaves.forEach((lf) => {
          at[lf.id] = P.len;
          if (lf.kind === 'seam') {
            // PaintGlyph(clip disc) -> PaintColrLayers(repeated circles), so they only show inside the clip
            P.u8(10); P.u24(6); P.u16(lf.op.clipGid);
            P.u8(1); P.u8(lf.dup.length); P.u32(lf.dupFirst);
            return;
          }
          const c = lf.c;
          // PaintTranslate(14) -> child right after (8 bytes)
          P.u8(14); P.u24(8); P.i16(c.x); P.i16(c.y);
          let deg = (-c.a * 180) / Math.PI;
          deg = ((deg % 360) + 540) % 360 - 180;
          const scale = Math.min(1.99, c.r / UNIT);
          if (lf.kind === 'fill') {
            P.u8(24); P.u24(6); P.f2(deg / 180); // PaintRotate
            const s0 = P.len; P.u8(20); P.u24(0); P.f2(scale); // PaintScaleUniform -> shared
            patches.push({ pos: s0 + 1, from: s0, id: `fill:${p.g.set}` });
          } else {
            const s0 = P.len; P.u8(20); P.u24(0); P.f2(scale);
            patches.push({ pos: s0 + 1, from: s0, id: 'outline' });
          }
          layerCount++;
        });
      }
      // shared: PaintGlyph(disc) -> PaintLinearGradient -> ColorLine, one per colour set
      setStops.forEach((stops, si) => {
        at[`fill:${si}`] = P.len;
        P.u8(10); P.u24(6); P.u16(discGid);
        P.u8(4); P.u24(16); P.i16(-UNIT); P.i16(0); P.i16(UNIT); P.i16(0); P.i16(-UNIT); P.i16(UNIT);
        P.u8(0); P.u16(stops.length);
        for (const s of stops) { P.f2(s.p); P.u16(s.i); P.f2(S.opacity); }
      });
      if (ow) {
        at.outline = P.len;
        P.u8(10); P.u24(6); P.u16(outlineGid);
        P.u8(2); P.u16(outlinePal); P.f2(S.outlineOpacity);
      }
      for (const pt of patches) {
        const d = at[pt.id] - pt.from;
        if (!(d > 0 && d < 1 << 24)) throw new Error('COLR offset out of range');
        P.put24(pt.pos, d);
      }

      // assemble COLR
      const nBase = plan.filter((p) => p.leaves.length).length;
      const hdr = 34;
      const baseListOff = hdr;
      const baseListLen = 4 + 6 * nBase;
      const layerListOff = baseListOff + baseListLen;
      const layerListLen = 4 + 4 * layerRefs.length;
      const clipListOff = layerListOff + layerListLen;
      const clipLen = 5 + 7 * nBase + 9 * nBase;
      const paintOff = clipListOff + clipLen;
      const w = new Wr(paintOff + P.len);
      w.u16(1); w.u16(0); w.u32(0); w.u32(0); w.u16(0);
      w.u32(baseListOff); w.u32(layerListOff); w.u32(clipListOff); w.u32(0); w.u32(0);
      // BaseGlyphList
      w.u32(nBase);
      for (const p of plan) if (p.leaves.length) { w.u16(p.gid); w.u32(paintOff + at[topOf.get(p.gid)] - baseListOff); }
      // LayerList
      w.u32(layerRefs.length);
      for (const id of layerRefs) w.u32(paintOff + at[id] - layerListOff);
      // ClipList
      w.u8(1); w.u32(nBase);
      const boxStart = 5 + 7 * nBase;
      let bi = 0;
      for (const p of plan) if (p.leaves.length) { w.u16(p.gid); w.u16(p.gid); w.u24(boxStart + 9 * bi); bi++; }
      for (const p of plan) if (p.leaves.length) {
        const b = p.g.bbox;
        w.u8(1); w.i16(b.xMin - 2); w.i16(b.yMin - 2); w.i16(b.xMax + 2); w.i16(b.yMax + 2);
      }
      if (w.len !== paintOff) throw new Error('COLR layout mismatch');
      w.bytes(P.out());
      tables.COLR = w.out();
      tables._layers = layerCount;
    }

    {
      const w = new Wr();
      w.u16(0); w.u16(palette.length); w.u16(1); w.u16(palette.length); w.u32(14); w.u16(0);
      for (const hex of palette) { const [r, g, b] = Coil.hexToRgb(hex); w.u8(b); w.u8(g); w.u8(r); w.u8(255); }
      tables.CPAL = w.out();
    }

    /* SVG (OpenType-SVG) */
    {
      const docs = [];
      for (let gid = 2; gid < baseEnd; gid++) {
        const g = glyphs[gid];
        if (!g.circles.length) continue;
        const stops = colorSets[g.set];
        let clips = '', seamN = 0;
        const body = Coil.opsMarkup(g.ops, S, 1, true, () => 's' + seamN++, (cid, x, y, R) => {
          clips += `<clipPath id="${cid}"><circle cx="${n2(x)}" cy="${n2(y)}" r="${n2(R)}"/></clipPath>`;
        });
        const doc = `<svg xmlns="http://www.w3.org/2000/svg"><defs>${Coil.gradientDef('g', stops)}${clips}</defs><g id="glyph${gid}" ${Coil.groupAttrs(S, 'g')}>${body}</g></svg>`;
        docs.push({ gid, bytes: utf8(doc) });
      }
      const w = new Wr();
      w.u16(0); w.u32(10); w.u32(0);
      const listStart = w.len;
      w.u16(docs.length);
      let off = 2 + 12 * docs.length;
      for (const d of docs) { w.u16(d.gid); w.u16(d.gid); w.u32(off); w.u32(d.bytes.length); off += d.bytes.length; }
      for (const d of docs) w.bytes(d.bytes);
      if (listStart !== 10) throw new Error('SVG header size');
      tables['SVG '] = w.out();
    }

    /* assemble sfnt */
    const layerTotal = tables._layers, kernPairs = tables._kernPairs || 0;
    delete tables._layers;
    delete tables._kernPairs;
    const tags = Object.keys(tables).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const nt = tags.length;
    const sr = 16 * 2 ** Math.floor(Math.log2(nt));
    let size = 12 + 16 * nt;
    const offsets = {};
    for (const t of tags) { offsets[t] = size; size += Math.ceil(tables[t].length / 4) * 4; }
    const out = new Wr(size);
    out.u32(0x00010000); out.u16(nt); out.u16(sr); out.u16(Math.floor(Math.log2(nt))); out.u16(nt * 16 - sr);
    for (const t of tags) { out.tag(t); out.u32(checksum(tables[t])); out.u32(offsets[t]); out.u32(tables[t].length); }
    for (const t of tags) { out.bytes(tables[t]); out.pad(4); }
    const bytes = out.out();
    const adj = (0xb1b0afba - checksum(bytes)) >>> 0;
    const ho = offsets.head + 8;
    bytes[ho] = adj >>> 24; bytes[ho + 1] = (adj >>> 16) & 255; bytes[ho + 2] = (adj >>> 8) & 255; bytes[ho + 3] = adj & 255;
    return { bytes, glyphCount: numGlyphs, layerCount: layerTotal, kernPairs, family, characters: codes.length + 1 };
  };
})(typeof window !== 'undefined' ? window : globalThis);
