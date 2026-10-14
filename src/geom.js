/* Coil Type — path geometry: parse skeleton paths, flatten, skew/stretch, round corners,
   and sample positions + tangents by arc length. No DOM, so it also runs in Node. */
(function (root) {
  const Coil = (root.Coil = root.Coil || {});
  const TAU = Math.PI * 2;
  const STEP = 5; // flattening resolution in skeleton units

  function tokenize(d) {
    const re = /([MmLlHhVvCcQqAaZz])|(-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)/g;
    const out = [];
    let m;
    while ((m = re.exec(d))) out.push(m[1] ? m[1] : parseFloat(m[2]));
    return out;
  }

  function flatCubic(x0, y0, x1, y1, x2, y2, x3, y3) {
    const net = Math.hypot(x1 - x0, y1 - y0) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(x3 - x2, y3 - y2);
    const n = Math.max(6, Math.ceil(net / STEP));
    const pts = [];
    for (let k = 1; k <= n; k++) {
      const t = k / n, u = 1 - t;
      pts.push([
        u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
        u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
      ]);
    }
    return pts;
  }

  function flatQuad(x0, y0, x1, y1, x2, y2) {
    const net = Math.hypot(x1 - x0, y1 - y0) + Math.hypot(x2 - x1, y2 - y1);
    const n = Math.max(4, Math.ceil(net / STEP));
    const pts = [];
    for (let k = 1; k <= n; k++) {
      const t = k / n, u = 1 - t;
      pts.push([u * u * x0 + 2 * u * t * x1 + t * t * x2, u * u * y0 + 2 * u * t * y1 + t * t * y2]);
    }
    return pts;
  }

  // SVG endpoint arc → centre parameterisation (SVG spec F.6.5), then flatten.
  function flatArc(x1, y1, rx, ry, phiDeg, fa, fs, x2, y2) {
    if (!rx || !ry) return [[x2, y2]];
    rx = Math.abs(rx); ry = Math.abs(ry);
    const phi = (phiDeg * Math.PI) / 180, cs = Math.cos(phi), sn = Math.sin(phi);
    const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
    const x1p = cs * dx + sn * dy, y1p = -sn * dx + cs * dy;
    const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
    if (lam > 1) { const s = Math.sqrt(lam); rx *= s; ry *= s; }
    const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
    const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
    let co = den ? Math.sqrt(Math.max(0, num / den)) : 0;
    if (!!fa === !!fs) co = -co;
    const cxp = (co * rx * y1p) / ry, cyp = (-co * ry * x1p) / rx;
    const cx = cs * cxp - sn * cyp + (x1 + x2) / 2, cy = sn * cxp + cs * cyp + (y1 + y2) / 2;
    const ang = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
    let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
    if (!fs && dt > 0) dt -= TAU;
    else if (fs && dt < 0) dt += TAU;
    const n = Math.max(8, Math.ceil((Math.abs(dt) * Math.max(rx, ry)) / STEP));
    const pts = [];
    for (let k = 1; k <= n; k++) {
      const t = t1 + (dt * k) / n;
      pts.push([cx + rx * Math.cos(t) * cs - ry * Math.sin(t) * sn, cy + rx * Math.cos(t) * sn + ry * Math.sin(t) * cs]);
    }
    pts[pts.length - 1] = [x2, y2];
    return pts;
  }

  /* Returns subpaths as { P: [[x,y]...], F: [0|1...] (1 = original vertex), closed } */
  function parsePath(d) {
    const t = tokenize(d);
    const subs = [];
    let i = 0, x = 0, y = 0, sx = 0, sy = 0, cmd = 'M', cur = null;
    const num = () => t[i++];
    const push = (pts) => {
      for (let k = 0; k < pts.length; k++) { cur.P.push(pts[k]); cur.F.push(k === pts.length - 1 ? 1 : 0); }
    };
    while (i < t.length) {
      if (typeof t[i] === 'string') cmd = t[i++];
      const rel = cmd === cmd.toLowerCase();
      const C = cmd.toUpperCase();
      const ox = rel ? x : 0, oy = rel ? y : 0;
      if (C === 'M') {
        x = ox + num(); y = oy + num(); sx = x; sy = y;
        cur = { P: [[x, y]], F: [1], closed: false };
        subs.push(cur);
        cmd = rel ? 'l' : 'L';
      } else if (C === 'L') { x = ox + num(); y = oy + num(); push([[x, y]]); }
      else if (C === 'H') { x = ox + num(); push([[x, y]]); }
      else if (C === 'V') { y = oy + num(); push([[x, y]]); }
      else if (C === 'C') {
        const a = [ox + num(), oy + num(), ox + num(), oy + num(), ox + num(), oy + num()];
        push(flatCubic(x, y, ...a)); x = a[4]; y = a[5];
      } else if (C === 'Q') {
        const a = [ox + num(), oy + num(), ox + num(), oy + num()];
        push(flatQuad(x, y, ...a)); x = a[2]; y = a[3];
      } else if (C === 'A') {
        const rx = num(), ry = num(), rot = num(), fa = num(), fs = num();
        const ex = ox + num(), ey = oy + num();
        push(flatArc(x, y, rx, ry, rot, fa, fs, ex, ey)); x = ex; y = ey;
      } else if (C === 'Z') {
        if (Math.hypot(x - sx, y - sy) > 1e-6) push([[sx, sy]]);
        cur.closed = true; x = sx; y = sy;
        if (typeof t[i] === 'number') i++; // malformed input guard
      } else i++;
    }
    return subs;
  }

  function cumLengths(P) {
    const cum = new Float64Array(P.length);
    for (let k = 1; k < P.length; k++) cum[k] = cum[k - 1] + Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]);
    return cum;
  }

  function pointAtLen(P, cum, s) {
    let lo = 0, hi = P.length - 1;
    if (s <= 0) return { x: P[0][0], y: P[0][1], i: 0 };
    if (s >= cum[hi]) return { x: P[hi][0], y: P[hi][1], i: hi - 1 };
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
    const seg = cum[hi] - cum[lo], u = seg > 0 ? (s - cum[lo]) / seg : 0;
    return { x: P[lo][0] + (P[hi][0] - P[lo][0]) * u, y: P[lo][1] + (P[hi][1] - P[lo][1]) * u, i: lo };
  }

  // Closed loops: move the start to the middle of the first original segment so every
  // original vertex is interior and can be rounded like any other corner.
  function rotateClosed(sub) {
    const { P, F } = sub;
    let j1 = 1;
    while (j1 < P.length - 1 && !F[j1]) j1++;
    const cum = cumLengths(P);
    const mid = pointAtLen(P, cum, cum[j1] / 2);
    const body = P.slice(0, P.length - 1), fb = F.slice(0, F.length - 1);
    const k = mid.i + 1;
    const NP = [[mid.x, mid.y]].concat(body.slice(k), body.slice(0, k), [[mid.x, mid.y]]);
    const NF = [0].concat(fb.slice(k), fb.slice(0, k), [0]);
    sub.P = NP; sub.F = NF;
  }

  function roundCorners(sub, rho) {
    const { P, F } = sub;
    if (rho <= 0 || P.length < 3) return;
    const cum = cumLengths(P);
    const verts = [];
    for (let k = 0; k < P.length; k++) if (F[k] || k === 0 || k === P.length - 1) verts.push(k);
    const corners = [];
    for (let v = 1; v < verts.length - 1; v++) {
      const k = verts[v];
      if (k === 0 || k === P.length - 1) continue;
      const ax = P[k][0] - P[k - 1][0], ay = P[k][1] - P[k - 1][1];
      const bx = P[k + 1][0] - P[k][0], by = P[k + 1][1] - P[k][1];
      const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
      if (!la || !lb) continue;
      const cosA = Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb)));
      const alpha = Math.acos(cosA);
      if (alpha < 0.14) continue;
      const prevLen = cum[k] - cum[verts[v - 1]], nextLen = cum[verts[v + 1]] - cum[k];
      const d = Math.min(rho * Math.min(Math.tan(alpha / 2), 2.2), prevLen * 0.5, nextLen * 0.5);
      if (d < 0.5) continue;
      corners.push({ k, sIn: cum[k] - d, sOut: cum[k] + d, d });
    }
    if (!corners.length) return;
    const NP = [], NF = [];
    let cursor = 0;
    for (const c of corners) {
      const a = pointAtLen(P, cum, c.sIn), b = pointAtLen(P, cum, c.sOut);
      for (let q = cursor; q <= a.i; q++) { NP.push(P[q]); NF.push(F[q]); }
      const V = P[c.k];
      const n = Math.max(4, Math.ceil((2 * c.d) / STEP));
      // A corner that points up or down (the bottom of V, the tops of M) is a tip: cutting across it
      // would cost the letter height, so the curve is drawn through the original vertex instead.
      // Handles lie along both legs, so the stroke stays smooth; 2/3 is the plain rounded corner.
      const tip = (a.y - V[1] > 1 && b.y - V[1] > 1) || (V[1] - a.y > 1 && V[1] - b.y > 1);
      const h = tip ? 4 / 3 : 2 / 3;
      const p1x = a.x + h * (V[0] - a.x), p1y = a.y + h * (V[1] - a.y);
      const p2x = b.x + h * (V[0] - b.x), p2y = b.y + h * (V[1] - b.y);
      NP.push([a.x, a.y]); NF.push(0);
      for (let q = 1; q < n; q++) {
        const t = q / n, u = 1 - t;
        NP.push([
          u * u * u * a.x + 3 * u * u * t * p1x + 3 * u * t * t * p2x + t * t * t * b.x,
          u * u * u * a.y + 3 * u * u * t * p1y + 3 * u * t * t * p2y + t * t * t * b.y,
        ]);
        NF.push(0);
      }
      NP.push([b.x, b.y]); NF.push(0);
      cursor = b.i + 1;
    }
    for (let q = cursor; q < P.length; q++) { NP.push(P[q]); NF.push(F[q]); }
    sub.P = NP; sub.F = NF;
  }

  function finishStroke(sub) {
    const P = [];
    for (const p of sub.P) {
      const last = P[P.length - 1];
      if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > 1e-6) P.push(p);
    }
    if (P.length === 1) P.push([P[0][0], P[0][1]]);
    const n = P.length;
    const xs = new Float64Array(n), ys = new Float64Array(n);
    for (let k = 0; k < n; k++) { xs[k] = P[k][0]; ys[k] = P[k][1]; }
    const cum = new Float64Array(n);
    for (let k = 1; k < n; k++) cum[k] = cum[k - 1] + Math.hypot(xs[k] - xs[k - 1], ys[k] - ys[k - 1]);
    return { xs, ys, cum, L: cum[n - 1], closed: sub.closed && cum[n - 1] > 1, n };
  }

  const cache = new Map();

  /* Prepare a glyph: flattened, stretched (width), slanted, corner-rounded strokes. */
  Coil.prepGlyph = function (key, cornerRho, widthScale, slant) {
    const ck = key + '|' + cornerRho.toFixed(1) + '|' + widthScale.toFixed(3) + '|' + slant.toFixed(3);
    let g = cache.get(ck);
    if (g) return g;
    const d = Coil.GLYPHS[key];
    const subs = parsePath(d);
    for (const s of subs) {
      s.P = s.P.map(([x, y]) => [x * widthScale + slant * (1000 - y), y]);
      if (s.closed && s.P.length > 3) rotateClosed(s);
      roundCorners(s, cornerRho);
    }
    const strokes = subs.map(finishStroke);
    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity, total = 0;
    for (const st of strokes) {
      total += st.L;
      for (let k = 0; k < st.n; k++) {
        if (st.xs[k] < xMin) xMin = st.xs[k];
        if (st.xs[k] > xMax) xMax = st.xs[k];
        if (st.ys[k] < yMin) yMin = st.ys[k];
        if (st.ys[k] > yMax) yMax = st.ys[k];
      }
    }
    g = { key, strokes, xMin, xMax, yMin, yMax, width: xMax - xMin, total };
    if (cache.size > 600) cache.clear();
    cache.set(ck, g);
    return g;
  };

  /* Position + tangent angle at arc length s. Writes into o = {x, y, ang}. */
  Coil.sampleStroke = function (st, s, o) {
    const L = st.L;
    if (L <= 0) { o.x = st.xs[0]; o.y = st.ys[0]; o.ang = 0; return o; }
    const at = (q) => {
      if (st.closed) q = ((q % L) + L) % L;
      else q = q < 0 ? 0 : q > L ? L : q;
      const cum = st.cum;
      let lo = 0, hi = st.n - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= q) lo = m; else hi = m; }
      const seg = cum[hi] - cum[lo], u = seg > 0 ? (q - cum[lo]) / seg : 0;
      return [st.xs[lo] + (st.xs[hi] - st.xs[lo]) * u, st.ys[lo] + (st.ys[hi] - st.ys[lo]) * u];
    };
    const p = at(s);
    const dl = Math.min(4, L / 4);
    let a = at(s - dl), b = at(s + dl);
    if (!st.closed) {
      if (s - dl < 0) a = at(0);
      if (s + dl > L) b = at(L);
    }
    o.x = p[0]; o.y = p[1];
    o.ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    return o;
  };
})(typeof window !== 'undefined' ? window : globalThis);
