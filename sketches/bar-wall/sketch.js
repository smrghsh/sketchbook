// bar wall — 2021 webpack piece ported to plain three.js modules.
// A grid of toon bars, heights ramped by a quintic ease + jitter,
// breathing by sampling 3D simplex noise along a circle (seamless loop).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const params = {};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xfff8e7);

scene.add(new THREE.AmbientLight(0x404040, 1));
const hemisphereLight = new THREE.HemisphereLight(0xff0000, 0x0000ff, 0.9);
scene.add(hemisphereLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.4);
scene.add(directionalLight);

const colorA = new THREE.Color(0x09c8d6);
const colorB = new THREE.Color(0xfa0fd2);
const pipGeometry = new THREE.BoxGeometry(1, 1, 1);

let pips = [];

function buildGrid() {
  for (const p of pips) {
    scene.remove(p);
    p.material.dispose();
  }
  pips = [];
  const n = params.grid;
  // one material per row — color depends only on the row index
  const rowMaterials = [];
  for (let i = 0; i < n; i++) {
    const c = new THREE.Color().lerpColors(
      colorA,
      colorB,
      THREE.MathUtils.mapLinear(i, 0, n, 0, 1)
    );
    rowMaterials.push(new THREE.MeshToonMaterial({ color: c }));
  }
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const p = new THREE.Mesh(pipGeometry, rowMaterials[i]);
      p.position.x = i;
      p.position.z = j;
      p.userData.ramp = THREE.MathUtils.mapLinear(i, 0, n, 0, 1);
      p.userData.jitter = Math.random() / 2;
      pips.push(p);
      scene.add(p);
    }
  }
  applyHeights();
  directionalLight.position.set(n / 2, 10, n / 2);
  controls.target.set(n / 2, 2, n / 2);
}

function applyHeights() {
  for (const p of pips) {
    const h =
      THREE.MathUtils.mapLinear(p.userData.ramp ** params.easing, 0, 1, 0, 20) +
      p.userData.jitter;
    p.userData.originalHeight = h;
  }
}

const camera = new THREE.PerspectiveCamera(
  20,
  innerWidth / innerHeight,
  0.1,
  400
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const controlsEl = document.getElementById('controls');
Standard.param(controlsEl, params, {
  id: 'grid',
  label: 'grid size',
  min: 10,
  max: 70,
  step: 5,
  value: 50,
  fmt: (v) => `${v}×${v}`,
  apply: (v) => {
    params.grid = v;
    buildGrid();
  },
});
Standard.param(controlsEl, params, {
  id: 'period',
  label: 'loop period',
  min: 5,
  max: 120,
  step: 1,
  value: 40,
  fmt: (v) => v + 's',
});
Standard.param(controlsEl, params, {
  id: 'easing',
  label: 'height easing',
  min: 1,
  max: 8,
  step: 0.25,
  value: 5,
  fmt: (v) => v.toFixed(2),
  apply: (v) => {
    params.easing = v;
    applyHeights();
  },
});

buildGrid();
camera.position.set(0, 4, params.grid / 2);
camera.lookAt(new THREE.Vector3(params.grid, 0, params.grid / 2));

noise.seed(Math.random());

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const clock = new THREE.Clock();
let phase = 0;

renderer.setAnimationLoop(() => {
  const delta = clock.getDelta();
  phase = (phase + delta / params.period) % 1; // 0..1, seamless
  const angle = phase * 2 * Math.PI;
  const noiseCircleX = 2 * Math.cos(angle);
  const noiseCircleY = 2 * Math.sin(angle);
  const n = params.grid;
  pips.forEach((p, i) => {
    const placeInRow = i % n;
    let s = noise.simplex3(
      THREE.MathUtils.mapLinear(placeInRow, 0, n, 0, 2),
      noiseCircleX,
      noiseCircleY
    );
    s += 1;
    const height = s / 2 + p.userData.originalHeight;
    p.scale.y = height;
    p.position.y = height / 2;
  });
  controls.update();
  renderer.render(scene, camera);
});
