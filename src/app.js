/* Coil Type — app: state, controls, preview, exports. */
(function () {
  const Coil = window.Coil;
  const $ = (id) => document.getElementById(id);
  const STORE = 'coil-type-v1';
  const app = $('app');

  /* ---------- state ---------- */
  let S = Coil.normalizeSettings({});
  let A = Coil.normalizeAnim(null);
  let view = 'gen';
  let pngScale = 2;
  let myPalette = null; // the viewer's own default colours
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (saved) {
      S = Coil.normalizeSettings(saved.S);
      A = Coil.normalizeAnim(saved.A);
      if (saved.view === 'anim' || saved.view === 'social') view = saved.view;
      if ([1, 2, 4].includes(saved.pngScale)) pngScale = saved.pngScale;
      // Keep whatever colours were in use when this version first loads as this viewer's default.
      if (saved.palette && Array.isArray(saved.palette.stops)) myPalette = Coil.paletteOf(Coil.normalizeSettings(saved.palette));
      else if (saved.S) myPalette = Coil.paletteOf(S);
    }
  } catch (e) { /* storage unavailable: start fresh */ }
  const freshSettings = () => Coil.normalizeSettings(myPalette ? Coil.paletteOf(Coil.normalizeSettings(myPalette)) : {});
  try { if (location.hash === '#animate') view = 'anim'; else if (location.hash === '#social') view = 'social'; } catch (e) {}

  let saveTimer = 0;
  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(STORE, JSON.stringify({ S, A, view, pngScale, palette: myPalette })); } catch (e) {}
    }, 250);
  }

  /* ---------- history ---------- */
  const hist = { stack: [JSON.stringify(S)], i: 0 };
  function commit() {
    const s = JSON.stringify(S);
    if (hist.stack[hist.i] === s) return;
    hist.stack = hist.stack.slice(0, hist.i + 1);
    hist.stack.push(s);
    if (hist.stack.length > 150) hist.stack.shift();
    hist.i = hist.stack.length - 1;
    updateUndo();
    persist();
  }
  function travel(d) {
    const j = hist.i + d;
    if (j < 0 || j >= hist.stack.length) return;
    hist.i = j;
    S = JSON.parse(hist.stack[j]);
    stateReplaced();
  }
  function updateUndo() {
    const sx = view === 'social' && social;
    $('undo').disabled = sx ? !social.canUndo() : hist.i <= 0;
    $('redo').disabled = sx ? !social.canRedo() : hist.i >= hist.stack.length - 1;
  }


  /* ---------- toast + saving files ---------- */
  let toastTimer = 0;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }
  const inViewer = !!(window.claude && typeof window.claude.use === 'function');
  const downloadsReady = inViewer ? window.claude.use('downloads').catch(() => null) : Promise.resolve(null);
  async function saveFile(name, blob) {
    const dl = await downloadsReady;
    if (dl) {
      try {
        await dl.save({ filename: name, data: blob });
        toast(`Saved ${name}`);
      } catch (e) {
        const code = e && e.code;
        if (code === 'declined') toast('Save cancelled');
        else if (code === 'rate_limited') toast('A save prompt is already open');
        else if (code === 'too_large') toast('That file is too large here. Try a smaller size.');
        else toast('Saving files is not available in this view');
      }
      return;
    }
    if (inViewer) { toast('Saving files is not available in this view'); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast(`Saved ${name}`);
  }
  const slug = () => 'coil-' + (S.text.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 28) || 'type');

  /* ---------- control schema ---------- */
  const pct = (v) => Math.round(v * 100) + '%';
  const deg = (v) => Math.round(v) + '°';
  const fx = (d, u = '') => (v) => (+v).toFixed(d) + u;
  const CTL = {
    textCtls: [
      { k: 'sizeMode', type: 'seg', label: 'Size', opts: [['fit', 'Fit to canvas'], ['fixed', 'Fixed size']] },
      { k: 'fill', label: 'Fill', min: 0.2, max: 1, step: 0.01, fmt: pct, show: () => S.sizeMode === 'fit', hint: 'How much of the canvas the text may fill.' },
      { k: 'size', label: 'Letter height', min: 20, max: 2000, step: 1, number: true, unit: 'px', show: () => S.sizeMode === 'fixed', hint: 'Height of a capital, from its top to the baseline, in canvas pixels. Text that does not fit runs off the canvas.' },
      { k: 'weight', label: 'Weight', min: 40, max: 320, step: 1, fmt: (v) => Math.round(v) },
      { k: 'width', label: 'Letter width', min: 0.5, max: 1.8, step: 0.01, fmt: fx(2, '×') },
      { k: 'slant', label: 'Slant', min: -0.4, max: 0.4, step: 0.01, fmt: (v) => Math.round((Math.atan(v) * 180) / Math.PI) + '°' },
      { k: 'align', type: 'seg', label: 'Align', opts: [['left', 'Left'], ['center', 'Centre'], ['right', 'Right']] },
      { k: 'valign', type: 'seg', label: 'Vertical position', opts: [['top', 'Top'], ['middle', 'Middle'], ['bottom', 'Bottom']] },
      { k: 'tracking', label: 'Letter spacing', min: -250, max: 500, step: 5, fmt: (v) => Math.round(v) },
      { k: 'wordSpacing', label: 'Word spacing', min: 0.2, max: 3, step: 0.05, fmt: pct },
      { k: 'lineHeight', label: 'Line spacing', min: 0.5, max: 1.6, step: 0.01, fmt: fx(2) },
      { k: 'kernMode', type: 'seg', label: 'Auto kerning', opts: [['none', 'Off'], ['optical', 'Optical']], hint: 'Optical kerning closes up open pairs like AT, AV and LT based on the letter shapes.' },
      { k: 'kernStrength', label: 'Optical strength', min: 0, max: 1, step: 0.01, fmt: pct, show: () => S.kernMode === 'optical' },
    ],
    shapeCtls: [
      { k: 'density', label: 'Circle step', min: 0.04, max: 1.2, step: 0.01, fmt: fx(2), hint: 'Gap between circles, relative to their size.' },
      { k: 'corners', label: 'Round corners', min: 0, max: 1, step: 0.01, fmt: pct },
      { k: 'taper', label: 'Taper ends', min: 0, max: 1, step: 0.01, fmt: pct },
      { k: 'contrast', label: 'Contrast', min: -1, max: 1, step: 0.01, fmt: fx(2), hint: 'Right: heavier verticals. Left: heavier horizontals.' },
      { k: 'wave', label: 'Wave', min: 0, max: 0.8, step: 0.01, fmt: pct },
      { k: 'waveFreq', label: 'Waves per stroke unit', min: 0.5, max: 12, step: 0.1, fmt: fx(1), show: () => S.wave > 0 },
      { k: 'jitter', label: 'Jitter', min: 0, max: 1, step: 0.01, fmt: pct },
      { k: 'style', type: 'seg', label: 'Circles', opts: [['disc', 'Discs'], ['ring', 'Rings']] },
      { k: 'ringWidth', label: 'Ring thickness', min: 0.02, max: 0.6, step: 0.01, fmt: pct, show: () => S.style === 'ring' },
      { k: 'order', type: 'seg', label: 'Stacking', opts: [['forward', 'Along'], ['reverse', 'Reverse'], ['shuffle', 'Shuffle']] },
    ],
    colorCtls: [
      { k: 'gradAngle', label: 'Gradient angle', min: -180, max: 180, step: 1, fmt: deg },
      { k: 'gradFollow', type: 'switch', label: 'Turn the gradient with the stroke' },
      { k: 'twist', label: 'Twist', min: -4, max: 4, step: 0.05, fmt: fx(2, ' turns'), hint: 'Spins the gradient along each stroke.' },
      { k: 'opacity', label: 'Opacity', min: 0.05, max: 1, step: 0.01, fmt: pct },
      { k: 'blend', type: 'select', label: 'Blend mode', opts: Coil.BLENDS },
      { k: 'hueDrift', label: 'Hue drift', min: -360, max: 360, step: 1, fmt: deg, hint: 'Shifts the hue from the first letter to the last.' },
      { k: 'outlineColor', type: 'color', label: 'Ink colour', hint: 'Outline, dot screen and shadow.' },
      { k: 'outlineWidth', label: 'Outline width', min: 0, max: 0.2, step: 0.005, fmt: pct, show: () => S.style !== 'ring' },
      { k: 'outlineOpacity', label: 'Outline opacity', min: 0, max: 1, step: 0.01, fmt: pct, show: () => S.style !== 'ring' },
    ],
    finishCtls: [
      { k: 'bg', type: 'color', label: 'Background' },
      { k: 'transparent', type: 'switch', label: 'Transparent background' },
      { k: 'grain', label: 'Grain', min: 0, max: 1, step: 0.01, fmt: pct },
      { k: 'dots', label: 'Dot screen', min: 0, max: 1, step: 0.01, fmt: pct },
      { k: 'dotSize', label: 'Dot size', min: 0.4, max: 4, step: 0.05, fmt: fx(2), show: () => S.dots > 0 },
      { k: 'shadow', label: 'Shadow', min: 0, max: 1, step: 0.01, fmt: pct },
    ],
    canvasCtls: [
      { k: 'format', type: 'select', label: 'Format', opts: Object.entries(Coil.FORMATS).map(([k, v]) => [k, v.label]) },
      { k: 'customW', type: 'number', label: 'Width in px', min: 64, max: 8000, show: () => S.format === 'custom' },
      { k: 'customH', type: 'number', label: 'Height in px', min: 64, max: 8000, show: () => S.format === 'custom' },
    ],
  };
  const MOTION = {
    slinky: [
      { k: 'flow', label: 'Flow', min: -8, max: 8, step: 0.1, fmt: fx(1, ' steps/s') },
      { k: 'spin', label: 'Gradient spin', min: -1, max: 1, step: 0.01, fmt: fx(2, ' turns/s') },
      { k: 'ripple', label: 'Ripple', min: 0, max: 0.8, step: 0.01, fmt: pct },
      { k: 'rippleSpeed', label: 'Ripple speed', min: -4, max: 4, step: 0.05, fmt: fx(2) },
      { k: 'altDir', type: 'switch', label: 'Alternate direction per stroke' },
      { k: 'hueSpeed', label: 'Colour cycle', min: 0, max: 180, step: 1, fmt: (v) => Math.round(v) + '°/s' },
    ],
    morph: [
      { k: 'morphBy', type: 'seg', label: 'Morph through', opts: [['letter', 'Letters'], ['line', 'Lines']] },
      { k: 'hold', label: 'Hold', min: 0, max: 3, step: 0.05, fmt: fx(2, ' s') },
      { k: 'trans', label: 'Transition', min: 0.2, max: 4, step: 0.05, fmt: fx(2, ' s') },
      { k: 'stagger', label: 'Stagger', min: 0, max: 1.5, step: 0.01, fmt: pct },
      { k: 'swoop', label: 'Swoop', min: 0, max: 1.5, step: 0.01, fmt: pct },
      { k: 'pump', label: 'Pump', min: 0, max: 1.5, step: 0.01, fmt: pct },
      { k: 'spin', label: 'Gradient spin', min: -1, max: 1, step: 0.01, fmt: fx(2, ' turns/s') },
    ],
    mouse: [
      { k: 'effect', type: 'seg', label: 'Cursor', opts: [['repel', 'Repel'], ['attract', 'Attract'], ['swirl', 'Swirl']] },
      { k: 'reach', label: 'Reach', min: 0.05, max: 0.6, step: 0.01, fmt: pct },
      { k: 'force', label: 'Force', min: 0, max: 1.5, step: 0.01, fmt: pct },
      { k: 'bulge', label: 'Bulge', min: 0, max: 2.5, step: 0.01, fmt: pct },
      { k: 'spring', label: 'Spring', min: 0.1, max: 1, step: 0.01, fmt: pct },
      { k: 'autopilot', type: 'switch', label: 'Wander when the cursor is away' },
    ],
    bounce: [
      { k: 'height', label: 'Jump height', min: 0, max: 1.5, step: 0.01, fmt: pct },
      { k: 'bounceSpeed', label: 'Tempo', min: 0.2, max: 3, step: 0.05, fmt: fx(2, ' hops/s') },
      { k: 'bounceStagger', label: 'Wave delay', min: 0, max: 0.5, step: 0.01, fmt: fx(2) },
      { k: 'squash', label: 'Squash', min: 0, max: 1, step: 0.01, fmt: pct },
      { k: 'wobble', label: 'Wobble', min: 0, max: 1.5, step: 0.01, fmt: pct },
      { k: 'bounceHue', label: 'Colour cycle', min: 0, max: 240, step: 1, fmt: (v) => Math.round(v) + '°/s' },
    ],
    common: [
      { k: 'speed', label: 'Overall speed', min: 0.1, max: 3, step: 0.05, fmt: fx(2, '×') },
      { k: 'liveGrain', type: 'switch', label: 'Moving grain' },
    ],
  };
  const MODES = [
    { id: 'slinky', name: 'Slinky', hint: 'Circles crawl along every stroke while the gradient spins.',
      icon: '<path d="M6 22c0-6 4-12 9-12s9 6 9 12M9 22c0-4 3-9 6-9s6 5 6 9M12 22c0-2 1.5-5 3-5s3 3 3 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' },
    { id: 'morph', name: 'Morph', hint: 'One shape flows from letter to letter. Pick Lines to morph between the lines of your text.',
      icon: '<circle cx="9" cy="15" r="5" fill="none" stroke="currentColor" stroke-width="2"/><rect x="17" y="10" width="9" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M14 8c2-2 4-2 6 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' },
    { id: 'mouse', name: 'Mouse', hint: 'Move over the canvas to push the circles around. Click for a shockwave.',
      icon: '<path d="M9 5l12 9-5 1.5 3.5 6-2.5 1.5-3.5-6L9 21z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>' },
    { id: 'bounce', name: 'Bounce', hint: 'Letters hop in a wave, squash when they land and cycle through colours.',
      icon: '<circle cx="15" cy="9" r="4" fill="currentColor"/><path d="M5 25h20M8 20q3-14 7-11M22 20q-3-14-7-11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' },
  ];

  const syncers = [];
  function makeCtl(def, getObj, onChange, defaults, prefix) {
    const type = def.type || 'range';
    const wrap = document.createElement('div');
    wrap.className = 'ctl';
    const id = 'c-' + (prefix || (getObj === getA ? 'a-' : 's-')) + def.k;
    const label = document.createElement('label');
    label.textContent = def.label;
    let sync;
    if (type === 'range' && def.number) {
      // Slider plus a number field you can type into; typed values may go past the slider's range.
      label.htmlFor = id;
      const box = document.createElement('label');
      box.className = 'out-num';
      const num = document.createElement('input');
      Object.assign(num, { type: 'number', min: 1, step: 1 });
      num.setAttribute('aria-label', def.label + (def.unit ? ' in ' + def.unit : ''));
      const unit = document.createElement('span');
      unit.textContent = def.unit || '';
      box.append(num, unit);
      const inp = document.createElement('input');
      Object.assign(inp, { type: 'range', id, min: def.min, max: def.max, step: def.step });
      inp.className = 'full';
      inp.title = 'Double-click to reset';
      inp.addEventListener('input', () => { getObj()[def.k] = +inp.value; num.value = Math.round(inp.value); onChange(def.k, false); });
      inp.addEventListener('change', () => onChange(def.k, true));
      inp.addEventListener('dblclick', () => { getObj()[def.k] = defaults[def.k]; sync(); onChange(def.k, true); });
      num.addEventListener('change', () => {
        const v = Math.round(+num.value);
        if (!(v > 0)) { sync(); return; }
        getObj()[def.k] = v; inp.value = v; onChange(def.k, true);
      });
      wrap.append(label, box, inp);
      sync = () => { inp.value = getObj()[def.k]; if (document.activeElement !== num) num.value = Math.round(getObj()[def.k]); };
    } else if (type === 'range') {
      label.htmlFor = id;
      const out = document.createElement('output');
      out.htmlFor = id;
      const inp = document.createElement('input');
      Object.assign(inp, { type: 'range', id, min: def.min, max: def.max, step: def.step });
      inp.className = 'full';
      inp.title = 'Double-click to reset';
      inp.addEventListener('input', () => { getObj()[def.k] = +inp.value; out.textContent = def.fmt(inp.value); onChange(def.k, false); });
      inp.addEventListener('change', () => onChange(def.k, true));
      inp.addEventListener('dblclick', () => { getObj()[def.k] = defaults[def.k]; sync(); onChange(def.k, true); });
      wrap.append(label, out, inp);
      sync = () => { inp.value = getObj()[def.k]; out.textContent = def.fmt(getObj()[def.k]); };
    } else if (type === 'seg') {
      const seg = document.createElement('div');
      seg.className = 'seg full';
      seg.setAttribute('role', 'radiogroup');
      seg.setAttribute('aria-label', def.label);
      const btns = def.opts.map(([v, txt]) => {
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = txt; b.setAttribute('role', 'radio');
        b.addEventListener('click', () => { getObj()[def.k] = v; sync(); onChange(def.k, true); });
        seg.appendChild(b);
        return [v, b];
      });
      wrap.append(label, seg);
      sync = () => btns.forEach(([v, b]) => b.setAttribute('aria-checked', String(getObj()[def.k] === v)));
    } else if (type === 'switch') {
      const lab = document.createElement('label');
      lab.className = 'switch full';
      const inp = document.createElement('input');
      inp.type = 'checkbox'; inp.id = id; inp.setAttribute('role', 'switch');
      const span = document.createElement('span');
      span.textContent = def.label;
      lab.append(span, inp);
      inp.addEventListener('change', () => { getObj()[def.k] = inp.checked; onChange(def.k, true); });
      wrap.append(lab);
      sync = () => { inp.checked = !!getObj()[def.k]; };
    } else if (type === 'select') {
      label.htmlFor = id;
      const sel = document.createElement('select');
      sel.id = id; sel.className = 'full';
      for (const [v, txt] of def.opts) { const o = document.createElement('option'); o.value = v; o.textContent = txt; sel.appendChild(o); }
      sel.addEventListener('change', () => { getObj()[def.k] = sel.value; onChange(def.k, true); });
      wrap.append(label, sel);
      sync = () => { sel.value = getObj()[def.k]; };
    } else if (type === 'color') {
      label.htmlFor = id;
      const box = document.createElement('div');
      box.className = 'color-ctl';
      const col = document.createElement('input');
      col.type = 'color'; col.id = id;
      const hex = document.createElement('input');
      hex.type = 'text'; hex.className = 'hex'; hex.maxLength = 7; hex.spellcheck = false;
      hex.setAttribute('aria-label', def.label + ' hex');
      col.addEventListener('input', () => { getObj()[def.k] = col.value; hex.value = col.value; onChange(def.k, false); });
      col.addEventListener('change', () => onChange(def.k, true));
      hex.addEventListener('change', () => {
        let v = hex.value.trim();
        if (!v.startsWith('#')) v = '#' + v;
        if (/^#[0-9a-f]{3}$/i.test(v)) v = '#' + v.slice(1).split('').map((c) => c + c).join('');
        if (/^#[0-9a-f]{6}$/i.test(v)) { getObj()[def.k] = v.toLowerCase(); sync(); onChange(def.k, true); }
        else { hex.value = getObj()[def.k]; toast('Use a hex colour like #ff3c9e'); }
      });
      box.append(col, hex);
      wrap.append(label, box);
      sync = () => { col.value = getObj()[def.k]; hex.value = getObj()[def.k]; };
    } else if (type === 'number') {
      label.htmlFor = id;
      const inp = document.createElement('input');
      Object.assign(inp, { type: 'number', id, min: def.min, max: def.max, step: 1 });
      inp.style.width = '110px';
      inp.addEventListener('change', () => {
        const v = Math.round(Coil.clamp(+inp.value || def.min, def.min, def.max));
        getObj()[def.k] = v; inp.value = v; onChange(def.k, true);
      });
      wrap.append(label, inp);
      sync = () => { inp.value = getObj()[def.k]; };
    }
    if (def.hint) {
      const p = document.createElement('p');
      p.className = 'hint full';
      p.textContent = def.hint;
      wrap.appendChild(p);
    }
    const entry = { wrap, sync, def };
    syncers.push(entry);
    return wrap;
  }
  const getS = () => S;
  const getA = () => A;

  function syncAll() {
    for (const e of syncers) { if (e.wrap.isConnected) e.sync(); }
    syncVisibility();
    $('text').value = S.text;
    renderGrad();
    textHint();
    renderPairs();
  }
  function syncVisibility() {
    for (const e of syncers) e.wrap.hidden = e.def.show ? !e.def.show() : false;
  }

  function onS(key, final) {
    if (key === 'sizeMode' && S.sizeMode === 'fixed') {
      const { W, H } = Coil.docSize({ ...S, sizeMode: 'fit' });
      S.size = Math.round(Coil.letterHeight({ ...S, sizeMode: 'fit' }, W, H));
      for (const e of syncers) if (e.def.k === 'size' && e.wrap.isConnected) e.sync();
    }
    syncVisibility();
    styleChanged();
    if (final) { commit(); renderPairs(); } else persist();
  }
  function onA(key, final) {
    syncVisibility();
    anim.invalidate();
    persist();
  }

  for (const [host, defs] of Object.entries(CTL)) {
    const el = $(host);
    for (const d of defs) el.appendChild(makeCtl(d, getS, onS, Coil.DEFAULTS));
  }

  /* ---------- motion controls ---------- */
  function buildModes() {
    const host = $('modes');
    host.innerHTML = '';
    for (const m of MODES) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'mode'; b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(A.mode === m.id));
      b.innerHTML = `<svg viewBox="0 0 30 30" aria-hidden="true">${m.icon}</svg><span>${m.name}</span>`;
      b.addEventListener('click', () => { A.mode = m.id; buildModes(); buildMotionCtls(); anim.restart(); persist(); });
      host.appendChild(b);
    }
    $('modeHint').textContent = MODES.find((m) => m.id === A.mode).hint;
  }
  function buildMotionCtls() {
    const host = $('motionCtls');
    for (let i = syncers.length - 1; i >= 0; i--) if (host.contains(syncers[i].wrap)) syncers.splice(i, 1);
    host.innerHTML = '';
    for (const d of MOTION[A.mode].concat(MOTION.common)) host.appendChild(makeCtl(d, getA, onA, Coil.ANIM_DEFAULTS));
    for (const e of syncers) if (host.contains(e.wrap)) e.sync();
    syncVisibility();
  }

  /* ---------- text ---------- */
  let textCommit = 0;
  $('text').addEventListener('input', (e) => {
    S.text = e.target.value;
    textHint();
    renderPairs();
    styleChanged(true);
    persist();
    clearTimeout(textCommit);
    textCommit = setTimeout(commit, 700);
  });
  function textHint() {
    const bad = [...new Set([...S.text].filter((ch) => ch !== '\n' && Coil.glyphKey(ch) === null))];
    const h = $('textHint');
    if (bad.length) {
      h.textContent = `Not in the set yet, shown as a space: ${bad.join(' ')}`;
      h.classList.add('warn');
    } else {
      h.textContent = 'A–Z, 0–9 and . , : ; ! ? \' " - + = / ( ) * # < > & ♥. Lowercase shows as capitals; accents are dropped.';
      h.classList.remove('warn');
    }
  }

  /* ---------- kerning ---------- */
  let selPair = null;
  const minus = (v) => (v < 0 ? '−' + Math.abs(v) : v > 0 ? '+' + v : '0');
  const showPair = (p) => [...p].join(' ');
  function renderPairs() {
    const pairs = Coil.textPairs(S.text);
    if (selPair && !pairs.includes(selPair)) selPair = null;
    const host = $('pairs');
    host.innerHTML = '';
    if (!pairs.length) {
      const p = document.createElement('p');
      p.className = 'hint';
      p.textContent = 'Type two or more letters next to each other to kern them.';
      host.appendChild(p);
    }
    for (const pair of pairs) {
      const [a, b] = [...pair];
      const total = Coil.kernPair(a, b, S);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pair' + (Coil.manualKern(a, b, S) ? ' manual' : '');
      btn.setAttribute('role', 'option');
      btn.setAttribute('aria-selected', String(pair === selPair));
      btn.textContent = showPair(pair);
      if (total) { const sm = document.createElement('small'); sm.textContent = minus(total); btn.appendChild(sm); }
      btn.addEventListener('click', () => selectPair(pair === selPair ? null : pair));
      host.appendChild(btn);
    }
    $('kernClear').disabled = !Object.keys(S.kerning).length;
    renderKernEdit();
  }
  function renderKernEdit() {
    const box = $('kernEdit');
    box.hidden = !selPair;
    if (!selPair) return;
    const [a, b] = [...selPair];
    const man = Coil.manualKern(a, b, S), opt = Coil.opticalKern(a, b, S);
    $('kernLabel').textContent = `Adjust ${showPair(selPair)}`;
    $('kernOut').textContent = minus(man);
    $('kernRange').value = man;
    $('kernReset').disabled = !man;
    $('kernSum').textContent = S.kernMode === 'optical'
      ? `Optical ${minus(opt)} plus your ${minus(man)} gives ${minus(opt + man)} units.`
      : `${minus(man)} units, where the letters are 1000 units tall.`;
  }
  function selectPair(p) {
    selPair = p;
    renderPairs();
    updateMarks();
  }
  let kernCommit = 0;
  function setManual(v, final) {
    if (!selPair) return;
    v = Math.round(Coil.clamp(v, -800, 800));
    if (v) S.kerning[selPair] = v; else delete S.kerning[selPair];
    renderPairs();
    styleChanged(true);
    clearTimeout(kernCommit);
    if (final) commit(); else { persist(); kernCommit = setTimeout(commit, 500); }
  }
  $('kernRange').addEventListener('input', (e) => setManual(+e.target.value, false));
  $('kernRange').addEventListener('change', (e) => setManual(+e.target.value, true));
  $('kernRange').addEventListener('dblclick', () => setManual(0, true));
  $('kernTighter').addEventListener('click', () => setManual(Coil.manualKern(...selPair, S) - 10, true));
  $('kernLooser').addEventListener('click', () => setManual(Coil.manualKern(...selPair, S) + 10, true));
  $('kernReset').addEventListener('click', () => setManual(0, true));
  $('kernClear').addEventListener('click', () => {
    S.kerning = {};
    renderPairs();
    styleChanged(true);
    commit();
    toast('Pair adjustments cleared');
  });

  // Pink markers on the canvas wherever the selected pair occurs.
  let lastLayout = null;
  function updateMarks() {
    const host = $('kernMarks');
    host.innerHTML = '';
    if (!selPair || !lastLayout || view !== 'gen') return;
    const { W, H } = lastLayout;
    const items = lastLayout.layout.items;
    for (let i = 1; i < items.length; i++) {
      const it = items[i];
      if (it.pair !== selPair) continue;
      const prev = items[i - 1];
      const gx = (prev.x1 + it.x0) / 2;
      const m = document.createElement('div');
      m.className = 'kern-mark';
      m.style.left = (gx / W) * 100 + '%';
      m.style.top = (it.y0 / H) * 100 + '%';
      m.style.height = ((it.y1 - it.y0) / H) * 100 + '%';
      const lab = document.createElement('span');
      lab.textContent = `${showPair(selPair)} ${minus(it.kern)}`;
      m.appendChild(lab);
      host.appendChild(m);
    }
  }
  // Clicking between two letters selects that pair.
  $('view').addEventListener('click', (e) => {
    if (!lastLayout) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * lastLayout.W;
    const y = ((e.clientY - rect.top) / rect.height) * lastLayout.H;
    const items = lastLayout.layout.items;
    let best = null, bestD = Infinity;
    for (let i = 1; i < items.length; i++) {
      const it = items[i], prev = items[i - 1];
      if (!it.pair || y < it.y0 || y > it.y1) continue;
      const gx = (prev.x1 + it.x0) / 2;
      const reach = Math.min(prev.x1 - prev.x0, it.x1 - it.x0) * 0.5;
      const d = Math.abs(x - gx);
      if (d < reach && d < bestD) { best = it.pair; bestD = d; }
    }
    selectPair(best);
    if (best) {
      const kern = $('kern');
      kern.closest('details').open = true;
      kern.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  });

  /* ---------- gradient editor ---------- */
  let sel = 0;
  const bar = $('gradBar');
  function colorAt(p) {
    const st = S.stops.slice().sort((a, b) => a.p - b.p);
    if (p <= st[0].p) return st[0].c;
    for (let i = 1; i < st.length; i++) {
      if (p <= st[i].p) {
        const a = st[i - 1], b = st[i], u = (p - a.p) / Math.max(1e-6, b.p - a.p);
        const ca = Coil.hexToRgb(a.c), cb = Coil.hexToRgb(b.c);
        return Coil.rgbToHex(ca.map((v, j) => v + (cb[j] - v) * u));
      }
    }
    return st[st.length - 1].c;
  }
  function paintGrad() {
    const st = S.stops.slice().sort((a, b) => a.p - b.p);
    bar.style.background = `linear-gradient(90deg, ${st.map((s) => `${s.c} ${(s.p * 100).toFixed(1)}%`).join(', ')})`;
    [...bar.children].forEach((b, i) => {
      const s = S.stops[i];
      b.style.left = s.p * 100 + '%';
      b.style.background = s.c;
      b.setAttribute('aria-pressed', String(i === sel));
      b.setAttribute('aria-label', `Gradient stop ${i + 1}: ${s.c} at ${Math.round(s.p * 100)}%`);
    });
    const s = S.stops[sel];
    $('stopColor').value = s.c;
    if (document.activeElement !== $('stopHex')) $('stopHex').value = s.c;
    $('stopPos').textContent = `at ${Math.round(s.p * 100)}%`;
    $('stopDel').disabled = S.stops.length <= 2;
  }
  function renderGrad() {
    if (sel >= S.stops.length) sel = S.stops.length - 1;
    if (bar.children.length !== S.stops.length) {
      bar.innerHTML = '';
      S.stops.forEach((s, i) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'grad-stop';
        b.dataset.i = i;
        bar.appendChild(b);
      });
    }
    paintGrad();
  }
  let drag = null;
  bar.addEventListener('pointerdown', (e) => {
    const rect = bar.getBoundingClientRect();
    const p = Coil.clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const stop = e.target.closest('.grad-stop');
    if (stop) {
      sel = +stop.dataset.i;
      drag = { id: e.pointerId, moved: false };
      bar.setPointerCapture(e.pointerId);
      stop.focus();
      paintGrad();
      return;
    }
    if (S.stops.length >= 8) { toast('Eight stops is the maximum'); return; }
    S.stops.push({ c: colorAt(p), p: Math.round(p * 1000) / 1000 });
    sel = S.stops.length - 1;
    renderGrad();
    styleChanged();
    commit();
  });
  bar.addEventListener('pointermove', (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    const rect = bar.getBoundingClientRect();
    S.stops[sel].p = Math.round(Coil.clamp((e.clientX - rect.left) / rect.width, 0, 1) * 1000) / 1000;
    drag.moved = true;
    paintGrad();
    styleChanged();
  });
  const endDrag = () => { if (drag) { if (drag.moved) commit(); drag = null; } };
  bar.addEventListener('pointerup', endDrag);
  bar.addEventListener('pointercancel', endDrag);
  bar.addEventListener('keydown', (e) => {
    const stop = e.target.closest('.grad-stop');
    if (!stop) return;
    sel = +stop.dataset.i;
    const s = S.stops[sel];
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      s.p = Coil.clamp(s.p + (e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 0.1 : 0.01), 0, 1);
      paintGrad(); styleChanged(); commit(); e.preventDefault();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      removeStop(); e.preventDefault();
    }
  });
  function removeStop() {
    if (S.stops.length <= 2) return;
    S.stops.splice(sel, 1);
    sel = Math.max(0, sel - 1);
    renderGrad(); styleChanged(); commit();
  }
  $('stopDel').addEventListener('click', removeStop);
  $('stopFlip').addEventListener('click', () => {
    S.stops.forEach((s) => (s.p = Math.round((1 - s.p) * 1000) / 1000));
    renderGrad(); styleChanged(); commit();
  });
  $('stopColor').addEventListener('input', (e) => { S.stops[sel].c = e.target.value; paintGrad(); styleChanged(); });
  $('stopColor').addEventListener('change', commit);
  $('stopHex').addEventListener('change', (e) => {
    let v = e.target.value.trim();
    if (!v.startsWith('#')) v = '#' + v;
    if (/^#[0-9a-f]{3}$/i.test(v)) v = '#' + v.slice(1).split('').map((c) => c + c).join('');
    if (/^#[0-9a-f]{6}$/i.test(v)) { S.stops[sel].c = v.toLowerCase(); paintGrad(); styleChanged(); commit(); }
    else { e.target.value = S.stops[sel].c; toast('Use a hex colour like #ff3c9e'); }
  });

  /* ---------- presets (shape and finish only; colours stay) ---------- */
  function applyLook(p) {
    for (const k of Coil.STYLE_KEYS) {
      if (k in p.s && !Coil.PRESET_SKIP.has(k)) S[k] = p.s[k];
    }
    stateReplaced();
    commit();
    toast(`${p.name} look applied`);
  }
  const lookCards = [];
  function buildPresets() {
    const host = $('presets');
    for (const p of Coil.PRESETS) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'preset';
      b.title = `Apply the ${p.name} look`;
      const c = document.createElement('canvas');
      c.width = 168; c.height = 168;
      const span = document.createElement('span');
      span.textContent = p.name;
      b.append(c, span);
      b.addEventListener('click', () => applyLook(p));
      host.appendChild(b);
      lookCards.push([c, p]);
    }
    renderLooks();
  }
  // Previews use the current colours, because applying a preset keeps them.
  function renderLooks() {
    for (const [c, p] of lookCards) {
      const sp = Coil.normalizeSettings({ ...p.s, ...Coil.paletteOf(S), hueDrift: S.hueDrift, text: 'O', format: 'square', fill: 0.8, weight: 190, tracking: 0, sizeMode: 'fit', valign: 'middle' });
      Coil.renderScene(c, Coil.buildScene(sp, 168, 168), sp);
    }
  }

  /* ---------- palettes (colours only) ---------- */
  const palKey = (p) => JSON.stringify([p.stops.slice().sort((a, b) => a.p - b.p).map((x) => [x.c.toLowerCase(), +(+x.p).toFixed(3)]), p.bg.toLowerCase(), p.outlineColor.toLowerCase()]);
  function renderPalettes() {
    const host = $('palettes');
    host.innerHTML = '';
    const cur = palKey(Coil.paletteOf(S));
    const list = (myPalette ? [{ id: 'mine', name: 'My colours', p: myPalette }] : []).concat(Coil.PALETTES);
    for (const pal of list) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'pal-chip';
      b.setAttribute('aria-pressed', String(palKey(pal.p) === cur));
      b.title = `Use the ${pal.name} colours`;
      const sw = document.createElement('span');
      sw.className = 'pal-sw';
      const stops = pal.p.stops.slice().sort((a, c) => a.p - c.p);
      sw.style.background = `linear-gradient(90deg, ${stops.map((x) => `${x.c} ${x.p * 100}%`).join(', ')})`;
      sw.style.boxShadow = `0 0 0 3px ${pal.p.bg}, 0 0 0 4px ${pal.p.outlineColor}`;
      const t = document.createElement('span');
      t.textContent = pal.name;
      b.append(sw, t);
      b.addEventListener('click', () => {
        Object.assign(S, Coil.paletteOf(Coil.normalizeSettings(pal.p)));
        stateReplaced();
        commit();
        toast(`${pal.name} colours`);
      });
      host.appendChild(b);
    }
  }
  $('palSave').addEventListener('click', () => {
    myPalette = Coil.paletteOf(S);
    persist();
    renderPalettes();
    toast('These colours are now your default');
  });

  function shuffleLook() {
    const r = Math.random, pick = (a) => a[Math.floor(r() * a.length)];
    const h = r() * 360;
    const scheme = pick([[0, 30, 60], [0, 180, 20], [0, 120, 240], [0, 150, 210], [0, -40, 200]]);
    const n = 3 + Math.floor(r() * 3);
    const dark = r() < 0.28;
    const stops = [];
    for (let i = 0; i < n; i++) {
      const hue = h + scheme[i % scheme.length] + (r() * 24 - 12);
      const light = i === n - 1 ? 0.12 + r() * 0.18 : 0.38 + r() * 0.4;
      stops.push({ c: Coil.rgbToHex(Coil.hslToRgb([hue, 0.55 + r() * 0.45, light])), p: Math.round((i / (n - 1)) * 1000) / 1000 });
    }
    if (r() < 0.4) stops.reverse().forEach((s, i) => (s.p = Math.round((i / (n - 1)) * 1000) / 1000));
    Object.assign(S, {
      stops,
      bg: Coil.rgbToHex(Coil.hslToRgb(dark ? [h + 180, 0.35, 0.08] : [h + r() * 60, 0.14 + r() * 0.2, 0.84 + r() * 0.08])),
      outlineColor: Coil.rgbToHex(Coil.hslToRgb(dark ? [h + 40, 0.6, 0.82] : [h + 200, 0.6, 0.12])),
      outlineOpacity: +(0.3 + r() * 0.6).toFixed(2),
      gradAngle: pick([-90, 0, 90, 180, Math.round(r() * 360 - 180)]),
      twist: pick([0, 0, 0.5, 1, 2, -1, 3]),
      density: +(0.1 + r() * 0.3).toFixed(2),
      opacity: +(0.62 + r() * 0.36).toFixed(2),
      blend: pick(['source-over', 'source-over', 'source-over', 'multiply', 'screen', 'hard-light', 'difference', 'overlay']),
      hueDrift: pick([0, 0, 0, 60, 120, -90, 240]),
      seed: Math.floor(r() * 9999),
    });
    stateReplaced();
    commit();
  }

  /* ---------- preview ---------- */
  const viewCanvas = $('view');
  const animCanvas = $('anim');
  const wrapEl = $('artboardWrap');
  const board = $('artboard');
  function fitBoard(W, H) {
    const cs = getComputedStyle(wrapEl);
    const aw = wrapEl.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const ah = wrapEl.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const sc = Math.max(0.01, Math.min(aw / W, ah / H));
    const w = Math.max(40, Math.floor(W * sc)), h = Math.max(40, Math.floor(H * sc));
    if (board.style.width !== w + 'px') board.style.width = w + 'px';
    if (board.style.height !== h + 'px') board.style.height = h + 'px';
    return w;
  }

  let raf = 0, dirty = true, lastCost = 0, interacting = false, settleTimer = 0;
  function requestRender() {
    dirty = true;
    if (!raf) raf = requestAnimationFrame(frame);
  }
  function frame() {
    raf = 0;
    if (!dirty || view !== 'gen') return;
    dirty = false;
    const { W, H } = Coil.docSize(S);
    const cssW = fitBoard(W, H);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const pw = Math.round(Math.min(W * 2, cssW * dpr)), ph = Math.round((pw * H) / W);
    if (viewCanvas.width !== pw || viewCanvas.height !== ph) { viewCanvas.width = pw; viewCanvas.height = ph; }
    const t0 = performance.now();
    const scene = Coil.buildScene(S, W, H);
    const fast = interacting && lastCost > 30;
    Coil.renderScene(viewCanvas, scene, S, { sprites: fast });
    if (!fast) lastCost = performance.now() - t0;
    if (fast) { clearTimeout(settleTimer); settleTimer = setTimeout(() => { interacting = false; requestRender(); }, 200); }
    const n = scene.groups.reduce((a, g) => a + g.circles.length, 0);
    const capPx = Math.round(scene.layout.k * (1000 + 2 * S.weight));
    $('info').textContent = `${W} × ${H} px · ${scene.groups.length} letters · ${capPx} px tall · ${n} circles`;
    lastLayout = { W, H, layout: scene.layout };
    updateMarks();
  }

  let markTimer = 0;
  function renderMark() {
    const c = $('mark');
    const sm = { ...S, text: 'COIL', align: 'center', valign: 'middle', sizeMode: 'fit', lineHeight: 1, tracking: Math.min(S.tracking, 80), fill: 0.96, transparent: true, shadow: 0, grain: 0, dots: 0 };
    Coil.renderScene(c, Coil.buildScene(sm, c.width, c.height), sm);
  }

  function styleChanged(textOnly) {
    interacting = true;
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => { interacting = false; requestRender(); }, 200);
    requestRender();
    anim.invalidate();
    if (!textOnly) {
      clearTimeout(markTimer);
      markTimer = setTimeout(() => { renderMark(); renderLooks(); renderPalettes(); }, 200);
    }
  }
  function stateReplaced() {
    syncAll();
    styleChanged();
    persist();
  }

  /* ---------- animation ---------- */
  const anim = new Coil.Animator({
    canvas: animCanvas, getS, getA,
    fit: fitBoard,
    onInfo: (txt) => { if (view === 'anim') $('info').textContent = txt; },
  });
  $('play').addEventListener('click', () => {
    anim.play(!anim.playing);
    $('play').textContent = anim.playing ? 'Pause' : 'Play';
    $('play').setAttribute('aria-pressed', String(anim.playing));
  });
  $('restart').addEventListener('click', () => anim.restart());

  /* ---------- social posts ---------- */
  const social = new Coil.Social({
    getS, saveFile, toast,
    onHistory: () => updateUndo(),
    onInfo: (txt) => { if (view === 'social') $('info').textContent = txt; },
  });

  function setView(v) {
    const was = view;
    view = v;
    app.dataset.view = v;
    $('tab-gen').setAttribute('aria-selected', String(v === 'gen'));
    $('tab-anim').setAttribute('aria-selected', String(v === 'anim'));
    $('tab-social').setAttribute('aria-selected', String(v === 'social'));
    viewCanvas.hidden = v !== 'gen';
    animCanvas.hidden = v !== 'anim';
    wrapEl.hidden = v === 'social';
    $('socialStage').hidden = v !== 'social';
    $('transport').hidden = v !== 'anim';
    $('shuffle').hidden = v === 'social';
    try { history.replaceState(null, '', v === 'anim' ? '#animate' : v === 'social' ? '#social' : location.pathname + location.search); } catch (e) {}
    $('panel').scrollTop = 0;
    updateMarks();
    if (v === 'anim') { anim.invalidate(); anim.start(); } else anim.stop();
    if (v === 'social') social.activate(); else if (was === 'social') social.deactivate();
    if (v === 'gen') requestRender();
    updateUndo();
    persist();
  }
  $('tab-gen').addEventListener('click', () => setView('gen'));
  $('tab-anim').addEventListener('click', () => setView('anim'));
  $('tab-social').addEventListener('click', () => setView('social'));

  /* ---------- export ---------- */
  const pngCtl = makeCtl({ k: 'pngScale', type: 'seg', label: 'PNG size', opts: [[1, '1×'], [2, '2×'], [4, '4×']] }, () => ({ get pngScale() { return pngScale; }, set pngScale(v) { pngScale = v; } }), () => persist(), {});
  $('pngScaleCtl').appendChild(pngCtl);
  const recCtl = makeCtl({ k: 'recLen', type: 'seg', label: 'Length', opts: [[4, '4 s'], [6, '6 s'], [10, '10 s'], [15, '15 s']] }, getA, onA, Coil.ANIM_DEFAULTS);
  $('recLenCtl').appendChild(recCtl);

  function busy(btn, on, label) {
    if (on) { btn.dataset.label = btn.textContent; btn.textContent = label; btn.disabled = true; }
    else { btn.textContent = btn.dataset.label; btn.disabled = false; }
  }

  $('savePng').addEventListener('click', () => {
    const btn = $('savePng');
    const { W, H } = Coil.docSize(S);
    let sc = pngScale;
    while (sc > 1 && W * sc * H * sc > 64e6) sc /= 2;
    if (sc !== pngScale) toast(`Saving at ${sc}× to stay under the canvas size limit`);
    busy(btn, true, 'Rendering…');
    setTimeout(() => {
      try {
        const c = document.createElement('canvas');
        c.width = Math.round(W * sc); c.height = Math.round(H * sc);
        Coil.renderScene(c, Coil.buildScene(S, W, H), S);
        c.toBlob((blob) => {
          busy(btn, false);
          if (!blob) { toast('The image was too large to save. Try a smaller size.'); return; }
          saveFile(`${slug()}${sc > 1 ? '@' + sc + 'x' : ''}.png`, blob);
        }, 'image/png');
      } catch (e) { busy(btn, false); toast('The image could not be rendered. Try a smaller size.'); }
    }, 30);
  });

  $('saveSvg').addEventListener('click', () => {
    const { W, H } = Coil.docSize(S);
    const svg = Coil.toSVG(S, W, H);
    saveFile(`${slug()}.svg`, new Blob([svg], { type: 'image/svg+xml' }));
  });

  function makeFont() {
    const name = $('fontName').value;
    const f = Coil.buildFont(S, name);
    return f;
  }
  $('saveFont').addEventListener('click', () => {
    const btn = $('saveFont');
    busy(btn, true, 'Building…');
    setTimeout(() => {
      try {
        const f = makeFont();
        saveFile(`${f.family.replace(/\s+/g, '')}-Regular.ttf`, new Blob([f.bytes], { type: 'font/ttf' }));
      } catch (e) { console.error(e); toast('The font could not be built with these settings'); }
      busy(btn, false);
    }, 30);
  });
  let fontSeq = 0;
  async function previewFont() {
    const btn = $('previewFont');
    busy(btn, true, 'Building…');
    try {
      const f = makeFont();
      const fam = 'CoilPreview' + ++fontSeq;
      const face = new FontFace(fam, f.bytes.buffer.slice(0));
      await face.load();
      document.fonts.add(face);
      $('fontPreview').hidden = false;
      $('specimen').style.fontFamily = `'${fam}', var(--font-ui)`;
      $('specimen').textContent = $('fontSample').value;
      $('fontInfo').textContent = `${f.family} · ${f.characters} characters · ${f.kernPairs} kerning pairs · ${f.layerCount} colour layers · ${Math.round(f.bytes.length / 1024)} KB`;
      btn.dataset.label = 'Rebuild with current settings';
    } catch (e) {
      console.error(e);
      toast('This browser could not load the font preview');
    }
    busy(btn, false);
  }
  $('previewFont').addEventListener('click', previewFont);
  $('fontSample').addEventListener('input', (e) => { $('specimen').textContent = e.target.value; });

  $('saveJson').addEventListener('click', () => {
    const data = JSON.stringify({ app: 'coil-type', version: 1, settings: S, motion: A }, null, 2);
    saveFile(`${slug()}-settings.json`, new Blob([data], { type: 'application/json' }));
  });
  $('loadJson').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const data = JSON.parse(rd.result);
        const s = data.settings || data;
        if (typeof s !== 'object' || !('stops' in s || 'weight' in s)) throw new Error('shape');
        S = Coil.normalizeSettings(s);
        if (data.motion) A = Coil.normalizeAnim(data.motion);
        buildModes(); buildMotionCtls();
        stateReplaced(); commit();
        toast('Settings loaded');
      } catch (err) { toast('That file is not a Coil Type settings file'); }
      e.target.value = '';
    };
    rd.readAsText(file);
  });
  let resetArmed = 0;
  $('reset').addEventListener('click', () => {
    const btn = $('reset');
    if (!resetArmed) {
      btn.textContent = 'Click again to reset';
      resetArmed = setTimeout(() => { resetArmed = 0; btn.textContent = 'Reset all'; }, 2500);
      return;
    }
    clearTimeout(resetArmed); resetArmed = 0; btn.textContent = 'Reset all';
    S = freshSettings();
    A = Coil.normalizeAnim(null);
    buildModes(); buildMotionCtls();
    stateReplaced(); commit();
    toast(myPalette ? 'Back to the defaults, with your colours' : 'Back to the defaults');
  });

  $('record').addEventListener('click', async () => {
    const btn = $('record');
    if (anim.recording) return;
    busy(btn, true, 'Recording…');
    btn.classList.add('rec');
    $('recProgress').hidden = false;
    try {
      const res = await anim.record(A.recLen, (p) => { $('recBar').style.width = p * 100 + '%'; });
      await saveFile(`${slug()}-${A.mode}.${res.ext}`, res.blob);
    } catch (e) {
      toast(e && e.code === 'unsupported' ? 'This browser cannot record video' : 'Recording stopped unexpectedly');
    }
    btn.classList.remove('rec');
    busy(btn, false);
    $('recProgress').hidden = true;
    $('recBar').style.width = '0';
    $('play').textContent = 'Pause';
  });

  /* ---------- global ---------- */
  $('undo').addEventListener('click', () => (view === 'social' ? social.undo() : travel(-1)));
  $('redo').addEventListener('click', () => (view === 'social' ? social.redo() : travel(1)));
  $('shuffle').addEventListener('click', shuffleLook);
  document.addEventListener('keydown', (e) => {
    const typing = /^(TEXTAREA|INPUT|SELECT)$/.test(e.target.tagName) && e.target.type !== 'range' && e.target.type !== 'checkbox';
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !typing) {
      e.preventDefault();
      if (view === 'social') { if (e.shiftKey) social.redo(); else social.undo(); }
      else travel(e.shiftKey ? 1 : -1);
    } else if (e.key === ' ' && view === 'anim' && !typing && e.target.tagName !== 'BUTTON') {
      e.preventDefault();
      $('play').click();
    } else if (selPair && view === 'gen' && e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !/^(TEXTAREA|INPUT|SELECT)$/.test(e.target.tagName)) {
      e.preventDefault();
      setManual(Coil.manualKern(...selPair, S) + (e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 50 : 10), false);
    } else if (e.key === 'Escape' && selPair) {
      selectPair(null);
    }
  });
  new ResizeObserver(() => { requestRender(); anim.invalidate(); }).observe(wrapEl);
  new ResizeObserver(() => { if (view === 'social') social.resize(); }).observe($('socialView'));
  try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => social.themeChanged()); } catch (e) {}

  /* ---------- boot ---------- */
  buildModes();
  buildMotionCtls();
  syncAll();
  buildPresets();
  renderPalettes();
  updateUndo();
  renderMark();
  setView(view);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => requestRender());
})();
