# sketchbook

Every generative-art piece from across my repos, collected in one place and
reconciled onto [the-standard](https://github.com/smrghsh/the-standard) —
params top left, title/description bottom left, handles bottom right, canvas
full-bleed underneath.

**Run it:** any static server from the repo root, e.g.

```
python3 -m http.server 8080
# → http://localhost:8080
```

The gallery strip at the top has prev/next buttons and thumbnails; the
selected sketch loads below in an iframe. Deep-link with `#slug`; arrow keys
navigate.

## Layout

```
index.html / gallery.{css,js}   the gallery shell
sketches.js                     manifest (generated — do not hand-edit)
shared/standard.{css,js}        vendored from the-standard
sketches/<slug>/                one self-contained page per piece
  index.html · sketch.js · meta.json · assets
thumbs/<slug>.png               gallery thumbnails (generated)
tools/                          manifest.js · thumbs.js · order.txt
```

Regenerate after adding/reordering sketches:

```
node tools/manifest.js --order tools/order.txt
node tools/thumbs.js [slug …]        # needs npm i in tools/ (playwright)
node tools/admin.js                  # admin panel → http://localhost:4747
```

The admin panel reorders (drag), edits titles/descriptions, and toggles
visibility. Saving writes each `meta.json`, syncs the sketch page's corner
text, rewrites `tools/order.txt`, and regenerates `sketches.js`. Hidden
sketches (`"hidden": true` in `meta.json`) keep their spot in `order.txt`
but are left out of the gallery.

Adding a piece: follow `CONVENTIONS.md`.

## The pieces (52)

| sketch | from | year | what it is |
| --- | --- | --- | --- |
| glass | glass | 2026 | stained glass adrift — transmission, dispersion, gold rims |
| topo-terrain | samir-is-on-the-internet | 2026 | the living contour map: fbm + ridge noise, rivers, meadows, birds |
| weave | samir-is-on-the-internet-old | 2022 | 40 ribbons shaped by y = a·sin(b·x + c·sin(d·x − e) + f) |
| lorenz-butterflies | lorenz-butterflies | 2025 | butterfly wing shaders riding a Lorenz-63 attractor |
| frame | frame | 2026 | rectangles adrift + chromatic aberration (p5 2.0 strands) |
| harada-scene | harada | 2026 | maple table, a cup of tea, steam — procedural wood |
| diamonds-and-sapphires | diamonds-and-sapphires | 2026 | orbiting rings of flickering gems |
| santa-cruz-sunsets | sunset | 2025 | a generative averaging of Pacific sunsets |
| dashed-dome | genuary2026 | 2026 | 1200 dashed strands converge into a dome (day 2) |
| lorenz-attractor | lorenz-threejs | 2025 | 6000 RK4 particles with trails and bloom |
| butterflies | butterfly | 2023 | hold still and one may land near your cursor |
| styx | diwali-on-the-styx | 2020 | domain-warped fbm river; stillness calms it |
| breathing-fragment | breathing-fragment | 2021 | the river breathes on a cos² cycle |
| eye-of-god | spectra-experiment | 2021 | inside a 4D-simplex plasma dome |
| planet-variations | planet-variations | 2021 | fbm ocean + dissolving cloud shell + moons |
| invisible-sphere | invisible-sphere | 2021 | 300k points streaming past from inside ("oceanflare") |
| surface-test | surface-test | 2021 | a million points reconstituting two images ("it became a meme") |
| point-holo | point-holo | 2021 | a human brain, downloading |
| sphere-wub | sphere-wub | 2021 | 2000 points, each breathing on its own phase |
| wow-such-creative | wow-such-creative | 2021 | shader-cube tunnel at FOV 10000 — the old landing page |
| scale-panel | scale-panel | 2021 | breathing cube-wall generator (breathe / pinch variants) |
| rainbow-noise-lines | rainbow-noise-lines · staggered-sin | 2021 | staggered sine line field, cyan→magenta |
| color-bop | color-bop | 2022 | click to re-roll the cosine palette |
| glip | demo/5-25-23 | 2023 | sine-interference lattice of yellow wireframe |
| bar-wall | bar-wall | 2021 | seamlessly looping equalizer wall, cyan→magenta |
| floor-panels-deform | floor-panels-deform | 2021 | a dreamt desert swell ("joshdream") |
| noise-dunes | learn-vertex-shaders | 2021 | first vertex-shader study — rolling point dunes |
| growth-structure | growth-structure | 2022 | accretion tree that grows, un-grows, reseeds |
| negative-space | negative-space | 2021 | the inverse starfield |
| pileup | pileup | 2021 | cube physics pile up |
| rgb-cube | rgb-cube | 2021 | the RGB color cube made physical |
| hypercube-wub | shapesXR-viewer-template · limbo | 2022 | nested wireframe cubes, wubbing (rescued from comments) |
| cgol | cgol · 1127 | 2021 | 2.5D Conway's — click cells to toggle |
| genuary-dna-loop | genuary2022/1 | 2022 | double helix, perfect loop |
| genuary-intersections | genuary2022/4 | 2022 | "the day coding was fun again" |
| genuary-tessellation | genuary2022/12 | 2022 | isometric lattice, radial pulse |
| genuary-lines-orb | genuary2025/Day1 | 2025 | 8000 axis-aligned lines in a sphere |
| ishq-fana | ishq-fana | 2026 | two loves, one dissolution |
| dandelion-wish | dandelion-wish | 2023 | blow into the mic, make a wish |
| breath-garden | breath-garden | 2021 | a 4-4-8 breathing river through the desert |
| chromatic | chromatic | 2025 | rgb channel split via pixel manipulation |
| derez | derez | 2025 | banded variable-resolution glitch toy |
| thoth-tarot-oracle | thoth-tarot-oracle | 2026 | vibecoded tarot deck. no divinity guaranteed |
| salsa-genart | salsa-genart | 2025 | salsa encoded in mathematics (synthetic-joint mode) |
| spectra | spectra · spectra-archive | 2020 | voice acoustics as a light organ (file or mic) |
| webgpu-agents | webgpu-mousefollow | 2024 | 1000 compute-shader agents chasing the mouse |
| treering | treering · lasercut(1) | 2024 | plotter-ready perlin rings, sized in inches |
| proximity-triangles | s18port | 2018 | the accidental proximity detector |
| intermittent | s18port | 2018 | perlin grooves interrupted by glitch (once EEG-driven) |
| h391 | southern-elephant-seals/eseal-animation · eseals | 2026 | an elephant seal's dive record, with sperm-whale encounters |
| swot-ssh-globe | swot-ssh-globe | 2026 | SWOT sea-surface anomalies as a breathing globe |
| swot-delta | swot-delta-wetlands | 2026 | the Delta breathes — tides and seasons from SWOT |

## Not included, and why

**Duplicates / superseded** — diving-with-seals2 (≡ seals), brahma-old?/examples
& brahma-xr/examples (≡ xr/wildfire), staggered-sin (≡ rainbow-noise-lines),
sword-sliced-shader (≈ breathing-fragment), aquatic & vr-website sky (styx
family), tornado/weave/kaleidoscope demo days (families represented),
markov-motivation ≡ rtp, nye ≈ swim, standby & glac.js (proximity-triangles
family), temp & bubbles (particle-lesson variants), genuary2022 days 2/5/9
(families represented), goethe-circle / sketches (minimal particle study).

**Server, multi-user, or API-bound** — seals / southern-elephant-seals /
penguins, wildfire / xr / vrss1a / xr copy, coastal (COG tile server),
geoparquet-viz-spike (FastAPI), swot-reservoir-levels + swot-seal-eddies +
swot xr (Mapbox/NASA tokens or live fetches), RYR1 (brahma multiplayer),
lydio/360 players (streaming backends), eroto-system (Intiface hardware +
dual webcams). Several of these had **hardcoded API tokens** in source
(Mapbox, NASA Earthdata JWT, Google Maps in scrying, a Lovense token) —
nothing token-bearing was copied here; consider rotating those keys.

**Asset-heavy captures** — cypherspace (400MB mocap), coral (128MB gaussian
splats), capoeira / baile / pingu (photogrammetry + rigged GLBs), cups / l /
lf (hundreds of MB of committed video), brain-rot (180-image corpora),
teapot-simulator (webcam facemesh), butterfly's 46MB forest floor (the
butterflies fly here without it).

**Stretch pieces worth a future session** — shred (WebGPU snow carving,
pinned to three@dev), caye (Boussinesq wave sim, vendored Celeris),
genuary2025 days 2/6/13, fun-sun (an orphaned shader in surface-test that
"makes a fun sun").

**Empty aspirational repos** — black-hole-lines, stems, destructibles,
hyper-hexagon, genuary2024, cylinder-flow-field (a template copy), aqvr,
inverness, mai-map, teental, dandelion (the VR one), and friends.

**Not mine** — polygon-shredder (spite), three-sketches (gkjohnson), lygia &
shader_prototyping_2022 (Patricio Gonzalez Vivo), p5.capture, hydra-functions,
NFT-Collection-THREE-JS, nn-vis-vr, air (Olwal), horse-drawings (davepagurek),
nbrody.github.io, mcvlix.github.io & chlesser.github.io (scaffold gifts to
friends), ProjectFlowerbed (Meta), lasercut(1) core algorithm (Dannenberg /
Jenny Lee — its descendant treering is here). Plato is confidential and
untouched. maptoposter is real generative art but Python-offline, not a
browser sketch.
