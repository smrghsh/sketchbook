// lines orb — genuary 2025 day 1: "vertical or horizontal lines only".
// 8000 tiny axis-aligned segments (up, forward, or sideways from their
// anchor) packed into a cube-root-distributed sphere. Ported standalone
// from genuary2025 (src/Experience/World/Day1.js); the per-line meshes are
// merged into one LineSegments draw for the web.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const params = {
  lines: 8000,
  lineSize: 0.07,
  radius: 2,
};

// ---- scene ----------------------------------------------------------------

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x010104);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0, 1.2, 6.5);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// ---- orb ------------------------------------------------------------------

const material = new THREE.LineBasicMaterial({ color: 0x0000ff });
let orb = null;

function generateOrb() {
  if (orb) {
    orb.geometry.dispose();
    scene.remove(orb);
  }

  const s = params.lineSize;
  // each segment points along exactly one axis: vertical or horizontal only
  const offsets = [
    [0, s, 0],
    [0, 0, s],
    [s, 0, 0],
  ];

  const positions = new Float32Array(params.lines * 6);
  const anchor = new THREE.Vector3();
  for (let i = 0; i < params.lines; i++) {
    anchor.set(
      Math.random() * 2 - 1,
      Math.random() * 2 - 1,
      Math.random() * 2 - 1
    );
    anchor.normalize();
    // cube-root radius keeps density uniform through the volume
    anchor.multiplyScalar(Math.cbrt(Math.random()) * params.radius);

    const [ox, oy, oz] = offsets[Math.floor(Math.random() * offsets.length)];
    const j = i * 6;
    positions[j] = anchor.x;
    positions[j + 1] = anchor.y;
    positions[j + 2] = anchor.z;
    positions[j + 3] = anchor.x + ox;
    positions[j + 4] = anchor.y + oy;
    positions[j + 5] = anchor.z + oz;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const rotation = orb ? orb.rotation.y : 0;
  orb = new THREE.LineSegments(geometry, material);
  orb.rotation.y = rotation;
  scene.add(orb);
}
generateOrb();

// ---- chrome ---------------------------------------------------------------

const ui = {};
const paramsContainer = document.getElementById('params');

Standard.param(paramsContainer, ui, {
  id: 'lines',
  label: 'lines',
  min: 1000,
  max: 20000,
  step: 100,
  value: params.lines,
  fmt: (v) => String(v),
  apply: (v) => {
    params.lines = Math.round(v);
    generateOrb();
  },
});

Standard.param(paramsContainer, ui, {
  id: 'line-size',
  label: 'line size',
  min: 0.01,
  max: 0.3,
  step: 0.005,
  value: params.lineSize,
  fmt: (v) => v.toFixed(3),
  apply: (v) => {
    params.lineSize = v;
    generateOrb();
  },
});

Standard.param(paramsContainer, ui, {
  id: 'radius',
  label: 'orb radius',
  min: 0.5,
  max: 4,
  step: 0.05,
  value: params.radius,
  fmt: (v) => v.toFixed(2),
  apply: (v) => {
    params.radius = v;
    generateOrb();
  },
});

// ---- loop -----------------------------------------------------------------

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  orb.rotation.y += dt * 0.25; // slow auto-rotate
  controls.update();
  renderer.render(scene, camera);
});

// ---- resize ---------------------------------------------------------------

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
