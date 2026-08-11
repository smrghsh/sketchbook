// negative space — Voidsphere extracted from the 2021 Experience harness
// (webpack/three@0.126). An inverse starfield: clusters of tiny black
// wireframe cubes oriented outward from the origin, a solid black center
// sphere, and a red phong underlayer that only shows at grazing angles.
// White background + white fog swallow the far side of the cloud.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const params = {
  clusters: 1500,
  cubesMin: 5,
  cubesMax: 9,
  spin: 0.6,
  fogNear: 0,
  fogFar: 20,
};

// Scene — white on white, the fog does the vanishing
const scene = new THREE.Scene();
scene.background = new THREE.Color('white');
scene.fog = new THREE.Fog(new THREE.Color('white'), params.fogNear, params.fogFar);

const ambientLight = new THREE.AmbientLight('#ffffff', 2.0);
scene.add(ambientLight);

// shared geometry + materials
const sphereGeometry = new THREE.SphereGeometry(1, 32, 32);
const blackMaterial = new THREE.MeshBasicMaterial({ color: 'black' });
const wireframeMaterial = new THREE.MeshBasicMaterial({ color: 'black', wireframe: true });
const cubeGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
const phongMaterial = new THREE.MeshPhongMaterial({
  color: 0xff0000,
  polygonOffset: true,
  polygonOffsetFactor: 1, // positive value pushes polygon further away
  polygonOffsetUnits: 1,
});

const minRadius = 2;
const maxRadius = 20;

let group = null;

function build() {
  if (group) scene.remove(group);
  group = new THREE.Group();

  // the solid void at the center
  group.add(new THREE.Mesh(sphereGeometry, blackMaterial));

  const clusterQty = () =>
    params.cubesMin + Math.random() * Math.max(0, params.cubesMax - params.cubesMin);

  for (let i = 0; i < params.clusters; i++) {
    const g = new THREE.Group();
    for (let j = 0; j < clusterQty(); j++) {
      const cube = new THREE.Mesh(cubeGeometry, wireframeMaterial);
      const cube2 = new THREE.Mesh(cubeGeometry, phongMaterial);
      const p = new THREE.Vector3(Math.random() / 4, Math.random() / 4, Math.random() / 4);

      cube.position.copy(p);
      cube2.position.copy(p);

      g.add(cube);
      g.add(cube2);
    }
    g.position.x = (maxRadius - minRadius) * Math.random() - (maxRadius - minRadius) * 0.5;
    g.position.y = (maxRadius - minRadius) * Math.random() - (maxRadius - minRadius) * 0.5;
    g.position.z = (maxRadius - minRadius) * Math.random() - (maxRadius - minRadius) * 0.5;

    // orient each cluster outward from the origin
    const p = new THREE.Vector3(g.position.x, g.position.y, g.position.z);
    g.rotation.x += Math.atan(p.z / p.y);
    g.rotation.z += Math.atan(p.x / p.y);
    group.add(g);
  }
  scene.add(group);
}
build();

/**
 * Camera
 */
const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.1, 100);
camera.position.set(10, 10, 3);
scene.add(camera);

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
});

// UI — cluster rebuilds are debounced (they move ~20k meshes)
let rebuildTimer = null;
function queueBuild() {
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(build, 250);
}
const fmt0 = (v) => v.toFixed(0);
Standard.bind(params, 'clusters', fmt0, (v) => {
  params.clusters = v;
  queueBuild();
});
Standard.bind(params, 'cubesMin', fmt0, (v) => {
  params.cubesMin = v;
  queueBuild();
});
Standard.bind(params, 'cubesMax', fmt0, (v) => {
  params.cubesMax = v;
  queueBuild();
});
Standard.bind(params, 'spin', (v) => v.toFixed(2), (v) => (params.spin = v));
Standard.bind(params, 'fogNear', fmt0, (v) => (scene.fog.near = params.fogNear = v));
Standard.bind(params, 'fogFar', fmt0, (v) => (scene.fog.far = params.fogFar = v));
document.getElementById('rescatter').addEventListener('click', build);

/**
 * Animate
 */
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const delta = clock.getDelta();
  group.rotation.x += delta * params.spin;
  controls.update();
  renderer.render(scene, camera);
});
