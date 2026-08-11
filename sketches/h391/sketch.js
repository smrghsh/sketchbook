/* h391 — elephant seal 3D dive trace.
   Ported from southern-elephant-seals/eseal-animation (single-file build).
   Bathymetry: NOAA CUDEM export → terrarium tiles → synthetic (offline). */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Water } from 'three/addons/objects/Water.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { fromArrayBuffer as geotiffFromArrayBuffer } from 'https://cdn.jsdelivr.net/npm/geotiff@2.1.3/+esm';
import SunCalc from 'https://cdn.jsdelivr.net/npm/suncalc@1.9.0/+esm';

const modal = document.getElementById('modal');
const progressEl = document.getElementById('load-progress');
const setProgress = (msg) => { progressEl.textContent = msg; };
const hideModal = () => { modal.classList.remove('visible'); };

const fmtDate = (ms) => new Date(ms).toISOString().replace('T', ' ').slice(0, 16) + 'Z';

// =============================================================================
// Tiles → elevation grid
// =============================================================================
const BBOX = { lat0: 36.0, lat1: 44.0, lon0: -127.5, lon1: -121.5 };
const ZOOM = 8;
const TILE = 256;
const NOAA_DEM_EXPORT_SERVICE =
  'https://gis.ngdc.noaa.gov/arcgis/rest/services/DEM_mosaics/DEM_all/ImageServer/exportImage';
const NOAA_SAMPLE_GRID = 2048; // 4096 in the original; 2048 keeps load ~4 s
const NOAA_TIMEOUT_MS = 12000;

const rad = (d) => (d * Math.PI) / 180;
const lon2tileX = (lon, z) => Math.floor(((lon + 180) / 360) * Math.pow(2, z));
const lat2tileY = (lat, z) =>
  Math.floor(
    ((1 - Math.log(Math.tan(rad(lat)) + 1 / Math.cos(rad(lat))) / Math.PI) / 2) *
      Math.pow(2, z)
  );
const tileX2lon = (x, z) => (x / Math.pow(2, z)) * 360 - 180;
const tileY2lat = (y, z) => {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
};

async function loadTileElevation(z, x, y) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = TILE;
      const ctx = cv.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, TILE, TILE).data;
      const out = new Float32Array(TILE * TILE);
      for (let i = 0, j = 0; i < data.length; i += 4, j++) {
        out[j] = data[i] * 256 + data[i + 1] + data[i + 2] / 256 - 32768;
      }
      resolve(out);
    };
    img.onerror = () => reject(new Error(`tile ${z}/${x}/${y} failed`));
    img.src = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
  });
}

async function buildElevationGrid() {
  const xMin = lon2tileX(BBOX.lon0, ZOOM);
  const xMax = lon2tileX(BBOX.lon1, ZOOM);
  const yMin = lat2tileY(BBOX.lat1, ZOOM);
  const yMax = lat2tileY(BBOX.lat0, ZOOM);
  const nx = (xMax - xMin + 1) * TILE;
  const ny = (yMax - yMin + 1) * TILE;
  setProgress(`fetching ${(xMax - xMin + 1) * (yMax - yMin + 1)} elevation tiles…`);

  const grid = new Float32Array(nx * ny);
  const promises = [];
  for (let ty = yMin; ty <= yMax; ty++) {
    for (let tx = xMin; tx <= xMax; tx++) {
      promises.push(
        loadTileElevation(ZOOM, tx, ty).then((tile) => {
          const ox = (tx - xMin) * TILE;
          const oy = (ty - yMin) * TILE;
          for (let j = 0; j < TILE; j++) {
            for (let i = 0; i < TILE; i++) {
              grid[(oy + j) * nx + (ox + i)] = tile[j * TILE + i];
            }
          }
        })
      );
    }
  }
  await Promise.all(promises);
  return {
    grid, nx, ny,
    lonW: tileX2lon(xMin, ZOOM),
    lonE: tileX2lon(xMax + 1, ZOOM),
    latN: tileY2lat(yMin, ZOOM),
    latS: tileY2lat(yMax + 1, ZOOM),
  };
}

function inpaintGridNearest(grid, nx, ny) {
  for (let y = 0; y < ny; y++) {
    let last = NaN;
    for (let x = 0; x < nx; x++) {
      const k = y * nx + x;
      if (Number.isFinite(grid[k])) last = grid[k];
      else if (Number.isFinite(last)) grid[k] = last;
    }
    last = NaN;
    for (let x = nx - 1; x >= 0; x--) {
      const k = y * nx + x;
      if (Number.isFinite(grid[k])) last = grid[k];
      else if (Number.isFinite(last)) grid[k] = last;
    }
  }
  for (let x = 0; x < nx; x++) {
    let last = NaN;
    for (let y = 0; y < ny; y++) {
      const k = y * nx + x;
      if (Number.isFinite(grid[k])) last = grid[k];
      else if (Number.isFinite(last)) grid[k] = last;
    }
    last = NaN;
    for (let y = ny - 1; y >= 0; y--) {
      const k = y * nx + x;
      if (Number.isFinite(grid[k])) last = grid[k];
      else if (Number.isFinite(last)) grid[k] = last;
    }
  }
}

function gridQuality(grid) {
  let invalid = 0, min = Infinity, max = -Infinity;
  for (let i = 0; i < grid.length; i++) {
    const v = grid[i];
    if (!Number.isFinite(v)) { invalid++; continue; }
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { invalidFraction: invalid / grid.length, min, max };
}

async function buildElevationGridNoaa() {
  const nx = NOAA_SAMPLE_GRID, ny = NOAA_SAMPLE_GRID;
  const lonW = BBOX.lon0, lonE = BBOX.lon1, latN = BBOX.lat1, latS = BBOX.lat0;
  setProgress('fetching NOAA CUDEM raster…');
  const params = new URLSearchParams({
    bbox: `${lonW},${latS},${lonE},${latN}`,
    bboxSR: '4326',
    imageSR: '4326',
    size: `${nx},${ny}`,
    format: 'tiff',
    pixelType: 'F32',
    interpolation: 'RSP_BilinearInterpolation',
    noData: '-99999',
    noDataInterpretation: 'esriNoDataMatchAny',
    renderingRule: '{"rasterFunction":"None"}',
    f: 'image',
  });
  const r = await fetch(`${NOAA_DEM_EXPORT_SERVICE}?${params.toString()}`, {
    signal: AbortSignal.timeout(NOAA_TIMEOUT_MS),
  });
  if (!r.ok) throw new Error(`NOAA exportImage failed: ${r.status}`);
  const buf = await r.arrayBuffer();
  const tiff = await geotiffFromArrayBuffer(buf);
  const image = await tiff.getImage();
  const w = image.getWidth();
  const h = image.getHeight();
  const bbox = image.getBoundingBox(); // [xmin, ymin, xmax, ymax]
  const ras = await image.readRasters({ interleave: true });
  if (w * h !== ras.length) throw new Error('NOAA GeoTIFF size mismatch');
  const grid = new Float32Array(ras.length);
  for (let i = 0; i < ras.length; i++) {
    const v = Number(ras[i]);
    grid[i] = Number.isFinite(v) && v > -20000 && v < 20000 ? v : NaN;
  }
  inpaintGridNearest(grid, w, h);
  const q = gridQuality(grid);
  if (
    q.invalidFraction > 0.005 || !Number.isFinite(q.min) ||
    !Number.isFinite(q.max) || q.min < -12000 || q.max > 9000
  ) {
    throw new Error('NOAA grid failed quality checks');
  }
  return { grid, nx: w, ny: h, lonW: bbox[0], lonE: bbox[2], latN: bbox[3], latS: bbox[1] };
}

// Synthetic fallback — plausible shelf/slope bathymetry so the piece still
// renders fully offline (dive ribbon, sky, water all remain).
function buildElevationGridSynthetic() {
  const nx = 512, ny = 512;
  const lonW = BBOX.lon0, lonE = BBOX.lon1, latN = BBOX.lat1, latS = BBOX.lat0;
  const grid = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    const lat = latN - (j / (ny - 1)) * (latN - latS);
    for (let i = 0; i < nx; i++) {
      const lon = lonW + (i / (nx - 1)) * (lonE - lonW);
      const coast = -122.1 - 0.35 * Math.sin((lat - 36) * 1.1); // rough CA/OR coastline
      const d = lon - coast; // >0 on land
      let e;
      if (d >= 0) {
        e = 60 + 900 * d + 220 * Math.sin(lon * 6.3) * Math.sin(lat * 4.7) * Math.min(1, d);
      } else {
        const t = Math.min(1, -d / 2.8);
        e = -25 - 3900 * t * t;
        e += 260 * Math.sin(lon * 3.1) * Math.sin(lat * 2.7) * t;
      }
      grid[j * nx + i] = e;
    }
  }
  return { grid, nx, ny, lonW, lonE, latN, latS };
}

// =============================================================================
// Coordinate frame  (x east km, y up km·VEX, z south km)
// =============================================================================
const KM_PER_DEG = 111.32;
let VEX = 5;
let latCenter, lonCenter, cosLat;
function project(lon, lat, elev_m) {
  return new THREE.Vector3(
    (lon - lonCenter) * cosLat * KM_PER_DEG,
    (elev_m / 1000) * VEX,
    -(lat - latCenter) * KM_PER_DEG
  );
}

// =============================================================================
// Main
// =============================================================================
(async function main() {
  let bouts, locations, depth, sealMeta, settings = {};
  try {
    [sealMeta, bouts, locations, depth] = await Promise.all([
      fetch('data/h391_meta.json').then((r) => r.json()),
      fetch('data/sw_bouts.json').then((r) => r.json()),
      fetch('data/h391_locations.json').then((r) => r.json()),
      fetch('data/h391_depth.json').then((r) => r.json()),
    ]);
  } catch (e) {
    setProgress('failed to load dive data — serve over http');
    throw e;
  }
  try {
    settings = await fetch('data/settings.json').then((r) => r.json());
  } catch (_) { /* authored defaults baked in below */ }

  latCenter = (BBOX.lat0 + BBOX.lat1) / 2;
  lonCenter = (BBOX.lon0 + BBOX.lon1) / 2;
  cosLat = Math.cos(rad(latCenter));

  // Trip apex → default follow-cam distance keyframes.
  let tNorth = locations[0].t, maxLatT = locations[0].lat;
  for (const l of locations) {
    if (l.lat > maxLatT) { maxLatT = l.lat; tNorth = l.t; }
  }
  const T0 = Math.max(depth[0].t, locations[0].t);
  const T1 = Math.min(depth[depth.length - 1].t, locations[locations.length - 1].t);
  const tDepartMid = T0 + (tNorth - T0) * 0.5;
  const tReturnMid = tNorth + (T1 - tNorth) * 0.5;
  const camKeys = [
    { t: T0, dist: 60 },
    { t: tDepartMid, dist: 380 },
    { t: tNorth, dist: 80 },
    { t: tReturnMid, dist: 380 },
    { t: T1, dist: 60 },
  ];
  function camDistAt(t) {
    if (t <= camKeys[0].t) return camKeys[0].dist;
    if (t >= camKeys.at(-1).t) return camKeys.at(-1).dist;
    for (let i = 0; i < camKeys.length - 1; i++) {
      const a = camKeys[i], b = camKeys[i + 1];
      if (t >= a.t && t <= b.t) {
        const f = (t - a.t) / (b.t - a.t);
        const s = f * f * (3 - 2 * f);
        return a.dist * (1 - s) + b.dist * s;
      }
    }
    return camKeys[0].dist;
  }

  // ---------------------------------------------------------------------------
  // three.js scene
  // ---------------------------------------------------------------------------
  const W = () => innerWidth;
  const H = () => innerHeight;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x131c2e);
  const camera = new THREE.PerspectiveCamera(45, W() / H(), 1, 5000);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(W(), H());
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.5;
  document.body.appendChild(renderer.domElement);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(W(), H()),
    settings.bloomStr ?? 0.3,
    settings.bloomRad ?? 0.4,
    settings.bloomThr ?? 0.55
  );
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());

  const controls = new OrbitControls(camera, renderer.domElement);

  const start = locations[0];
  const startPos = project(start.lon, start.lat, 0);
  controls.target.copy(startPos);
  camera.position.set(startPos.x - 30, startPos.y + 30, startPos.z + 50);
  controls.update();

  // Sky + sun (position driven by SunCalc from playback time)
  const sky = new Sky();
  sky.scale.setScalar(4500);
  scene.add(sky);
  const skyUniforms = sky.material.uniforms;
  skyUniforms.turbidity.value = settings.skyTurbidity ?? 6.0;
  skyUniforms.rayleigh.value = settings.skyRayleigh ?? 1.3;
  skyUniforms.mieCoefficient.value = settings.skyMieCoeff ?? 0.005;
  skyUniforms.mieDirectionalG.value = settings.skyMieG ?? 0.8;

  scene.add(new THREE.AmbientLight(0x1a2a40, 0.4));
  const dirLight = new THREE.DirectionalLight(0xfff4e0, 1.2);
  scene.add(dirLight);

  const sunVec = new THREE.Vector3();
  const skyGeo = { lat: 37.1085, lon: -122.337 };
  function updateSun(tMs) {
    const pos = SunCalc.getPosition(new Date(tMs), skyGeo.lat, skyGeo.lon);
    const elev = THREE.MathUtils.radToDeg(pos.altitude);
    const azim = ((THREE.MathUtils.radToDeg(pos.azimuth) + 180 + 540) % 360) - 180;
    const phi = THREE.MathUtils.degToRad(90 - elev);
    const theta = THREE.MathUtils.degToRad(azim);
    sunVec.setFromSphericalCoords(1, phi, theta);
    skyUniforms.sunPosition.value.copy(sunVec);
    dirLight.position.copy(sunVec).multiplyScalar(500);
    water.material.uniforms.sunDirection.value
      .set(sunVec.x, Math.abs(sunVec.y) + 0.05, sunVec.z)
      .normalize();
  }

  // ---------------------------------------------------------------------------
  // Bathymetry mesh — NOAA → terrarium → synthetic
  // ---------------------------------------------------------------------------
  let elevData;
  try {
    elevData = await buildElevationGridNoaa();
  } catch (e) {
    console.warn('NOAA CUDEM failed, falling back to terrarium:', e);
    try {
      elevData = await buildElevationGrid();
    } catch (e2) {
      console.warn('terrarium tiles failed, using synthetic bathymetry:', e2);
      elevData = buildElevationGridSynthetic();
    }
  }
  const { grid, nx, ny, lonW, lonE, latN, latS } = elevData;

  const STEP = nx >= 2000 ? 2 : 1;
  const mx = Math.floor(nx / STEP);
  const my = Math.floor(ny / STEP);
  const widthKm = (lonE - lonW) * cosLat * KM_PER_DEG;
  const heightKm = (latN - latS) * KM_PER_DEG;
  const geo = new THREE.PlaneGeometry(widthKm, heightKm, mx - 1, my - 1);
  geo.rotateX(-Math.PI / 2);
  const positions = geo.attributes.position.array;

  const offsetX = ((lonW + lonE) / 2 - lonCenter) * cosLat * KM_PER_DEG;
  const offsetZ = -((latN + latS) / 2 - latCenter) * KM_PER_DEG;
  geo.translate(offsetX, 0, offsetZ);

  const elevAttr = new Float32Array(mx * my);
  for (let j = 0; j < my; j++) {
    for (let i = 0; i < mx; i++) {
      const gi = Math.min(nx - 1, i * STEP);
      const gj = Math.min(ny - 1, j * STEP);
      const e = grid[gj * nx + gi];
      const vi = j * mx + i;
      elevAttr[vi] = e;
      positions[vi * 3 + 1] = (e / 1000) * VEX;
    }
  }
  geo.setAttribute('elev', new THREE.BufferAttribute(elevAttr, 1));
  geo.computeVertexNormals();

  const S = settings;
  const terrainMat = new THREE.ShaderMaterial({
    uniforms: {
      lightDir: { value: new THREE.Vector3(-0.4, 0.85, 0.35).normalize() },
      landC0: { value: new THREE.Color(S.landC0 ?? '#dbdbdb') },
      landC1: { value: new THREE.Color(S.landC1 ?? '#4f4f4f') },
      landC2: { value: new THREE.Color(S.landC2 ?? '#696969') },
      landC3: { value: new THREE.Color(S.landC3 ?? '#6b7a6e') },
      landC4: { value: new THREE.Color(S.landC4 ?? '#4b716b') },
      landC5: { value: new THREE.Color(S.landC5 ?? '#274844') },
      landC6: { value: new THREE.Color(S.landC6 ?? '#a3a3a3') },
      landC7: { value: new THREE.Color(S.landC7 ?? '#ffffff') },
      landC8: { value: new THREE.Color(S.landC8 ?? '#adebff') },
    },
    vertexShader: /* glsl */ `
      attribute float elev;
      varying float vElev;
      varying vec3 vNormal;
      void main() {
        vElev = elev;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying float vElev;
      varying vec3 vNormal;
      uniform vec3 lightDir;
      uniform vec3 landC0; uniform vec3 landC1; uniform vec3 landC2;
      uniform vec3 landC3; uniform vec3 landC4; uniform vec3 landC5;
      uniform vec3 landC6; uniform vec3 landC7; uniform vec3 landC8;

      vec3 hex(float r, float g, float b) { return vec3(r,g,b)/255.0; }

      vec3 oceanRamp(float depth_m) {
        vec3 c1 = hex(10.0,  31.0,  61.0);
        vec3 c2 = hex(28.0,  61.0, 107.0);
        vec3 c3 = hex(45.0,  90.0, 143.0);
        vec3 c4 = hex(63.0, 124.0, 178.0);
        vec3 c5 = hex(91.0, 160.0, 201.0);
        vec3 c6 = hex(135.0,191.0, 214.0);
        vec3 c7 = hex(194.0,223.0, 229.0);
        vec3 c8 = hex(216.0,236.0, 236.0);
        float d = depth_m;
        if (d > 4000.0) return mix(c1, c2, smoothstep(8000.0, 4000.0, d));
        if (d > 2000.0) return mix(c2, c3, smoothstep(4000.0, 2000.0, d));
        if (d > 1000.0) return mix(c3, c4, smoothstep(2000.0, 1000.0, d));
        if (d >  500.0) return mix(c4, c5, smoothstep(1000.0,  500.0, d));
        if (d >  250.0) return mix(c5, c6, smoothstep( 500.0,  250.0, d));
        if (d >   10.0) return mix(c6, c7, smoothstep( 250.0,   10.0, d));
        return mix(c7, c8, smoothstep(10.0, 0.0, d));
      }

      vec3 landRamp(float e) {
        if (e <   10.0) return mix(landC0, landC1, smoothstep(   0.0,   10.0, e));
        if (e <   50.0) return mix(landC1, landC2, smoothstep(  10.0,   50.0, e));
        if (e <  250.0) return mix(landC2, landC3, smoothstep(  50.0,  250.0, e));
        if (e <  500.0) return mix(landC3, landC4, smoothstep( 250.0,  500.0, e));
        if (e < 1000.0) return mix(landC4, landC5, smoothstep( 500.0, 1000.0, e));
        if (e < 2000.0) return mix(landC5, landC6, smoothstep(1000.0, 2000.0, e));
        if (e < 4000.0) return mix(landC6, landC7, smoothstep(2000.0, 4000.0, e));
        return mix(landC7, landC8, smoothstep(4000.0, 8000.0, e));
      }

      void main() {
        vec3 base;
        if (vElev < 0.0) base = oceanRamp(-vElev);
        else if (vElev < 5.0) base = landC0;
        else base = landRamp(vElev);
        float lam = clamp(dot(normalize(vNormal), lightDir), 0.0, 1.0);
        base *= 0.55 + 0.55 * lam;
        gl_FragColor = vec4(base, 1.0);
      }
    `,
    side: THREE.FrontSide,
  });

  const terrain = new THREE.Mesh(geo, terrainMat);
  scene.add(terrain);

  // ---------------------------------------------------------------------------
  // Ocean water plane
  // ---------------------------------------------------------------------------
  const waterNormals = new THREE.TextureLoader().load('waternormals.jpg', (tex) => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  });
  const oceanGeo = new THREE.PlaneGeometry(widthKm, heightKm);
  oceanGeo.rotateX(-Math.PI / 2);
  oceanGeo.translate(offsetX, 0, offsetZ);
  const water = new Water(oceanGeo, {
    textureWidth: 512,
    textureHeight: 512,
    waterNormals,
    sunDirection: new THREE.Vector3(-0.4, 0.85, 0.35).normalize(),
    sunColor: new THREE.Color(S.wSunColor ?? '#ffffff').getHex(),
    waterColor: new THREE.Color(S.wColor ?? '#0a2a4a').getHex(),
    distortionScale: S.wDistortion ?? 3.0,
    alpha: S.wAlpha ?? 0.72,
    fog: false,
  });
  water.material.transparent = true;
  water.material.depthWrite = false;
  water.material.side = THREE.DoubleSide;
  water.material.uniforms.size.value = S.wSize ?? 20.0;
  let waterSpeed = S.wSpeed ?? 0.5;
  water.position.y = 0.01;
  const _waterOnBeforeRender = water.onBeforeRender.bind(water);
  water.onBeforeRender = function (renderer, scene, cam, geo, mat, group) {
    terrain.visible = false;
    _waterOnBeforeRender(renderer, scene, cam, geo, mat, group);
    terrain.visible = true;
  };
  scene.add(water);

  // ---------------------------------------------------------------------------
  // Seal location interpolation + 3D dive path
  // ---------------------------------------------------------------------------
  function interpolatePosition(tMs) {
    if (tMs <= locations[0].t) return [locations[0].lat, locations[0].lon];
    const last = locations[locations.length - 1];
    if (tMs >= last.t) return [last.lat, last.lon];
    let lo = 0, hi = locations.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (locations[m].t <= tMs) lo = m; else hi = m;
    }
    const a = locations[lo], b = locations[hi];
    const f = (tMs - a.t) / (b.t - a.t);
    return [a.lat + (b.lat - a.lat) * f, a.lon + (b.lon - a.lon) * f];
  }

  const depthInRange = depth.filter((p) => p.t >= T0 && p.t <= T1);

  let tailDays = S.trTail ?? 15;
  let ghostDays = S.trGhost ?? 30;
  let tailOpacity = S.trTailOp ?? 1.0;
  let ghostOpacity = S.trMinOp ?? S.trGhostOp ?? 0.18;
  let orbRadius = S.trOrbR ?? 1.0;
  let ribbonWidthPx = S.trRibbonW ?? 3.0;

  function terrainElevAt(lon, lat) {
    const fx = ((lon - lonW) / (lonE - lonW)) * (nx - 1);
    const fy = ((latN - lat) / (latN - latS)) * (ny - 1);
    const x0 = Math.max(0, Math.min(nx - 2, Math.floor(fx)));
    const y0 = Math.max(0, Math.min(ny - 2, Math.floor(fy)));
    const tx = fx - x0, ty = fy - y0;
    const s00 = grid[y0 * nx + x0], s10 = grid[y0 * nx + x0 + 1];
    const s01 = grid[(y0 + 1) * nx + x0], s11 = grid[(y0 + 1) * nx + x0 + 1];
    return s00 * (1 - tx) * (1 - ty) + s10 * tx * (1 - ty) + s01 * (1 - tx) * ty + s11 * tx * ty;
  }

  // Screen-space constant-width ribbon shaders (age-faded).
  const TRACK_VERT = /* glsl */ `
    attribute float tVal;
    attribute vec3 trackColor;
    attribute vec3 prevPos;
    attribute vec3 nextPos;
    attribute float side;
    varying vec3 vColor;
    varying float vAge;
    varying float vBrightness;
    uniform float currentT;
    uniform float tailSec;
    uniform float ribbonWidth;
    uniform vec2 resolution;
    void main() {
      vColor = trackColor;
      vAge = currentT - tVal;
      float ageFrac = clamp(vAge / max(tailSec, 1.0), 0.0, 1.0);
      vBrightness = mix(3.5, 1.0, ageFrac);

      mat4 mvp = projectionMatrix * modelViewMatrix;
      vec4 cClip = mvp * vec4(position, 1.0);
      vec4 pClip = mvp * vec4(prevPos,  1.0);
      vec4 nClip = mvp * vec4(nextPos,  1.0);

      vec2 cPx = (cClip.xy / cClip.w) * resolution * 0.5;
      vec2 pPx = (pClip.xy / pClip.w) * resolution * 0.5;
      vec2 nPx = (nClip.xy / nClip.w) * resolution * 0.5;

      vec2 dPrev = cPx - pPx;
      vec2 dNext = nPx - cPx;
      vec2 nA = length(dPrev) > 0.5 ? normalize(vec2(-dPrev.y, dPrev.x)) : vec2(0.0);
      vec2 nB = length(dNext) > 0.5 ? normalize(vec2(-dNext.y, dNext.x)) : vec2(0.0);
      vec2 miter = normalize(nA + nB + vec2(1e-7, 0.0));
      vec2 tB = length(dNext) > 0.5 ? normalize(dNext) : normalize(dPrev);
      float miterScale = 1.0 / max(abs(dot(miter, vec2(-tB.y, tB.x))), 0.35);
      miterScale = min(miterScale, 3.0);

      vec2 offsetPx = miter * (ribbonWidth * 0.5) * miterScale * side;
      vec2 offsetNDC = offsetPx / (resolution * 0.5);
      gl_Position = vec4(cClip.xy + offsetNDC * cClip.w, cClip.z, cClip.w);
    }
  `;
  const TRACK_FRAG = /* glsl */ `
    precision highp float;
    varying vec3 vColor;
    varying float vAge;
    varying float vBrightness;
    uniform float tailSec;
    uniform float ghostSec;
    uniform float tailOpacity;
    uniform float ghostOpacity;
    void main() {
      if (vAge < 0.0) discard;
      float alpha;
      float ageFrac = clamp(vAge / max(tailSec, 1.0), 0.0, 1.0);
      float anteriorOpacity = mix(1.0, tailOpacity, ageFrac);
      if (vAge <= tailSec) {
        alpha = anteriorOpacity;
      } else if (ghostSec > 0.0 && vAge <= tailSec + ghostSec) {
        float f = (vAge - tailSec) / ghostSec;
        alpha = mix(tailOpacity, ghostOpacity, f);
      } else {
        discard;
      }
      gl_FragColor = vec4(vColor * vBrightness, alpha);
    }
  `;

  const SEC_PER_DAY = 86400;

  function buildRibbonGeom(pts, colors, times) {
    const N = pts.length / 3;
    const pos = new Float32Array(N * 2 * 3);
    const prev = new Float32Array(N * 2 * 3);
    const next = new Float32Array(N * 2 * 3);
    const col = new Float32Array(N * 2 * 3);
    const tv = new Float32Array(N * 2);
    const sid = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) {
      const iPrev = Math.max(0, i - 1);
      const iNext = Math.min(N - 1, i + 1);
      for (let s = 0; s < 2; s++) {
        const vi = i * 2 + s;
        for (let k = 0; k < 3; k++) {
          pos[vi * 3 + k] = pts[i * 3 + k];
          prev[vi * 3 + k] = pts[iPrev * 3 + k];
          next[vi * 3 + k] = pts[iNext * 3 + k];
          col[vi * 3 + k] = colors[i * 3 + k];
        }
        tv[vi] = times[i];
        sid[vi] = s === 0 ? 1.0 : -1.0;
      }
    }
    const idx = new Uint32Array((N - 1) * 6);
    for (let i = 0; i < N - 1; i++) {
      const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2, d = (i + 1) * 2 + 1;
      idx[i * 6 + 0] = a; idx[i * 6 + 1] = b; idx[i * 6 + 2] = c;
      idx[i * 6 + 3] = b; idx[i * 6 + 4] = d; idx[i * 6 + 5] = c;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('prevPos', new THREE.BufferAttribute(prev, 3));
    g.setAttribute('nextPos', new THREE.BufferAttribute(next, 3));
    g.setAttribute('trackColor', new THREE.BufferAttribute(col, 3));
    g.setAttribute('tVal', new THREE.BufferAttribute(tv, 1));
    g.setAttribute('side', new THREE.BufferAttribute(sid, 1));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    return g;
  }

  function makeTrackMat() {
    return new THREE.ShaderMaterial({
      uniforms: {
        currentT: { value: 0 },
        tailSec: { value: tailDays * SEC_PER_DAY },
        ghostSec: { value: ghostDays * SEC_PER_DAY },
        tailOpacity: { value: tailOpacity },
        ghostOpacity: { value: ghostOpacity },
        ribbonWidth: { value: ribbonWidthPx },
        resolution: { value: new THREE.Vector2(W(), H()) },
      },
      vertexShader: TRACK_VERT,
      fragmentShader: TRACK_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }

  const colShallow = new THREE.Color(S.trColShallow ?? '#9be7ff');
  const colMid = new THREE.Color(S.trColMid ?? '#3fb6ff');
  const colDeep = new THREE.Color(S.trColDeep ?? '#ff8c5a');
  const colSurf = new THREE.Color(S.trColSurf ?? '#3fb6ff');
  const colDeepBreakM = S.trColBreak ?? 800;

  function computePathColor(depthM) {
    const tc = Math.min(1, depthM / colDeepBreakM);
    return tc < 0.5
      ? colShallow.clone().lerp(colMid, tc * 2)
      : colMid.clone().lerp(colDeep, (tc - 0.5) * 2);
  }

  // ----- 3D dive path (depth-coloured) -----
  const pathPositions = new Float32Array(depthInRange.length * 3);
  const pathColors = new Float32Array(depthInRange.length * 3);
  const pathTimes = new Float32Array(depthInRange.length);
  for (let i = 0; i < depthInRange.length; i++) {
    const p = depthInRange[i];
    const [lat, lon] = interpolatePosition(p.t);
    const v = project(lon, lat, -p.dmax);
    pathPositions[i * 3 + 0] = v.x;
    pathPositions[i * 3 + 1] = v.y;
    pathPositions[i * 3 + 2] = v.z;
    pathTimes[i] = (p.t - T0) / 1000;
    const c = computePathColor(p.dmax);
    pathColors[i * 3] = c.r; pathColors[i * 3 + 1] = c.g; pathColors[i * 3 + 2] = c.b;
  }
  const pathGeom = buildRibbonGeom(pathPositions, pathColors, pathTimes);
  const pathMat = makeTrackMat();
  const pathLine = new THREE.Mesh(pathGeom, pathMat);
  pathLine.frustumCulled = false;
  pathLine.renderOrder = 20;
  scene.add(pathLine);

  // ----- Surface track (GPS fixes, 5 m above sea level) -----
  const surfPositions = new Float32Array(locations.length * 3);
  const surfColors = new Float32Array(locations.length * 3);
  const surfTimes = new Float32Array(locations.length);
  for (let i = 0; i < locations.length; i++) {
    const l = locations[i];
    const v = project(l.lon, l.lat, 5);
    surfPositions[i * 3 + 0] = v.x;
    surfPositions[i * 3 + 1] = v.y;
    surfPositions[i * 3 + 2] = v.z;
    surfTimes[i] = (l.t - T0) / 1000;
    surfColors[i * 3] = colSurf.r; surfColors[i * 3 + 1] = colSurf.g; surfColors[i * 3 + 2] = colSurf.b;
  }
  const surfGeom = buildRibbonGeom(surfPositions, surfColors, surfTimes);
  const surfMat = makeTrackMat();
  const surfLine = new THREE.Mesh(surfGeom, surfMat);
  surfLine.frustumCulled = false;
  surfLine.renderOrder = 10;
  scene.add(surfLine);

  function updateTrackUniforms() {
    for (const mat of [pathMat, surfMat]) {
      mat.uniforms.tailSec.value = tailDays * SEC_PER_DAY;
      mat.uniforms.ghostSec.value = ghostDays * SEC_PER_DAY;
      mat.uniforms.tailOpacity.value = tailOpacity;
      mat.uniforms.ghostOpacity.value = ghostOpacity;
    }
  }

  // ---------------------------------------------------------------------------
  // Sperm-whale bout ribbons (progressively revealed) + seal orb + dive line
  // ---------------------------------------------------------------------------
  const BOUT_VERT = /* glsl */ `
    attribute vec3  prevPos;
    attribute vec3  nextPos;
    attribute float side;
    attribute float tVal;
    varying float   vTVal;
    uniform float   ribbonWidth;
    uniform vec2    resolution;
    void main() {
      vTVal = tVal;
      vec4 cur  = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      vec4 prv  = projectionMatrix * modelViewMatrix * vec4(prevPos,  1.0);
      vec4 nxt  = projectionMatrix * modelViewMatrix * vec4(nextPos,  1.0);
      vec2 curN = cur.xy / cur.w;
      vec2 prvN = prv.xy / prv.w;
      vec2 nxtN = nxt.xy / nxt.w;
      vec2 aspect = vec2(resolution.x / resolution.y, 1.0);
      vec2 dir;
      if      (length((curN - prvN) * aspect) < 0.0001) dir = normalize((nxtN - curN) * aspect);
      else if (length((nxtN - curN) * aspect) < 0.0001) dir = normalize((curN - prvN) * aspect);
      else {
        vec2 d1 = normalize((curN - prvN) * aspect);
        vec2 d2 = normalize((nxtN - curN) * aspect);
        dir = normalize(d1 + d2);
      }
      vec2 perp = vec2(-dir.y, dir.x);
      float miter = dot(perp, normalize((nxtN - prvN) * aspect));
      float len = ribbonWidth / max(abs(miter), 0.333);
      vec2 offset = perp * side * (len / resolution.y);
      gl_Position = cur + vec4(offset * cur.w, 0.0, 0.0);
    }
  `;
  const BOUT_FRAG = /* glsl */ `
    uniform vec3  boutColor;
    uniform float boutOpacity;
    uniform float currentT;
    varying float vTVal;
    void main() {
      if (vTVal > currentT) discard;
      gl_FragColor = vec4(boutColor, boutOpacity);
    }
  `;

  function makeBoutRibbonMat(color, boutStartMs) {
    const c = new THREE.Color(color);
    return new THREE.ShaderMaterial({
      uniforms: {
        ribbonWidth: { value: ribbonWidthPx * 2.5 },
        resolution: { value: new THREE.Vector2(W(), H()) },
        boutColor: { value: new THREE.Vector3(c.r, c.g, c.b) },
        boutOpacity: { value: Math.min(1, (S.boutEmit ?? 1.5) * 0.4 + 0.45) },
        currentT: { value: boutStartMs },
      },
      vertexShader: BOUT_VERT,
      fragmentShader: BOUT_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }

  function buildBareRibbonGeom(pts, times) {
    const N = pts.length / 3;
    if (N < 2) return null;
    const pos = new Float32Array(N * 2 * 3);
    const prev = new Float32Array(N * 2 * 3);
    const next = new Float32Array(N * 2 * 3);
    const sid = new Float32Array(N * 2);
    const tv = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) {
      const iPrev = Math.max(0, i - 1);
      const iNext = Math.min(N - 1, i + 1);
      for (let s = 0; s < 2; s++) {
        const vi = i * 2 + s;
        for (let k = 0; k < 3; k++) {
          pos[vi * 3 + k] = pts[i * 3 + k];
          prev[vi * 3 + k] = pts[iPrev * 3 + k];
          next[vi * 3 + k] = pts[iNext * 3 + k];
        }
        sid[vi] = s === 0 ? 1.0 : -1.0;
        tv[vi] = times[i];
      }
    }
    const idx = new Uint32Array((N - 1) * 6);
    for (let i = 0; i < N - 1; i++) {
      const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2, d = (i + 1) * 2 + 1;
      idx[i * 6 + 0] = a; idx[i * 6 + 1] = b; idx[i * 6 + 2] = c;
      idx[i * 6 + 3] = b; idx[i * 6 + 4] = d; idx[i * 6 + 5] = c;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('prevPos', new THREE.BufferAttribute(prev, 3));
    g.setAttribute('nextPos', new THREE.BufferAttribute(next, 3));
    g.setAttribute('side', new THREE.BufferAttribute(sid, 1));
    g.setAttribute('tVal', new THREE.BufferAttribute(tv, 1));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    return g;
  }

  function nearestDepthAt(t) {
    let lo = 0, hi = depthInRange.length - 1;
    if (t <= depthInRange[0].t) return depthInRange[0];
    if (t >= depthInRange[hi].t) return depthInRange[hi];
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (depthInRange[m].t <= t) lo = m; else hi = m;
    }
    return t - depthInRange[lo].t < depthInRange[hi].t - t
      ? depthInRange[lo]
      : depthInRange[hi];
  }

  function boutPoints(b) {
    let pts = depthInRange.filter((p) => p.t >= b.start && p.t <= b.end);
    const tStart = Math.max(b.start, T0), tEnd = Math.min(b.end, T1);
    if (pts.length < 2) {
      pts = [];
      const step = Math.max((tEnd - tStart) / 20, 60000);
      for (let t = tStart; t <= tEnd + step * 0.5; t += step) {
        const tc = Math.min(t, tEnd);
        pts.push({ t: tc, dmax: nearestDepthAt(tc).dmax });
      }
    }
    return pts;
  }

  const boutGroup = new THREE.Group();
  boutGroup.renderOrder = 40;
  scene.add(boutGroup);
  const boutMeshes = bouts
    .map((b, i) => {
      const pts = boutPoints(b);
      const wpts = new Float32Array(pts.length * 3);
      const wtimes = new Float32Array(pts.length);
      for (let j = 0; j < pts.length; j++) {
        const [lat, lon] = interpolatePosition(pts[j].t);
        const v = project(lon, lat, -pts[j].dmax);
        wpts[j * 3] = v.x; wpts[j * 3 + 1] = v.y; wpts[j * 3 + 2] = v.z;
        wtimes[j] = pts[j].t;
      }
      const geo = buildBareRibbonGeom(wpts, wtimes);
      if (!geo) return null;
      const mesh = new THREE.Mesh(geo, makeBoutRibbonMat('#ff5a5f', Math.max(b.start, T0)));
      mesh.frustumCulled = false;
      mesh.visible = false;
      mesh.renderOrder = 40;
      mesh.userData = { bout: b, index: i };
      boutGroup.add(mesh);
      return mesh;
    })
    .filter(Boolean);

  const boutLabels = bouts.map((b) => b.label || b.notes || 'sperm whales detected');

  const sealMesh = new THREE.Mesh(
    new THREE.SphereGeometry(orbRadius, 16, 12),
    new THREE.MeshStandardMaterial({
      color: '#ffffff',
      emissive: '#ffffff',
      emissiveIntensity: S.sealEmit ?? 2.0,
    })
  );
  sealMesh.renderOrder = 50;
  scene.add(sealMesh);

  const diveLineGeom = new THREE.BufferGeometry();
  diveLineGeom.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3)
  );
  const diveLine = new THREE.Line(
    diveLineGeom,
    new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6 })
  );
  diveLine.frustumCulled = false;
  diveLine.renderOrder = 30;
  scene.add(diveLine);

  // ---------------------------------------------------------------------------
  // Depth-profile scrub strip
  // ---------------------------------------------------------------------------
  const dCanvas = document.getElementById('depthCanvas');
  const dCtx = dCanvas.getContext('2d');
  const timeInd = document.getElementById('depth-time');
  const boutFlag = document.getElementById('bout-flag');
  let CW = 0, CH = 0, DPR = 1;
  function resizeDepth() {
    DPR = window.devicePixelRatio || 1;
    const r = dCanvas.getBoundingClientRect();
    CW = r.width;
    CH = r.height;
    dCanvas.width = CW * DPR;
    dCanvas.height = CH * DPR;
    dCtx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  const LABEL_W = 34;
  const tToX = (t) => LABEL_W + ((t - T0) / (T1 - T0)) * (CW - LABEL_W);
  const dToY = (d) => 16 + (d / sealMeta.depth_max) * (CH - 24);

  function drawDepth() {
    if (CW === 0) return;
    dCtx.clearRect(0, 0, CW, CH);
    const FONT = '9px ui-monospace, "SF Mono", monospace';

    dCtx.strokeStyle = 'rgba(31,42,68,0.7)';
    dCtx.lineWidth = 1;
    dCtx.fillStyle = 'rgba(149,163,189,0.75)';
    dCtx.font = FONT;
    dCtx.textBaseline = 'middle';
    [0, 400, 800].forEach((d) => {
      if (d > sealMeta.depth_max) return;
      const y = dToY(d);
      dCtx.beginPath(); dCtx.moveTo(LABEL_W, y); dCtx.lineTo(CW, y); dCtx.stroke();
      dCtx.fillText(d + 'm', 3, y);
    });

    // bouts
    dCtx.fillStyle = 'rgba(255, 90, 95, 0.25)';
    bouts.forEach((b) => {
      const x0 = Math.max(LABEL_W, tToX(b.start));
      const x1 = Math.min(CW, tToX(b.end));
      if (x1 > x0) dCtx.fillRect(x0, 8, Math.max(2, x1 - x0), CH - 8);
    });

    // depth fill + stroke
    dCtx.beginPath();
    dCtx.moveTo(tToX(T0), dToY(0));
    for (const p of depthInRange) dCtx.lineTo(tToX(p.t), dToY(p.dmax));
    dCtx.lineTo(tToX(T1), dToY(0));
    dCtx.closePath();
    dCtx.fillStyle = 'rgba(110, 231, 227, 0.14)';
    dCtx.fill();

    dCtx.beginPath();
    for (let i = 0; i < depthInRange.length; i++) {
      const p = depthInRange[i];
      if (i === 0) dCtx.moveTo(tToX(p.t), dToY(p.dmax));
      else dCtx.lineTo(tToX(p.t), dToY(p.dmax));
    }
    dCtx.strokeStyle = '#6ee7e3';
    dCtx.lineWidth = 1;
    dCtx.stroke();

    // seafloor under the track
    const BATHY_STEP = Math.max(1, Math.round((CW - LABEL_W) / 300));
    dCtx.save();
    dCtx.setLineDash([3, 3]);
    dCtx.strokeStyle = 'rgba(200,210,230,0.5)';
    dCtx.beginPath();
    let started = false;
    for (let px = 0; px < CW - LABEL_W; px += BATHY_STEP) {
      const t = T0 + (px / (CW - LABEL_W)) * (T1 - T0);
      const [lat, lon] = interpolatePosition(t);
      const depthM = Math.max(0, -terrainElevAt(lon, lat));
      if (depthM > sealMeta.depth_max) { started = false; continue; }
      const x = LABEL_W + px, y = dToY(depthM);
      if (!started) { dCtx.moveTo(x, y); started = true; }
      else dCtx.lineTo(x, y);
    }
    dCtx.stroke();
    dCtx.restore();
  }
  function drawDepthCursor(t) {
    const x = tToX(t);
    dCtx.save();
    dCtx.strokeStyle = '#ffffff';
    dCtx.lineWidth = 1;
    dCtx.setLineDash([4, 4]);
    dCtx.beginPath(); dCtx.moveTo(x, 0); dCtx.lineTo(x, CH); dCtx.stroke();
    dCtx.restore();
  }

  function depthCanvasScrubFromEvent(ev) {
    const rect = dCanvas.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, (x - LABEL_W) / (rect.width - LABEL_W)));
    seekTo(T0 + pct * (T1 - T0));
  }
  dCanvas.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    depthCanvasScrubFromEvent(ev);
    const onMove = (e) => depthCanvasScrubFromEvent(e);
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  });

  // ---------------------------------------------------------------------------
  // Playback + Standard chrome
  // ---------------------------------------------------------------------------
  let currentT = T0;
  let playing = true;
  let follow = true;
  const params = { exaggeration: VEX, speed: 12, trail: tailDays, bloom: bloomPass.strength };

  function rebuildTerrainHeights() {
    const pos = geo.attributes.position.array;
    for (let j = 0; j < my; j++) {
      for (let i = 0; i < mx; i++) {
        const vi = j * mx + i;
        pos[vi * 3 + 1] = (elevAttr[vi] / 1000) * VEX;
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
  }

  function syncRibbonPositions(geom, pts) {
    const N = pts.length / 3;
    const pos = geom.attributes.position.array;
    const prev = geom.attributes.prevPos.array;
    const next = geom.attributes.nextPos.array;
    for (let i = 0; i < N; i++) {
      const iPrev = Math.max(0, i - 1);
      const iNext = Math.min(N - 1, i + 1);
      for (let s = 0; s < 2; s++) {
        const vi = i * 2 + s;
        for (let k = 0; k < 3; k++) {
          pos[vi * 3 + k] = pts[i * 3 + k];
          prev[vi * 3 + k] = pts[iPrev * 3 + k];
          next[vi * 3 + k] = pts[iNext * 3 + k];
        }
      }
    }
    geom.attributes.position.needsUpdate = true;
    geom.attributes.prevPos.needsUpdate = true;
    geom.attributes.nextPos.needsUpdate = true;
  }

  function rebuildPathHeights() {
    for (let i = 0; i < depthInRange.length; i++) {
      pathPositions[i * 3 + 1] = (-depthInRange[i].dmax / 1000) * VEX;
    }
    syncRibbonPositions(pathGeom, pathPositions);
    for (let i = 1; i < surfPositions.length; i += 3) surfPositions[i] = (5 / 1000) * VEX;
    syncRibbonPositions(surfGeom, surfPositions);
    boutMeshes.forEach((m) => {
      const pts = boutPoints(m.userData.bout);
      const wpts = new Float32Array(pts.length * 3);
      for (let j = 0; j < pts.length; j++) {
        const [lat, lon] = interpolatePosition(pts[j].t);
        const v = project(lon, lat, -pts[j].dmax);
        wpts[j * 3] = v.x; wpts[j * 3 + 1] = v.y; wpts[j * 3 + 2] = v.z;
      }
      syncRibbonPositions(m.geometry, wpts);
    });
  }

  function seekTo(t) {
    currentT = Math.max(T0, Math.min(T1, t));
    update();
  }

  const _camTargetTmp = new THREE.Vector3();
  function updateCameraFollow() {
    if (!follow) return;
    const [lat, lon] = interpolatePosition(currentT);
    _camTargetTmp.copy(project(lon, lat, 0));
    const offset = camera.position.clone().sub(controls.target);
    const dir =
      offset.lengthSq() < 1e-6
        ? new THREE.Vector3(-0.4, 0.55, 0.7).normalize()
        : offset.normalize();
    controls.target.copy(_camTargetTmp);
    camera.position.copy(_camTargetTmp).addScaledVector(dir, camDistAt(currentT));
    controls.update();
  }

  function update() {
    timeInd.textContent = fmtDate(currentT);
    updateSun(currentT);

    const curSec = (currentT - T0) / 1000;
    pathMat.uniforms.currentT.value = curSec;
    surfMat.uniforms.currentT.value = curSec;

    const [lat, lon] = interpolatePosition(currentT);
    const cur = nearestDepthAt(currentT);
    const v = project(lon, lat, -cur.dmax);
    sealMesh.position.copy(v);

    updateCameraFollow();

    const surfV = project(lon, lat, 5);
    const dlArr = diveLineGeom.attributes.position.array;
    dlArr[0] = surfV.x; dlArr[1] = surfV.y; dlArr[2] = surfV.z;
    dlArr[3] = v.x; dlArr[4] = v.y; dlArr[5] = v.z;
    diveLineGeom.attributes.position.needsUpdate = true;

    let activeIdx = -1;
    for (let i = 0; i < bouts.length; i++) {
      if (currentT >= bouts[i].start && currentT <= bouts[i].end) { activeIdx = i; break; }
    }
    boutMeshes.forEach((m) => {
      m.visible = currentT >= m.userData.bout.start;
      m.material.uniforms.currentT.value = currentT;
    });
    if (activeIdx >= 0) {
      boutFlag.textContent = boutLabels[activeIdx];
      boutFlag.classList.add('visible');
    } else {
      boutFlag.classList.remove('visible');
    }

    drawDepth();
    drawDepthCursor(currentT);
  }

  // Standard param wiring
  Standard.bind(params, 'exaggeration', (v) => v + '×', (v) => {
    VEX = v;
    rebuildTerrainHeights();
    rebuildPathHeights();
    update();
  });
  Standard.bind(params, 'speed', (v) => v + ' h/s', (v) => (params.speed = v));
  Standard.bind(params, 'trail', (v) => v + ' d', (v) => {
    tailDays = v;
    ghostDays = v * 2;
    updateTrackUniforms();
  });
  Standard.bind(params, 'bloom', (v) => v.toFixed(2), (v) => (bloomPass.strength = v));

  const followBtn = document.getElementById('follow');
  followBtn.addEventListener('click', () => {
    follow = !follow;
    followBtn.classList.toggle('active', follow);
  });
  const playBtn = document.getElementById('playpause');
  function setPlaying(p) {
    playing = p;
    playBtn.textContent = playing ? 'pause ✦' : 'play ✦';
  }
  playBtn.addEventListener('click', () => setPlaying(!playing));
  window.addEventListener('keydown', (e) => {
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    keys[e.code] = true;
    if (e.code === 'Space') {
      e.preventDefault();
      setPlaying(!playing);
    }
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });

  // ---------------------------------------------------------------------------
  // WASD fly + pinch zoom
  // ---------------------------------------------------------------------------
  const camSpeed = 30; // km/s
  const keys = {};
  const _wasdForward = new THREE.Vector3();
  const _wasdRight = new THREE.Vector3();
  const _wasdUp = new THREE.Vector3(0, 1, 0);
  function applyWASD(dt) {
    const fwd = keys.KeyW || keys.ArrowUp;
    const back = keys.KeyS || keys.ArrowDown;
    const left = keys.KeyA || keys.ArrowLeft;
    const right = keys.KeyD || keys.ArrowRight;
    const up = keys.KeyE;
    const down = keys.KeyQ;
    if (!fwd && !back && !left && !right && !up && !down) return;
    _wasdForward.subVectors(controls.target, camera.position);
    _wasdForward.y = 0;
    if (_wasdForward.lengthSq() < 1e-6) _wasdForward.set(0, 0, -1);
    _wasdForward.normalize();
    _wasdRight.crossVectors(_wasdForward, _wasdUp).normalize();
    const step = camSpeed * dt;
    const move = new THREE.Vector3();
    if (fwd) move.addScaledVector(_wasdForward, step);
    if (back) move.addScaledVector(_wasdForward, -step);
    if (right) move.addScaledVector(_wasdRight, step);
    if (left) move.addScaledVector(_wasdRight, -step);
    if (up) move.y += step;
    if (down) move.y -= step;
    camera.position.add(move);
    controls.target.add(move);
    controls.update();
  }

  let _pinchDist0 = null;
  const _pinchDir = new THREE.Vector3();
  renderer.domElement.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      _pinchDist0 = Math.sqrt(dx * dx + dy * dy);
      e.preventDefault();
    }
  }, { passive: false });
  renderer.domElement.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && _pinchDist0 !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const delta = (dist - _pinchDist0) * 0.5;
      _pinchDist0 = dist;
      _pinchDir.subVectors(controls.target, camera.position).normalize();
      camera.position.addScaledVector(_pinchDir, delta);
      controls.target.addScaledVector(_pinchDir, delta);
      controls.update();
      e.preventDefault();
    }
  }, { passive: false });
  renderer.domElement.addEventListener('touchend', () => { _pinchDist0 = null; });

  // ---------------------------------------------------------------------------
  // Geographic labels + state boundary lines (runtime fetches, fail silently)
  // ---------------------------------------------------------------------------
  const geoLabelsEl = document.getElementById('geo-labels');
  const geoLabels = [];
  const BOUNDARY_URL =
    'https://raw.githubusercontent.com/martynafford/natural-earth-geojson/master/50m/cultural/ne_50m_admin_1_states_provinces.json';

  const inBbox = (lon, lat) =>
    lon >= BBOX.lon0 && lon <= BBOX.lon1 && lat >= BBOX.lat0 && lat <= BBOX.lat1;

  function emitBoundaryLine(pts, group, mat) {
    const verts = [];
    for (const [lon, lat] of pts) {
      const elev = Math.max(0, terrainElevAt(lon, lat)) + 5;
      const v = project(lon, lat, elev);
      verts.push(v.x, v.y, v.z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
    group.add(new THREE.Line(g, mat));
  }

  async function loadBoundaryLines() {
    const grp = new THREE.Group();
    grp.renderOrder = 5;
    try {
      const r = await fetch(BOUNDARY_URL);
      if (!r.ok) return;
      const gj = await r.json();
      const lineMat = new THREE.LineBasicMaterial({
        color: 0x6688aa, transparent: true, opacity: 0.45, depthTest: true,
      });
      for (const feat of gj.features) {
        const adm0 = feat.properties?.adm0_a3 ?? feat.properties?.ADM0_A3 ?? '';
        if (adm0 !== 'USA' && adm0 !== 'CAN') continue;
        const geom = feat.geometry;
        if (!geom) continue;
        const rings =
          geom.type === 'MultiPolygon' ? geom.coordinates.flat()
          : geom.type === 'Polygon' ? geom.coordinates
          : geom.type === 'LineString' ? [geom.coordinates]
          : geom.type === 'MultiLineString' ? geom.coordinates
          : [];
        for (const ring of rings) {
          const pts = [];
          for (const [lon, lat] of ring) {
            if (
              lon < BBOX.lon0 - 0.5 || lon > BBOX.lon1 + 0.5 ||
              lat < BBOX.lat0 - 0.5 || lat > BBOX.lat1 + 0.5
            ) {
              if (pts.length) { emitBoundaryLine(pts, grp, lineMat); pts.length = 0; }
              continue;
            }
            pts.push([lon, lat]);
          }
          if (pts.length > 1) emitBoundaryLine(pts, grp, lineMat);
        }
      }
      scene.add(grp);
    } catch (e) {
      console.warn('boundary lines unavailable:', e);
    }
  }

  function addGeoLabel(name, type, lon, lat) {
    if (!inBbox(lon, lat)) return;
    const elev = type === 'seamount' ? 0 : Math.max(0, terrainElevAt(lon, lat));
    const world = project(lon, lat, elev);
    const wrap = document.createElement('div');
    wrap.className = 'geo-label';
    const text = document.createElement('div');
    text.className = `geo-label-text ${type}`;
    text.textContent = name;
    const stem = document.createElement('div');
    stem.className = 'geo-label-stem';
    stem.style.height = '18px';
    const dot = document.createElement('div');
    dot.className = 'geo-label-dot';
    wrap.appendChild(text);
    wrap.appendChild(stem);
    wrap.appendChild(dot);
    geoLabelsEl.appendChild(wrap);
    geoLabels.push({ world, el: wrap });
  }

  const _labelNDC = new THREE.Vector3();
  function updateGeoLabels() {
    for (const lbl of geoLabels) {
      _labelNDC.copy(lbl.world).project(camera);
      if (_labelNDC.z > 1 || Math.abs(_labelNDC.x) > 1.3 || Math.abs(_labelNDC.y) > 1.3) {
        lbl.el.style.display = 'none';
        continue;
      }
      lbl.el.style.display = '';
      lbl.el.style.left = (_labelNDC.x * 0.5 + 0.5) * W() + 'px';
      lbl.el.style.top = (-_labelNDC.y * 0.5 + 0.5) * H() + 'px';
    }
  }

  async function loadGeoFeatures() {
    const features = [];
    try {
      const ql = `[out:json][timeout:30];
(
  node[natural=peak](if:number(t["ele"])>3000)(${BBOX.lat0},${BBOX.lon0},${BBOX.lat1},${BBOX.lon1});
  node[natural=bay](${BBOX.lat0},${BBOX.lon0},${BBOX.lat1},${BBOX.lon1});
  way[natural=bay](${BBOX.lat0},${BBOX.lon0},${BBOX.lat1},${BBOX.lon1});
  node[natural=cape](${BBOX.lat0},${BBOX.lon0},${BBOX.lat1},${BBOX.lon1});
  way[natural=cape](${BBOX.lat0},${BBOX.lon0},${BBOX.lat1},${BBOX.lon1});
);
out center;`;
      const res = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: 'data=' + encodeURIComponent(ql),
      });
      const data = await res.json();
      for (const el of data.elements ?? []) {
        if (!el.tags?.name) continue;
        const lon = el.lon ?? el.center?.lon;
        const lat = el.lat ?? el.center?.lat;
        if (lon == null || lat == null) continue;
        const nat = el.tags.natural;
        const type = nat === 'peak' ? 'peak' : 'bay';
        const ele = parseFloat(el.tags.ele) || 0;
        const priority = nat === 'peak' ? ele : -el.tags.name.length + 1000;
        features.push({ name: el.tags.name, type, lon, lat, priority });
      }
    } catch (e) {
      console.warn('overpass unavailable:', e);
    }
    const peaks = features.filter((f) => f.type === 'peak').sort((a, b) => b.priority - a.priority);
    const coastal = features.filter((f) => f.type === 'bay').sort((a, b) => b.priority - a.priority);
    for (const f of [...peaks.slice(0, 8), ...coastal.slice(0, 8)]) {
      addGeoLabel(f.name, f.type, f.lon, f.lat);
    }
  }

  loadBoundaryLines();
  loadGeoFeatures();

  // ---------------------------------------------------------------------------
  // Resize + animate
  // ---------------------------------------------------------------------------
  function onResize() {
    renderer.setSize(W(), H());
    composer.setSize(W(), H());
    bloomPass.resolution.set(W(), H());
    camera.aspect = W() / H();
    camera.updateProjectionMatrix();
    pathMat.uniforms.resolution.value.set(W(), H());
    surfMat.uniforms.resolution.value.set(W(), H());
    boutMeshes.forEach((m) => m.material.uniforms.resolution.value.set(W(), H()));
    resizeDepth();
    drawDepth();
    drawDepthCursor(currentT);
  }
  window.addEventListener('resize', onResize);
  onResize();

  hideModal();
  seekTo(T0);

  let lastLoopTime = performance.now();
  function loop() {
    const now = performance.now();
    const dt = Math.min((now - lastLoopTime) / 1000, 0.1);
    lastLoopTime = now;
    applyWASD(dt);
    if (playing) {
      currentT += dt * params.speed * 3600 * 1000;
      if (currentT >= T1) currentT = T0; // loop the trip
      update();
    }
    water.material.uniforms.time.value += dt * waterSpeed;
    controls.update();
    composer.render();
    updateGeoLabels();
    requestAnimationFrame(loop);
  }
  loop();
})();
