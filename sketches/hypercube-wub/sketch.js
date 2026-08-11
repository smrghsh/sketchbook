/* hypercube wub — c. 2023, from shapesXR-viewer-template / limbo
   (src/Experience/World/Hypercube.js, with Circles.js as second mode).
   Ninety nested wireframe cubes of increasing radius, random colors;
   wub() pulses each cube's x/y/z scale by cos(r·π/maxSize + t) so the
   nest breathes. It was commented out of every scene it lived in —
   here it finally gets its own. */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const params = {
  mode: 'cubes',
  shells: 90,
  wubSpeed: 1,
  maxSize: 1,
};

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.01, 100);
camera.position.set(2, 1.4, 3);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x050508);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.5;

let group = null;

function disposeGroup() {
  if (!group) return;
  group.traverse((child) => {
    if (child.isMesh) {
      child.geometry.dispose();
      child.material.dispose();
    }
  });
  scene.remove(group);
  group = null;
}

function build() {
  disposeGroup();
  group = new THREE.Group();
  if (params.mode === 'cubes') {
    // nested cubes, minSize 0.1 → maxSize
    const minSize = 0.1 * params.maxSize;
    const maxSize = params.maxSize;
    const spacing = (maxSize - minSize) / params.shells;
    for (let r = minSize; r < maxSize; r += spacing) {
      const cubeGeometry = new THREE.BoxGeometry(r, r, r);
      const material = new THREE.MeshBasicMaterial({
        color: Math.random() * 0xffffff,
        wireframe: true,
      });
      const cube = new THREE.Mesh(cubeGeometry, material);
      cube.r = r;
      group.add(cube);
    }
  } else {
    // concentric circles — the original ran 0.3 → 3; scaled down uniformly
    // (×1/3) so the disc shares the cube nest's footprint and camera
    const minRadius = 0.1 * params.maxSize;
    const maxRadius = params.maxSize;
    const spacing = (maxRadius - minRadius) / params.shells;
    for (let radius = minRadius; radius < maxRadius; radius += spacing) {
      const circleGeometry = new THREE.CircleGeometry(radius, 100);
      const material = new THREE.MeshBasicMaterial({
        color: Math.random() * 0xffffff,
        wireframe: true,
      });
      const circle = new THREE.Mesh(circleGeometry, material);
      circle.radius = radius;
      group.add(circle);
    }
  }
  scene.add(group);
}
build();

// wub() — the original only pulses the inner half of the nest, and the
// cosine swings negative, folding cubes through themselves. Keep it.
function wub(t) {
  const max = params.maxSize;
  group.traverse((child) => {
    if (child.isMesh && child.r !== undefined) {
      if (child.r < max / 2) {
        const s = Math.cos(child.r * (Math.PI / max) + t);
        child.scale.set(s, s, s);
      }
    }
  });
}

function undulate(t) {
  const maxRadius = params.maxSize;
  const amplitude = params.maxSize / 3; // original: amplitude 1 at radius 3
  group.traverse((child) => {
    if (child.isMesh && child.radius !== undefined) {
      child.position.z = amplitude * Math.sin(child.radius * (Math.PI / maxRadius) + t);
    }
  });
}

/* controls ---------------------------------------------------------- */

document.getElementById('mode').addEventListener('change', (e) => {
  params.mode = e.target.value;
  build();
});
Standard.bind(params, 'shells', (v) => v.toFixed(0), (v) => {
  params.shells = Math.round(v);
  build();
});
Standard.bind(params, 'wubSpeed', (v) => v.toFixed(2), (v) => {
  params.wubSpeed = v;
});
Standard.bind(params, 'maxSize', (v) => v.toFixed(1), (v) => {
  params.maxSize = v;
  build();
});
document.getElementById('regenerate').addEventListener('click', build);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

/* loop -------------------------------------------------------------- */

const clock = new THREE.Clock();
let wubT = 0;
renderer.setAnimationLoop(() => {
  wubT += Math.min(clock.getDelta(), 0.1) * params.wubSpeed;
  if (params.mode === 'cubes') wub(wubT);
  else undulate(wubT);
  controls.update();
  renderer.render(scene, camera);
});
