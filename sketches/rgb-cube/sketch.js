// rgb cube — the color cube made physical. 2021 webpack piece ported to
// plain three.js modules; ~18k+ meshes replaced with one InstancedMesh
// carrying per-instance color. Camera circles the lattice until dragged.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const params = {};

// original lattice ranges
const R_MAX = 700;
const G_MAX = 255;
const B_MAX = 700;
const CENTER = new THREE.Vector3(R_MAX / 2, G_MAX / 2, B_MAX / 2);

const scene = new THREE.Scene();

const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshBasicMaterial();
let lattice = null;

function buildLattice() {
  if (lattice) {
    scene.remove(lattice);
    lattice.dispose();
  }
  const step = params.step;
  let count = 0;
  for (let r = 0; r < R_MAX; r += step)
    for (let g = 0; g < G_MAX; g += step)
      for (let b = 0; b < B_MAX; b += step) count++;

  lattice = new THREE.InstancedMesh(boxGeometry, material, count);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  let i = 0;
  for (let r = 0; r < R_MAX; r += step) {
    for (let g = 0; g < G_MAX; g += step) {
      for (let b = 0; b < B_MAX; b += step) {
        dummy.position.set(r, g, b);
        dummy.updateMatrix();
        lattice.setMatrixAt(i, dummy.matrix);
        color.setRGB(
          Math.min(r / 255, 1),
          Math.min(g / 255, 1),
          Math.min(b / 255, 1)
        );
        lattice.setColorAt(i, color);
        i++;
      }
    }
  }
  lattice.instanceMatrix.needsUpdate = true;
  lattice.instanceColor.needsUpdate = true;
  scene.add(lattice);
}

const camera = new THREE.PerspectiveCamera(
  75,
  innerWidth / innerHeight,
  1,
  4000
);
camera.position.set(CENTER.x + 350, CENTER.y, CENTER.z + 350);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x000000);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.copy(CENTER);

// auto-orbit on the original sin/cos path until the first drag
let autoOrbit = true;
controls.addEventListener('start', () => {
  autoOrbit = false;
});

const controlsEl = document.getElementById('controls');
Standard.param(controlsEl, params, {
  id: 'step',
  label: 'lattice step',
  min: 8,
  max: 40,
  step: 1,
  value: 10,
  fmt: (v) => String(v),
  apply: (v) => {
    params.step = v;
    buildLattice();
  },
});
Standard.param(controlsEl, params, {
  id: 'speed',
  label: 'orbit speed',
  min: 0,
  max: 4,
  step: 0.05,
  value: 1,
  fmt: (v) => v.toFixed(2),
});

buildLattice();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const clock = new THREE.Clock();
let angle = 0;

renderer.setAnimationLoop(() => {
  const delta = clock.getDelta();
  if (autoOrbit) {
    angle += delta * 0.5 * params.speed;
    camera.position.set(
      CENTER.x + Math.sin(angle) * 350,
      CENTER.y,
      CENTER.z + Math.cos(angle) * 350
    );
    camera.lookAt(CENTER);
  } else {
    controls.update();
  }
  renderer.render(scene, camera);
});
