// harada scene — the physical world beneath the worksheet.
// A japanese maple table filling the frame, a glazed yunomi of tea in the
// upper right with steam rising (Bruno Simon coffee-smoke technique), warm
// window light. Ported standalone from the harada repo (src/scene/).

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// ---------------------------------------------------------------------------
// procedural japanese maple tabletop textures (2048² canvas-painted)
// ---------------------------------------------------------------------------

const SIZE = 2048;

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function makeWoodTextures(anisotropy = 4) {
  const color = document.createElement('canvas');
  const bump = document.createElement('canvas');
  const rough = document.createElement('canvas');
  color.width = color.height = SIZE;
  bump.width = bump.height = SIZE;
  rough.width = rough.height = SIZE;
  const c = color.getContext('2d');
  const b = bump.getContext('2d');
  const r = rough.getContext('2d');

  // base: honey-amber maple, gentle diagonal tone drift
  const base = c.createLinearGradient(0, 0, SIZE, SIZE * 0.35);
  base.addColorStop(0.0, '#d3b585');
  base.addColorStop(0.45, '#caa873');
  base.addColorStop(0.75, '#d7bc8f');
  base.addColorStop(1.0, '#c4a069');
  c.fillStyle = base;
  c.fillRect(0, 0, SIZE, SIZE);

  b.fillStyle = '#808080';
  b.fillRect(0, 0, SIZE, SIZE);

  r.fillStyle = 'rgb(118,118,118)'; // ~0.46 roughness baseline
  r.fillRect(0, 0, SIZE, SIZE);

  // curl / figure: broad soft luminance bands across the grain
  const curlCount = 26;
  const curlPhase = rand(0, Math.PI * 2);
  for (let i = 0; i < curlCount; i++) {
    const x = (i / curlCount) * SIZE + rand(-40, 40);
    const w = rand(60, 180);
    const bright = Math.sin(i * 1.7 + curlPhase) * 0.5 + 0.5;
    const g = c.createLinearGradient(x - w, 0, x + w, 0);
    const tone = bright > 0.5 ? '255,246,225' : '150,116,72';
    const a = Math.abs(bright - 0.5) * 0.11;
    g.addColorStop(0, `rgba(${tone},0)`);
    g.addColorStop(0.5, `rgba(${tone},${a.toFixed(3)})`);
    g.addColorStop(1, `rgba(${tone},0)`);
    c.fillStyle = g;
    c.fillRect(x - w, 0, w * 2, SIZE);

    const rg = r.createLinearGradient(x - w, 0, x + w, 0);
    const rv = bright > 0.5 ? '95,95,95' : '135,135,135';
    rg.addColorStop(0, `rgba(${rv},0)`);
    rg.addColorStop(0.5, `rgba(${rv},0.35)`);
    rg.addColorStop(1, `rgba(${rv},0)`);
    r.fillStyle = rg;
    r.fillRect(x - w, 0, w * 2, SIZE);
  }

  // grain lines: fine, gently wavering, horizontal
  const sharedF = rand(0.0012, 0.0022);
  const sharedP = rand(0, Math.PI * 2);
  const sharedA = rand(14, 26);

  let y = rand(2, 8);
  while (y < SIZE + 30) {
    const isGrowth = Math.random() < 0.16;
    const ownF = rand(0.004, 0.009);
    const ownP = rand(0, Math.PI * 2);
    const ownA = rand(1.2, 4.5);
    const wobF = rand(0.02, 0.05);
    const wobA = rand(0.3, 0.9);

    const alpha = isGrowth ? rand(0.14, 0.24) : rand(0.05, 0.12);
    const width = isGrowth ? rand(1.1, 2.0) : rand(0.5, 1.1);
    const hue = isGrowth
      ? `rgba(${Math.round(rand(140, 160))},${Math.round(rand(104, 120))},${Math.round(rand(62, 76))},${alpha})`
      : `rgba(${Math.round(rand(168, 190))},${Math.round(rand(132, 152))},${Math.round(rand(90, 108))},${alpha})`;

    const trace = (ctx) => {
      ctx.beginPath();
      for (let x = -20; x <= SIZE + 20; x += 16) {
        const yy =
          y +
          Math.sin(x * sharedF + sharedP + y * 0.004) * sharedA +
          Math.sin(x * ownF + ownP) * ownA +
          Math.sin(x * wobF + ownP * 2.0) * wobA;
        if (x === -20) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    };

    c.strokeStyle = hue;
    c.lineWidth = width;
    trace(c);

    b.strokeStyle = `rgba(70,70,70,${(alpha * 0.9).toFixed(3)})`;
    b.lineWidth = width + 0.4;
    trace(b);

    r.strokeStyle = `rgba(150,150,150,${(alpha * 0.7).toFixed(3)})`;
    r.lineWidth = width + 0.6;
    trace(r);

    y += isGrowth ? rand(9, 22) : rand(3.5, 9);
  }

  // fine pore flecks: tiny short dashes along the grain
  for (let i = 0; i < 2600; i++) {
    const px = rand(0, SIZE);
    const py = rand(0, SIZE);
    const len = rand(2, 9);
    const a = rand(0.03, 0.1);
    c.strokeStyle = `rgba(120,92,58,${a.toFixed(3)})`;
    c.lineWidth = rand(0.4, 0.8);
    c.beginPath();
    c.moveTo(px, py);
    c.lineTo(px + len, py + rand(-0.6, 0.6));
    c.stroke();

    b.strokeStyle = `rgba(60,60,60,${(a * 1.4).toFixed(3)})`;
    b.lineWidth = 0.7;
    b.beginPath();
    b.moveTo(px, py);
    b.lineTo(px + len, py);
    b.stroke();
  }

  // very soft overall mottle (avoids flat plastic look)
  for (let i = 0; i < 140; i++) {
    const px = rand(0, SIZE);
    const py = rand(0, SIZE);
    const rad = rand(60, 260);
    const g = c.createRadialGradient(px, py, 0, px, py, rad);
    const warm = Math.random() > 0.5;
    g.addColorStop(0, warm ? 'rgba(232,206,158,0.05)' : 'rgba(146,116,80,0.045)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(px - rad, py - rad, rad * 2, rad * 2);
  }

  const mk = (canvas, srgb) => {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = anisotropy;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };

  return {
    map: mk(color, true),
    bumpMap: mk(bump, false),
    roughnessMap: mk(rough, false),
  };
}

// subtle glaze speckle map for the ceramic cup
function makeGlazeTexture() {
  const s = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = s;
  const ctx = canvas.getContext('2d');

  const g = ctx.createLinearGradient(0, 0, 0, s);
  g.addColorStop(0, '#eaefe6');
  g.addColorStop(0.5, '#e4ebe0');
  g.addColorStop(1, '#e9ede4');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);

  for (let i = 0; i < 26; i++) {
    const px = rand(0, s);
    const py = rand(0, s);
    const rad = rand(30, 120);
    const rg = ctx.createRadialGradient(px, py, 0, px, py, rad);
    rg.addColorStop(0, 'rgba(198,212,196,0.10)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(px - rad, py - rad, rad * 2, rad * 2);
  }

  for (let i = 0; i < 420; i++) {
    const a = rand(0.06, 0.28);
    ctx.fillStyle = `rgba(${Math.round(rand(96, 128))},${Math.round(rand(96, 122))},${Math.round(rand(84, 106))},${a.toFixed(3)})`;
    const rad = rand(0.4, 1.4);
    ctx.beginPath();
    ctx.arc(rand(0, s), rand(0, s), rad, 0, Math.PI * 2);
    ctx.fill();
  }

  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------------------------------------------------------------------------
// yunomi teacup: lathe profile, hand-thrown lip, glazed ceramic, tea disc
// ---------------------------------------------------------------------------

const TEAS = {
  sencha:    { color: '#c9cf6e', opacity: 0.94, transmission: 0.35, roughness: 0.06 }, // pale green-gold
  hojicha:   { color: '#9c5320', opacity: 0.96, transmission: 0.25, roughness: 0.05 }, // roasted amber
  matcha:    { color: '#4e7d3c', opacity: 1.0,  transmission: 0.0,  roughness: 0.30 }, // opaque jade
  genmaicha: { color: '#c2b35a', opacity: 0.95, transmission: 0.3,  roughness: 0.06 }, // toasty yellow-green
  oolong:    { color: '#c98a3b', opacity: 0.93, transmission: 0.35, roughness: 0.05 }, // honey
  chamomile: { color: '#e3c877', opacity: 0.90, transmission: 0.45, roughness: 0.05 }, // pale straw
};

const CUP_HEIGHT = 0.78;
const TEA_LEVEL = 0.66;

function makeCup() {
  const group = new THREE.Group();

  // lathe profile: foot ring -> belly -> gently inward lip
  const pts = [
    [0.0, 0.02],
    [0.1, 0.018],
    [0.16, 0.0],
    [0.19, 0.015],
    [0.185, 0.05],
    [0.21, 0.07],
    [0.3, 0.12],
    [0.365, 0.26],
    [0.415, 0.46],
    [0.42, 0.6],
    [0.405, 0.72],
    [0.4, CUP_HEIGHT],
    [0.383, CUP_HEIGHT + 0.008],
    [0.366, CUP_HEIGHT],
    [0.36, 0.7],
    [0.35, 0.5],
    [0.315, 0.24],
    [0.24, 0.13],
    [0.0, 0.115],
  ].map(([x, y]) => new THREE.Vector2(x, y));

  const geometry = new THREE.LatheGeometry(pts, 72);

  // handmade irregularity: radial jitter growing toward the lip
  const p1 = Math.random() * Math.PI * 2;
  const p2 = Math.random() * Math.PI * 2;
  const p3 = Math.random() * Math.PI * 2;
  const pos = geometry.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const radius = Math.hypot(v.x, v.z);
    if (radius < 1e-4) continue;
    const a = Math.atan2(v.z, v.x);
    const n =
      Math.sin(a * 3 + p1) * 0.5 +
      Math.sin(a * 5 + p2) * 0.32 +
      Math.sin(a * 8 + p3) * 0.18;
    const t = Math.max(0, v.y / CUP_HEIGHT);
    const d = n * 0.009 * t * t * t;
    const scale = (radius + d) / radius;
    pos.setX(i, v.x * scale);
    pos.setZ(i, v.z * scale);
    if (v.y > CUP_HEIGHT - 0.03) pos.setY(i, v.y + n * 0.004);
  }
  geometry.computeVertexNormals();

  const glaze = makeGlazeTexture();
  const ceramic = new THREE.MeshPhysicalMaterial({
    map: glaze,
    color: '#f2f4ee',
    roughness: 0.15,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.12,
    sheen: 0.15,
    sheenColor: new THREE.Color('#dfe8dc'),
    envMapIntensity: 1.1,
    side: THREE.DoubleSide,
  });

  const body = new THREE.Mesh(geometry, ceramic);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // tea surface: variety picked at random per cup
  const names = Object.keys(TEAS);
  const teaName = names[Math.floor(Math.random() * names.length)];
  const tea = TEAS[teaName];

  const teaGeometry = new THREE.CircleGeometry(0.35, 48);
  teaGeometry.rotateX(-Math.PI / 2);
  const teaMaterial = new THREE.MeshPhysicalMaterial({
    color: tea.color,
    roughness: tea.roughness,
    metalness: 0.0,
    transmission: tea.transmission,
    thickness: 0.25,
    transparent: tea.opacity < 1.0,
    opacity: tea.opacity,
    clearcoat: 0.6,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.3,
    bumpScale: 0.0016,
  });

  const teaSurface = new THREE.Mesh(teaGeometry, teaMaterial);
  teaSurface.position.y = TEA_LEVEL;
  group.add(teaSurface);

  return { group, teaName, teaMaterial, rimY: CUP_HEIGHT };
}

// ---------------------------------------------------------------------------
// steam shaders (Bruno Simon coffee-smoke technique), inlined
// ---------------------------------------------------------------------------

const smokeVertexShader = /* glsl */ `
uniform float uTime;
uniform sampler2D uPerlinTexture;
uniform float uWind;

varying vec2 vUv;

vec2 rotate2D(vec2 value, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    mat2 m = mat2(c, s, -s, c);
    return m * value;
}

void main() {
    vec3 newPosition = position;

    // twist: one perlin sample scrolled along uv.y drives a rotation
    // around the plane's vertical axis
    float twistPerlin = texture(
        uPerlinTexture,
        vec2(0.5, uv.y * 0.2 - uTime * 0.005)
    ).r;
    float angle = twistPerlin * 10.0;
    newPosition.xz = rotate2D(newPosition.xz, angle);

    // wind: two independent perlin samples, remapped to [-0.5, 0.5],
    // pushing harder with elevation
    vec2 windOffset = vec2(
        texture(uPerlinTexture, vec2(0.25, uTime * 0.01)).r - 0.5,
        texture(uPerlinTexture, vec2(0.75, uTime * 0.01)).r - 0.5
    );
    windOffset *= pow(uv.y, 2.0) * uWind;
    newPosition.xz += windOffset;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);

    vUv = uv;
}
`;

const smokeFragmentShader = /* glsl */ `
uniform float uTime;
uniform sampler2D uPerlinTexture;
uniform float uOpacity;

varying vec2 vUv;

void main() {
    // scale and scroll the uv, sample perlin for the smoke mask
    vec2 smokeUv = vUv;
    smokeUv.x *= 0.5;
    smokeUv.y *= 0.3;
    smokeUv.y -= uTime * 0.04;

    float smoke = texture(uPerlinTexture, smokeUv).r;

    // remap so only the brighter noise survives
    smoke = smoothstep(0.4, 1.0, smoke);

    // fade the edges: sides, bottom (rises out of the tea), long top fade
    smoke *= smoothstep(0.0, 0.1, vUv.x);
    smoke *= smoothstep(1.0, 0.9, vUv.x);
    smoke *= smoothstep(0.0, 0.1, vUv.y);
    smoke *= smoothstep(1.0, 0.4, vUv.y);

    // soft white-grey steam
    gl_FragColor = vec4(0.93, 0.94, 0.95, smoke * uOpacity);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}
`;

// ---------------------------------------------------------------------------
// scene
// ---------------------------------------------------------------------------

// mode targets: 'day' is bright daylight paper-working light,
// 'evening' is a warmer, slightly moodier lamp.
const MODES = {
  evening: {
    keyIntensity: 2.0,
    hemiIntensity: 0.3,
    envIntensity: 0.28,
    exposure: 0.84,
    warmthBoost: 0.6,
    smokeLift: 1.12,
  },
  day: {
    keyIntensity: 2.6,
    hemiIntensity: 0.6,
    envIntensity: 0.55,
    exposure: 1.0,
    warmthBoost: 0.0,
    smokeLift: 1.0,
  },
};

const COLOR_DAYLIGHT = new THREE.Color('#fff5e6');
const COLOR_LAMP = new THREE.Color('#ffb877');

// where the cup lands on screen, in NDC (x right, y up)
const CUP_NDC = new THREE.Vector2(0.6, 0.55);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#171310');

// camera: looking mostly down at the table
const camera = new THREE.PerspectiveCamera(
  30,
  window.innerWidth / window.innerHeight,
  0.1,
  60
);
camera.position.set(0, 11.5, 4.6);
camera.lookAt(0, 0, -0.5);

// environment (so the varnish and glaze have something to reflect)
const pmrem = new THREE.PMREMGenerator(renderer);
const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = envTexture;
scene.environmentIntensity = MODES.evening.envIntensity;

// the maple table
const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
const WOOD_REPEAT = 5; // texture tile ≈ 12 world units on a 60-unit slab

const tableMaterial = new THREE.MeshPhysicalMaterial({
  bumpScale: 0.6,
  roughness: 1.0, // driven by the map (~0.46 baseline)
  metalness: 0.0,
  clearcoat: 0.3, // satin varnish
  clearcoatRoughness: 0.55,
  sheen: 0.25,
  sheenRoughness: 0.6,
  sheenColor: new THREE.Color('#e8d8b8'),
  anisotropy: 0.5, // brushed-along-the-grain reflections
  envMapIntensity: 0.8,
});

let wood = null;
function newWood() {
  const old = wood;
  wood = makeWoodTextures(maxAniso);
  for (const t of [wood.map, wood.bumpMap, wood.roughnessMap]) {
    t.repeat.set(WOOD_REPEAT, WOOD_REPEAT);
  }
  tableMaterial.map = wood.map;
  tableMaterial.bumpMap = wood.bumpMap;
  tableMaterial.roughnessMap = wood.roughnessMap;
  tableMaterial.needsUpdate = true;
  if (old) for (const t of Object.values(old)) t.dispose();
}
newWood();

const table = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), tableMaterial);
table.rotation.x = -Math.PI / 2; // grain runs screen-horizontal
table.receiveShadow = true;
scene.add(table);

// lights: warm key like window light from the upper left, plus soft fill
const keyLight = new THREE.DirectionalLight(COLOR_DAYLIGHT, MODES.evening.keyIntensity);
keyLight.position.set(-4.5, 6.5, -3);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.near = 1;
keyLight.shadow.camera.far = 20;
keyLight.shadow.camera.left = -6;
keyLight.shadow.camera.right = 6;
keyLight.shadow.camera.top = 6;
keyLight.shadow.camera.bottom = -6;
keyLight.shadow.bias = -0.0004;
keyLight.shadow.normalBias = 0.01;
scene.add(keyLight);
scene.add(keyLight.target);

const hemiLight = new THREE.HemisphereLight('#dfe6f0', '#8a6b4c', MODES.evening.hemiIntensity);
scene.add(hemiLight);

// perlin noise texture for the steam + the tea surface ripple
const textureLoader = new THREE.TextureLoader();
let teaBump = null;
const perlinTexture = textureLoader.load('perlin.png', () => {
  teaBump = perlinTexture.clone();
  teaBump.wrapS = teaBump.wrapT = THREE.RepeatWrapping;
  teaBump.repeat.set(3, 3);
  teaBump.center.set(0.5, 0.5);
  teaBump.needsUpdate = true;
  cup.teaMaterial.bumpMap = teaBump;
  cup.teaMaterial.needsUpdate = true;
});
perlinTexture.wrapS = THREE.RepeatWrapping;
perlinTexture.wrapT = THREE.RepeatWrapping;

// steam mesh (shared across cups; re-parented on "new tea")
const smokeGeometry = new THREE.PlaneGeometry(1, 6, 16, 64);
smokeGeometry.translate(0, 3, 0); // origin at the base

const smokeMaterial = new THREE.ShaderMaterial({
  vertexShader: smokeVertexShader,
  fragmentShader: smokeFragmentShader,
  uniforms: {
    uTime: new THREE.Uniform(0),
    uPerlinTexture: new THREE.Uniform(perlinTexture),
    uWind: new THREE.Uniform(3.0),
    uOpacity: new THREE.Uniform(0.55),
  },
  side: THREE.DoubleSide,
  transparent: true,
  depthWrite: false,
});

const SMOKE_BASE_SCALE = { x: 0.5, y: 0.24, z: 0.5 }; // ≈1.45 units tall
const smoke = new THREE.Mesh(smokeGeometry, smokeMaterial);
smoke.scale.set(SMOKE_BASE_SCALE.x, SMOKE_BASE_SCALE.y, SMOKE_BASE_SCALE.z);
smoke.renderOrder = 2;

// the cup of tea, upper right of the viewport
const teaNameEl = document.getElementById('tea-name');
let cup = null;
function newCup() {
  if (cup) {
    smoke.removeFromParent(); // keep the shared steam mesh alive
    scene.remove(cup.group);
    cup.group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (obj.material.map) obj.material.map.dispose();
        obj.material.dispose();
      }
    });
  }
  cup = makeCup();
  if (teaBump) {
    cup.teaMaterial.bumpMap = teaBump;
    cup.teaMaterial.needsUpdate = true;
  }
  smoke.position.y = cup.rimY - 0.06;
  cup.group.add(smoke);
  scene.add(cup.group);
  placeCup();
  teaNameEl.textContent = cup.teaName;
}

// cup placement: unproject a fixed NDC point onto the table so the cup
// stays in the upper right at any aspect ratio
const raycaster = new THREE.Raycaster();
const tablePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hit = new THREE.Vector3();
function placeCup() {
  camera.updateMatrixWorld();
  raycaster.setFromCamera(CUP_NDC, camera);
  if (raycaster.ray.intersectPlane(tablePlane, hit)) {
    cup.group.position.set(hit.x, 0, hit.z);
  }
}
newCup();

// ---- chrome ---------------------------------------------------------------

const params = {};
const paramsContainer = document.getElementById('params');

Standard.param(paramsContainer, params, {
  id: 'smokeSpeed',
  label: 'steam speed',
  min: 0.2,
  max: 2,
  step: 0.05,
  value: 1,
  fmt: (v) => v.toFixed(2),
});

Standard.param(paramsContainer, params, {
  id: 'smokeAmount',
  label: 'steam amount',
  min: 0,
  max: 1,
  step: 0.01,
  value: 0.55,
  fmt: (v) => v.toFixed(2),
});

Standard.param(paramsContainer, params, {
  id: 'warmth',
  label: 'light warmth',
  min: 0,
  max: 1,
  step: 0.01,
  value: 0.25,
  fmt: (v) => v.toFixed(2),
});

document.getElementById('btn-new-tea').addEventListener('click', () => {
  newWood();
  newCup();
});

let mode = 'evening';
const modeButton = document.getElementById('btn-mode');
modeButton.addEventListener('click', () => {
  mode = mode === 'evening' ? 'day' : 'evening';
  modeButton.textContent = mode === 'evening' ? 'evening ☾' : 'day ☀';
});

// ---- loop -----------------------------------------------------------------

const current = {
  keyIntensity: MODES.evening.keyIntensity,
  hemiIntensity: MODES.evening.hemiIntensity,
  envIntensity: MODES.evening.envIntensity,
  exposure: MODES.evening.exposure,
  warmth: params.warmth,
  smokeLift: MODES.evening.smokeLift,
};
const keyColor = new THREE.Color();

const clock = new THREE.Clock();
let smokeTime = 0;

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  smokeTime += dt * params.smokeSpeed;
  smokeMaterial.uniforms.uTime.value = smokeTime;
  smokeMaterial.uniforms.uOpacity.value = params.smokeAmount;

  // tea surface ripple: drift + slow rotation of the bump texture
  if (teaBump) {
    teaBump.offset.x += dt * 0.008;
    teaBump.offset.y += dt * 0.011;
    teaBump.rotation += dt * 0.02;
  }

  // ease lighting toward the current mode's targets
  const target = MODES[mode];
  const k = 1 - Math.exp(-2.5 * dt); // framerate-independent lerp
  current.keyIntensity += (target.keyIntensity - current.keyIntensity) * k;
  current.hemiIntensity += (target.hemiIntensity - current.hemiIntensity) * k;
  current.envIntensity += (target.envIntensity - current.envIntensity) * k;
  current.exposure += (target.exposure - current.exposure) * k;
  current.smokeLift += (target.smokeLift - current.smokeLift) * k;
  const warmthTarget = Math.min(1, params.warmth + target.warmthBoost);
  current.warmth += (warmthTarget - current.warmth) * k;

  keyLight.intensity = current.keyIntensity;
  keyColor.lerpColors(COLOR_DAYLIGHT, COLOR_LAMP, current.warmth);
  keyLight.color.copy(keyColor);
  hemiLight.intensity = current.hemiIntensity;
  scene.environmentIntensity = current.envIntensity;
  renderer.toneMappingExposure = current.exposure;
  smoke.scale.y = SMOKE_BASE_SCALE.y * current.smokeLift;

  renderer.render(scene, camera);
});

// ---- resize ---------------------------------------------------------------

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  placeCup();
});
