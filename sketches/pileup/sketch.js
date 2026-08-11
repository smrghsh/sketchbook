// pileup — cube physics pile up. 2021 webpack + cannon piece ported to
// plain three.js modules with cannon-es. Cubes rain from above and heap
// on a foggy white stage; oldest cubes are recycled so it runs forever.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as CANNON from 'cannon-es';

const params = {};
const MAX_BODIES = 1200;

const scene = new THREE.Scene();
scene.background = new THREE.Color('white');
scene.fog = new THREE.Fog(0xffffff, 0.1, 20);

scene.add(new THREE.AmbientLight(0xffffff, 0.85));
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.set(1024, 1024);
directionalLight.shadow.camera.far = 25;
directionalLight.shadow.camera.left = -12;
directionalLight.shadow.camera.top = 12;
directionalLight.shadow.camera.right = 12;
directionalLight.shadow.camera.bottom = -12;
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

// physics
const world = new CANNON.World();
world.broadphase = new CANNON.SAPBroadphase(world);
world.allowSleep = true;
world.gravity.set(0, -9.82, 0);

const defaultMaterial = new CANNON.Material('default');
const defaultContactMaterial = new CANNON.ContactMaterial(
  defaultMaterial,
  defaultMaterial,
  { friction: 0.1, restitution: 0.7 }
);
world.addContactMaterial(defaultContactMaterial);
world.defaultContactMaterial = defaultContactMaterial;

const floorBody = new CANNON.Body({ mass: 0, material: defaultMaterial });
floorBody.addShape(new CANNON.Plane());
floorBody.quaternion.setFromAxisAngle(new CANNON.Vec3(-1, 0, 0), Math.PI / 2);
world.addBody(floorBody);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(100, 100),
  new THREE.MeshStandardMaterial({
    color: new THREE.Color(),
    metalness: 0.3,
    roughness: 0.4,
    transparent: true,
    opacity: 0.3,
  })
);
floor.receiveShadow = true;
floor.rotation.x = -Math.PI * 0.5;
scene.add(floor);

const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
const objectsToUpdate = [];

const createBox = (size, position, color) => {
  const mesh = new THREE.Mesh(
    boxGeometry,
    new THREE.MeshToonMaterial({ color })
  );
  mesh.scale.set(size, size, size);
  mesh.castShadow = true;
  mesh.position.copy(position);
  scene.add(mesh);

  const half = size / 2;
  const body = new CANNON.Body({
    mass: 15,
    position: new CANNON.Vec3(position.x, position.y, position.z),
    shape: new CANNON.Box(new CANNON.Vec3(half, half, half)),
    material: defaultMaterial,
  });
  world.addBody(body);
  objectsToUpdate.push({ mesh, body });

  // recycle the oldest cubes so the heap can grow forever
  while (objectsToUpdate.length > MAX_BODIES) {
    const oldest = objectsToUpdate.shift();
    world.removeBody(oldest.body);
    scene.remove(oldest.mesh);
    oldest.mesh.material.dispose();
  }
};

const removeAll = () => {
  for (const o of objectsToUpdate) {
    world.removeBody(o.body);
    scene.remove(o.mesh);
    o.mesh.material.dispose();
  }
  objectsToUpdate.length = 0;
};

const camera = new THREE.PerspectiveCamera(
  75,
  innerWidth / innerHeight,
  0.1,
  100
);
camera.position.set(14, 8, 14);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 4, 0);

const controlsEl = document.getElementById('controls');
const pauseButton = document.getElementById('pause');
const resetButton = document.getElementById('reset');
Standard.param(controlsEl, params, {
  id: 'rate',
  label: 'spawn rate',
  min: 0,
  max: 240,
  step: 5,
  value: 60,
  fmt: (v) => v + '/s',
});
Standard.param(controlsEl, params, {
  id: 'size',
  label: 'cube size',
  min: 0.05,
  max: 0.6,
  step: 0.05,
  value: 0.2,
  fmt: (v) => v.toFixed(2),
});
// keep the buttons after the sliders
controlsEl.appendChild(pauseButton);
controlsEl.appendChild(resetButton);

let paused = false;
pauseButton.addEventListener('click', () => {
  paused = !paused;
  pauseButton.textContent = paused ? 'resume ✦' : 'pause ✦';
});
resetButton.addEventListener('click', removeAll);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const clock = new THREE.Clock();
let spawnDebt = 0;

renderer.setAnimationLoop(() => {
  const deltaTime = Math.min(clock.getDelta(), 0.1);

  if (!paused) {
    spawnDebt += deltaTime * params.rate;
    while (spawnDebt >= 1) {
      spawnDebt -= 1;
      createBox(
        params.size,
        { x: Math.random() * 10, y: 15, z: Math.random() * 10 },
        new THREE.Color(Math.random(), Math.random() / 2, 20)
      );
    }
    world.step(1 / 60, deltaTime, 3);
    for (const object of objectsToUpdate) {
      object.mesh.position.copy(object.body.position);
      object.mesh.quaternion.copy(object.body.quaternion);
    }
  }

  controls.update();
  renderer.render(scene, camera);
});
