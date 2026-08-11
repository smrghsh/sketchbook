// topo-terrain — the living contour map from samir.tech.
// An FBM + ridge-noise heightfield with contour/index lines, distance fog and
// a 5-stop elevation palette. Rivers flood the valleys, meadows spread across
// the mid-slopes, and flocks of birds drift across the sky every so often.
// Ported standalone from the Nuxt/vite Experience (three 0.160 -> 0.174);
// the original scroll-lerp toward the bathymetric palettes is now the
// "palette blend" slider (classic -> abyss).
import * as THREE from "three";

/**
 * Palette presets + per-mode terrain defaults.
 * Each palette: bg + 5 elevation colors (c0 low -> c4 high) + line colors
 * + landscape feature colors (water/meadow) mixed in by the terrain.
 */
const PALETTES = {
  // Dark — black sky, teal valleys, green ridgelines.
  darkClassic: {
    bg: "#000000",
    c0: "#0a1018", c1: "#102634", c2: "#1b4d5b", c3: "#3a8a78", c4: "#7fd49a",
    line: "#5fd49a", indexLine: "#9be8b8",
    water: "#1d5f7a", meadow: "#3f7a4e",
  },
  // Light — warm paper, sage valleys, deep-green ridges.
  lightClassic: {
    bg: "#f5f3ee",
    c0: "#ece5d3", c1: "#d6cdb2", c2: "#bdc89b", c3: "#7eaa78", c4: "#2ea36a",
    line: "#2e7a4d", indexLine: "#1a4a30",
    water: "#8fc0d2", meadow: "#a9c877",
  },
  // Deep bathymetric — the blend target in dark mode.
  darkAbyss: {
    bg: "#03070d",
    c0: "#04121f", c1: "#0a2b44", c2: "#114e6b", c3: "#1f86a6", c4: "#56d0d6",
    line: "#43b8c4", indexLine: "#8af0ee",
    water: "#2596b8", meadow: "#155a70",
  },
  // Blend target in light mode.
  lightBathy: {
    bg: "#eef3f3",
    c0: "#d6e6e6", c1: "#b3d4d4", c2: "#88bcc2", c3: "#4f97a6", c4: "#2e6f86",
    line: "#2e6f86", indexLine: "#163f52",
    water: "#79b7c4", meadow: "#9cc4b0",
  },
};

// Night is the dramatic high-relief green-on-black; day is calmer/lower.
const NIGHT_DEFAULTS = { amp: 1.55, contourEvery: 0.18, lineStrength: 1.0 };
const DAY_DEFAULTS = { amp: 1.18, contourEvery: 0.14, lineStrength: 0.8 };

const vertexShader = /* glsl */ `
varying vec3 vWorldPos;
varying float vHeight;
uniform float uAmp;

vec3 mod289(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                     -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                            + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0),
                          dot(x12.xy, x12.xy),
                          dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x  = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float fbm(vec2 p) {
  float a = 0.5, f = 1.0, s = 0.0, n = 0.0;
  for (int i = 0; i < 6; i++) {
    s += a * snoise(p * f);
    n += a;
    a *= 0.5;
    f *= 2.03;
  }
  return s / n;
}

uniform float uSeed;
float terrain(vec2 p) {
  p += uSeed;
  float base  = fbm(p * 0.18);
  float ridge = 1.0 - abs(fbm(p * 0.36));
  ridge = ridge * ridge;
  return base * 0.85 + (ridge - 0.55) * 0.40;
}

void main() {
  vec3 pos = position;
  float h = terrain(pos.xz) * uAmp;
  pos.y = h;
  vHeight = h;
  vec4 wp = modelMatrix * vec4(pos, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const fragmentShader = /* glsl */ `
varying vec3 vWorldPos;
varying float vHeight;

uniform float uContourEvery;
uniform float uIndexEvery;
uniform float uLineWidth;
uniform vec3  uLightDir;
uniform vec3  uBg, uC0, uC1, uC2, uC3, uC4, uLine, uIndexLine;
uniform float uFogNear, uFogFar;
uniform float uShadeLow, uShadeHigh;
uniform float uLineStrength;

// landscape features (strengths animate 0->1 as their scripts load in)
uniform float uTime;
uniform vec3  uWaterCol, uMeadowCol;
uniform float uWaterLevel;
uniform float uWaterStrength, uMeadowStrength;

vec3 mod289(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                     -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                            + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0),
                          dot(x12.xy, x12.xy),
                          dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x  = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

vec3 ramp(float t) {
  t = clamp(t, 0.0, 1.0);
  if (t < 0.25) return mix(uC0, uC1,  t        / 0.25);
  if (t < 0.50) return mix(uC1, uC2, (t - 0.25) / 0.25);
  if (t < 0.75) return mix(uC2, uC3, (t - 0.50) / 0.25);
  return            mix(uC3, uC4, (t - 0.75) / 0.25);
}

void main() {
  vec3 dpx = dFdx(vWorldPos);
  vec3 dpy = dFdy(vWorldPos);
  vec3 n = normalize(cross(dpy, dpx));

  float t = clamp(vHeight * 0.32 + 0.5, 0.0, 1.0);
  vec3 base = ramp(t);

  float lambert = clamp(dot(n, normalize(uLightDir)), 0.0, 1.0);
  base *= mix(uShadeLow, uShadeHigh, lambert);

  // ── landscape features ────────────────────────────────────────────
  // meadows: patchy warm greens on gentle mid-low slopes
  float mNoise = snoise(vWorldPos.xz * 0.32 + 7.3);
  float meadowBand = smoothstep(-0.30, -0.05, vHeight) * (1.0 - smoothstep(0.20, 0.42, vHeight));
  float meadow = smoothstep(0.12, 0.55, mNoise) * meadowBand * uMeadowStrength;
  base = mix(base, uMeadowCol * mix(uShadeLow, uShadeHigh, lambert), meadow * 0.55);

  // rivers/lakes: valley floors flood below the water level, with a soft
  // shoreline. The surface behaves like water: animated ripple normals, a
  // fresnel-weighted sky reflection, and a sun glint.
  float water = (1.0 - smoothstep(uWaterLevel - 0.05, uWaterLevel + 0.03, vHeight)) * uWaterStrength;
  if (water > 0.001) {
    vec3 V = normalize(cameraPosition - vWorldPos);
    // two scales of drifting ripples perturb an up-facing normal
    float r1 = snoise(vWorldPos.xz * 2.0 + vec2(uTime * 0.16, uTime * 0.10));
    float r2 = snoise(vWorldPos.xz * 4.3 - vec2(uTime * 0.11, uTime * 0.19));
    vec3 wN = normalize(vec3(r1 * 0.10 + r2 * 0.05, 1.0, r1 * 0.07 - r2 * 0.05));

    // depth shading: deeper water reads darker
    float depth = clamp((uWaterLevel - vHeight) / 0.14, 0.0, 1.0);
    vec3 waterCol = mix(uWaterCol * 1.08, uWaterCol * 0.72, depth);

    // sky reflection strengthens at grazing angles (schlick-ish fresnel)
    float fresnel = pow(1.0 - max(dot(wN, V), 0.0), 3.0);
    waterCol = mix(waterCol, uBg + (1.0 - uBg) * 0.25, fresnel * 0.5);

    // sun glint off the ripples
    float spec = pow(max(dot(reflect(-normalize(uLightDir), wN), V), 0.0), 90.0);
    waterCol += spec * 0.45;

    base = mix(base, waterCol, water * 0.92);
  }

  float hd = fwidth(vHeight) + 1e-5;

  float cMinor = abs(fract(vHeight / uContourEvery) - 0.5);
  float minorLine = 1.0 - smoothstep(0.0, uLineWidth * hd / uContourEvery, cMinor);

  float idxStep = uContourEvery * uIndexEvery;
  float cMajor = abs(fract(vHeight / idxStep) - 0.5);
  float majorLine = 1.0 - smoothstep(0.0, uLineWidth * 1.4 * hd / idxStep, cMajor);

  // contours quiet down over water (reads as lakes on a topo map)
  float lineDamp = 1.0 - water * 0.8;
  vec3 col = base;
  col = mix(col, uLine,      minorLine * 0.55 * uLineStrength * lineDamp);
  col = mix(col, uIndexLine, majorLine * 0.85 * uLineStrength * lineDamp);

  float d = length(vWorldPos - cameraPosition);
  float fogFactor = smoothstep(uFogNear, uFogFar, d);
  col = mix(col, uBg, fogFactor);

  gl_FragColor = vec4(col, 1.0);
}
`;

/**
 * State
 */
let isDark = true; // boot dark (the night palette pair)

const params = {
  amp: NIGHT_DEFAULTS.amp,
  contour: NIGHT_DEFAULTS.contourEvery,
  lineWidth: 1.05,
  fogFar: 38,
  blend: 0, // classic -> abyss (was the scroll lerp)
};
let lineStrength = NIGHT_DEFAULTS.lineStrength;
const indexEvery = 5.0;
const fogNear = 14;

const pal = () => (isDark ? PALETTES.darkClassic : PALETTES.lightClassic);
const palBottom = () => (isDark ? PALETTES.darkAbyss : PALETTES.lightBathy);

/**
 * Scene / camera / renderer
 */
const sizes = { width: window.innerWidth, height: window.innerHeight };

const scene = new THREE.Scene();
scene.background = new THREE.Color("#000000");
scene.fog = new THREE.Fog("#000000", fogNear, params.fogFar);

// Fixed backdrop camera that drifts with the mouse for parallax — the
// original never hands the viewer the orbit, and OrbitControls would fight
// the per-frame parallax easing, so it stays parallax-only here too.
const start = { pos: [0, 6.2, 11], look: [0, 0.4, -2], fov: 34 };
const camera = new THREE.PerspectiveCamera(
  start.fov,
  sizes.width / sizes.height,
  0.1,
  200
);
camera.position.set(...start.pos);
camera.lookAt(...start.look);
scene.add(camera);

const parallax = 0.55;
const mouse = { x: 0, y: 0 };
window.addEventListener("mousemove", (e) => {
  mouse.x = (e.clientX / sizes.width) * 2 - 1;
  mouse.y = (e.clientY / sizes.height) * 2 - 1;
});
const cam = { curX: start.pos[0], curY: start.pos[1] };

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

/**
 * Terrain
 */
const p0 = pal();
const geometry = new THREE.PlaneGeometry(44, 44, 320, 320);
geometry.rotateX(-Math.PI / 2);

const uniforms = {
  uAmp: { value: params.amp },
  uContourEvery: { value: params.contour },
  uIndexEvery: { value: indexEvery },
  uLineWidth: { value: params.lineWidth },
  uLineStrength: { value: lineStrength },
  uSeed: { value: 0 },
  uLightDir: { value: new THREE.Vector3(0.55, 0.85, 0.3).normalize() },
  uShadeLow: { value: 0.55 },
  uShadeHigh: { value: 1.15 },
  uFogNear: { value: fogNear },
  uFogFar: { value: params.fogFar },
  uBg: { value: new THREE.Color(p0.bg) },
  uC0: { value: new THREE.Color(p0.c0) },
  uC1: { value: new THREE.Color(p0.c1) },
  uC2: { value: new THREE.Color(p0.c2) },
  uC3: { value: new THREE.Color(p0.c3) },
  uC4: { value: new THREE.Color(p0.c4) },
  uLine: { value: new THREE.Color(p0.line) },
  uIndexLine: { value: new THREE.Color(p0.indexLine) },
  // landscape features — strengths start at 0; rivers/meadows fade them in
  // after load. The water level scales with amplitude.
  uTime: { value: 0 },
  uWaterCol: { value: new THREE.Color(p0.water) },
  uMeadowCol: { value: new THREE.Color(p0.meadow) },
  uWaterLevel: { value: -0.4 * params.amp },
  uWaterStrength: { value: 0 },
  uMeadowStrength: { value: 0 },
};

const material = new THREE.ShaderMaterial({
  uniforms,
  vertexShader,
  fragmentShader,
});
scene.add(new THREE.Mesh(geometry, material));

// Lerp classic -> abyss/bathy across the blend slider, in the current mode.
function applyPalette() {
  const a = pal();
  const b = palBottom();
  const t = params.blend;
  const mixCol = (k) => new THREE.Color(a[k]).lerp(new THREE.Color(b[k]), t);

  uniforms.uBg.value.copy(mixCol("bg"));
  uniforms.uC0.value.copy(mixCol("c0"));
  uniforms.uC1.value.copy(mixCol("c1"));
  uniforms.uC2.value.copy(mixCol("c2"));
  uniforms.uC3.value.copy(mixCol("c3"));
  uniforms.uC4.value.copy(mixCol("c4"));
  uniforms.uLine.value.copy(mixCol("line"));
  uniforms.uIndexLine.value.copy(mixCol("indexLine"));
  uniforms.uWaterCol.value.copy(mixCol("water"));
  uniforms.uMeadowCol.value.copy(mixCol("meadow"));
  uniforms.uShadeLow.value = isDark ? 0.55 : 0.7;
  uniforms.uShadeHigh.value = isDark ? 1.15 : 1.1;

  scene.background.copy(uniforms.uBg.value);
  scene.fog.color.copy(uniforms.uBg.value);
  document.body.style.background = "#" + uniforms.uBg.value.getHexString();
}
applyPalette();

/**
 * Feature fades — rivers flood the valleys first, then meadows spread.
 * Each eases a terrain strength uniform 0 -> 1 after its delay, so the
 * landscape assembles piece by piece instead of arriving all at once.
 */
const fades = [
  { uniform: "uWaterStrength", delay: 1200, duration: 3000 }, // rivers
  { uniform: "uMeadowStrength", delay: 2800, duration: 3200 }, // meadows
];
function updateFades(elapsedMs) {
  for (const f of fades) {
    const t = elapsedMs - f.delay;
    if (t <= 0) continue;
    const x = Math.min(1, t / f.duration);
    uniforms[f.uniform].value = x * x * (3 - 2 * x); // smoothstep ease
  }
}

/**
 * Birds: small flocks in loose V formation drifting across the sky every so
 * often. Each bird is two flapping wing triangles — silhouettes, not models.
 */
const FIRST_FLOCK = 6500; // ms after load
const INTERVAL = [16000, 34000]; // ms between flocks (random in range)
const SPEED = 1.3; // units/sec — unhurried; a crossing takes ~30s
const EDGE = 18; // spawn/despawn |x| (just past the view cone)

function makeWingGeometry(side) {
  // one triangle per wing: root at the body, tip out on ±z
  const g = new THREE.BufferGeometry();
  const s = side; // +1 left, -1 right
  g.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [0, 0, 0, -0.06, 0, s * 0.21, 0.06, 0, s * 0.15],
      3
    )
  );
  g.computeVertexNormals();
  return g;
}

class Flock {
  constructor(scene, material, rand) {
    this.group = new THREE.Group();
    this.dir = rand() > 0.35 ? 1 : -1; // mostly left-to-right
    this.y = 2.8 + rand() * 1.8;
    this.z = -7 + rand() * 6;
    this.x = -EDGE * this.dir;
    this.speed = SPEED * (0.85 + rand() * 0.4);
    this.birds = [];

    const n = 5 + Math.floor(rand() * 4);
    const geoL = makeWingGeometry(1);
    const geoR = makeWingGeometry(-1);
    for (let i = 0; i < n; i++) {
      const bird = new THREE.Group();
      const l = new THREE.Mesh(geoL, material);
      const r = new THREE.Mesh(geoR, material);
      bird.add(l, r);
      // loose V: alternate sides, drift back with rank
      const rank = Math.ceil(i / 2);
      const side = i === 0 ? 0 : i % 2 ? 1 : -1;
      bird.userData = {
        ox: -rank * 0.55 * this.dir + (rand() - 0.5) * 0.18,
        oy: (rand() - 0.5) * 0.3,
        oz: side * rank * 0.42 + (rand() - 0.5) * 0.15,
        flapPhase: rand() * Math.PI * 2,
        flapFreq: 7 + rand() * 3,
        wings: [l, r],
      };
      this.birds.push(bird);
      this.group.add(bird);
    }
    scene.add(this.group);
  }

  // returns false when the flock has flown off the far edge
  update(dt, tSec) {
    this.x += this.dir * this.speed * dt;
    for (const b of this.birds) {
      const u = b.userData;
      b.position.set(
        this.x + u.ox,
        this.y + u.oy + Math.sin(tSec * 1.3 + u.flapPhase) * 0.12,
        this.z + u.oz
      );
      const flap = Math.sin(tSec * u.flapFreq + u.flapPhase) * 0.7;
      u.wings[0].rotation.x = flap;
      u.wings[1].rotation.x = -flap;
    }
    return this.dir > 0 ? this.x < EDGE : this.x > -EDGE;
  }

  dispose(scene) {
    scene.remove(this.group);
  }
}

const birdMaterial = new THREE.MeshBasicMaterial({
  color: isDark ? "#b9d8c6" : "#5c675e",
  side: THREE.DoubleSide,
});
let flocks = [];
let nextFlockAt = FIRST_FLOCK;

function updateBirds(elapsedMs, deltaMs) {
  if (elapsedMs >= nextFlockAt) {
    flocks.push(new Flock(scene, birdMaterial, Math.random));
    nextFlockAt =
      elapsedMs + INTERVAL[0] + Math.random() * (INTERVAL[1] - INTERVAL[0]);
  }
  const dt = Math.min(deltaMs, 100) / 1000;
  const tSec = elapsedMs / 1000;
  flocks = flocks.filter((f) => {
    const alive = f.update(dt, tSec);
    if (!alive) f.dispose(scene);
    return alive;
  });
}

/**
 * Controls — mirrors the original "open me!" lil-gui panel
 */
const paramsEl = document.getElementById("params");
const fmt2 = (v) => v.toFixed(2);

Standard.param(paramsEl, params, {
  id: "amp", label: "amp", min: 0.4, max: 2.6, step: 0.01, value: params.amp,
  fmt: fmt2,
  apply: (v) => {
    params.amp = v;
    uniforms.uAmp.value = v;
    // the water level tracks the relief height
    uniforms.uWaterLevel.value = -0.4 * v;
  },
});
Standard.param(paramsEl, params, {
  id: "contour", label: "contour every", min: 0.06, max: 0.4, step: 0.005,
  value: params.contour, fmt: fmt2,
  apply: (v) => {
    params.contour = v;
    uniforms.uContourEvery.value = v;
  },
});
Standard.param(paramsEl, params, {
  id: "lineWidth", label: "line width", min: 0.4, max: 2.4, step: 0.05,
  value: params.lineWidth, fmt: fmt2,
  apply: (v) => {
    params.lineWidth = v;
    uniforms.uLineWidth.value = v;
  },
});
Standard.param(paramsEl, params, {
  id: "fogFar", label: "fog far", min: 16, max: 60, step: 0.5,
  value: params.fogFar, fmt: (v) => v.toFixed(1),
  apply: (v) => {
    params.fogFar = v;
    uniforms.uFogFar.value = v;
    scene.fog.far = v;
  },
});
Standard.param(paramsEl, params, {
  id: "blend", label: "palette blend", min: 0, max: 1, step: 0.01,
  value: params.blend, fmt: fmt2,
  apply: (v) => {
    params.blend = v;
    applyPalette();
  },
});

// push a value back into a slider + its readout (night/day swaps defaults)
function syncSlider(id, v, fmt = fmt2) {
  params[id] = v;
  const el = document.getElementById(id);
  const label = document.getElementById(id + "-value");
  if (el) el.value = v;
  if (label) label.textContent = fmt(v);
}

document.getElementById("regenerate").addEventListener("click", () => {
  uniforms.uSeed.value = Math.random() * 100;
});

const modeBtn = document.getElementById("mode");
modeBtn.addEventListener("click", () => {
  isDark = !isDark;
  const d = isDark ? NIGHT_DEFAULTS : DAY_DEFAULTS;

  // apply that mode's terrain defaults, reflect them into the sliders
  syncSlider("amp", d.amp);
  syncSlider("contour", d.contourEvery);
  uniforms.uAmp.value = d.amp;
  uniforms.uWaterLevel.value = -0.4 * d.amp;
  uniforms.uContourEvery.value = d.contourEvery;
  lineStrength = d.lineStrength;
  uniforms.uLineStrength.value = lineStrength;

  birdMaterial.color.set(isDark ? "#b9d8c6" : "#5c675e");
  document.body.classList.toggle("standard-light", !isDark);
  modeBtn.textContent = isDark ? "day ☀" : "night ☾";
  applyPalette();
});

/**
 * Resize / animate
 */
window.addEventListener("resize", () => {
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;
  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();
  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const deltaMs = clock.getDelta() * 1000;
  const elapsedMs = clock.elapsedTime * 1000;

  uniforms.uTime.value = elapsedMs * 0.001;
  updateFades(elapsedMs);
  updateBirds(elapsedMs, deltaMs);

  // mouse parallax, eased toward the base position
  cam.curX += (start.pos[0] - mouse.x * parallax - cam.curX) * 0.05;
  cam.curY += (start.pos[1] + mouse.y * parallax * 0.6 - cam.curY) * 0.05;
  camera.position.set(cam.curX, cam.curY, start.pos[2]);
  camera.lookAt(...start.look);

  renderer.render(scene, camera);
});
