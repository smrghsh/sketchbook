// growth structure — ported from the 2021 webpack/three@0.126 original.
// Spheres spawn inside staged height/radius envelopes and snap to touch the
// nearest existing sphere (trunk -> stageA -> stageB -> stageC). When fully
// grown the tree un-grows a few spheres per frame, then reseeds and loops.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const params = { density: 1, size: 0.1, ungrow: 30, orbit: 1 };

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color('black');

// Light
const light = new THREE.AmbientLight(0xffffff);
scene.add(light);
scene.fog = new THREE.Fog('black', 0.01, 70);
const hemisphereLight = new THREE.HemisphereLight(0xff0000, 0x0000ff, 0.8);
scene.add(hemisphereLight);

function brand() {
  return 2 * (Math.random() - 0.5);
}

// growth parameters
const stages = [
  {
    name: 'trunk',
    sizeDistribution: [0.9, 1.3],
    minHeight: 0,
    maxHeight: 11,
    minRadius: 0,
    maxRadius: 0.8,
    count: 10,
  },
  {
    name: 'stageA',
    sizeDistribution: [0.4, 0.8],
    minHeight: 10,
    maxHeight: 15,
    minRadius: 0,
    maxRadius: 8,
    count: 400,
  },
  {
    name: 'stageB',
    sizeDistribution: [0.3, 0.7],
    minHeight: 12,
    maxHeight: 20,
    minRadius: 0,
    maxRadius: 9,
    count: 600,
  },
  {
    name: 'stageC',
    sizeDistribution: [0.1, 0.4],
    minHeight: 13,
    maxHeight: 20,
    minRadius: 0,
    maxRadius: 10,
    count: 1500,
  },
];

// random toon palette
const funMaterials = [];
for (let i = 0; i < 1000; i++) {
  funMaterials.push(new THREE.MeshToonMaterial({ color: Math.random() * 0xffffff }));
}

function map_range(value, low1, high1, low2, high2) {
  return low2 + ((high2 - low2) * (value - low1)) / (high1 - low1);
}

// geometries, materials go here
const segments = 8;
let sphereGeometry = new THREE.SphereGeometry(params.size, segments, segments);
const woodMaterial = new THREE.MeshToonMaterial({ color: 0xbf784e });

// wireframe floor
const floorGeometry = new THREE.PlaneGeometry(1, 1, 32, 32);
const floorMaterial = new THREE.MeshToonMaterial({
  color: 'white',
  wireframe: true,
  transparent: true,
  opacity: 0.3,
});
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
scene.add(floor);
floor.rotation.x += Math.PI / 2;
floor.scale.set(100, 100, 100);

let spheres = [];
let growing = true;
let sphereCounter = 0;
let stage = 0;

function addASphere(sizeDistribution, minHeight, maxHeight, minRadius, maxRadius) {
  const maxSize = params.size;
  const y = map_range(Math.random(), 0, 1, minHeight, maxHeight);
  const nInitPos = new THREE.Vector3(brand() * maxRadius, y, brand() * maxRadius);
  const nScale = map_range(Math.random(), 0, 1, sizeDistribution[0], sizeDistribution[1]);

  // get nearest sphere
  let nearestSphere = spheres[0];
  for (let i = 0; i < spheres.length; i++) {
    if (nInitPos.distanceTo(spheres[i].position) < nInitPos.distanceTo(nearestSphere.position)) {
      nearestSphere = spheres[i];
    }
  }
  const nPos = nInitPos
    .sub(nearestSphere.position)
    .normalize()
    .multiplyScalar(maxSize * nScale + maxSize * nearestSphere.scale.x);
  const funMaterial = funMaterials[Math.floor(Math.random() * funMaterials.length)];
  const nSphere = new THREE.Mesh(sphereGeometry, funMaterial);
  nSphere.scale.set(nScale, nScale, nScale);
  const temp = new THREE.Vector3().copy(nearestSphere.position);
  temp.add(nPos);
  nSphere.position.add(temp);
  spheres.push(nSphere);
  scene.add(nSphere);
}

// clear everything and plant the seed sphere again
function seed() {
  for (const s of spheres) scene.remove(s);
  spheres = [];
  sphereGeometry.dispose();
  sphereGeometry = new THREE.SphereGeometry(params.size, segments, segments);
  const initialSphere = new THREE.Mesh(sphereGeometry, woodMaterial);
  spheres.push(initialSphere);
  scene.add(initialSphere);
  growing = true;
  sphereCounter = 0;
  stage = 0;
}
seed();

/**
 * Camera
 */
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 100);
camera.position.set(20, 11, 20);
camera.lookAt(0, 11, 0);
scene.add(camera);

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// Controls — auto-orbit until the first drag, then hand over
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 11, 0);
let autoOrbit = true;
controls.addEventListener('start', () => {
  autoOrbit = false;
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
});

// UI
const fmt1 = (v) => v.toFixed(1);
Standard.bind(params, 'density', fmt1, (v) => {
  params.density = v;
  seed();
});
Standard.bind(params, 'size', (v) => v.toFixed(2), (v) => {
  params.size = v;
  seed();
});
Standard.bind(params, 'ungrow', (v) => v.toFixed(0), (v) => (params.ungrow = v));
Standard.bind(params, 'orbit', fmt1, (v) => (params.orbit = v));
document.getElementById('regrow').addEventListener('click', seed);

/**
 * Animate
 */
const clock = new THREE.Clock();
let orbitAngle = 0;

renderer.setAnimationLoop(() => {
  const delta = clock.getDelta();

  if (growing) {
    if (stage < stages.length) {
      for (let i = 0; i < 30; i++) {
        addASphere(
          stages[stage].sizeDistribution,
          stages[stage].minHeight,
          stages[stage].maxHeight,
          stages[stage].minRadius,
          stages[stage].maxRadius
        );
        sphereCounter++;
      }
      if (sphereCounter > stages[stage].count * params.density) {
        sphereCounter = 0;
        stage++;
      }
    } else {
      growing = false;
    }
  } else {
    for (let i = 0; i <= params.ungrow && spheres.length > 0; i++) {
      scene.remove(spheres.pop());
    }
    if (spheres.length < 10) {
      seed();
    }
  }

  if (autoOrbit) {
    orbitAngle += (delta * params.orbit) / 3;
    camera.position.set(Math.cos(orbitAngle) * 20, 11, Math.sin(orbitAngle) * 20);
    camera.lookAt(0, 11, 0);
  } else {
    controls.update();
  }

  renderer.render(scene, camera);
});
