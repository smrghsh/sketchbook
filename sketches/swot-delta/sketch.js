/* delta breathing — ported from swot-delta-wetlands (vite build).
   256²-segment plane displaced/colored by real SWOT L2_HR_Raster WSE PNGs
   (copied locally); tidal sinusoid (20 s ≈ 12 h) + seasonal lerp across four
   granules (60 s ≈ a year); levee GeoJSON overlaid as lines. Falls back to a
   procedural SWOTDataGenerator if the PNGs fail to load. */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// =============================================================================
// Shaders (inlined from src/Experience/World/shaders/)
// =============================================================================
const terrainVert = /* glsl */ `
uniform sampler2D uTexture;    // WSE frame A
uniform sampler2D uTextureB;   // WSE frame B
uniform sampler2D uTexture2;   // terrain color (unused in vertex)

uniform float uHeightScalar;
uniform float uBlend;

varying vec2  vUv;
varying float vElevation;
varying float vWse;

void main() {
    vUv = uv;

    float wseA = texture2D(uTexture,  uv).r;
    float wseB = texture2D(uTextureB, uv).r;
    float wse  = mix(wseA, wseB, uBlend);

    vWse = wse;

    // 0-1 → meters: -5 m (deep channels) to +15 m (high levees)
    float wseMeter = wse * 20.0 - 5.0;
    vElevation = wseMeter;

    vec3 modifiedPosition = position;
    modifiedPosition.z += wseMeter * uHeightScalar;

    vec4 modelPosition     = modelMatrix      * vec4(modifiedPosition, 1.0);
    vec4 viewPosition      = viewMatrix       * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;
    gl_Position = projectedPosition;
}
`;

const terrainFrag = /* glsl */ `
uniform sampler2D uTexture;
uniform sampler2D uTextureB;
uniform sampler2D uTexture2;

uniform float uBlend;
uniform float uWaterThreshold;
uniform float uWseOffset;
uniform float uTime;

varying vec2  vUv;
varying float vElevation;
varying float vWse;

vec3 waterColor(vec2 uv, float t) {
    vec2 uv1 = uv * 9.0  + vec2(t * 0.035,  t * 0.022);
    vec2 uv2 = uv * 5.5  - vec2(t * 0.028, -t * 0.017);
    float wave1 = sin(uv1.x * 6.28318 + uv1.y * 3.14159) * 0.5 + 0.5;
    float wave2 = sin(uv2.x * 4.71239 - uv2.y * 6.28318) * 0.5 + 0.5;
    float w = wave1 * 0.6 + wave2 * 0.4;

    vec3 shallow = vec3(0.16, 0.52, 0.68);
    vec3 deep    = vec3(0.04, 0.18, 0.42);
    return mix(deep, shallow, w * 0.5 + 0.28);
}

void main() {
    vec3 terrainColor = texture2D(uTexture2, vUv).rgb;

    float waterLevelM = uWaterThreshold * 20.0 - 5.0 + uWseOffset;
    float depth = waterLevelM - vElevation;
    float wetness = smoothstep(-0.05, 0.6, depth);

    vec3 waterCol = waterColor(vUv, uTime);

    float foamBand  = smoothstep(-0.25, 0.0, depth) * smoothstep(0.5, 0.12, depth);
    float foamShimmer = fract(vUv.x * 38.0 + vUv.y * 29.0 - uTime * 0.45);
    float foam = foamBand * step(0.38, foamShimmer) * 0.85;

    vec3 color = mix(terrainColor, waterCol, wetness);
    color = mix(color, vec3(1.0), foam);

    float depthTint = clamp(depth / 4.0, 0.0, 1.0);
    color = mix(color, color * 0.35, wetness * depthTint * 0.6);

    gl_FragColor = vec4(color, 1.0);
}
`;

// =============================================================================
// SWOTDataGenerator — procedural fallback when the local PNGs are unavailable
// =============================================================================
const GEN_SIZE = 512;

function smoothstepJS(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
const mixJS = (a, b, t) => a + (b - a) * t;

class SWOTDataGenerator {
  constructor() {
    this._noise = new Float32Array(GEN_SIZE * GEN_SIZE);
    for (let i = 0; i < this._noise.length; i++) this._noise[i] = Math.random();
  }

  generateTexture(tidalOffset = 0.0, season = 0.0) {
    const data = new Uint8Array(GEN_SIZE * GEN_SIZE * 4);
    const seasonalBase = 0.4 + 0.06 * Math.cos(season * Math.PI * 2.0);
    for (let y = 0; y < GEN_SIZE; y++) {
      for (let x = 0; x < GEN_SIZE; x++) {
        const u = x / GEN_SIZE, v = y / GEN_SIZE;
        const wse = this._computeWSE(u, v, seasonalBase, tidalOffset);
        const encoded = Math.max(0, Math.min(255, Math.round(wse * 255)));
        const i = (y * GEN_SIZE + x) * 4;
        data[i] = encoded; data[i + 1] = encoded; data[i + 2] = encoded; data[i + 3] = 255;
      }
    }
    const tex = new THREE.DataTexture(data, GEN_SIZE, GEN_SIZE, THREE.RGBAFormat);
    tex.needsUpdate = true;
    return tex;
  }

  generateColorTexture() {
    const data = new Uint8Array(GEN_SIZE * GEN_SIZE * 4);
    for (let y = 0; y < GEN_SIZE; y++) {
      for (let x = 0; x < GEN_SIZE; x++) {
        const u = x / GEN_SIZE, v = y / GEN_SIZE;
        const channelMask = this._channelMask(u, v);
        const noise = this._sampleNoise(u * 4, v * 4) * 0.3;
        const i = (y * GEN_SIZE + x) * 4;
        data[i] = Math.round(mixJS(0.55, 0.3 + noise, channelMask) * 255);
        data[i + 1] = Math.round(mixJS(0.48, 0.4 + noise * 0.5, channelMask) * 255);
        data[i + 2] = Math.round(mixJS(0.3, 0.52, channelMask) * 255);
        data[i + 3] = 255;
      }
    }
    const tex = new THREE.DataTexture(data, GEN_SIZE, GEN_SIZE, THREE.RGBAFormat);
    tex.needsUpdate = true;
    return tex;
  }

  _computeWSE(u, v, seasonalBase, tidalOffset) {
    const cx = u - 0.5, cy = v - 0.5;
    const r = Math.sqrt(cx * cx + cy * cy);
    const terrain = smoothstepJS(0.0, 0.45, r) * 0.6 + 0.2;
    const channelDepth = this._channelMask(u, v);
    const carved = terrain - channelDepth * 0.45;
    const microNoise = (this._sampleNoise(u * 12, v * 12) - 0.5) * 0.06;
    const macroNoise = (this._sampleNoise(u * 3, v * 3) - 0.5) * 0.08;
    const wse = carved + seasonalBase * 0.12 + tidalOffset + microNoise + macroNoise;
    return Math.max(0.0, Math.min(1.0, wse));
  }

  _channelMask(u, v) {
    const cx = u - 0.5, cy = v - 0.5;
    const angle = Math.atan2(cy, cx);
    const r = Math.sqrt(cx * cx + cy * cy);
    const channels = [0, 0.52, 1.05, 1.57, 2.62, 3.67, 4.71, 5.76];
    let mask = 0;
    for (const a of channels) {
      const dAngle = Math.abs(((angle - a + Math.PI) % (Math.PI * 2)) - Math.PI);
      const width = 0.06 + 0.04 * (1.0 - r / 0.5);
      const m =
        smoothstepJS(width, 0.0, dAngle) *
        smoothstepJS(0.0, 0.08, r) *
        smoothstepJS(0.5, 0.3, r);
      mask = Math.max(mask, m);
    }
    const riverBand =
      smoothstepJS(0.08, 0.0, Math.abs(v - 0.52)) *
      smoothstepJS(0.0, 0.1, u) *
      smoothstepJS(0.9, 0.7, u);
    mask = Math.max(mask, riverBand * 0.9);
    return Math.max(0, Math.min(1, mask));
  }

  _sampleNoise(x, y) {
    const ix = Math.floor(x) & (GEN_SIZE - 1);
    const iy = Math.floor(y) & (GEN_SIZE - 1);
    return this._noise[iy * GEN_SIZE + ix];
  }
}

// =============================================================================
// Levee network (embedded simplified GeoJSON, from DeltaLevees.js)
// =============================================================================
const LON_MIN = -122.5, LON_MAX = -121.0;
const LAT_MIN = 37.5, LAT_MAX = 38.5;
const WORLD_SIZE = 80;

function geoToXZ(lon, lat) {
  const x = ((lon - LON_MIN) / (LON_MAX - LON_MIN) - 0.5) * WORLD_SIZE;
  const z = -((lat - LAT_MIN) / (LAT_MAX - LAT_MIN) - 0.5) * WORLD_SIZE;
  return [x, z];
}

const LEVEE_GEOJSON = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [
      [-122.42, 38.05], [-122.3, 38.04], [-122.1, 38.03], [-121.9, 38.02],
      [-121.7, 38.01], [-121.55, 38.0],
    ] } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [
      [-122.42, 38.01], [-122.3, 38.0], [-122.1, 37.99], [-121.9, 37.98],
      [-121.7, 37.97], [-121.55, 37.97],
    ] } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [
      [-121.55, 37.97], [-121.62, 37.93], [-121.72, 37.88], [-121.85, 37.84],
    ] } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [
      [-121.83, 38.05], [-121.78, 38.02], [-121.73, 38.0], [-121.76, 37.97],
      [-121.82, 37.96], [-121.87, 37.98], [-121.88, 38.02], [-121.83, 38.05],
    ] } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [
      [-121.66, 38.04], [-121.61, 38.03], [-121.58, 38.01], [-121.6, 37.98],
      [-121.65, 37.97], [-121.7, 37.98], [-121.71, 38.02], [-121.66, 38.04],
    ] } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [
      [-121.65, 37.99], [-121.61, 37.96], [-121.6, 37.93], [-121.64, 37.92],
      [-121.68, 37.93], [-121.68, 37.97], [-121.65, 37.99],
    ] } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [
      [-121.73, 37.98], [-121.69, 37.97], [-121.68, 37.93], [-121.72, 37.92],
      [-121.76, 37.93], [-121.76, 37.97], [-121.73, 37.98],
    ] } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [
      [-121.76, 38.03], [-121.72, 38.01], [-121.7, 37.98], [-121.73, 37.97],
      [-121.78, 37.98], [-121.79, 38.01], [-121.76, 38.03],
    ] } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [
      [-121.65, 38.04], [-121.59, 38.04], [-121.57, 38.01], [-121.6, 37.99],
      [-121.64, 38.0], [-121.66, 38.03], [-121.65, 38.04],
    ] } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [
      [-121.89, 38.01], [-121.84, 38.0], [-121.83, 37.97], [-121.87, 37.96],
      [-121.91, 37.97], [-121.92, 38.0], [-121.89, 38.01],
    ] } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [
      [-121.55, 38.03], [-121.5, 38.02], [-121.48, 37.97], [-121.52, 37.93],
      [-121.58, 37.92], [-121.62, 37.93], [-121.63, 37.97], [-121.6, 38.01],
      [-121.55, 38.03],
    ] } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [
      [-121.58, 38.1], [-121.52, 38.08], [-121.49, 38.04], [-121.53, 38.01],
      [-121.58, 38.02], [-121.61, 38.05], [-121.6, 38.09], [-121.58, 38.1],
    ] } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [
      [-121.52, 38.16], [-121.47, 38.13], [-121.46, 38.09], [-121.5, 38.07],
      [-121.55, 38.08], [-121.56, 38.12], [-121.54, 38.16], [-121.52, 38.16],
    ] } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [
      [-121.43, 38.08], [-121.38, 38.06], [-121.37, 38.02], [-121.41, 38.0],
      [-121.46, 38.01], [-121.47, 38.05], [-121.45, 38.08], [-121.43, 38.08],
    ] } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [
      [-121.65, 38.18], [-121.57, 38.16], [-121.53, 38.12], [-121.55, 38.08],
      [-121.62, 38.07], [-121.68, 38.09], [-121.7, 38.14], [-121.67, 38.18],
      [-121.65, 38.18],
    ] } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [
      [-121.72, 38.18], [-121.68, 38.15], [-121.67, 38.1], [-121.72, 38.08],
      [-121.77, 38.09], [-121.78, 38.14], [-121.75, 38.18], [-121.72, 38.18],
    ] } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [
      [-121.7, 37.97], [-121.66, 37.95], [-121.65, 37.91], [-121.7, 37.9],
      [-121.74, 37.91], [-121.74, 37.95], [-121.7, 37.97],
    ] } },
  ],
};

// =============================================================================
// Scene
// =============================================================================
const SEGMENTS = 256;
const PLANE_SIZE = 80;

const params = {
  tide: 1.0,
  season: 1.0,
  displace: 0.08,
  waterThreshold: 0.42,
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050d1a);
scene.fog = new THREE.FogExp2(0x050d1a, 0.004);

const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 2000);
camera.position.set(0, 28, 38); // bird's-eye on the Delta, looking north
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxPolarAngle = Math.PI * 0.48;
controls.minDistance = 4;
controls.maxDistance = 180;
controls.target.set(0, 0, 0);

// ── Load the real SWOT rasters; fall back to the procedural generator ───────
function loadTexture(path) {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(path, resolve, undefined, reject);
  });
}

async function loadFrames() {
  try {
    const [winter, spring, summer, fall, color] = await Promise.all([
      loadTexture('textures/swot_winter_wse.png'),
      loadTexture('textures/swot_spring_wse.png'),
      loadTexture('textures/swot_summer_wse.png'),
      loadTexture('textures/swot_fall_wse.png'),
      loadTexture('textures/swot_terrain_color.png'),
    ]);
    return {
      frames: [
        { tex: winter, season: 0.0 }, { tex: winter, season: 0.0 },
        { tex: spring, season: 0.25 }, { tex: spring, season: 0.25 },
        { tex: summer, season: 0.5 }, { tex: summer, season: 0.5 },
        { tex: fall, season: 0.75 }, { tex: fall, season: 0.75 },
      ],
      terrainColor: color,
    };
  } catch (e) {
    console.warn('SWOT PNGs unavailable — generating synthetic rasters:', e);
    const gen = new SWOTDataGenerator();
    const cfgs = [
      { season: 0.0, tidalOffset: 0.07 }, { season: 0.0, tidalOffset: 0.0 },
      { season: 0.25, tidalOffset: 0.07 }, { season: 0.25, tidalOffset: 0.0 },
      { season: 0.5, tidalOffset: 0.07 }, { season: 0.5, tidalOffset: 0.0 },
      { season: 0.75, tidalOffset: 0.07 }, { season: 0.75, tidalOffset: 0.0 },
    ];
    return {
      frames: cfgs.map((c) => ({
        tex: gen.generateTexture(c.tidalOffset, c.season),
        season: c.season,
      })),
      terrainColor: gen.generateColorTexture(),
    };
  }
}

const { frames, terrainColor } = await loadFrames();

// ── Terrain mesh ────────────────────────────────────────────────────────────
const material = new THREE.ShaderMaterial({
  vertexShader: terrainVert,
  fragmentShader: terrainFrag,
  uniforms: {
    uTexture: { value: frames[0].tex },
    uTextureB: { value: frames[1].tex },
    uTexture2: { value: terrainColor },
    uHeightScalar: { value: params.displace },
    uBlend: { value: 0.0 },
    uWaterThreshold: { value: params.waterThreshold },
    uWseOffset: { value: 0.0 },
    uTime: { value: 0.0 },
  },
});

const mesh = new THREE.Mesh(
  new THREE.PlaneGeometry(PLANE_SIZE, PLANE_SIZE, SEGMENTS, SEGMENTS),
  material
);
mesh.rotation.x = -Math.PI / 2;
scene.add(mesh);

// ── Levee lines ─────────────────────────────────────────────────────────────
{
  const positions = [];
  for (const feature of LEVEE_GEOJSON.features) {
    const coords = feature.geometry.coordinates;
    for (let i = 0; i < coords.length - 1; i++) {
      const [x0, z0] = geoToXZ(coords[i][0], coords[i][1]);
      const [x1, z1] = geoToXZ(coords[i + 1][0], coords[i + 1][1]);
      positions.push(x0, 0.18, z0, x1, 0.18, z1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  scene.add(
    new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({
        color: 0xd4a96a, // warm ochre — levee earthwork
        transparent: true,
        opacity: 0.75,
      })
    )
  );
}

// ── Chrome wiring ───────────────────────────────────────────────────────────
let paused = false;
Standard.bind(params, 'tide', (v) => v.toFixed(1), (v) => (params.tide = v));
Standard.bind(params, 'season', (v) => v.toFixed(1), (v) => (params.season = v));
Standard.bind(params, 'displace', (v) => v.toFixed(3), (v) => {
  material.uniforms.uHeightScalar.value = v;
});
const pauseBtn = document.getElementById('pause');
pauseBtn.addEventListener('click', () => {
  paused = !paused;
  pauseBtn.textContent = paused ? 'play ✦' : 'pause ✦';
  pauseBtn.classList.toggle('active', paused);
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ── Animate ─────────────────────────────────────────────────────────────────
// Tidal cycle: 20 s ≈ 12 h. Season cycle: 60 s ≈ a full year.
let tidalTime = 0;
let seasonTime = 0;
let animTime = 0;
const clock = new THREE.Clock();

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  if (!paused) {
    tidalTime += dt * params.tide;
    seasonTime += dt * params.season;
    animTime += dt;
    material.uniforms.uTime.value = animTime;

    const tidalT = (tidalTime / 20.0) % 1.0;
    const seasonT = (seasonTime / 60.0) % 1.0;

    const seasonIdx = Math.floor(seasonT * 4) * 2;
    const nextSeasonIdx = ((Math.floor(seasonT * 4) + 1) % 4) * 2;
    const tidalBlend = Math.sin(tidalT * Math.PI * 2.0) * 0.5 + 0.5;
    const frameA = seasonIdx + (tidalBlend > 0.5 ? 1 : 0);
    const frameB = nextSeasonIdx + (tidalBlend > 0.5 ? 1 : 0);
    const crossBlend = (seasonT * 4) % 1.0;

    material.uniforms.uTexture.value = frames[frameA].tex;
    material.uniforms.uTextureB.value = frames[frameB].tex;
    material.uniforms.uBlend.value = crossBlend;

    // Tidal breathing: ±2 cm on the water threshold
    material.uniforms.uWaterThreshold.value =
      params.waterThreshold + tidalBlend * 0.04 - 0.02;
  }
  controls.update();
  renderer.render(scene, camera);
});
