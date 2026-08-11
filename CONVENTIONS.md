# sketchbook conversion conventions

Every piece lives at `sketches/<slug>/` and is a self-contained page rendered
inside the gallery's iframe (also works standalone). Follow The Standard
(see `shared/standard.css`, `shared/standard.js`, and the-standard repo's
CLAUDE.md rules).

## File layout

```
sketches/<slug>/
  index.html      — from the-standard template.html, paths adjusted
  sketch.js       — the piece (module for three, classic global for p5)
  meta.json       — manifest fragment (see below)
  *.glsl / assets — only what the sketch actually uses; keep < ~5 MB
```

`index.html` references the shared chrome:

```html
<link rel="stylesheet" href="../../shared/standard.css" />
<script src="../../shared/standard.js"></script>
```

## meta.json

```json
{
  "slug": "example",
  "title": "example",
  "description": "one line about the piece",
  "hint": "drag to orbit · scroll to zoom",
  "library": "three | p5 | webgl | webgpu | canvas2d",
  "source": "repo-or-path the piece came from",
  "year": "2023",
  "thumbDelay": 4000
}
```

`thumbDelay` = ms of animation before the thumbnail screenshot is taken.

## Libraries

- three.js: importmap to `https://cdn.jsdelivr.net/npm/three@0.174.0/…`
  (as in the-standard template). Port old 0.126-era code forward
  (`PlaneBufferGeometry`→`PlaneGeometry`, `outputEncoding`→
  `outputColorSpace`, etc.). If a piece truly needs an old API, pin its own
  importmap version instead of fighting it.
- p5: CDN `p5@2.3.2` global mode when the code allows; pin 1.9.x if the
  sketch depends on 1.x behavior.
- No bundlers, no node_modules — everything CDN or local files.
- Shaders: inline template literals or fetched local .glsl files.

## The chrome (corner semantics — never violate)

- top left `#controls`: `Standard.param(...)` sliders for every
  interpretable parameter (sensible min/max/step, current value as
  default), `.ctrl` buttons for actions (regenerate, palette, pause).
  Params must actually affect the running sketch live where feasible.
- bottom left `#bottom-left`: `#description-title` (lowercase piece title),
  `#description` (one poetic-but-accurate line), `#hint` (interaction hint,
  e.g. "drag to orbit · scroll to zoom").
- bottom right `#attribution`: keep the three handles exactly as in
  template.html.
- Canvas appended to body, no z-index, full-bleed, responsive (resize
  handler wired). Never hard-pin canvas to a social aspect ratio.

## Cleanups required when porting

- Strip CCapture / recording harnesses, per-frame console.logs, dead
  scripts (e.g. visbrain.js), dev-only panels.
- Remove hardcoded API tokens (Mapbox, NASA Earthdata). If a piece needs
  remote data, prefer its synthetic/offline fallback.
- WebXR pieces: desktop-first (OrbitControls). Keep VRButton only if it
  works untouched; otherwise drop XR and note it in meta.json source.
- Keep the original visual character. Parameterize, don't redesign.
- Dark theme is default; add `class="standard-light"` on body for
  light-background pieces and set the page background explicitly.

## Don'ts

- Don't edit `shared/standard.css` / `standard.js`.
- Don't touch `sketches.js` (the manifest is assembled from meta.json).
- Don't copy node_modules, .git, renders, or unused assets.
