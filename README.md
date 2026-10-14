# Coil Type

Lettering generator that builds every letter from a chain of gradient circles.

**Live site:** https://fredericbaert.github.io/type/

- `dist/coil-type-standalone.html`: the whole app in one file. Double-click to open it in a browser.
- `dist/coil-type.html`: the same app without the html/head wrapper; this is the version published as an artifact.
- `index.html`: development page that loads the separate files in `src/`.

## Source (`src/`)
- `glyphs.js`: letter skeletons as SVG paths (cap top y=0, baseline y=1000)
- `geom.js`: path parsing, corner rounding, sampling along strokes
- `engine.js`: settings, presets (shape and finish only), palettes (colours only), layout, kerning (manual pairs + optical), circle chains, canvas rendering
- `svg.js`: SVG export
- `font.js`: TrueType builder (glyf outlines + COLRv1/CPAL + OpenType-SVG colour tables + kern table)
- `anim.js`: animation modes (slinky, morph, mouse, bounce) and video recording
- `app.js`, `page.html`, `style.css`: the interface

## Rebuild
After editing anything in `src/`, run:

    node tools/build.js

`tools/test.html` renders one setting full-screen (settings as JSON in the URL hash); `tools/node-load.js` loads the engine in Node for scripted tests.
To preview `index.html` from a local server: `python3 -m http.server 8765` in this folder.

## Publish an update
GitHub Pages serves `docs/index.html`. After changing anything in `src/`:

    node tools/build.js
    git add -A
    git commit -m "Describe the change"
    git push

The site updates within a minute or two.
