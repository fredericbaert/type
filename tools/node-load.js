// Loads the browser-style modules into Node's global scope for testing.
const fs = require('fs'), path = require('path'), vm = require('vm');
const dir = path.join(__dirname, '..', 'src');
for (const f of ['glyphs.js', 'geom.js', 'engine.js', 'svg.js', 'font.js']) {
  const p = path.join(dir, f);
  if (fs.existsSync(p)) vm.runInThisContext(fs.readFileSync(p, 'utf8'), { filename: p });
}
module.exports = globalThis.Coil;
