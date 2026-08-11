import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const DT = 0.005;
const NUM_POINTS = 5000;
const MAX_BUTTERFLIES = 300;
const STEP = 16;

// mutable lorenz parameters (σ, ρ, β)
let sigma = 10;
let rho = 28;
let beta = 8 / 3;

function lorenzDeriv(x, y, z) {
  return [
    sigma * (y - x),
    x * (rho - z) - y,
    x * y - beta * z,
  ];
}

function computeLorenzPoints() {
  const pts = [];
  let x = 0.1, y = 0, z = 0;
  // warm up past the initial transient so the loop of points lies on the
  // attractor itself (butterflies then cover both lobes from frame one,
  // instead of bunching on the slow spiral out of the origin)
  const WARMUP = 2000;
  for (let i = 0; i < WARMUP + NUM_POINTS; i++) {
    // map lorenz (x, y, z) → three (x, z, y) so the classic two-lobed
    // butterfly plane (lorenz x–z) faces the default camera
    if (i >= WARMUP) pts.push(new THREE.Vector3(x, z, y));
    const [k1x, k1y, k1z] = lorenzDeriv(x, y, z);
    const [k2x, k2y, k2z] = lorenzDeriv(x + 0.5 * DT * k1x, y + 0.5 * DT * k1y, z + 0.5 * DT * k1z);
    const [k3x, k3y, k3z] = lorenzDeriv(x + 0.5 * DT * k2x, y + 0.5 * DT * k2y, z + 0.5 * DT * k2z);
    const [k4x, k4y, k4z] = lorenzDeriv(x + DT * k3x, y + DT * k3y, z + DT * k3z);
    x += (DT / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
    y += (DT / 6) * (k1y + 2 * k2y + 2 * k3y + k4y);
    z += (DT / 6) * (k1z + 2 * k2z + 2 * k3z + k4z);
  }

  // center the attractor on the origin, then normalize its size so the
  // camera framing holds for any (σ, ρ, β)
  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  for (const p of pts) {
    min.min(p);
    max.max(p);
  }
  const center = min.clone().add(max).multiplyScalar(0.5);
  let maxAbs = 0;
  for (const p of pts) {
    p.sub(center);
    maxAbs = Math.max(maxAbs, Math.abs(p.x), Math.abs(p.y), Math.abs(p.z));
  }
  const scale = 15 / (maxAbs || 1);
  for (const p of pts) p.multiplyScalar(scale);
  return pts;
}

const vertexShader = `
#define PI 3.14159265
uniform float uTime;
attribute float displacement;
varying float vDisplacement;

float rand(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
    vDisplacement = displacement;
    vec3 p = position;
    p.z += 1.4 * abs(p.x) * sin(uTime * 80.0 * (1.0 + 0.3 * rand(vec2(displacement, 0.0))) - displacement * 0.5);
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(p, 1.0);
}
`;

const fragmentShader = `
varying float vDisplacement;
uniform float uTime;
uniform vec3 palA;
uniform vec3 palB;
uniform vec3 palC;
uniform vec3 palD;

vec3 pal(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
    return a + b * cos(6.28318 * (c * t + d));
}

void main() {
    float t = vDisplacement * 0.003 + uTime * 0.05;
    vec3 col = pal(t, palA, palB, palC, palD);
    gl_FragColor = vec4(col, 0.9);
}
`;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 4, 30);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.4;

scene.add(new THREE.AmbientLight(0xffffff, 0.5));

let points = computeLorenzPoints();

const material = new THREE.ShaderMaterial({
  vertexShader,
  fragmentShader,
  uniforms: {
    uTime: { value: 0 },
    palA: { value: new THREE.Vector3(0.5, 0.5, 0.5) },
    palB: { value: new THREE.Vector3(0.5, 0.5, 0.5) },
    palC: { value: new THREE.Vector3(1.0, 1.0, 1.0) },
    palD: { value: new THREE.Vector3(0.0, 0.33, 0.67) },
  },
  transparent: true,
  side: THREE.DoubleSide,
  depthWrite: false,
});

const butterflies = [];
const FORWARD = new THREE.Vector3(0, 0, 1);

for (let i = 0; i < MAX_BUTTERFLIES; i++) {
  const geom = new THREE.PlaneGeometry(1, 1, 2, 1);
  const count = geom.attributes.position.count;
  const disps = new Float32Array(count);
  for (let v = 0; v < count; v++) disps[v] = i;
  geom.setAttribute('displacement', new THREE.BufferAttribute(disps, 1));

  const mesh = new THREE.Mesh(geom, material);
  mesh.scale.setScalar(0.5);

  const idx = (i * STEP) % NUM_POINTS;
  butterflies.push({ mesh, idx });
  scene.add(mesh);
}

const tangentTmp = new THREE.Vector3();
const quatTmp = new THREE.Quaternion();

function updateButterfly(b) {
  const curr = points[b.idx];
  const next = points[(b.idx + 1) % NUM_POINTS];
  tangentTmp.subVectors(next, curr).normalize();
  quatTmp.setFromUnitVectors(FORWARD, tangentTmp);
  b.mesh.position.copy(curr);
  b.mesh.quaternion.copy(quatTmp);
}

for (const b of butterflies) updateButterfly(b);

let uTime = 0;

// ── the-standard chrome ──
const params = {};
const paramsEl = document.getElementById('params');

Standard.param(paramsEl, params, {
  id: 'butterflies', label: 'butterflies',
  min: 10, max: MAX_BUTTERFLIES, step: 1, value: MAX_BUTTERFLIES,
  fmt: (v) => v.toFixed(0),
  apply: (v) => {
    params.butterflies = v;
    for (let i = 0; i < MAX_BUTTERFLIES; i++) {
      butterflies[i].mesh.visible = i < v;
    }
  },
});

Standard.param(paramsEl, params, {
  id: 'speed', label: 'flutter speed',
  min: 0.1, max: 3, step: 0.05, value: 1,
  fmt: (v) => v.toFixed(2),
  apply: (v) => (params.speed = v),
});

function regenerate() {
  points = computeLorenzPoints();
  for (const b of butterflies) updateButterfly(b);
}

Standard.param(paramsEl, params, {
  id: 'sigma', label: 'sigma σ',
  min: 1, max: 20, step: 0.1, value: 10,
  fmt: (v) => v.toFixed(1),
  apply: (v) => { sigma = v; regenerate(); },
});

Standard.param(paramsEl, params, {
  id: 'rho', label: 'rho ρ',
  min: 5, max: 50, step: 0.5, value: 28,
  fmt: (v) => v.toFixed(1),
  apply: (v) => { rho = v; regenerate(); },
});

Standard.param(paramsEl, params, {
  id: 'beta', label: 'beta β',
  min: 0.5, max: 5, step: 0.01, value: 2.67,
  fmt: (v) => v.toFixed(2),
  apply: (v) => { beta = v; regenerate(); },
});

// palette presets using IQ palette params [a, b, c, d]
const PALETTES = {
  rainbow: [[0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [1.0, 1.0, 1.0], [0.0, 0.33, 0.67]],
  fire:    [[0.5, 0.2, 0.1], [0.5, 0.4, 0.1], [1.0, 1.0, 0.5], [0.0, 0.1, 0.2]],
  ice:     [[0.4, 0.6, 0.8], [0.2, 0.3, 0.3], [1.0, 1.0, 1.0], [0.0, 0.1, 0.5]],
  gold:    [[0.5, 0.4, 0.1], [0.5, 0.4, 0.1], [1.0, 0.8, 0.3], [0.0, 0.1, 0.3]],
  void:    [[0.1, 0.0, 0.2], [0.4, 0.1, 0.5], [1.0, 0.5, 1.0], [0.0, 0.2, 0.5]],
};

document.getElementById('sel-palette').addEventListener('change', (e) => {
  const p = PALETTES[e.target.value];
  if (!p) return;
  const u = material.uniforms;
  u.palA.value.set(...p[0]);
  u.palB.value.set(...p[1]);
  u.palC.value.set(...p[2]);
  u.palD.value.set(...p[3]);
});

document.getElementById('btn-autorotate').addEventListener('click', (e) => {
  controls.autoRotate = !controls.autoRotate;
  e.currentTarget.classList.toggle('active', controls.autoRotate);
});

// ── loop ──
function animate() {
  requestAnimationFrame(animate);
  uTime += 0.005 * params.speed;
  material.uniforms.uTime.value = uTime;

  for (const b of butterflies) {
    b.idx = (b.idx + 1) % NUM_POINTS;
    updateButterfly(b);
  }

  controls.update();
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
