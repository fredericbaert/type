// Builds index.html (dev, linked files) and dist/coil-type.html (single file, everything inline).
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const src = (f) => fs.readFileSync(path.join(root, 'src', f), 'utf8');
const SCRIPTS = ['glyphs.js', 'geom.js', 'engine.js', 'svg.js', 'font.js', 'anim.js', 'app.js'];
const page = src('page.html');

const dev = page
  .replace('<!-- STYLE -->', `<link rel="stylesheet" href="src/style.css?v=${Date.now()}">`)
  .replace('<!-- SCRIPTS -->', SCRIPTS.map((f) => `<script src="src/${f}?v=${Date.now()}"></script>`).join('\n'));
fs.writeFileSync(path.join(root, 'index.html'),
  '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n</head>\n<body>\n' + dev + '\n</body>\n</html>\n');

const js = SCRIPTS.map((f) => {
  const code = src(f);
  if (/<\/script/i.test(code)) throw new Error(`${f} contains a closing script tag`);
  return `<script>\n${code}\n</script>`;
}).join('\n');
const single = page.replace('<!-- STYLE -->', `<style>\n${src('style.css')}\n</style>`).replace('<!-- SCRIPTS -->', js);
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'coil-type.html'), single);
console.log('built', (single.length / 1024).toFixed(1) + ' KB');

// Standalone copy as a full document (title, fonts and styles in <head>), for opening straight
// from disk and for the website in docs/ that GitHub Pages serves.
const split = single.indexOf('<div class="app"');
const standalone = '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' +
  '<meta name="description" content="Lettering generator that builds every letter from a chain of gradient circles.">\n' +
  single.slice(0, split).trim() + '\n</head>\n<body>\n' + single.slice(split) + '\n</body>\n</html>\n';
fs.writeFileSync(path.join(root, 'dist', 'coil-type-standalone.html'), standalone);
fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
fs.writeFileSync(path.join(root, 'docs', 'index.html'), standalone);
fs.writeFileSync(path.join(root, 'docs', '.nojekyll'), '');
