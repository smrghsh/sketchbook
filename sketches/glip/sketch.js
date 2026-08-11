// glip — ported from demo/5-25-23 (webpack scaffold, src/World/Glip.js)
// A 3D lattice of yellow wireframe boxes fills a cube at 0.1 spacing;
// every frame each box's y-scale = amp·sin(x + t/2) + amp·sin(z + t/2) —
// two sine fields crossing through the lattice. The ~8000 meshes of the
// original are an InstancedMesh here; the wireframe look is unchanged.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const params = {
  amplitude: 3,
  speed: 1,
  extent: 1,
};

const SPACING = 0.1;
const BOX_SIZE = 0.1;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a12);

const camera = new THREE.PerspectiveCamera(
  35,
  innerWidth / innerHeight,
  0.1,
  100
);
camera.position.set(-4.6, 2.8, -4.6);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// ---------------------------------------------------------------- lattice
const geometry = new THREE.BoxGeometry(BOX_SIZE, BOX_SIZE, BOX_SIZE);
const material = new THREE.MeshBasicMaterial({
  color: 'yellow',
  wireframe: true,
});

let lattice = null;
let positions = [];

function buildLattice() {
  if (lattice) {
    scene.remove(lattice);
    lattice.dispose();
  }
  positions = [];
  const e = params.extent;
  for (let x = -e; x < e; x += SPACING) {
    for (let y = -e; y < e; y += SPACING) {
      for (let z = -e; z < e; z += SPACING) {
        positions.push(x, y, z);
      }
    }
  }
  const count = positions.length / 3;
  lattice = new THREE.InstancedMesh(geometry, material, count);
  lattice.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(lattice);
}
buildLattice();

// ---------------------------------------------------------------- chrome
const controlsEl = document.getElementById('controls');
Standard.param(controlsEl, params, {
  id: 'amplitude',
  label: 'amplitude',
  min: 0,
  max: 6,
  step: 0.1,
  value: params.amplitude,
  fmt: (v) => v.toFixed(1),
});
Standard.param(controlsEl, params, {
  id: 'speed',
  label: 'speed',
  min: 0,
  max: 3,
  step: 0.05,
  value: params.speed,
  fmt: (v) => v.toFixed(2),
});
Standard.param(controlsEl, params, {
  id: 'extent',
  label: 'lattice size',
  min: 0.4,
  max: 1.4,
  step: 0.1,
  value: params.extent,
  fmt: (v) => v.toFixed(1),
  apply: (v) => {
    params.extent = v;
    buildLattice();
  },
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------------------------------------------------------------- loop
const matrix = new THREE.Matrix4();
const position = new THREE.Vector3();
const quaternion = new THREE.Quaternion();
const scale = new THREE.Vector3(1, 1, 1);
const clock = new THREE.Clock();
let t = 0;

renderer.setAnimationLoop(() => {
  t += clock.getDelta() * params.speed;
  const amp = params.amplitude;
  const count = positions.length / 3;
  for (let i = 0; i < count; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    position.set(x, y, z);
    scale.y =
      amp * Math.sin(x + t / 2) + amp * Math.sin(z + t / 2) || 0.0001;
    matrix.compose(position, quaternion, scale);
    lattice.setMatrixAt(i, matrix);
  }
  lattice.instanceMatrix.needsUpdate = true;
  controls.update();
  renderer.render(scene, camera);
});
