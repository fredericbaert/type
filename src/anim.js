/* Coil Type — animation modes: slinky flow, morphing, mouse play, bounce & wave. */
(function (root) {
  const Coil = root.Coil;
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOutBounce = (x) => {
    const n1 = 7.5625, d1 = 2.75;
    if (x < 1 / d1) return n1 * x * x;
    if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
    if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
    return n1 * (x -= 2.625 / d1) * x + 0.984375;
  };
  const wrapAngle = (d) => ((d + Math.PI) % TAU + TAU) % TAU - Math.PI;

  Coil.ANIM_DEFAULTS = {
    mode: 'slinky', speed: 1, liveGrain: false,
    flow: 2.5, spin: 0.12, ripple: 0.18, rippleSpeed: 1.2, altDir: true, hueSpeed: 0,
    morphBy: 'letter', hold: 0.7, trans: 1.4, stagger: 0.6, swoop: 0.45, pump: 0.35,
    effect: 'repel', reach: 0.2, force: 0.55, bulge: 0.8, spring: 0.5, autopilot: true,
    height: 0.5, bounceSpeed: 1.1, bounceStagger: 0.12, squash: 0.6, wobble: 0.4, bounceHue: 40,
    recLen: 6,
  };

  /* Split a circle list into consecutive groups of (rounded) equal hue, keeping draw order. */
  function groupByHue(list) {
    const groups = [];
    let cur = null;
    for (const c of list) {
      const h = Math.round(c.hue / 6) * 6;
      if (!cur || cur.hue !== h) { cur = { hue: h, circles: [] }; groups.push(cur); }
      cur.circles.push(c);
    }
    return groups;
  }

  class Animator {
    constructor(o) {
      this.canvas = o.canvas;
      this.getS = o.getS;
      this.getA = o.getA;
      this.fit = o.fit; // (W, H) => css width of the artboard
      this.onInfo = o.onInfo || (() => {});
      this.t = 0;
      this.playing = true;
      this.running = false;
      this.dirty = true;
      this.recording = false;
      this.ptr = { x: 0, y: 0, last: -1e9, inside: false };
      this.waves = [];
      this.fps = 60;
      this.loop = this.loop.bind(this);
      const c = this.canvas;
      const toDoc = (e) => {
        const r = c.getBoundingClientRect();
        return [((e.clientX - r.left) / r.width) * this.W, ((e.clientY - r.top) / r.height) * this.H];
      };
      c.addEventListener('pointermove', (e) => {
        [this.ptr.x, this.ptr.y] = toDoc(e);
        this.ptr.last = this.t; this.ptr.inside = true;
      });
      c.addEventListener('pointerdown', (e) => {
        [this.ptr.x, this.ptr.y] = toDoc(e);
        this.ptr.last = this.t; this.ptr.inside = true;
        this.waves.push({ x: this.ptr.x, y: this.ptr.y, t0: this.t });
        if (this.getA().mode === 'mouse' && !this.playing) this.play(true);
      });
      c.addEventListener('pointerleave', () => { this.ptr.inside = false; });
    }

    start() {
      if (this.running) return;
      this.running = true;
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.loop);
    }
    stop() { this.running = false; cancelAnimationFrame(this.raf); }
    invalidate() { this.dirty = true; }
    restart() { this.t = 0; this.waves = []; this.dirty = true; }
    play(on) { this.playing = on; this.dirty = true; }

    loop(now) {
      if (!this.running) return;
      this.raf = requestAnimationFrame(this.loop);
      const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
      this.last = now;
      if (dt > 0) this.fps = this.fps * 0.92 + (1 / dt) * 0.08;
      if (!this.playing && !this.dirty) return;
      this.step(this.playing ? dt : 0);
    }

    step(dt) {
      const S = this.getS(), A = this.getA();
      const { W, H } = Coil.docSize(S, true);
      if (this.dirty || W !== this.W || H !== this.H || A.mode !== this.mode || A.morphBy !== this.morphBy) {
        this.W = W; this.H = H; this.mode = A.mode; this.morphBy = A.morphBy;
        this.build(S, A);
      }
      this.dirty = false;
      const sdt = dt * A.speed;
      this.t += sdt;
      this.sizeCanvas(W, H);
      const scene = this[A.mode + 'Frame'](S, A, sdt);
      Coil.renderScene(this.canvas, scene, S, {
        sprites: true,
        grainShift: A.liveGrain && this.playing ? [Math.random(), Math.random()] : null,
      });
      const n = scene.groups.reduce((a, g) => a + g.circles.length, 0);
      this.onInfo(`${this.canvas.width} × ${this.canvas.height} px · ${n} circles · ${Math.round(this.fps)} fps`);
    }

    sizeCanvas(W, H) {
      const cssW = this.fit(W, H);
      let pw;
      if (this.recording) pw = Math.min(W, Math.round((W * 1920) / Math.max(W, H)));
      else pw = Math.round(Math.min(W, cssW * Math.min(2, window.devicePixelRatio || 1)));
      const ph = Math.round((pw * H) / W);
      if (this.canvas.width !== pw || this.canvas.height !== ph) { this.canvas.width = pw; this.canvas.height = ph; }
    }

    build(S, A) {
      const W = this.W, H = this.H;
      if (A.mode === 'slinky' || A.mode === 'bounce') {
        this.lay = Coil.layout(S, W, H);
        if (A.mode === 'bounce') {
          const k = this.lay.k, r = S.weight;
          this.glyphs = this.lay.items.map((it) => ({
            it,
            base: Coil.orderCircles(Coil.glyphCircles(it.prep, S).map((c) => ({ x: it.tx + c.x * k, y: it.ty + c.y * k, r: c.r * k, a: c.a, si: c.si, k: c.k, n: c.n })), S, it.index),
            cx: it.tx + ((it.prep.xMin + it.prep.xMax) / 2) * k,
            cy: it.ty + (1000 + r) * k,
          }));
        }
      } else if (A.mode === 'morph') this.buildMorph(S, A);
      else if (A.mode === 'mouse') this.buildMouse(S);
    }

    /* ---------- slinky ---------- */
    slinkyFrame(S, A) {
      const lay = this.lay, k = lay.k, t = this.t;
      const S2 = A.ripple ? Object.assign({}, S, { wave: S.wave + A.ripple, waveFreq: S.wave ? S.waveFreq : 2.2 }) : S;
      const opt = { phase: t * A.flow, conveyor: true, spin: t * A.spin * TAU, wavePhase: -t * A.rippleSpeed * TAU, altDir: A.altDir };
      const groups = lay.items.map((it) => {
        const circles = Coil.glyphCircles(it.prep, S2, opt).map((c) => ({ x: it.tx + c.x * k, y: it.ty + c.y * k, r: c.r * k, a: c.a, si: c.si, k: c.k, n: c.n }));
        Coil.orderCircles(circles, S, it.index);
        return { circles, ops: Coil.withSeams(circles, S), hue: Coil.hueFor(S, it.index, lay.count, t * A.hueSpeed) };
      });
      return { W: this.W, H: this.H, groups };
    }

    /* ---------- morph ---------- */
    buildMorph(S, A) {
      const W = this.W, H = this.H;
      const visible = (txt) => [...txt].some((ch) => { const g = Coil.glyphKey(ch); return g && g !== ' '; });
      let seq = [];
      if (A.morphBy === 'line') seq = S.text.split('\n').filter(visible);
      else for (const ch of S.text) { const g = Coil.glyphKey(ch); if (g && g !== ' ') seq.push(ch); }
      if (!seq.length) seq = ['O'];
      const entries = seq.map((text) => {
        const lay = Coil.layout(S, W, H, { text });
        const natural = lay.items.reduce((a, it) => a + Coil.glyphCircles(it.prep, S).length, 0);
        return { lay, natural };
      });
      const N = clamp(Math.max(...entries.map((e) => e.natural)), 24, 1200);
      this.morphN = N;
      this.sets = entries.map(({ lay }) => {
        const k = lay.k;
        const total = lay.items.reduce((a, it) => a + it.prep.total, 0) || 1;
        const out = [];
        let left = N;
        lay.items.forEach((it, j) => {
          const n = j === lay.items.length - 1 ? left : Math.max(1, Math.round((N * it.prep.total) / total));
          left -= n;
          const hue = Coil.hueFor(S, it.index, lay.count);
          for (const c of Coil.glyphCircles(it.prep, S, { fixedN: Math.max(1, n) })) {
            out.push({ x: it.tx + c.x * k, y: it.ty + c.y * k, r: c.r * k, a: c.a, hue });
          }
        });
        while (out.length < N) { const l = out[out.length - 1] || { x: W / 2, y: H / 2, r: 0, a: 0, hue: 0 }; out.push({ ...l, r: 0 }); }
        out.length = N;
        return out;
      });
    }

    morphFrame(S, A) {
      const sets = this.sets, L = sets.length, N = this.morphN, W = this.W;
      const cyc = A.hold + A.trans;
      const T = this.t;
      const idx = Math.floor(T / cyc);
      const local = T - idx * cyc;
      const from = sets[((idx % L) + L) % L], to = sets[(((idx + 1) % L) + L) % L];
      const p = L < 2 || local < A.hold ? 0 : (local - A.hold) / A.trans;
      const st = A.stagger, spin = T * A.spin * TAU;
      const out = new Array(N);
      for (let i = 0; i < N; i++) {
        const a = from[i], b = to[i];
        const e = easeInOut(clamp(p * (1 + st) - st * (i / N), 0, 1));
        const lift = Math.sin(Math.PI * e);
        const s = lift * A.swoop * W * 0.12;
        out[i] = {
          x: a.x + (b.x - a.x) * e + Math.cos(i * 0.61) * s,
          y: a.y + (b.y - a.y) * e + Math.sin(i * 0.61) * s,
          r: (a.r + (b.r - a.r) * e) * (1 + A.pump * lift),
          a: a.a + wrapAngle(b.a - a.a) * e + spin + lift * Math.PI * A.swoop,
          hue: a.hue + (b.hue - a.hue) * e,
        };
      }
      return { W, H: this.H, groups: groupByHue(out) };
    }

    /* ---------- mouse ---------- */
    buildMouse(S) {
      const sc = Coil.buildScene(S, this.W, this.H);
      const all = [];
      for (const g of sc.groups) for (const c of g.circles) all.push({ ...c, hue: g.hue });
      const n = all.length;
      const F = () => new Float32Array(n);
      this.m = { n, all, dx: F(), dy: F(), vx: F(), vy: F() };
      this.block = sc.layout.block;
    }

    pointerTarget(A) {
      if (this.ptr.inside && this.t - this.ptr.last < 2.5) return this.ptr;
      if (this.ptr.inside && !A.autopilot) return this.ptr;
      if (!A.autopilot) return null;
      const b = this.block, t = this.t;
      return {
        x: b.x + b.w / 2 + Math.sin(t * 0.7) * b.w * 0.55 + Math.sin(t * 1.9) * b.w * 0.08,
        y: b.y + b.h / 2 + Math.sin(t * 1.13 + 1) * b.h * 0.6,
      };
    }

    mouseFrame(S, A, dt) {
      const m = this.m, W = this.W;
      const P = this.pointerTarget(A);
      const R = A.reach * W;
      const K = 8 + 140 * A.spring * A.spring;
      const damp = Math.exp(-(3 + 7 * A.spring) * dt);
      const F = A.force * 30000;
      this.waves = this.waves.filter((w) => this.t - w.t0 < 2.2);
      const out = new Array(m.n);
      for (let i = 0; i < m.n; i++) {
        const c = m.all[i];
        let dx = m.dx[i], dy = m.dy[i];
        const px = c.x + dx, py = c.y + dy;
        let ax = -K * dx, ay = -K * dy, near = 0;
        if (P) {
          const ex = px - P.x, ey = py - P.y, d = Math.hypot(ex, ey) + 1e-3;
          if (d < R) {
            const f = (1 - d / R) ** 2;
            near = f;
            const ux = ex / d, uy = ey / d;
            if (A.effect === 'repel') { ax += ux * f * F; ay += uy * f * F; }
            else if (A.effect === 'attract') { ax -= ux * f * F * 0.5; ay -= uy * f * F * 0.5; }
            else { ax += (-uy + ux * 0.25) * f * F; ay += (ux + uy * 0.25) * f * F; }
          }
        }
        for (const w of this.waves) {
          const age = this.t - w.t0, front = age * W * 0.9;
          const ex = px - w.x, ey = py - w.y, d = Math.hypot(ex, ey) + 1e-3;
          const band = W * 0.06, q = 1 - Math.abs(d - front) / band;
          if (q > 0) { const f = q * 60000 * Math.exp(-age * 1.6); ax += (ex / d) * f; ay += (ey / d) * f; }
        }
        let vx = (m.vx[i] + ax * dt) * damp, vy = (m.vy[i] + ay * dt) * damp;
        dx += vx * dt; dy += vy * dt;
        m.vx[i] = vx; m.vy[i] = vy; m.dx[i] = dx; m.dy[i] = dy;
        const disp = Math.hypot(dx, dy);
        out[i] = {
          x: c.x + dx, y: c.y + dy,
          r: c.r * (1 + A.bulge * near),
          a: c.a + (disp / Math.max(4, c.r)) * 0.9,
          hue: c.hue,
        };
      }
      return { W, H: this.H, groups: groupByHue(out) };
    }

    /* ---------- bounce ---------- */
    bounceFrame(S, A) {
      const H = this.H, t = this.t, count = this.lay.count;
      const groups = this.glyphs.map((g, i) => {
        const tau = t * A.bounceSpeed - i * A.bounceStagger;
        const ph = tau - Math.floor(tau);
        const h = Math.sin(Math.PI * ph);
        const contact = 1 - h;
        const sq = A.squash * contact ** 8;
        const sy = 1 - 0.34 * sq + A.squash * 0.1 * h * Math.cos(Math.PI * ph);
        const sx = 1 + 0.26 * sq;
        const rot = A.wobble * 0.32 * Math.sin(TAU * tau * 0.5 + i * 1.7);
        const intro = clamp((t - i * 0.07) / 0.95, 0, 1);
        const yOff = -A.height * H * 0.22 * h - (1 - easeOutBounce(intro)) * H * 1.05;
        const co = Math.cos(rot), si = Math.sin(rot), rs = Math.sqrt(Math.max(0.05, sx * sy));
        const circles = g.base.map((c) => {
          const lx = (c.x - g.cx) * sx, ly = (c.y - g.cy) * sy;
          return { x: g.cx + lx * co - ly * si, y: g.cy + lx * si + ly * co + yOff, r: c.r * rs, a: c.a + rot, si: c.si, k: c.k, n: c.n };
        });
        return { circles, ops: Coil.withSeams(circles, S), hue: Coil.hueFor(S, g.it.index, count, t * A.bounceHue + i * 0) };
      });
      return { W: this.W, H, groups };
    }

    /* ---------- recording ---------- */
    async record(seconds, onProgress) {
      const types = ['video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
      const type = typeof MediaRecorder !== 'undefined' && types.find((t) => MediaRecorder.isTypeSupported(t));
      if (!type || !this.canvas.captureStream) throw Object.assign(new Error('Video recording is not supported in this browser.'), { code: 'unsupported' });
      this.recording = true;
      this.restart();
      this.playing = true;
      this.step(0);
      const stream = this.canvas.captureStream(60);
      const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 16000000 });
      const chunks = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      const stopped = new Promise((res) => (rec.onstop = res));
      rec.start(250);
      const t0 = performance.now();
      try {
        await new Promise((res) => {
          const tick = () => {
            const p = (performance.now() - t0) / 1000 / seconds;
            onProgress && onProgress(Math.min(1, p));
            if (p >= 1) res(); else setTimeout(tick, 100);
          };
          tick();
        });
      } finally {
        rec.stop();
        await stopped;
        stream.getTracks().forEach((tr) => tr.stop());
        this.recording = false;
        this.dirty = true;
      }
      return { blob: new Blob(chunks, { type: type.split(';')[0] }), ext: type.startsWith('video/mp4') ? 'mp4' : 'webm' };
    }
  }

  /* Settings saved by any version, made safe for the four modes above. */
  Coil.normalizeAnim = function (a) {
    const D = Coil.ANIM_DEFAULTS;
    const out = { ...D };
    if (!a || typeof a !== 'object') return out;
    if (a.v === 2) {
      // Saved by the timeline version: keep the closest mode and the general settings.
      const loops = Array.isArray(a.loops) ? a.loops : [];
      out.mode = a.transition === 'morph' && a.seq !== 'all' ? 'morph'
        : loops.includes('push') ? 'mouse'
        : loops.includes('bounce') ? 'bounce' : 'slinky';
      if (out.mode === 'morph') out.morphBy = a.seq === 'lines' ? 'line' : 'letter';
      if (typeof a.speed === 'number') out.speed = a.speed;
      if (typeof a.liveGrain === 'boolean') out.liveGrain = a.liveGrain;
      return out;
    }
    for (const k of Object.keys(D)) if (k in a && typeof a[k] === typeof D[k]) out[k] = a[k];
    if (!['slinky', 'morph', 'mouse', 'bounce'].includes(out.mode)) out.mode = 'slinky';
    return out;
  };

  Coil.Animator = Animator;
})(typeof window !== 'undefined' ? window : globalThis);
