/* Coil Type — SVG export. One shared gradient per colour set; each circle is rotated so the
   bounding-box gradient points the same way as on the canvas. */
(function (root) {
  const Coil = (root.Coil = root.Coil || {});
  const n2 = (v) => +(+v).toFixed(2);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  Coil.gradientDef = function (id, stops) {
    return `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0">` +
      stops.map((s) => `<stop offset="${n2(s.p)}" stop-color="${s.c}"/>`).join('') + '</linearGradient>';
  };

  Coil.circleTag = function (c, S, k = 1, flipY = false) {
    const cx = n2(c.x * k), cy = n2((flipY ? -c.y : c.y) * k), r = n2(c.r * k);
    // Flipping y for font space moves the centre but not the direction: SVG and canvas are both y-down.
    let deg = (c.a * 180) / Math.PI;
    deg = n2(((deg % 360) + 540) % 360 - 180);
    const sw = S.style === 'ring' ? S.ringWidth * c.r * k : S.outlineWidth * c.r * k;
    const swAttr = sw > 0.01 && (S.style === 'ring' || S.outlineOpacity > 0) ? ` stroke-width="${n2(sw)}"` : '';
    const rot = deg ? ` transform="rotate(${deg} ${cx} ${cy})"` : '';
    return `<circle cx="${cx}" cy="${cy}" r="${r}"${swAttr}${rot}/>`;
  };

  /* Circle markup for a list of draw ops; seams become clipped groups of repeated circles. */
  Coil.opsMarkup = function (ops, S, k, flipY, newId, addClip) {
    let out = '';
    for (const op of ops) {
      if (!op.seam) { if (op.r > 0.05) out += Coil.circleTag(op, S, k, flipY); continue; }
      const cid = newId();
      addClip(cid, op.x * k, (flipY ? -op.y : op.y) * k, op.R * k);
      out += `<g clip-path="url(#${cid})">`;
      for (const c of op.list) if (c.r > 0.05) out += Coil.circleTag(c, S, k, flipY);
      out += '</g>';
    }
    return out;
  };

  Coil.groupAttrs = function (S, gradId) {
    if (S.style === 'ring') return `fill="none" stroke="url(#${gradId})" stroke-opacity="${n2(S.opacity)}"`;
    const outline = S.outlineWidth > 0 && S.outlineOpacity > 0;
    return `fill="url(#${gradId})" fill-opacity="${n2(S.opacity)}"` +
      (outline ? ` stroke="${S.outlineColor}" stroke-opacity="${n2(S.outlineOpacity)}"` : ' stroke="none"');
  };

  Coil.toSVG = function (S, W, H) {
    const scene = Coil.buildScene(S, W, H);
    const grads = new Map();
    let defs = '';
    const gradFor = (hue) => {
      const stops = Coil.stopsFor(S, hue);
      const key = stops.map((s) => s.c + s.p).join();
      if (!grads.has(key)) {
        const id = 'grad' + grads.size;
        grads.set(key, id);
        defs += Coil.gradientDef(id, stops);
      }
      return grads.get(key);
    };
    const blend = S.blend && S.blend !== 'source-over' ? S.blend : null;
    let body = '', seamN = 0;
    for (const g of scene.groups) {
      const id = gradFor(g.hue);
      body += `<g id="letter-${g.index + 1}-${encodeURIComponent(g.key)}" ${Coil.groupAttrs(S, id)}>`;
      body += Coil.opsMarkup(g.ops || g.circles, S, 1, false, () => {
        const cid = 'seam' + seamN++;
        return cid;
      }, (cid, x, y, R) => { defs += `<clipPath id="${cid}"><circle cx="${n2(x)}" cy="${n2(y)}" r="${n2(R)}"/></clipPath>`; });
      body += '</g>';
    }
    if (S.shadow > 0) {
      defs += `<filter id="shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="${n2(S.shadow * 26)}" stdDeviation="${n2(S.shadow * 35)}" flood-color="${S.outlineColor}" flood-opacity="0.45"/></filter>`;
    }
    const grain = !S.transparent && S.grain > 0;
    if (grain) {
      defs += '<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>';
    }
    const style = blend ? `<style>#letters circle{mix-blend-mode:${blend}}</style>` : '';
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<title>${esc(S.text.replace(/\n/g, ' '))} — Coil Type</title>
<defs>${defs}</defs>${style}
${S.transparent ? '' : `<rect id="background" width="${W}" height="${H}" fill="${S.bg}"/>`}
<g id="letters"${blend ? ' style="isolation:isolate"' : ''}${S.shadow > 0 ? ' filter="url(#shadow)"' : ''}>${body}</g>
${grain ? `<rect id="grain" width="${W}" height="${H}" filter="url(#grain)" opacity="${n2(S.grain * 0.55)}" style="mix-blend-mode:overlay"/>` : ''}
</svg>`;
  };
})(typeof window !== 'undefined' ? window : globalThis);
